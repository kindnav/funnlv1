import os
import re
import json
import uuid
import asyncio
import logging
import secrets
import base64
from datetime import datetime, timezone, timedelta
from pathlib import Path
from email.utils import parsedate_to_datetime
from typing import Optional

import httpx
import jwt as pyjwt
import anthropic
from fastapi import FastAPI, APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from googleapiclient.discovery import build as gbuild
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from google_auth_oauthlib.flow import Flow
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Allow HTTP redirect URIs (needed for internal k8s routing)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ── Config ─────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_KEY']
SUPABASE_PROJECT_REF = SUPABASE_URL.split('//')[1].split('.')[0]
ANTHROPIC_API_KEY = os.environ['ANTHROPIC_API_KEY']
GOOGLE_CLIENT_ID = os.environ['GOOGLE_CLIENT_ID']
GOOGLE_CLIENT_SECRET = os.environ['GOOGLE_CLIENT_SECRET']
GOOGLE_REDIRECT_URI = os.environ['GOOGLE_REDIRECT_URI']
JWT_SECRET = os.environ.get('JWT_SECRET', 'vc-dealflow-jwt-2026')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://vc-pipeline-1.preview.emergentagent.com')

SB_HEADERS = {
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'apikey': SUPABASE_KEY,
    'Content-Type': 'application/json',
}

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Fund settings (per-user, file-backed) ──────────────────────────────────────
SETTINGS_FILE = ROOT_DIR / 'fund_settings.json'
_fund_settings: dict = {}

def _load_fund_settings():
    global _fund_settings
    if SETTINGS_FILE.exists():
        try:
            _fund_settings = json.loads(SETTINGS_FILE.read_text())
        except Exception:
            _fund_settings = {}

def get_fund_settings(user_id: str) -> dict:
    return _fund_settings.get(user_id, {})

def save_fund_settings(user_id: str, data: dict):
    _fund_settings[user_id] = data
    try:
        SETTINGS_FILE.write_text(json.dumps(_fund_settings, indent=2))
    except Exception as e:
        logger.error(f'Failed to save fund settings: {e}')

_load_fund_settings()

app = FastAPI(title="VC Deal Flow API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)
scheduler = AsyncIOScheduler()
claude_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

# In-memory OAuth state store (single-process is fine)
# Stores {state: {'flow': Flow, 'created_at': datetime}}
oauth_states: dict[str, dict] = {}

# ── Supabase helpers ────────────────────────────────────────────────────────────
async def sb_select(table: str, params: dict = None) -> list:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f'{SUPABASE_URL}/rest/v1/{table}',
            headers=SB_HEADERS, params=params or {}
        )
        if resp.status_code in (200, 206):
            return resp.json()
        logger.error(f'sb_select {table}: {resp.status_code} {resp.text[:300]}')
        return []

async def sb_insert(table: str, data) -> Optional[dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f'{SUPABASE_URL}/rest/v1/{table}',
            headers={**SB_HEADERS, 'Prefer': 'return=representation'},
            json=data
        )
        if resp.status_code in (200, 201):
            result = resp.json()
            return result[0] if isinstance(result, list) and result else result
        logger.error(f'sb_insert {table}: {resp.status_code} {resp.text[:300]}')
        return None

async def sb_update(table: str, data: dict, params: dict) -> bool:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.patch(
            f'{SUPABASE_URL}/rest/v1/{table}',
            headers={**SB_HEADERS, 'Prefer': 'return=minimal'},
            params=params, json=data
        )
        return resp.status_code in (200, 204)

async def sb_table_exists(table: str) -> bool:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f'{SUPABASE_URL}/rest/v1/{table}',
            headers=SB_HEADERS, params={'limit': '0'}
        )
        return resp.status_code in (200, 206)

# ── Database init ───────────────────────────────────────────────────────────────
MIGRATION_SQL = """
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  picture TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  last_synced TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  thread_id TEXT,
  message_id TEXT,
  received_date TIMESTAMPTZ,
  sender_name TEXT,
  sender_email TEXT,
  subject TEXT,
  body_preview TEXT,
  gmail_thread_link TEXT,
  company_name TEXT,
  founder_name TEXT,
  founder_role TEXT,
  category TEXT,
  warm_or_cold TEXT,
  sector TEXT,
  stage TEXT,
  check_size_requested TEXT,
  geography TEXT,
  deck_attached BOOLEAN DEFAULT FALSE,
  traction_mentioned BOOLEAN DEFAULT FALSE,
  intro_source TEXT,
  summary TEXT,
  relevance_score INTEGER,
  urgency_score INTEGER,
  next_action TEXT,
  confidence TEXT,
  tags TEXT[],
  status TEXT DEFAULT 'New',
  notes TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, thread_id)
);
"""

SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"
SYSTEM_USER = {
    "id": SYSTEM_USER_ID,
    "google_id": "system_ff_sample_user",
    "email": "system@futurefrontiercapital.vc",
    "name": "FF System",
    "picture": None,
    "access_token": None,
    "refresh_token": None,
    "token_expiry": None,
    "last_synced": None,
    "created_at": "2025-01-01T00:00:00+00:00",
}

SAMPLE_DEALS = [
    {
        "id": "00000000-0000-0000-0001-000000000001",
        "user_id": SYSTEM_USER_ID,
        "thread_id": "sample_001",
        "message_id": "sample_msg_001",
        "received_date": "2025-01-15T10:30:00+00:00",
        "sender_name": "Priya Sharma",
        "sender_email": "priya@vccircle.com",
        "subject": "Intro: Marcus Chen, VaultAI – Seed Round",
        "body_preview": "Hi there, I wanted to introduce you to Marcus Chen, CEO of VaultAI, an AI-powered contract intelligence platform. They have 22 design partners and $45k MRR.",
        "gmail_thread_link": "#",
        "company_name": "VaultAI",
        "founder_name": "Marcus Chen",
        "founder_role": "CEO",
        "category": "Warm intro",
        "warm_or_cold": "Warm",
        "sector": "Enterprise AI",
        "stage": "Seed",
        "check_size_requested": "$3M",
        "geography": "San Francisco, CA",
        "deck_attached": True,
        "traction_mentioned": True,
        "intro_source": "Priya Sharma",
        "summary": "Marcus is raising a $3M seed round for VaultAI, an AI-powered contract intelligence platform. Introduced via Priya Sharma with 22 design partners and $45k MRR.",
        "relevance_score": 9,
        "urgency_score": 8,
        "next_action": "Review now",
        "confidence": "High",
        "tags": ["AI", "Enterprise", "Seed", "Warm", "Contract Tech"],
        "status": "New",
        "processed_at": "2025-01-15T10:35:00+00:00",
        "created_at": "2025-01-15T10:35:00+00:00",
    },
    {
        "id": "00000000-0000-0000-0001-000000000002",
        "user_id": None,
        "thread_id": "sample_002",
        "message_id": "sample_msg_002",
        "received_date": "2025-01-14T14:20:00+00:00",
        "sender_name": "Anika Patel",
        "sender_email": "anika@greenloop.io",
        "subject": "GreenLoop – Pre-Seed Round | Climate Tech Marketplace",
        "body_preview": "Hi Future Frontier team, I am Anika Patel, CEO of GreenLoop. We are building a B2B marketplace connecting industrial waste producers with circular economy processors.",
        "gmail_thread_link": "#",
        "company_name": "GreenLoop",
        "founder_name": "Anika Patel",
        "founder_role": "CEO",
        "category": "Founder pitch",
        "warm_or_cold": "Cold",
        "sector": "Climate Tech",
        "stage": "Pre-seed",
        "check_size_requested": "$1.5M",
        "geography": "Austin, TX",
        "deck_attached": False,
        "traction_mentioned": False,
        "intro_source": None,
        "summary": "Anika is raising $1.5M pre-seed for GreenLoop, a B2B marketplace connecting industrial waste with circular economy processors. Strong team background, no traction metrics yet.",
        "relevance_score": 7,
        "urgency_score": 5,
        "next_action": "Request more info",
        "confidence": "Medium",
        "tags": ["Climate Tech", "Marketplace", "Pre-seed", "B2B"],
        "status": "New",
        "processed_at": "2025-01-14T14:25:00+00:00",
        "created_at": "2025-01-14T14:25:00+00:00",
    },
    {
        "id": "00000000-0000-0000-0001-000000000003",
        "user_id": SYSTEM_USER_ID,
        "thread_id": "sample_003",
        "message_id": "sample_msg_003",
        "received_date": "2025-01-13T09:15:00+00:00",
        "sender_name": "David Kim",
        "sender_email": "david.kim@lppartners.com",
        "subject": "Q2 Fund Update – LP Partners",
        "body_preview": "Dear Future Frontier team, Please find attached our Q2 fund performance update. Portfolio performing well, 2.3x TVPI.",
        "gmail_thread_link": "#",
        "company_name": None,
        "founder_name": "David Kim",
        "founder_role": "Managing Partner",
        "category": "LP / investor relations",
        "warm_or_cold": "Warm",
        "sector": None,
        "stage": None,
        "check_size_requested": None,
        "geography": None,
        "deck_attached": True,
        "traction_mentioned": False,
        "intro_source": None,
        "summary": "David Kim from LP Partners sending a routine Q2 fund update. Existing LP relationship, portfolio performing well.",
        "relevance_score": 5,
        "urgency_score": 3,
        "next_action": "Follow up later",
        "confidence": "High",
        "tags": ["LP", "Fund Update", "Q2"],
        "status": "Reviewed",
        "processed_at": "2025-01-13T09:20:00+00:00",
        "created_at": "2025-01-13T09:20:00+00:00",
    },
    {
        "id": "00000000-0000-0000-0001-000000000004",
        "user_id": SYSTEM_USER_ID,
        "thread_id": "sample_004",
        "message_id": "sample_msg_004",
        "received_date": "2025-01-12T11:45:00+00:00",
        "sender_name": "Sales Team",
        "sender_email": "sales@cloudbase.solutions",
        "subject": "Reduce Your AWS Costs by 40% – CloudBase Solutions",
        "body_preview": "Hello, I hope this email finds you well. At CloudBase Solutions, we specialize in helping companies reduce their cloud infrastructure costs.",
        "gmail_thread_link": "#",
        "company_name": "CloudBase Solutions",
        "founder_name": None,
        "founder_role": None,
        "category": "Service provider / vendor",
        "warm_or_cold": "Cold",
        "sector": "Cloud Infrastructure",
        "stage": None,
        "check_size_requested": None,
        "geography": None,
        "deck_attached": False,
        "traction_mentioned": False,
        "intro_source": None,
        "summary": "Mass cold outreach from a cloud cost optimization vendor. Not relevant to deal flow.",
        "relevance_score": 1,
        "urgency_score": 1,
        "next_action": "Archive",
        "confidence": "High",
        "tags": ["Vendor", "Cloud", "Spam"],
        "status": "Archived",
        "processed_at": "2025-01-12T11:50:00+00:00",
        "created_at": "2025-01-12T11:50:00+00:00",
    },
]

