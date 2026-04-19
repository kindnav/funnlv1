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
from email.mime.text import MIMEText
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

# Track which users have an active background sync running
_syncing_users: set = set()

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

async def sb_insert(table: str, data, upsert: bool = False) -> Optional[dict]:
    async with httpx.AsyncClient(timeout=20) as client:
        prefer = 'return=representation'
        if upsert:
            prefer = 'return=representation,resolution=merge-duplicates'
        resp = await client.post(
            f'{SUPABASE_URL}/rest/v1/{table}',
            headers={**SB_HEADERS, 'Prefer': prefer},
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

async def sb_delete(table: str, params: dict) -> bool:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.delete(
            f'{SUPABASE_URL}/rest/v1/{table}',
            headers={**SB_HEADERS, 'Prefer': 'return=minimal'},
            params=params
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
  thesis_match_score INTEGER,
  fit_strengths TEXT[],
  fit_weaknesses TEXT[],
  match_reasoning TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, thread_id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  name TEXT,
  email TEXT,
  company TEXT,
  role TEXT,
  sector TEXT,
  stage TEXT,
  geography TEXT,
  intro_source TEXT,
  warm_or_cold TEXT,
  contact_status TEXT DEFAULT 'In Review',
  relevance_score INTEGER,
  notes TEXT,
  tags TEXT[],
  deal_count INTEGER DEFAULT 1,
  first_contacted TIMESTAMPTZ,
  last_contacted TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
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
        "thesis_match_score": 88,
        "fit_strengths": ["Strong AI/Enterprise sector alignment", "Early traction — $45k MRR with 22 design partners", "Warm intro signal from trusted source"],
        "fit_weaknesses": ["Seed stage may be later than typical entry point"],
        "match_reasoning": "VaultAI's AI contract intelligence platform closely aligns with enterprise software theses, with early traction and a warm intro backing conviction.",
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
        "thesis_match_score": 62,
        "fit_strengths": ["Climate tech is a high-conviction sector", "B2B marketplace model has strong network effects potential"],
        "fit_weaknesses": ["No traction or revenue metrics yet", "Pre-seed stage is very early", "Two-sided marketplace requires liquidity proof"],
        "match_reasoning": "GreenLoop targets a real gap in circular economy infrastructure but lacks the traction metrics that would typically warrant conviction at this stage.",
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
        "thesis_match_score": None,
        "fit_strengths": [],
        "fit_weaknesses": [],
        "match_reasoning": "This is an LP fund update, not an investment opportunity — thesis match scoring does not apply.",
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
        await migrate_schema()
        await migrate_sample_thesis()
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

SCHEMA_MIGRATION_SQL = """
ALTER TABLE deals ADD COLUMN IF NOT EXISTS thesis_match_score INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS fit_strengths TEXT[];
ALTER TABLE deals ADD COLUMN IF NOT EXISTS fit_weaknesses TEXT[];
ALTER TABLE deals ADD COLUMN IF NOT EXISTS match_reasoning TEXT;

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  name TEXT,
  email TEXT,
  company TEXT,
  role TEXT,
  sector TEXT,
  stage TEXT,
  geography TEXT,
  intro_source TEXT,
  warm_or_cold TEXT,
  contact_status TEXT DEFAULT 'In Review',
  relevance_score INTEGER,
  notes TEXT,
  tags TEXT[],
  deal_count INTEGER DEFAULT 1,
  first_contacted TIMESTAMPTZ,
  last_contacted TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);
"""

SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', SUPABASE_KEY)

async def migrate_schema():
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f'https://api.supabase.com/v1/projects/{SUPABASE_PROJECT_REF}/database/query',
                headers={'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}', 'Content-Type': 'application/json'},
                json={'query': SCHEMA_MIGRATION_SQL}
            )
            if resp.status_code in (200, 201):
                logger.info("Schema migration applied")
            else:
                logger.warning(f"Schema migration may need manual SQL: {resp.status_code}")
    except Exception as e:
        logger.error(f"Schema migration error: {e}")

SAMPLE_THESIS = {
    "00000000-0000-0000-0001-000000000001": {
        "thesis_match_score": 88,
        "fit_strengths": ["Strong AI/Enterprise alignment", "Early traction — $45k MRR, 22 design partners", "Warm intro from trusted source"],
        "fit_weaknesses": ["Seed stage may be later than typical entry point"],
        "match_reasoning": "VaultAI closely aligns with enterprise software and AI theses, backed by early traction and a credible warm introduction.",
    },
    "00000000-0000-0000-0001-000000000002": {
        "thesis_match_score": 62,
        "fit_strengths": ["Climate tech is a high-conviction sector", "B2B marketplace has network effects potential"],
        "fit_weaknesses": ["No traction or revenue metrics", "Pre-seed is very early", "Two-sided marketplace needs liquidity proof"],
        "match_reasoning": "GreenLoop targets a real gap in circular economy but lacks the traction metrics to build conviction at this stage.",
    },
    "00000000-0000-0000-0001-000000000003": {
        "thesis_match_score": None,
        "fit_strengths": [],
        "fit_weaknesses": [],
        "match_reasoning": "LP fund update — thesis match scoring does not apply to non-investment emails.",
    },
}

async def migrate_sample_thesis():
    for deal_id, data in SAMPLE_THESIS.items():
        rows = await sb_select('deals', {'id': f'eq.{deal_id}', 'thesis_match_score': 'is.null'})
        if rows:
            await sb_update('deals', data, {'id': f'eq.{deal_id}'})
    logger.info("Sample deal thesis data patched")

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
    'https://www.googleapis.com/auth/gmail.send',
]