async def init_database():
    exists = await sb_table_exists('users')
    if exists:
        logger.info("Database tables verified")
        await seed_sample_data()
        return True

    # Try Management API with service_role key
    logger.info("Tables not found – attempting auto-creation via Management API...")
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f'https://api.supabase.com/v1/projects/{SUPABASE_PROJECT_REF}/database/query',
            headers={'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'},
            json={'query': MIGRATION_SQL}
        )
        if resp.status_code in (200, 201):
            logger.info("Tables created via Management API")
            await seed_sample_data()
            return True

    logger.warning("=" * 60)
    logger.warning("DB SETUP REQUIRED – Run this SQL in Supabase Dashboard > SQL Editor:")
    logger.warning(MIGRATION_SQL)
    logger.warning("=" * 60)
    return False

async def seed_sample_data():
    # Ensure system user exists first
    existing_sys = await sb_select('users', {'google_id': f'eq.{SYSTEM_USER["google_id"]}'})
    if not existing_sys:
        await sb_insert('users', SYSTEM_USER)

    existing = await sb_select('deals', {'thread_id': 'like.sample_%'})
    if existing:
        return
    for deal in SAMPLE_DEALS:
        await sb_insert('deals', deal)
    logger.info("Sample data seeded")

# ── JWT helpers ─────────────────────────────────────────────────────────────────
def create_jwt(user_id: str, email: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(days=30),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm='HS256')

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return pyjwt.decode(credentials.credentials, JWT_SECRET, algorithms=['HS256'])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ── Google OAuth ─────────────────────────────────────────────────────────────────
GOOGLE_SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly',
]

GOOGLE_CLIENT_CONFIG = {
    "web": {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": [GOOGLE_REDIRECT_URI],
    }
}

def create_oauth_flow() -> Flow:
    flow = Flow.from_client_config(GOOGLE_CLIENT_CONFIG, scopes=GOOGLE_SCOPES)
    flow.redirect_uri = GOOGLE_REDIRECT_URI
    return flow