# Scopes used to BUILD existing credentials from stored tokens.
# Always read-only so sync works regardless of whether the user has granted gmail.send yet.
GMAIL_SERVICE_SCOPES = [
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
        scopes=GMAIL_SERVICE_SCOPES,  # Never include gmail.send here — old tokens break if we do
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
    "- tags: array of up to 5 strings\n"
    "- thesis_match_score: 0-100 integer or null (only output when fund thesis context is provided; "
    "80+=strong fit, 50=neutral, 30-=poor fit; null if no thesis provided)\n"
    "- fit_strengths: array of 2-3 short strings — specific reasons this deal FITS the fund thesis "
    "(empty array if no thesis provided)\n"
    "- fit_weaknesses: array of 2-3 short strings — specific reasons this deal does NOT fit the fund thesis "
    "(empty array if no thesis provided)\n"
    "- match_reasoning: 1-2 sentence string summarizing overall thesis alignment (null if no thesis provided)"
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
        logger.info(f'[CLAUDE] Analyzing: "{subject}" from {sender_email}')
        msg = await claude_client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1500,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        logger.debug(f'[CLAUDE] Raw response for "{subject}": {text[:200]}')
        text = re.sub(r'^```(?:json)?\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
        result = json.loads(text)
        logger.info(f'[CLAUDE] Result for "{subject}": category={result.get("category")} score={result.get("relevance_score")}')
        return result
    except Exception as e:
        logger.error(f'[CLAUDE] Analysis FAILED for "{subject}" from {sender_email}: {e}')
        return {
            "category": "Unprocessed",
            "summary": "AI extraction failed — review manually",
            "relevance_score": 0,
            "urgency_score": 0,
            "next_action": "Review now",
            "confidence": "Low",
            "tags": [],
            "warm_or_cold": "Unknown",
            "deck_attached": False,
            "traction_mentioned": False,
        }

# ── Deal processing ───────────────────────────────────────────────────────────────
# Categories to skip entirely — not relevant to any fund
SKIP_CATEGORIES = {'Spam / irrelevant'}

# ── Pitch signal heuristics ────────────────────────────────────────────────────
PITCH_KEYWORDS = [
    'raising', 'raise', 'funding', 'investment', 'deck', 'pitch', 'round',
    'pre-seed', 'preseed', 'seed', 'series a', 'series b', 'startup',
    'founder', 'co-founder', 'venture', 'capital', 'mrr', 'arr',
    'traction', 'term sheet', 'valuation', 'equity', 'investors',
]

def pitch_signal_score(subject: str, body: str) -> int:
    """Return count of pitch-related keywords found — used to pre-filter emails before Claude."""
    text = f"{subject} {body[:1000]}".lower()
    return sum(1 for kw in PITCH_KEYWORDS if kw in text)

async def process_and_save_email(
    user_id: Optional[str], sender_name: str, sender_email: str,
    subject: str, body: str, thread_id: str = None,
    message_id: str = None, received_date: str = None, gmail_link: str = None,
    fund_ctx: dict = None, skip_dedup: bool = False, force_replace: bool = False,
) -> Optional[dict]:
    # Deduplicate (only if not already checked by caller's pre-fetched set)
    if not skip_dedup and user_id and thread_id:
        existing = await sb_select('deals', {
            'user_id': f'eq.{user_id}', 'thread_id': f'eq.{thread_id}'
        })
        if existing:
            logger.debug(f'[DEDUP] Thread {thread_id} already exists, skipping: "{subject}"')
            return None

    # In force_replace mode: upsert will update the existing record via the unique constraint
    # (user_id, thread_id) — no explicit delete needed

    ai = await analyze_email(sender_name, sender_email, subject, body, fund_ctx)

    # NOTE: We NO LONGER drop spam emails at ingestion.
    # Spam is saved to DB so nothing is permanently lost.
    # The get_deals endpoint filters spam out of the dashboard display.
    # This ensures test emails are never silently discarded.
    if ai.get('category') == 'Spam / irrelevant':
        logger.info(f'[PROCESS] Classified as spam: "{subject}" from {sender_email} — saving to DB (filtered from dashboard)')

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
        'relevance_score': int(ai.get('relevance_score') or 0),
        'urgency_score': int(ai.get('urgency_score') or 0),
        'next_action': ai.get('next_action', 'Review now'),
        'confidence': ai.get('confidence', 'Medium'),
        'tags': ai.get('tags', []),
        'thesis_match_score': ai.get('thesis_match_score'),
        'fit_strengths': ai.get('fit_strengths', []),
        'fit_weaknesses': ai.get('fit_weaknesses', []),
        'match_reasoning': ai.get('match_reasoning'),
        'status': 'New',
        'processed_at': now,
        'created_at': now,
    }
    saved = await sb_insert('deals', deal, upsert=force_replace)
    if not saved:
        # Fallback: retry without new schema fields if columns don't exist yet
        for f in ('thesis_match_score', 'fit_strengths', 'fit_weaknesses', 'match_reasoning'):
            deal.pop(f, None)
        saved = await sb_insert('deals', deal, upsert=force_replace)
    if saved:
        logger.info(f'[PROCESS] Saved: "{subject}" from {sender_email} | category={ai.get("category")} score={ai.get("relevance_score")}')
        return saved
    else:
        logger.error(f'[PROCESS] FAILED to save: "{subject}" from {sender_email}')
        return None

# ── Gmail sync ─────────────────────────────────────────────────────────────────────
async def sync_user_emails(user_id: str, is_initial: bool = False, force_full_scan: bool = False, force_reprocess: bool = False) -> int:
    users = await sb_select('users', {'id': f'eq.{user_id}'})
    if not users:
        logger.warning(f'[SYNC] User {user_id} not found in DB')
        return 0
    user = users[0]
    logger.info(f'[SYNC] ── Starting sync for user: {user.get("email", user_id)} ──')
    logger.info(f'[SYNC] Token expiry in DB: {user.get("token_expiry", "not set")}')

    if not user.get('refresh_token'):
        logger.warning(f'[SYNC] No refresh token for {user.get("email")} — cannot sync. User must re-authenticate.')
        return 0

    fund_ctx = get_fund_settings(user_id)
    try:
        gmail, creds = await asyncio.to_thread(build_gmail_service, user)

        # Always refresh token proactively — avoids mid-sync expiry
        try:
            needs_refresh = creds.expired or not creds.token
        except Exception:
            needs_refresh = True

        if needs_refresh and creds.refresh_token:
            logger.info(f'[SYNC] Refreshing access token for {user.get("email")}')
            await asyncio.to_thread(creds.refresh, GoogleRequest())
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
            gmail, creds = await asyncio.to_thread(build_gmail_service, {
                **user,
                'access_token': creds.token,
                'token_expiry': new_expiry,
            })
            logger.info(f'[SYNC] Token refreshed successfully. New expiry: {new_expiry}')

        # Build Gmail query params
        params = {'userId': 'me', 'maxResults': 10 if force_reprocess else 100, 'labelIds': ['INBOX']}
        if not force_full_scan and not is_initial and not force_reprocess and user.get('last_synced'):
            try:
                ls = datetime.fromisoformat(user['last_synced'].replace('Z', '+00:00'))
                params['q'] = f'after:{int(ls.timestamp())}'
                logger.info(f'[SYNC] Incremental scan after {user["last_synced"][:19]}')
            except Exception as e:
                logger.warning(f'[SYNC] Could not parse last_synced ({e}), falling back to full scan')
        else:
            logger.info(f'[SYNC] Full scan (force_full={force_full_scan}, initial={is_initial}, force_reprocess={force_reprocess})')

        logger.info(f'[SYNC] Fetching messages from Gmail API...')
        resp = await asyncio.to_thread(
            lambda: gmail.users().messages().list(**params).execute()
        )
        messages = resp.get('messages', [])
        logger.info(f'[SYNC] Gmail API returned {len(messages)} messages to check')

        if not messages:
            await sb_update('users', {'last_synced': datetime.now(timezone.utc).isoformat()}, {'id': f'eq.{user_id}'})
            logger.info(f'[SYNC] No messages in Gmail response — inbox empty or no new mail since last sync')
            return 0

        # ── PRE-FETCH all existing thread IDs in ONE query (avoids 100 round-trip HTTP calls) ──
        if not force_reprocess:
            all_deals = await sb_select('deals', {'user_id': f'eq.{user_id}', 'select': 'thread_id'})
            existing_thread_ids: set = {d['thread_id'] for d in (all_deals or []) if d.get('thread_id')}
            logger.info(f'[SYNC] Pre-fetched {len(existing_thread_ids)} existing thread IDs (dedup set ready)')
        else:
            existing_thread_ids = set()
            logger.info(f'[SYNC] force_reprocess=True — deduplication bypassed, reprocessing all messages')

        processed = 0
        skipped_dup = 0
        skipped_newsletter = 0
        errors = 0

        for i, ref in enumerate(messages):
            try:
                msg = await asyncio.to_thread(
                    lambda mid=ref['id']: gmail.users().messages().get(
                        userId='me', id=mid, format='full'
                    ).execute()
                )
                headers = msg.get('payload', {}).get('headers', [])
                subject_for_log = get_header(headers, 'Subject') or '(No Subject)'
                thread_id = msg.get('threadId', ref['id'])

                # Fast O(1) deduplication using pre-fetched set
                if thread_id in existing_thread_ids:
                    logger.debug(f'[SYNC] [{i+1}/{len(messages)}] SKIP (dup) thread={thread_id}: "{subject_for_log}"')
                    skipped_dup += 1
                    continue

                # Skip newsletters (unsubscribe headers etc.)
                if is_newsletter(headers):
                    logger.info(f'[SYNC] [{i+1}/{len(messages)}] SKIP (newsletter): "{subject_for_log}"')
                    existing_thread_ids.add(thread_id)
                    skipped_newsletter += 1
                    continue

                from_header = get_header(headers, 'From') or ''
                raw_from = from_header
                if '<' in raw_from:
                    from_name = raw_from.split('<')[0].strip().strip('"')
                    from_email = raw_from.split('<')[1].strip('> ')
                else:
                    from_email = raw_from.strip()
                    from_name = from_email.split('@')[0] if '@' in from_email else from_email

                # NOTE: Self-sent filter REMOVED. Users may send test pitch emails from their own
                # account and expect them to appear. Claude will classify content appropriately.

                subject = get_header(headers, 'Subject') or '(No Subject)'
                date_str = get_header(headers, 'Date')
                try:
                    received_date = parsedate_to_datetime(date_str).isoformat() if date_str else None
                except Exception:
                    received_date = None

                body = extract_body(msg.get('payload', {}))
                gmail_link = f'https://mail.google.com/mail/u/0/#inbox/{thread_id}'

                logger.info(f'[SYNC] [{i+1}/{len(messages)}] NEW — processing: "{subject}" from {from_email}')

                result = await process_and_save_email(
                    user_id=user_id, sender_name=from_name,
                    sender_email=from_email, subject=subject,
                    body=body, thread_id=thread_id,
                    message_id=ref['id'], received_date=received_date,
                    gmail_link=gmail_link, fund_ctx=fund_ctx,
                    skip_dedup=True,  # dedup already done above with the set
                    force_replace=force_reprocess,  # delete-before-insert when force=true
                )
                # Always add to set so we don't reprocess same thread in this batch
                existing_thread_ids.add(thread_id)
                if result:
                    processed += 1
                    logger.info(f'[SYNC] [{i+1}/{len(messages)}] SAVED deal: "{subject}" | category={result.get("category")}')
                else:
                    logger.warning(f'[SYNC] [{i+1}/{len(messages)}] Save returned None for: "{subject}"')
            except Exception as e:
                logger.error(f'[SYNC] [{i+1}/{len(messages)}] Error processing message {ref["id"]}: {e}')
                errors += 1
                continue

        await sb_update('users', {'last_synced': datetime.now(timezone.utc).isoformat()}, {'id': f'eq.{user_id}'})
        logger.info(
            f'[SYNC] ── Complete for {user.get("email")} — '
            f'saved={processed}, skipped_dup={skipped_dup}, '
            f'skipped_newsletter={skipped_newsletter}, errors={errors} ──'
        )
        return processed
    except Exception as e:
        err = str(e)
        logger.error(f'[SYNC] FATAL error for {user_id}: {e}')
        if 'invalid_scope' in err or 'invalid_grant' in err or 'unauthorized' in err.lower():
            raise
        return 0

async def sync_all_users():
    users = await sb_select('users', {'refresh_token': 'not.is.null'})
    for u in users:
        await sync_user_emails(u['id'])

# ── Action engine ──────────────────────────────────────────────────────────────
ACTION_PROMPTS = {
    'reject': (
        "Write a professional, respectful rejection email from an investor. "
        "Reference the company name specifically. Give a genuine reason for passing tied to fit — "
        "be human and encouraging. 3-5 sentences. No generic filler phrases like 'at this time'."
    ),
    'request_info': (
        "Write a brief, direct follow-up email requesting more information. "
        "Ask 3-4 targeted questions based on what is missing from the pitch (traction, market size, team, etc.). "
        "Be specific to this company — not generic."
    ),
    'forward_partner': (
        "Write a concise internal forwarding note for a co-investor or fund partner. "
        "Cover: what the company does, key traction or metrics if available, why it is interesting, "
        "and a suggested next step. Tone: internal memo, 3-4 sentences, opinionated."
    ),
}

async def generate_action_draft(deal: dict, action_type: str, fund_ctx: dict = None) -> dict:
    ctx = (
        f"Company: {deal.get('company_name', 'Unknown')}\n"
        f"Founder: {deal.get('founder_name', 'Unknown')} ({deal.get('founder_role', '')})\n"
        f"Stage: {deal.get('stage', 'Unknown')}\n"
        f"Sector: {deal.get('sector', 'Unknown')}\n"
        f"Summary: {deal.get('summary', '')}\n"
        f"Check size asked: {deal.get('check_size_requested', 'Not mentioned')}\n"
        f"Traction: {'Mentioned' if deal.get('traction_mentioned') else 'Not mentioned'}"
    )
    if deal.get('fit_weaknesses'):
        ctx += f"\nThesis gaps: {', '.join(deal['fit_weaknesses'])}"
    if deal.get('fit_strengths'):
        ctx += f"\nThesis strengths: {', '.join(deal['fit_strengths'])}"
    if fund_ctx and fund_ctx.get('fund_name'):
        ctx += f"\nFund: {fund_ctx['fund_name']}"

    instruction = ACTION_PROMPTS.get(action_type, ACTION_PROMPTS['request_info'])
    prompt = (
        f"Deal context:\n{ctx}\n\n"
        f"Original email subject: \"{deal.get('subject', '')}\"\n\n"
        f"Task: {instruction}\n\n"
        "Return ONLY valid JSON:\n"
        "{\"subject\": \"reply subject here\", \"body\": \"full email body here\"}"
    )
    try:
        msg = await claude_client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=800,
            system="You are a VC investor assistant. Generate professional email drafts. Return ONLY valid JSON, no markdown.",
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        text = re.sub(r'^```(?:json)?\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
        result = json.loads(text)
        return {
            "to_email": deal.get('sender_email', ''),
            "to_name": deal.get('sender_name', ''),
            "subject": result.get('subject', f"Re: {deal.get('subject', '')}"),
            "body": result.get('body', ''),
            "action_type": action_type,
        }
    except Exception as e:
        logger.error(f"Action draft error: {e}")
        return {
            "to_email": deal.get('sender_email', ''),
            "to_name": deal.get('sender_name', ''),
            "subject": f"Re: {deal.get('subject', '')}",
            "body": "",
            "action_type": action_type,
        }

async def send_gmail_message(
    user_id: str, to_email: str, to_name: str,
    subject: str, body: str, thread_id: str = None
):
    users = await sb_select('users', {'id': f'eq.{user_id}'})
    if not users or not users[0].get('refresh_token'):
        return False, "Gmail not connected"
    user = users[0]
    try:
        gmail, creds = await asyncio.to_thread(build_gmail_service, user)
        msg = MIMEText(body, 'plain')
        msg['to'] = f"{to_name} <{to_email}>" if to_name else to_email
        msg['from'] = 'me'
        msg['subject'] = subject
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        send_body = {'raw': raw}
        if thread_id and 'sample' not in str(thread_id):
            send_body['threadId'] = thread_id
        result = await asyncio.to_thread(
            lambda: gmail.users().messages().send(userId='me', body=send_body).execute()
        )
        return True, result.get('id', '')
    except Exception as e:
        err = str(e)
        logger.error(f"Gmail send error: {err}")
        if 'insufficient' in err.lower() or 'scope' in err.lower() or '403' in err:
            return False, "insufficient_scope"
        return False, err

# ── Routes ─────────────────────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "VC Deal Flow API", "status": "healthy"}

# ── Diagnostic test endpoints ──────────────────────────────────────────────────
@api_router.get("/test-gmail")
async def test_gmail(current_user: dict = Depends(get_current_user)):
    """Diagnostic: make a raw Gmail API call and return the 5 most recent messages."""
    uid = current_user['user_id']
    users = await sb_select('users', {'id': f'eq.{uid}'})
    if not users:
        raise HTTPException(status_code=404, detail="User not found")
    user = users[0]
    if not user.get('refresh_token'):
        return {"error": "No refresh token stored — user must re-authenticate", "has_access_token": bool(user.get('access_token')), "has_refresh_token": False}
    try:
        gmail, creds = await asyncio.to_thread(build_gmail_service, user)
        # Force refresh
        if creds.refresh_token:
            await asyncio.to_thread(creds.refresh, GoogleRequest())
        resp = await asyncio.to_thread(
            lambda: gmail.users().messages().list(userId='me', maxResults=5, labelIds=['INBOX']).execute()
        )
        messages = resp.get('messages', [])
        details = []
        for ref in messages:
            msg = await asyncio.to_thread(
                lambda mid=ref['id']: gmail.users().messages().get(userId='me', id=mid, format='metadata', metadataHeaders=['Subject', 'From', 'Date']).execute()
            )
            h = {hdr['name']: hdr['value'] for hdr in msg.get('payload', {}).get('headers', [])}
            details.append({'id': ref['id'], 'threadId': msg.get('threadId'), 'subject': h.get('Subject', ''), 'from': h.get('From', ''), 'date': h.get('Date', '')})
        return {"ok": True, "message_count": len(messages), "messages": details, "user_email": user.get('email'), "token_expiry": user.get('token_expiry')}
    except Exception as e:
        return {"ok": False, "error": str(e), "user_email": user.get('email')}

@api_router.post("/test-insert")
async def test_insert(current_user: dict = Depends(get_current_user)):
    """Diagnostic: insert a hardcoded test deal row and return success/error."""
    uid = current_user['user_id']
    now = datetime.now(timezone.utc).isoformat()
    test_deal = {
        'id': str(uuid.uuid4()),
        'user_id': uid,
        'thread_id': f'test-thread-{now}',
        'message_id': f'test-msg-{now}',
        'received_date': now,
        'sender_name': 'Test Sender',
        'sender_email': 'test@example.com',
        'subject': f'[TEST INSERT] Diagnostic deal {now[:19]}',
        'body_preview': 'This is a test deal inserted by the /api/test-insert endpoint.',
        'gmail_thread_link': '#',
        'category': 'Founder pitch',
        'warm_or_cold': 'Cold',
        'summary': 'Test deal inserted for diagnostic purposes.',
        'relevance_score': 7,
        'urgency_score': 5,
        'next_action': 'Review now',
        'confidence': 'High',
        'tags': ['test'],
        'status': 'New',
        'deck_attached': False,
        'traction_mentioned': False,
        'processed_at': now,
        'created_at': now,
    }
    saved = await sb_insert('deals', test_deal)
    if saved:
        return {"ok": True, "deal_id": saved.get('id', test_deal['id']), "subject": test_deal['subject'], "message": "Test row inserted successfully — it should now appear in /api/deals"}
    else:
        return {"ok": False, "message": "Supabase insert failed — check backend logs for error details"}

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

@api_router.post("/deals/{deal_id}/generate-action")
async def generate_deal_action(deal_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    action_type = data.get('action_type', 'request_info')
    if action_type not in ('reject', 'request_info', 'forward_partner'):
        raise HTTPException(status_code=400, detail="Invalid action_type")
    deals = await sb_select('deals', {'id': f'eq.{deal_id}'})
    if not deals:
        raise HTTPException(status_code=404, detail="Deal not found")
    fund_ctx = get_fund_settings(current_user['user_id'])
    return await generate_action_draft(deals[0], action_type, fund_ctx)

@api_router.post("/deals/{deal_id}/send-action")
async def send_deal_action(deal_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    to_email = data.get('to_email', '').strip()
    body = data.get('body', '').strip()
    if not to_email or not body:
        raise HTTPException(status_code=400, detail="to_email and body are required")
    deals = await sb_select('deals', {'id': f'eq.{deal_id}'})
    if not deals:
        raise HTTPException(status_code=404, detail="Deal not found")
    deal = deals[0]
    success, result = await send_gmail_message(
        user_id=uid,
        to_email=to_email,
        to_name=data.get('to_name', ''),
        subject=data.get('subject', ''),
        body=body,
        thread_id=deal.get('thread_id'),
    )
    if not success:
        if result == 'insufficient_scope':
            raise HTTPException(
                status_code=403,
                detail="Gmail send permission not granted. Please reconnect Gmail to enable sending."
            )
        raise HTTPException(status_code=500, detail=f"Send failed: {result}")
    action_type = data.get('action_type', 'request_info')
    status_map = {'reject': 'Archived', 'request_info': 'Reviewed', 'forward_partner': 'Reviewed'}
    new_status = status_map.get(action_type, 'Reviewed')
    await sb_update('deals', {'status': new_status}, {
        'id': f'eq.{deal_id}',
        'user_id': f'in.({uid},{SYSTEM_USER_ID})',
    })
    return {"message": "Email sent", "status": new_status}

# Sync
async def _run_background_sync(user_id: str, force_reprocess: bool = False):
    """Run a full inbox scan in the background, releasing the HTTP response immediately."""
    try:
        count = await sync_user_emails(user_id, force_full_scan=True, force_reprocess=force_reprocess)
        logger.info(f'[SYNC] Background sync complete: {count} new deals for user {user_id}')
    except Exception as e:
        logger.error(f'[SYNC] Background sync error for user {user_id}: {e}')
    finally:
        _syncing_users.discard(user_id)

@api_router.post("/sync")
async def trigger_sync(
    background_tasks: BackgroundTasks,
    force: bool = False,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user['user_id']
    if user_id in _syncing_users:
        return {"message": "Sync already running", "status": "already_syncing", "new_deals": 0}
    _syncing_users.add(user_id)
    background_tasks.add_task(_run_background_sync, user_id, force)
    logger.info(f'[SYNC] Triggered for user {user_id} (force_reprocess={force})')
    return {"message": "Sync started", "status": "started", "new_deals": 0}

# Stats
# ── Contacts ─────────────────────────────────────────────────────────────────

@api_router.post("/contacts/upsert")
async def upsert_contact(data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    contact_status = data.get('contact_status', 'In Review')
    deal = data.get('deal', {})

    email = deal.get('sender_email') or deal.get('founder_email')
    if not email:
        raise HTTPException(status_code=400, detail="No email found on deal")

    existing = await sb_select('contacts', {'user_id': f'eq.{uid}', 'email': f'eq.{email}'})

    now_iso = datetime.now(timezone.utc).isoformat()

    if existing:
        contact = existing[0]
        new_score = deal.get('thesis_match_score') or deal.get('relevance_score') or 0
        existing_score = contact.get('relevance_score') or 0
        update_data = {
            'last_contacted': deal.get('received_date') or now_iso,
            'deal_count': (contact.get('deal_count') or 1) + 1,
            'updated_at': now_iso,
        }
        if new_score > existing_score:
            update_data['relevance_score'] = new_score
        await sb_update('contacts', update_data, {'user_id': f'eq.{uid}', 'email': f'eq.{email}'})
        return {'status': 'updated', 'contact_id': contact['id'], 'returning': True,
                'name': contact.get('name'), 'company': contact.get('company')}
    else:
        new_contact = {
            'user_id': uid,
            'name': deal.get('sender_name') or deal.get('founder_name'),
            'email': email,
            'company': deal.get('company_name'),
            'role': deal.get('founder_role'),
            'sector': deal.get('sector'),
            'stage': deal.get('stage'),
            'geography': deal.get('geography'),
            'intro_source': deal.get('intro_source'),
            'warm_or_cold': deal.get('warm_or_cold'),
            'relevance_score': deal.get('thesis_match_score') or deal.get('relevance_score'),
            'tags': deal.get('tags') or [],
            'contact_status': contact_status,
            'first_contacted': deal.get('received_date') or now_iso,
            'last_contacted': deal.get('received_date') or now_iso,
            'deal_count': 1,
        }
        result = await sb_insert('contacts', new_contact)
        contact_id = result.get('id') if result else None
        return {'status': 'created', 'contact_id': contact_id, 'returning': False,
                'name': new_contact['name'], 'company': new_contact['company']}


@api_router.get("/contacts")
async def get_contacts(current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    contacts = await sb_select('contacts', {'user_id': f'eq.{uid}', 'order': 'last_contacted.desc'})
    return contacts or []


@api_router.patch("/contacts/{contact_id}")
async def update_contact(contact_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    data['updated_at'] = datetime.now(timezone.utc).isoformat()
    await sb_update('contacts', data, {'id': f'eq.{contact_id}', 'user_id': f'eq.{uid}'})
    return {'status': 'updated'}


@api_router.get("/contacts/{contact_id}/deals")
async def get_contact_deals(contact_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    contacts = await sb_select('contacts', {'id': f'eq.{contact_id}', 'user_id': f'eq.{uid}'})
    if not contacts:
        raise HTTPException(status_code=404, detail="Contact not found")
    email = contacts[0].get('email')
    if not email:
        return []
    deals = await sb_select('deals', {'user_id': f'eq.{uid}', 'sender_email': f'eq.{email}'})
    return deals or []



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
    new = sum(1 for d in deals if d.get('status') == 'New')
    # Use thesis_match_score (0-100) when available, fall back to relevance_score (1-10)
    thesis_scores = [d['thesis_match_score'] for d in deals if isinstance(d.get('thesis_match_score'), int)]
    if thesis_scores:
        avg = round(sum(thesis_scores) / len(thesis_scores), 1)
        high = sum(1 for d in deals if isinstance(d.get('thesis_match_score'), int) and d['thesis_match_score'] >= 70)
    else:
        rel_scores = [d['relevance_score'] for d in deals if isinstance(d.get('relevance_score'), int)]
        avg = round(sum(rel_scores) / len(rel_scores), 1) if rel_scores else 0.0
        high = sum(1 for d in deals if isinstance(d.get('relevance_score'), int) and d['relevance_score'] >= 8)
    return {'total': len(deals), 'founder_pitches': pitches, 'avg_score': avg, 'high_score': high, 'unreviewed': new}

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
    # Merge into existing settings so onboarding_complete survives fund-settings saves
    existing = get_fund_settings(uid)
    allowed = {'fund_name', 'fund_type', 'thesis', 'stages', 'sectors', 'check_size'}
    clean = {**existing, **{k: v for k, v in data.items() if k in allowed}}
    save_fund_settings(uid, clean)
    return {"message": "Fund settings saved", "settings": clean}

@api_router.post("/onboarding-complete")
async def mark_onboarding_complete(current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    settings = get_fund_settings(uid)
    settings['onboarding_complete'] = True
    save_fund_settings(uid, settings)
    return {"ok": True}

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