# ── Gmail helpers ────────────────────────────────────────────────────────────────
def get_header(headers: list, name: str) -> str:
    for h in headers:
        if h.get('name', '').lower() == name.lower():
            return h.get('value', '')
    return ''

def is_newsletter(headers: list) -> bool:
    return any(
        h.get('name', '').lower() in ('list-unsubscribe', 'list-id', 'x-mailchimp-id', 'precedence')
        for h in headers
    )

def extract_body(payload: dict, max_chars: int = 4000) -> str:
    mime = payload.get('mimeType', '')
    if mime == 'text/plain':
        data = payload.get('body', {}).get('data', '')
        if data:
            return base64.urlsafe_b64decode(data + '==').decode('utf-8', errors='ignore')[:max_chars]
    if mime == 'text/html':
        data = payload.get('body', {}).get('data', '')
        if data:
            html = base64.urlsafe_b64decode(data + '==').decode('utf-8', errors='ignore')
            text = re.sub(r'<[^>]+>', ' ', html)
            return re.sub(r'\s+', ' ', text).strip()[:max_chars]
    parts = payload.get('parts', [])
    plain = html_fallback = None
    for part in parts:
        pt = part.get('mimeType', '')
        if pt == 'text/plain':
            d = part.get('body', {}).get('data', '')
            if d:
                plain = base64.urlsafe_b64decode(d + '==').decode('utf-8', errors='ignore')[:max_chars]
        elif pt == 'text/html':
            d = part.get('body', {}).get('data', '')
            if d:
                h = base64.urlsafe_b64decode(d + '==').decode('utf-8', errors='ignore')
                html_fallback = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', h)).strip()[:max_chars]
        elif 'multipart' in pt:
            result = extract_body(part, max_chars)
            if result:
                return result
    return plain or html_fallback or ''

def build_gmail_service(user: dict):
    expiry = None
    if user.get('token_expiry'):
        try:
            # Google-auth uses naive UTC datetimes internally — strip timezone
            dt = datetime.fromisoformat(user['token_expiry'].replace('Z', '+00:00'))
            expiry = dt.astimezone(timezone.utc).replace(tzinfo=None)
        except Exception:
            pass
    creds = Credentials(
        token=user.get('access_token'),
        refresh_token=user.get('refresh_token'),
        expiry=expiry,
        token_uri='https://oauth2.googleapis.com/token',
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=GOOGLE_SCOPES,
    )
    return gbuild('gmail', 'v1', credentials=creds), creds

# ── Claude AI ────────────────────────────────────────────────────────────────────
CLAUDE_SYSTEM = (
    "You are an AI analyst for a venture capital fund. Analyze inbound emails and extract "
    "structured data. Return ONLY valid JSON, no markdown, no preamble.\n\n"
    "Extract these fields:\n"
    "- company_name: string or null\n"
    "- founder_name: string or null\n"
    "- founder_role: string or null\n"
    '- category: one of "Founder pitch","Warm intro","Cold outreach","LP / investor relations",'
    '"Portfolio company update","Service provider / vendor","Recruiter / hiring","Press / media",'
    '"Event invitation","Student / informational request","Spam / irrelevant","Other"\n'
    '- warm_or_cold: "Warm","Cold","Unknown"\n'
    "- sector: string or null\n"
    "- stage: string or null\n"
    "- check_size_requested: string or null\n"
    "- geography: string or null\n"
    "- deck_attached: boolean\n"
    "- traction_mentioned: boolean\n"
    "- intro_source: string or null\n"
    "- summary: 2-3 sentence string\n"
    "- relevance_score: 1-10 integer (8-10=strong pitch/warm intro,5-7=cold pitch/LP,2-4=vendor/recruiter,1=spam)\n"
    "- urgency_score: 1-10 integer\n"
    '- next_action: one of "Review now","Forward to partner","Archive","Ignore","Request more info",'
    '"Schedule meeting","Add to pipeline","Follow up later"\n'
    '- confidence: "High","Medium","Low"\n'
    "- tags: array of up to 5 strings"
)

async def analyze_email(sender_name: str, sender_email: str, subject: str, body: str, fund_ctx: dict = None) -> dict:
    # Build fund-aware system prompt
    system = CLAUDE_SYSTEM
    if fund_ctx:
        ctx_lines = []
        if fund_ctx.get('fund_name'):
            ctx_lines.append(f"Fund Name: {fund_ctx['fund_name']}")
        if fund_ctx.get('fund_type'):
            ctx_lines.append(f"Fund Type: {fund_ctx['fund_type']}")
        if fund_ctx.get('thesis'):
            ctx_lines.append(f"Investment Thesis: {fund_ctx['thesis']}")
        if fund_ctx.get('stages'):
            stages = fund_ctx['stages'] if isinstance(fund_ctx['stages'], str) else ', '.join(fund_ctx['stages'])
            ctx_lines.append(f"Preferred Stages: {stages}")
        if fund_ctx.get('sectors'):
            ctx_lines.append(f"Sector Focus: {fund_ctx['sectors']}")
        if fund_ctx.get('check_size'):
            ctx_lines.append(f"Typical Check Size: {fund_ctx['check_size']}")
        if ctx_lines:
            fund_block = (
                "\n\nFUND THESIS CONTEXT — calibrate relevance_score to this fund:\n"
                + "\n".join(ctx_lines)
                + "\n\nScore 8-10 only if the email aligns with the fund's thesis and stage/sector focus. "
                "Score 1-3 for off-thesis, vendor, recruiter, or spam emails."
            )
            system = CLAUDE_SYSTEM + fund_block

    prompt = f"Analyze this email for a VC fund:\n\nFrom: {sender_name} <{sender_email}>\nSubject: {subject}\n\nBody:\n{body[:3500]}"
    try:
        msg = await claude_client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1500,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        text = re.sub(r'^```(?:json)?\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
        return json.loads(text)
    except Exception as e:
        logger.error(f"Claude error: {e}")
        return {
            "category": "Other", "summary": "AI analysis pending.",
            "relevance_score": 5, "urgency_score": 5,
            "next_action": "Review now", "confidence": "Low", "tags": [],
            "warm_or_cold": "Unknown",
        }

# ── Deal processing ───────────────────────────────────────────────────────────────
# Categories to skip entirely — not relevant to any fund
SKIP_CATEGORIES = {'Spam / irrelevant'}

async def process_and_save_email(
    user_id: Optional[str], sender_name: str, sender_email: str,
    subject: str, body: str, thread_id: str = None,
    message_id: str = None, received_date: str = None, gmail_link: str = None,
    fund_ctx: dict = None,
) -> Optional[dict]:
    # Deduplicate
    if user_id and thread_id:
        existing = await sb_select('deals', {
            'user_id': f'eq.{user_id}', 'thread_id': f'eq.{thread_id}'
        })
        if existing:
            return None

    ai = await analyze_email(sender_name, sender_email, subject, body, fund_ctx)

    # Skip spam / irrelevant emails — don't pollute the pipeline
    if ai.get('category') in SKIP_CATEGORIES:
        logger.info(f'Skipping spam email: "{subject}" from {sender_email}')
        return None
    now = datetime.now(timezone.utc).isoformat()
    deal = {
        'id': str(uuid.uuid4()),
        'user_id': user_id,
        'thread_id': thread_id or str(uuid.uuid4()),
        'message_id': message_id,
        'received_date': received_date or now,
        'sender_name': sender_name,
        'sender_email': sender_email,
        'subject': subject,
        'body_preview': body[:500],
        'gmail_thread_link': gmail_link or '#',
        'company_name': ai.get('company_name'),
        'founder_name': ai.get('founder_name'),
        'founder_role': ai.get('founder_role'),
        'category': ai.get('category', 'Other'),
        'warm_or_cold': ai.get('warm_or_cold', 'Unknown'),
        'sector': ai.get('sector'),
        'stage': ai.get('stage'),
        'check_size_requested': ai.get('check_size_requested'),
        'geography': ai.get('geography'),
        'deck_attached': bool(ai.get('deck_attached', False)),
        'traction_mentioned': bool(ai.get('traction_mentioned', False)),
        'intro_source': ai.get('intro_source'),
        'summary': ai.get('summary', ''),
        'relevance_score': int(ai.get('relevance_score', 5)),
        'urgency_score': int(ai.get('urgency_score', 5)),
        'next_action': ai.get('next_action', 'Review now'),
        'confidence': ai.get('confidence', 'Medium'),
        'tags': ai.get('tags', []),
        'status': 'New',
        'processed_at': now,
        'created_at': now,
    }
    saved = await sb_insert('deals', deal)
    return saved or deal

# ── Gmail sync ─────────────────────────────────────────────────────────────────────
async def sync_user_emails(user_id: str, is_initial: bool = False) -> int:
    users = await sb_select('users', {'id': f'eq.{user_id}'})
    if not users:
        return 0
    user = users[0]
    if not user.get('refresh_token'):
        return 0
    # Load this user's fund thesis for relevance calibration
    fund_ctx = get_fund_settings(user_id)
    try:
        gmail, creds = await asyncio.to_thread(build_gmail_service, user)
        # Refresh token if expired (use try/except to avoid any datetime comparison issues)
        try:
            needs_refresh = creds.expired and creds.refresh_token
        except Exception:
            needs_refresh = bool(creds.refresh_token)  # Assume refresh needed if unsure

        if needs_refresh:
            await asyncio.to_thread(creds.refresh, GoogleRequest())
            # Store expiry as naive UTC string for compatibility
            new_expiry = None
            if creds.expiry:
                try:
                    e = creds.expiry
                    if hasattr(e, 'tzinfo') and e.tzinfo:
                        e = e.astimezone(timezone.utc).replace(tzinfo=None)
                    new_expiry = e.isoformat()
                except Exception:
                    pass
            await sb_update('users', {
                'access_token': creds.token,
                'token_expiry': new_expiry,
            }, {'id': f'eq.{user_id}'})
            # Rebuild service with refreshed credentials
            gmail, creds = await asyncio.to_thread(build_gmail_service, {
                **user,
                'access_token': creds.token,
                'token_expiry': new_expiry,
            })

        params = {'userId': 'me', 'maxResults': 20 if is_initial else 50, 'labelIds': ['INBOX']}
        if not is_initial and user.get('last_synced'):
            try:
                ls = datetime.fromisoformat(user['last_synced'].replace('Z', '+00:00'))
                params['q'] = f'after:{int(ls.timestamp())}'
            except Exception:
                pass

        resp = await asyncio.to_thread(
            lambda: gmail.users().messages().list(**params).execute()
        )
        messages = resp.get('messages', [])
        processed = 0

        for ref in messages:
            try:
                msg = await asyncio.to_thread(
                    lambda mid=ref['id']: gmail.users().messages().get(
                        userId='me', id=mid, format='full'
                    ).execute()
                )
                headers = msg.get('payload', {}).get('headers', [])
                if is_newsletter(headers):
                    continue
                from_header = get_header(headers, 'From')
                if user.get('email') and user['email'] in from_header:
                    continue

                thread_id = msg.get('threadId', ref['id'])
                raw_from = from_header
                if '<' in raw_from:
                    from_name = raw_from.split('<')[0].strip().strip('"')
                    from_email = raw_from.split('<')[1].strip('> ')
                else:
                    from_email = raw_from.strip()
                    from_name = from_email.split('@')[0] if '@' in from_email else from_email

                subject = get_header(headers, 'Subject') or '(No Subject)'
                date_str = get_header(headers, 'Date')
                try:
                    received_date = parsedate_to_datetime(date_str).isoformat() if date_str else None
                except Exception:
                    received_date = None

                body = extract_body(msg.get('payload', {}))
                gmail_link = f'https://mail.google.com/mail/u/0/#inbox/{thread_id}'
                result = await process_and_save_email(
                    user_id=user_id, sender_name=from_name,
                    sender_email=from_email, subject=subject,
                    body=body, thread_id=thread_id,
                    message_id=ref['id'], received_date=received_date,
                    gmail_link=gmail_link, fund_ctx=fund_ctx,
                )
                if result:
                    processed += 1
            except Exception as e:
                logger.error(f'Email {ref["id"]} error: {e}')
                continue

        await sb_update('users', {'last_synced': datetime.now(timezone.utc).isoformat()}, {'id': f'eq.{user_id}'})
        logger.info(f'Synced {processed} new emails for user {user_id}')
        return processed
    except Exception as e:
        logger.error(f'Sync error user {user_id}: {e}')
        return 0

async def sync_all_users():
    users = await sb_select('users', {'refresh_token': 'not.is.null'})
    for u in users:
        await sync_user_emails(u['id'])

# ── Routes ─────────────────────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "VC Deal Flow API", "status": "healthy"}

# Auth
@api_router.get("/auth/google")
async def auth_google():
    flow = create_oauth_flow()
    state = secrets.token_urlsafe(32)
    auth_url, _ = flow.authorization_url(
        state=state, access_type='offline',
        include_granted_scopes='true', prompt='consent'
    )
    # Store the entire flow so code_verifier is preserved for callback
    oauth_states[state] = {'flow': flow, 'created_at': datetime.now(timezone.utc)}
    # Clean up stale states older than 10 minutes
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    stale = [k for k, v in oauth_states.items() if v['created_at'] < cutoff]
    for k in stale:
        oauth_states.pop(k, None)
    return RedirectResponse(url=auth_url)

@api_router.get("/auth/callback")
async def auth_callback(
    background_tasks: BackgroundTasks,
    code: str = None, state: str = None, error: str = None
):
    if error:
        return RedirectResponse(url=f'{FRONTEND_URL}/?error={error}')
    if not code:
        return RedirectResponse(url=f'{FRONTEND_URL}/?error=no_code')
    try:
        # Retrieve the saved flow (contains code_verifier for PKCE)
        state_data = oauth_states.pop(state, None) if state else None
        if state_data:
            flow = state_data['flow']
        else:
            # Fallback: create fresh flow (no PKCE, may fail for new Google clients)
            flow = create_oauth_flow()

        await asyncio.to_thread(flow.fetch_token, code=code)
        creds = flow.credentials

        user_info_svc = await asyncio.to_thread(
            lambda: gbuild('oauth2', 'v2', credentials=creds)
        )
        user_info = await asyncio.to_thread(
            lambda: user_info_svc.userinfo().get().execute()
        )

        google_id = user_info['id']
        email = user_info.get('email', '')
        def _safe_expiry(dt):
            """Convert expiry to naive-UTC ISO string for google-auth compatibility"""
            if not dt:
                return None
            try:
                if hasattr(dt, 'tzinfo') and dt.tzinfo:
                    dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
                return dt.isoformat()
            except Exception:
                return None

        user_data = {
            'google_id': google_id,
            'email': email,
            'name': user_info.get('name', ''),
            'picture': user_info.get('picture', ''),
            'access_token': creds.token,
            'refresh_token': creds.refresh_token,
            'token_expiry': _safe_expiry(creds.expiry),
        }

        existing = await sb_select('users', {'google_id': f'eq.{google_id}'})
        if existing:
            user_id = existing[0]['id']
            await sb_update('users', user_data, {'id': f'eq.{user_id}'})
        else:
            user_data['id'] = str(uuid.uuid4())
            user_data['created_at'] = datetime.now(timezone.utc).isoformat()
            new_user = await sb_insert('users', user_data)
            user_id = (new_user or {}).get('id', user_data['id'])

        token = create_jwt(user_id, email)
        background_tasks.add_task(sync_user_emails, user_id, True)
        return RedirectResponse(url=f'{FRONTEND_URL}/oauth-callback?token={token}')
    except Exception as e:
        logger.error(f'OAuth callback error: {e}')
        return RedirectResponse(url=f'{FRONTEND_URL}/?error=auth_failed')

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    users = await sb_select('users', {'id': f'eq.{current_user["user_id"]}'})
    if not users:
        raise HTTPException(status_code=404, detail="User not found")
    u = users[0]
    return {
        'id': u['id'], 'email': u['email'], 'name': u['name'],
        'picture': u['picture'], 'last_synced': u.get('last_synced'),
        'gmail_connected': bool(u.get('refresh_token')),
    }

@api_router.post("/auth/logout")
async def logout():
    return {"message": "Logged out"}

@api_router.post("/auth/disconnect")
async def disconnect_gmail(current_user: dict = Depends(get_current_user)):
    await sb_update('users', {
        'access_token': None, 'refresh_token': None,
        'token_expiry': None, 'last_synced': None,
    }, {'id': f'eq.{current_user["user_id"]}'})
    return {"message": "Gmail disconnected"}

# Deals
@api_router.get("/deals")
async def get_deals(current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    user_deals, sample_deals = await asyncio.gather(
        sb_select('deals', {'user_id': f'eq.{uid}', 'category': 'neq.Spam / irrelevant', 'order': 'created_at.desc', 'limit': '200'}),
        sb_select('deals', {'user_id': f'eq.{SYSTEM_USER_ID}', 'category': 'neq.Spam / irrelevant', 'order': 'created_at.desc'}),
    )
    # Additional client-side filter for other low-signal categories
    def is_relevant(d):
        cat = d.get('category', '')
        irrelevant = {'Spam / irrelevant', 'Service provider / vendor', 'Recruiter / hiring'}
        return cat not in irrelevant
    return [d for d in (user_deals or []) + (sample_deals or []) if is_relevant(d)]

@api_router.post("/deals/process")
async def process_email_manual(data: dict, current_user: dict = Depends(get_current_user)):
    body = data.get('body', '').strip()
    if not body:
        raise HTTPException(status_code=400, detail="Email body is required")
    fund_ctx = get_fund_settings(current_user['user_id'])
    result = await process_and_save_email(
        user_id=current_user['user_id'],
        sender_name=data.get('sender_name', 'Unknown'),
        sender_email=data.get('sender_email', ''),
        subject=data.get('subject', '(No Subject)'),
        body=body,
        fund_ctx=fund_ctx,
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to process email")
    return result

@api_router.patch("/deals/{deal_id}")
async def update_deal(deal_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    allowed = {'status', 'notes', 'next_action'}
    update = {k: v for k, v in data.items() if k in allowed}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    uid = current_user['user_id']
    # Allow updating own deals or sample deals
    ok = await sb_update('deals', update, {
        'id': f'eq.{deal_id}',
        'user_id': f'in.({uid},{SYSTEM_USER_ID})'
    })
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to update deal")
    return {"message": "Updated"}

# Sync
@api_router.post("/sync")
async def trigger_sync(background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    background_tasks.add_task(sync_user_emails, current_user['user_id'])
    return {"message": "Sync started", "status": "syncing"}

# Stats
@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    IRRELEVANT_CATS = {'Spam / irrelevant', 'Service provider / vendor', 'Recruiter / hiring'}
    user_deals, sample_deals = await asyncio.gather(
        sb_select('deals', {'user_id': f'eq.{uid}'}),
        sb_select('deals', {'user_id': f'eq.{SYSTEM_USER_ID}'}),
    )
    deals = [d for d in (user_deals or []) + (sample_deals or []) if d.get('category') not in IRRELEVANT_CATS]
    if not deals:
        return {'total': 0, 'founder_pitches': 0, 'avg_relevance': 0.0, 'high_score': 0, 'unreviewed': 0}
    pitches = sum(1 for d in deals if d.get('category') in ('Founder pitch', 'Warm intro'))
    scores = [d['relevance_score'] for d in deals if isinstance(d.get('relevance_score'), int)]
    avg = round(sum(scores) / len(scores), 1) if scores else 0.0
    high = sum(1 for d in deals if isinstance(d.get('relevance_score'), int) and d['relevance_score'] >= 8)
    new = sum(1 for d in deals if d.get('status') == 'New')
    return {'total': len(deals), 'founder_pitches': pitches, 'avg_relevance': avg, 'high_score': high, 'unreviewed': new}

# Settings
@api_router.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user)):
    users = await sb_select('users', {'id': f'eq.{current_user["user_id"]}'})
    u = users[0] if users else {}
    return {
        'gmail_connected': bool(u.get('refresh_token')),
        'email': u.get('email'), 'name': u.get('name'),
        'picture': u.get('picture'), 'last_synced': u.get('last_synced'),
        'anthropic_key_set': bool(ANTHROPIC_API_KEY),
        'google_client_id_set': bool(GOOGLE_CLIENT_ID),
        'fund_settings': get_fund_settings(current_user['user_id']),
    }

# Fund settings
@api_router.get("/fund-settings")
async def get_fund_settings_route(current_user: dict = Depends(get_current_user)):
    return get_fund_settings(current_user['user_id'])

@api_router.post("/fund-settings")
async def save_fund_settings_route(data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    allowed = {'fund_name', 'fund_type', 'thesis', 'stages', 'sectors', 'check_size'}
    clean = {k: v for k, v in data.items() if k in allowed}
    save_fund_settings(uid, clean)
    return {"message": "Fund settings saved", "settings": clean}

# DB status for frontend
@api_router.get("/status/db")
async def db_status():
    exists = await sb_table_exists('users')
    return {"tables_ready": exists}

# ── App setup ───────────────────────────────────────────────────────────────────
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.on_event("startup")
async def on_startup():
    await init_database()
    scheduler.add_job(sync_all_users, 'interval', minutes=15, id='bg_sync', replace_existing=True)
    scheduler.start()
    logger.info("VC Deal Flow API started")

@app.on_event("shutdown")
async def on_shutdown():
    scheduler.shutdown(wait=False)
