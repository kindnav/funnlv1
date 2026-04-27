import os
from dotenv import load_dotenv
load_dotenv()
import re
import json
import uuid
from dataclasses import dataclass
import string
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
import stripe
from fastapi import FastAPI, APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import RedirectResponse, JSONResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from googleapiclient.discovery import build as gbuild
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from google_auth_oauthlib.flow import Flow
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Allow HTTP redirect URIs for local dev — remove or guard behind ENV check before production
if os.environ.get('ENVIRONMENT') != 'production':
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
JWT_SECRET = os.environ['JWT_SECRET']
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://vc-pipeline-1.preview.emergentagent.com')
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
STRIPE_PRICE_ID = os.environ.get('STRIPE_PRICE_ID', '')
stripe.api_key = STRIPE_SECRET_KEY

SB_HEADERS = {
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'apikey': SUPABASE_KEY,
    'Content-Type': 'application/json',
}

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Fund settings (per-user, Supabase-backed) ──────────────────────────────────
async def get_fund_settings(user_id: str) -> dict:
    rows = await sb_select('users', {'id': f'eq.{user_id}', 'select': 'fund_settings'})
    if rows and rows[0].get('fund_settings'):
        return rows[0]['fund_settings']
    return {}

async def save_fund_settings(user_id: str, data: dict):
    await sb_update('users', {'fund_settings': data}, {'id': f'eq.{user_id}'})

async def check_subscription_access(user_id: str) -> bool:
    """True if user has active subscription or valid trial.
    Legacy users with no subscription_status are granted access."""
    users = await sb_select('users', {'id': f'eq.{user_id}'})
    if not users:
        return False
    u = users[0]
    status = u.get('subscription_status')
    trial_ends = u.get('trial_ends_at')
    if not status and not trial_ends:
        return True  # legacy user predating payment system
    if status == 'active':
        return True
    if status == 'trialing' and trial_ends:
        trial_dt = datetime.fromisoformat(trial_ends.replace('Z', '+00:00'))
        return datetime.now(timezone.utc) < trial_dt
    return False

async def create_contact_activity(contact_id: str, user_id: str, act_type: str, description: str, deal_id: str = None):
    """Insert one row into contact_activities. Silently skips on error."""
    try:
        await sb_insert('contact_activities', {
            'contact_id': contact_id,
            'user_id': user_id,
            'type': act_type,
            'description': description,
            'deal_id': deal_id,
        })
    except Exception as e:
        logger.debug(f'[Activity] Could not log activity type={act_type}: {e}')

async def _log_deal_activity(user_id: str, deal: dict, act_type: str, description: str):
    """Look up contact by deal sender_email and log an activity. Fire-and-forget."""
    email = (deal.get('sender_email') or '').strip().lower()
    if not email:
        return
    try:
        rows = await sb_select('contacts', {'user_id': f'eq.{user_id}', 'email': f'eq.{email}'})
        if rows:
            await create_contact_activity(rows[0]['id'], user_id, act_type, description, deal.get('id'))
    except Exception as e:
        logger.debug(f'[Activity] _log_deal_activity failed: {e}')

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

# Real-time sync progress per user — polled by frontend
_sync_progress: dict = {}

def _set_sync_progress(user_id: str, step: int, message: str, total: int = 0, current: int = 0, **extra):
    _sync_progress[user_id] = {
        'step': step, 'message': message,
        'total': total, 'current': current,
        'ts': datetime.now(timezone.utc).isoformat(),
        **extra,
    }

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  fund_settings JSONB DEFAULT '{}'::jsonb,
  trial_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  weekly_digest_enabled BOOLEAN DEFAULT TRUE
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS fund_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS follow_up_date DATE;

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
  follow_up_date DATE,
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

CREATE TABLE IF NOT EXISTS contact_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  type        TEXT NOT NULL,
  description TEXT,
  deal_id     UUID REFERENCES deals(id),
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ca_contact_id ON contact_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_ca_created_at ON contact_activities(created_at DESC);
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

async def migrate_deal_stages():
    """Migrate old deal stage names to new VC-native 7-stage system."""
    stage_map = {
        'New':                'Inbound',
        'Assigned':           'First Look',
        'Under Review':       'In Conversation',
        'Committee Decision': 'Due Diligence',
        'Invested':           'Closed',
    }
    for old, new in stage_map.items():
        try:
            await sb_update('deals', {'deal_stage': new}, {'deal_stage': f'eq.{old}'})
        except Exception as e:
            logger.warning(f'[MIGRATE] Stage {old}→{new}: {e}')
    try:
        await sb_update('deals', {'deal_stage': 'Inbound'}, {'deal_stage': 'is.null'})
    except Exception as e:
        logger.warning(f'[MIGRATE] Null stage→Inbound: {e}')
    logger.info("[MIGRATE] Deal stages migrated to 7-stage VC system")


async def purge_expired_archived_deals():
    """Permanently delete soft-deleted deals older than 30 days."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    try:
        await sb_delete('deals', {'status': 'eq.deleted', 'updated_at': f'lt.{cutoff}'})
        logger.info("[PURGE] Expired archived deals purged")
    except Exception as e:
        logger.warning(f'[PURGE] Could not purge expired deals: {e}')

async def init_database():
    exists = await sb_table_exists('users')
    if exists:
        logger.info("Database tables verified")
        await migrate_deal_stages()
        await purge_expired_archived_deals()
        await migrate_sample_thesis()
        await seed_sample_data()
        await _auto_populate_contacts_if_empty()
        return True
    logger.warning("DB tables not found — please run the schema SQL in Supabase SQL Editor")
    return False


async def _auto_populate_contacts_if_empty():
    """
    On startup, sync contacts from all visible deals (own + sample) for every real user.
    Uses upsert logic — safe to run repeatedly, never wipes notes/tags.
    """
    try:
        real_users = await sb_select('users', {'refresh_token': 'not.is.null'})
        for user in (real_users or []):
            uid = user['id']
            # Mirror GET /deals: own deals + system sample deals
            deals = await sb_select('deals', {
                'user_id': f'in.({uid},{SYSTEM_USER_ID})',
                'status': 'neq.deleted',
            })
            if not deals:
                continue
            count = 0
            for deal in deals:
                r = await sync_contact(uid, deal)
                if r:
                    count += 1
            if count > 0:
                logger.info(f'[Startup] Synced {count} contacts for user {uid[:8]}')
    except Exception as exc:
        logger.error(f'[Startup] auto-populate contacts failed: {exc}')

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

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    # Cookie-first: browser sessions use httpOnly cookie.
    # Authorization header used as fallback for API clients and tests.
    token = request.cookies.get("vc_token")
    if not token and credentials:
        token = credentials.credentials
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=['HS256'])
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

def _html_to_text(raw_html: str) -> str:
    """Strip HTML to clean readable text, removing style/script content entirely."""
    # Remove style and script blocks including their content
    text = re.sub(r'<(style|script)[^>]*>.*?</(style|script)>', ' ', raw_html, flags=re.DOTALL | re.IGNORECASE)
    # Remove all remaining HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # Collapse whitespace
    return re.sub(r'\s+', ' ', text).strip()

def extract_body(payload: dict, max_chars: int = 4000) -> str:
    mime = payload.get('mimeType', '')
    if mime == 'text/plain':
        data = payload.get('body', {}).get('data', '')
        if data:
            return base64.urlsafe_b64decode(data + '==').decode('utf-8', errors='ignore')[:max_chars]
    if mime == 'text/html':
        data = payload.get('body', {}).get('data', '')
        if data:
            raw = base64.urlsafe_b64decode(data + '==').decode('utf-8', errors='ignore')
            return _html_to_text(raw)[:max_chars]
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
                raw = base64.urlsafe_b64decode(d + '==').decode('utf-8', errors='ignore')
                html_fallback = _html_to_text(raw)[:max_chars]
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

# ── Noise filters ──────────────────────────────────────────────────────────────
# Exact known automated sender addresses to always skip
AUTOMATED_SENDERS_EXACT = frozenset([
    'no-reply@accounts.google.com', 'noreply@accounts.google.com',
    'no-reply@google.com', 'noreply@google.com', 'no-reply@notifications.google.com',
    'no-reply@mail.google.com', 'no-reply@security.google.com',
    'calendar-notification@google.com',
    'no-reply@linkedin.com', 'notifications-noreply@linkedin.com',
    'messages-noreply@linkedin.com', 'jobs-noreply@linkedin.com',
    'notification@linkedin.com', 'noreply@twitter.com', 'noreply@facebook.com',
    'noreply@instagram.com', 'noreply@github.com', 'noreply@notion.so',
    'noreply@slack.com', 'noreply@zoom.us', 'noreply@calendly.com',
    'invites@calendly.com',
    'noreply@eventbrite.com', 'noreply@dropbox.com', 'noreply@docusign.com',
    'noreply@stripe.com', 'noreply@docsend.com',
    'noreply@hubspot.com', 'noreply@mailchimp.com', 'noreply@constantcontact.com',
    'noreply@loom.com', 'noreply@typeform.com', 'noreply@airtable.com',
])

# Email address prefixes that always indicate automated senders
AUTOMATED_EMAIL_PREFIXES = (
    'noreply@', 'no-reply@', 'donotreply@', 'do-not-reply@',
    'notifications@', 'alerts@', 'mailer@', 'bounce@',
    'system@', 'automated@', 'automailer@', 'auto@',
)

# Sender name keywords that indicate automated / non-human senders
AUTOMATED_NAME_KEYWORDS = (
    'noreply', 'no-reply', 'donotreply', 'do-not-reply',
    'notifications', 'mailer-daemon', 'mailer daemon',
    'system', 'automated', 'auto-mailer',
)

# Subject line keywords that indicate noise (case-insensitive)
NOISY_SUBJECT_KEYWORDS = (
    'unsubscribe', 'weekly digest', 'monthly digest', 'newsletter',
    'your receipt', 'order confirmation', 'invoice #', 'payment confirmation',
    'verify your email', 'confirm your email', 'password reset',
    'security alert', 'sign-in attempt', '[automated]', 'auto-reply',
    'out of office', 'on vacation', 'automatic reply',
    # Calendar and scheduling noise
    'invitation:', 'accepted:', 'declined:', 'tentative:',
    'you have been invited', "you've been invited",
    'has been rescheduled', 'has been cancelled', 'has been canceled',
    'updated invitation', 'canceled event', 'new event',
    # Registration and confirmation noise
    "you're registered", 'you are registered', 'registration confirmed',
    'registration confirmation', 'thank you for registering',
    'webinar confirmation', 'your booking', 'booking confirmation',
    # Social / notification noise
    'viewed your profile', 'new connection request',
    'accepted your connection', 'sent you a message',
    'commented on', 'liked your',
    # Test / internal noise
    '[test]', 'test message', 'test email',
)

def is_automated_sender(from_email: str, from_name: str) -> bool:
    """Return True only if the sender is clearly automated/bot — never block real humans."""
    email_l = from_email.lower().strip()
    name_l = (from_name or '').lower().strip()
    # Exact match against known automated addresses
    if email_l in AUTOMATED_SENDERS_EXACT:
        return True
    # Email starts with no-reply / system prefix
    if any(email_l.startswith(p) for p in AUTOMATED_EMAIL_PREFIXES):
        return True
    # Name contains hard automated keywords
    if any(kw in name_l for kw in AUTOMATED_NAME_KEYWORDS):
        return True
    return False

def is_noisy_subject(subject: str) -> bool:
    """Return True if subject indicates an automated/irrelevant email."""
    s = subject.lower()
    return any(kw in s for kw in NOISY_SUBJECT_KEYWORDS)

MIN_BODY_LENGTH = 50  # skip near-empty automated pings
CLAUDE_SYSTEM = """You are an expert venture capital analyst with 10 years of experience at top-tier venture funds. Your job is to analyze inbound emails received by VC funds, angel investors, student-run venture funds, and startup accelerators.

You understand the difference between a high-signal founder pitch and noise. You know what warm intros look like. You can identify LP communications, portfolio updates, service vendors, and recruiters instantly.

Your output will be used to automatically triage and score deal flow for investment professionals. Accuracy is critical.

Return ONLY valid JSON. No markdown. No explanation. No preamble. Just the raw JSON object."""

# ── AI Gate ─────────────────────────────────────────────────────────────────
GATE_SYSTEM_PROMPT = """You are a precision filter for a venture capital deal flow tool. Your job is to decide whether this specific email contains a genuine investment signal that a VC, angel investor, or fund manager should see.

THE CORE TEST: Does this email contain new information about a specific investment opportunity, a deal relationship, or the active business of running a fund?

SET belongs_in_dealflow TRUE for:
- Founder pitching their startup for investment — cold, warm, polished, unpolished, any language, any country
- Third party introducing a founder or company (warm intro written by the introducer)
- LP, potential LP, or investor relations communication with substantive content
- Co-investor or syndicate outreach about a specific named deal
- Portfolio company sending a business update, asking for help, or sharing a milestone
- Accelerator or program application from a startup
- Another investor asking you to evaluate or co-invest in a specific company
- Email with a pitch deck, term sheet, cap table, or financial model attached or linked
- Student asking for VC career advice or mentorship (low priority but legitimate)

SET belongs_in_dealflow FALSE for:
- Calendar invitations, meeting acceptances, scheduling confirmations — even if related to an investment meeting
- Automated system notifications: document signed, payment received, account activity, delivery receipts
- Vendor or agency pitching services TO the fund (software, legal, PR, back-office, recruiting)
- Recruiter cold outreach placing candidates (unless explicitly and specifically for a named portfolio company)
- Conference announcements, event invitations, and webinar promotions without a named deal attached
- Newsletter, digest, or broadcast email sent to a list
- Internal colleague messages about logistics with no new external deal content
- Social network notifications (LinkedIn connections, Twitter mentions, etc.)
- Out-of-office replies, vacation messages, and bounce notifications

TIEBREAKER: If genuinely uncertain whether this is a founder pitch vs. vendor spam, include it. If genuinely uncertain whether this is deal content vs. calendar/scheduling noise, exclude it.

Return ONLY valid JSON: {"belongs_in_dealflow": true or false, "reason": "one short sentence"}"""

# Domains strongly associated with B2B SaaS vendors and service providers selling to VCs.
# Used to add a soft hint to the gate prompt — not a hard block.
_VENDOR_DOMAIN_HINTS = frozenset([
    'hubspot.com', 'salesforce.com', 'affinity.co', 'pipedrive.com',
    'apollo.io', 'zoominfo.com', 'clearbit.com', 'lusha.com',
    'seamless.ai', 'hunter.io', 'reply.io', 'outreach.io', 'salesloft.com',
    'mailshake.com', 'lemlist.com', 'instantly.ai', 'smartlead.ai',
    'clay.com', 'lavender.ai', 'wiza.co', 'uplead.com',
])

async def gate_email(sender_name: str, sender_email: str, subject: str, body: str) -> dict:
    """Lightweight AI gate — decides if email belongs in deal flow before full extraction."""
    body_preview = body[:600].strip()
    sender_domain = sender_email.lower().split('@')[-1] if '@' in sender_email else ''
    vendor_hint = (
        '\n[NOTE: This sender domain is commonly associated with B2B sales and marketing tools. '
        'Be skeptical — include only if there is clear deal content, not just vendor outreach.]'
        if sender_domain in _VENDOR_DOMAIN_HINTS else ''
    )
    user_prompt = (
        f"Should this email appear in a venture capital deal flow tool?\n\n"
        f"FROM: {sender_name} <{sender_email}>\n"
        f"SUBJECT: {subject}\n"
        f"BODY PREVIEW: {body_preview}"
        f"{vendor_hint}"
    )
    try:
        msg = await claude_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=150,
            system=GATE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = msg.content[0].text.strip()
        text = re.sub(r'^```(?:json)?\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
        result = json.loads(text)
        belongs = bool(result.get('belongs_in_dealflow', True))
        reason = result.get('reason', '')
        logger.info(f'[GATE] {"PASS" if belongs else "BLOCK"}: "{subject}" — {reason}')
        return {'belongs': belongs, 'reason': reason}
    except Exception as e:
        # On any error, default to INCLUDE (never miss a deal)
        logger.warning(f'[GATE] Error for "{subject}", defaulting to INCLUDE: {e}')
        return {'belongs': True, 'reason': 'gate error — included by default'}

async def save_gated_email(user_id: str, sender_name: str, sender_email: str,
                           subject: str, body: str, received_date: str, reason: str):
    """Save a gated-out email to the gated_emails table."""
    try:
        record = {
            'user_id': user_id,
            'sender_name': sender_name,
            'sender_email': sender_email,
            'subject': subject,
            'received_date': received_date or datetime.now(timezone.utc).isoformat(),
            'gate_reason': reason,
            'body_preview': body[:500],
        }
        result = await sb_insert('gated_emails', record)
        if result:
            logger.info(f'[GATE] Saved to gated_emails: "{subject}"')
        else:
            logger.warning(f'[GATE] Could not save to gated_emails (table may not exist): "{subject}"')
    except Exception as e:
        logger.warning(f'[GATE] gated_emails insert failed: {e}')

def _build_fund_context_block(fund_ctx: Optional[dict]) -> tuple[str, str]:
    """Return (fund_block, thesis_instruction) for the Claude prompt."""
    lines = []
    if fund_ctx:
        if fund_ctx.get('fund_name'):  lines.append(f"Fund Name: {fund_ctx['fund_name']}")
        if fund_ctx.get('fund_type'):  lines.append(f"Fund Type: {fund_ctx['fund_type']}")
        if fund_ctx.get('thesis'):     lines.append(f"Investment Thesis: {fund_ctx['thesis']}")
        if fund_ctx.get('stages'):
            s = fund_ctx['stages'] if isinstance(fund_ctx['stages'], str) else ', '.join(fund_ctx['stages'])
            lines.append(f"Preferred Stages: {s}")
        if fund_ctx.get('sectors'):    lines.append(f"Sector Focus: {fund_ctx['sectors']}")
        if fund_ctx.get('check_size'): lines.append(f"Typical Check Size: {fund_ctx['check_size']}")

    if lines:
        fund_block = "\n".join(lines)
        thesis_instruction = (
            "\nAlso compute fund-fit fields:\n"
            "- thesis_match_score: 0-100 integer (80+=strong fit, 50=neutral, 30-=poor). null if no thesis.\n"
            "- fit_strengths: array of 2-3 short strings why this fits the thesis. [] if no thesis.\n"
            "- fit_weaknesses: array of 2-3 short strings of thesis gaps. [] if no thesis.\n"
            "- match_reasoning: 1-2 sentence thesis alignment summary. null if no thesis."
        )
    else:
        fund_block = (
            "This fund receives emails from founders seeking investment, LPs, warm intro connections, "
            "portfolio companies, service vendors, recruiters, press, event organizers, co-investors, "
            "and students seeking advice."
        )
        thesis_instruction = ""
    return fund_block, thesis_instruction


def _build_analysis_prompt(
    sender_name: str, sender_email: str, subject: str, body: str,
    received_date: Optional[str], attachments: Optional[str],
    fund_block: str, thesis_instruction: str,
) -> str:
    """Build the complete Claude prompt for email analysis. Pure function."""
    return (
        "Analyze this email received by an investment fund and extract every piece of relevant information.\n\n"
        f"EMAIL METADATA:\nReceived: {received_date or 'Unknown'}\n"
        f"From: {sender_name} <{sender_email}>\nSubject: {subject}\n"
        f"Attachments: {attachments or 'none'}\n\n"
        f"EMAIL BODY:\n{body[:2500]}\n\n"
        f"FUND CONTEXT:\n{fund_block}\n\n"
        "EXTRACTION INSTRUCTIONS:\n\n"
        "1. CATEGORY — classify into exactly one:\n"
        '"Founder pitch" — founder directly pitching their startup for investment, whether cold or warm. Use this whenever the primary intent is to raise capital from a founder, regardless of how they found you.\n'
        '"Warm intro" — email from a THIRD PARTY (mutual connection, advisor, existing investor) introducing a founder/company. The email is written by the introducer, not the founder.\n'
        '"LP / investor relations" — LP, potential LP, or investor relations communication\n'
        '"Portfolio company update" — update from a company the fund has invested in\n'
        '"Accelerator / program application" — startup applying to an accelerator program\n'
        '"Co-investor / syndicate" — another fund or angel about co-investing\n'
        '"Service provider / vendor" — company selling services to the fund or portfolio\n'
        '"Recruiter / hiring" — recruiter about placing candidates or finding talent\n'
        '"Press / media" — journalist or media outlet requesting interview or comment\n'
        '"Event invitation" — conference, demo day, networking event, pitch competition\n'
        '"Student / informational request" — student requesting a call or advice about VC\n'
        '"Spam / irrelevant" — mass outreach, automated emails, completely irrelevant\n'
        '"Other" — anything that does not fit above\n\n'
        "2. RELEVANCE SCORING (1-10):\n"
        "9-10: Warm intro from credible source to strong founder with traction. Repeat founder with prior exit. Top co-investor.\n"
        "7-8: Cold pitch with traction or strong team. Warm intro from known connection. Strong portfolio update. LP from credible investor.\n"
        "5-6: Cold pitch with interesting idea but no traction. Mixed portfolio update. Accelerator application with potential.\n"
        "3-4: Student request. Press inquiry. Relevant event invitation. General ecosystem networking.\n"
        "1-2: Service vendor/recruiter cold outreach. Spam. Automated notifications.\n\n"
        '3. warm_or_cold: "Warm" if mentions mutual connection/prior meeting/referral/third-party intro. "Cold" if pure cold outreach. "Unknown" if unclear.\n\n'
        "4. traction_mentioned=true if email mentions MRR, ARR, GMV, revenue, customer counts, growth rates, retention, named customers, waitlist, downloads, press coverage, or any growth metric.\n\n"
        "5. deck_attached=true if: (a) any attachment is .pdf/.pptx/.ppt/.key or filename contains deck/pitch/presentation/overview/memo, OR (b) body links to docsend.com, pitch.com, canva.com/deck, slides.google.com, OR (c) body mentions 'happy to send the deck', 'can share our deck', 'send you our pitch', 'deck attached', 'sending the deck', 'share the deck', 'link to our deck', or similar offers/offers to provide a pitch deck.\n\n"
        '6. stage: "Pre-idea", "Pre-seed", "Seed", "Series A", "Series B+", "Growth", or "Unknown"\n\n'
        "7. check_size_requested: dollar amount if mentioned (e.g. '$2,000,000' or '$2M seed'), null if not.\n\n"
        "8. urgency_score 1-10: 8-10=closing imminently/this week. 5-7=active fundraise/timeline. 2-4=general interest. 1=no urgency.\n\n"
        "9. next_action — exactly one of: 'Review now', 'Schedule meeting', 'Forward to partner', 'Request more info', 'Add to pipeline', 'Follow up later', 'Archive', 'Ignore'\n\n"
        "10. summary: 2-3 sentences. Reference actual company name, founder name, most important signal (traction number, intro source, prior exit, red flag). Be specific not generic.\n"
        'BAD: "A founder is pitching their startup."\n'
        'GOOD: "Marcus Chen, 2nd-time founder with a prior Salesforce exit, is raising a $3M seed for VaultAI — AI contract intelligence. Introduced by Priya Sharma. Claims $45k MRR growing 40% MoM. Strong warm signal, high priority."\n\n'
        "11. tags: Up to 6 short descriptive tags. Good examples: 'YC founder', 'repeat founder', 'prior exit', 'enterprise SaaS', 'B2B', 'climate tech', 'fintech', 'health tech', 'AI infrastructure', 'strong traction', 'warm intro', 'seed round'. BAD: 'startup', 'founder', 'email', 'pitch'.\n\n"
        '12. confidence: "High" (clear signals), "Medium" (some ambiguity), "Low" (very short/unclear).\n'
        f"{thesis_instruction}\n"
        "RETURN THIS EXACT JSON STRUCTURE AND NOTHING ELSE:\n"
        '{\n'
        '  "company_name": string or null,\n'
        '  "founder_name": string or null,\n'
        '  "founder_role": string or null,\n'
        '  "category": string,\n'
        '  "warm_or_cold": string,\n'
        '  "sector": string or null,\n'
        '  "stage": string or null,\n'
        '  "check_size_requested": string or null,\n'
        '  "geography": string or null,\n'
        '  "deck_attached": boolean,\n'
        '  "traction_mentioned": boolean,\n'
        '  "intro_source": string or null,\n'
        '  "summary": string,\n'
        '  "relevance_score": integer 1-10,\n'
        '  "urgency_score": integer 1-10,\n'
        '  "next_action": string,\n'
        '  "confidence": string,\n'
        '  "tags": array of strings,\n'
        '  "thesis_match_score": integer 0-100 or null,\n'
        '  "fit_strengths": array of strings,\n'
        '  "fit_weaknesses": array of strings,\n'
        '  "match_reasoning": string or null\n'
        '}'
    )


async def analyze_email(sender_name: str, sender_email: str, subject: str, body: str,
                        received_date: str = None, attachments: str = None,
                        fund_ctx: dict = None) -> dict:
    fund_block, thesis_instruction = _build_fund_context_block(fund_ctx)
    prompt = _build_analysis_prompt(
        sender_name, sender_email, subject, body,
        received_date, attachments, fund_block, thesis_instruction,
    )

    try:
        logger.info(f'[CLAUDE] Processing: "{subject}" from {sender_email}')
        msg = await claude_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1200,
            system=CLAUDE_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        text = re.sub(r'^```(?:json)?\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
        result = json.loads(text)
        logger.info(f'[CLAUDE] Success: "{subject}" | category={result.get("category")} score={result.get("relevance_score")} confidence={result.get("confidence")}')
        return result
    except json.JSONDecodeError as e:
        logger.error(f'[CLAUDE] JSON parse FAILED for "{subject}": {e}')
        return _claude_fallback()
    except Exception as e:
        logger.error(f'[CLAUDE] FAILED for "{subject}" from {sender_email}: {e}')
        return _claude_fallback()

def _claude_fallback() -> dict:
    return {
        "category": "Unprocessed", "summary": "AI extraction failed — review manually",
        "relevance_score": 0, "urgency_score": 0, "next_action": "Review now",
        "confidence": "Low", "tags": [], "warm_or_cold": "Unknown",
        "deck_attached": False, "traction_mentioned": False,
        "thesis_match_score": None, "fit_strengths": [], "fit_weaknesses": [], "match_reasoning": None,
        "company_name": None, "founder_name": None, "founder_role": None,
        "sector": None, "stage": None, "check_size_requested": None,
        "geography": None, "intro_source": None,
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

def _build_deal_dict(
    user_id: str, thread_id: Optional[str], message_id: Optional[str],
    sender_name: str, sender_email: str, subject: str, body: str,
    received_date: Optional[str], gmail_link: Optional[str], ai: dict,
) -> dict:
    """Build the deal dict from Claude AI extraction results. Pure function — no DB calls."""
    now = datetime.now(timezone.utc).isoformat()
    return {
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
        'deal_stage': 'Inbound',
        'processed_at': now,
        'created_at': now,
    }


@dataclass
class EmailPayload:
    """Groups the parameters for process_and_save_email to reduce function arity."""
    user_id: str
    sender_name: str
    sender_email: str
    subject: str
    body: str
    thread_id: Optional[str] = None
    message_id: Optional[str] = None
    received_date: Optional[str] = None
    gmail_link: Optional[str] = None
    fund_ctx: Optional[dict] = None
    skip_dedup: bool = False
    force_replace: bool = False
    attachments: Optional[str] = None


async def process_and_save_email(
    user_id: Optional[str], sender_name: str, sender_email: str,
    subject: str, body: str, thread_id: str = None,
    message_id: str = None, received_date: str = None, gmail_link: str = None,
    fund_ctx: dict = None, skip_dedup: bool = False, force_replace: bool = False,
    run_gate: bool = True,
) -> Optional[dict]:
    # Deduplicate (only if not already checked by caller's pre-fetched set)
    if not skip_dedup and user_id and thread_id:
        existing = await sb_select('deals', {
            'user_id': f'eq.{user_id}', 'thread_id': f'eq.{thread_id}'
        })
        if existing:
            logger.debug(f'[DEDUP] Thread {thread_id} already exists, skipping: "{subject}"')
            return None

    # ── AI Gate — run before full extraction ──────────────────────────────────
    if run_gate:
        gate = await gate_email(sender_name, sender_email, subject, body)
        if not gate['belongs']:
            logger.info(f'[GATE] Gated out: "{subject}" — {gate["reason"]}')
            if user_id:
                await save_gated_email(user_id, sender_name, sender_email,
                                       subject, body, received_date, gate['reason'])
            return 'gated'  # sentinel so callers can count it

    ai = await analyze_email(
        sender_name=sender_name, sender_email=sender_email,
        subject=subject, body=body,
        received_date=received_date,
        fund_ctx=fund_ctx,
    )

    # Skip saving categories that are definitively not deal-relevant.
    # Claude's classification is reliable enough — no need to pollute the deals table.
    # Press/media and event invitations are filtered here: they clutter the dashboard
    # and are never actionable deal flow. They remain accessible via gated_emails.
    CATEGORIES_TO_SKIP_SAVING = {
        'Spam / irrelevant',
        'Service provider / vendor',
        'Recruiter / hiring',
        'Press / media',
        'Event invitation',
    }
    category = ai.get('category', '')
    if category in CATEGORIES_TO_SKIP_SAVING:
        logger.info(f'[PROCESS] Skipping save — category={category}: "{subject}"')
        if user_id:
            await save_gated_email(
                user_id, sender_name, sender_email,
                subject, body, received_date,
                f'Category: {category} — filtered before save',
            )
        return 'gated'

    deal = _build_deal_dict(
        user_id=user_id, thread_id=thread_id, message_id=message_id,
        sender_name=sender_name, sender_email=sender_email,
        subject=subject, body=body,
        received_date=received_date, gmail_link=gmail_link,
        ai=ai,
    )
    saved = await sb_insert('deals', deal, upsert=force_replace)
    if not saved:
        # Fallback: retry without new schema fields if columns don't exist yet
        for f in ('thesis_match_score', 'fit_strengths', 'fit_weaknesses', 'match_reasoning'):
            deal.pop(f, None)
        saved = await sb_insert('deals', deal, upsert=force_replace)
    if saved:
        logger.info(f'[PROCESS] Saved: "{subject}" from {sender_email} | category={ai.get("category")} score={ai.get("relevance_score")}')
        # Auto-create / update contact for every saved deal (not stage-gated)
        if user_id:
            await sync_contact(user_id, saved, is_new_deal=True)
            await _log_deal_activity(user_id, saved, 'deal_received',
                f"New deal received: {saved.get('company_name') or saved.get('sender_name', 'Unknown')}")
        return saved
    else:
        logger.error(f'[PROCESS] FAILED to save: "{subject}" from {sender_email}')
        return None

async def _refresh_gmail_token_if_needed(user: dict, user_id: str, gmail, creds):
    """Proactively refresh the Gmail OAuth token if expired. Returns (gmail, creds)."""
    try:
        needs_refresh = creds.expired or not creds.token
    except Exception:
        needs_refresh = True

    if not (needs_refresh and creds.refresh_token):
        return gmail, creds

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
    updated_user = {**user, 'access_token': creds.token, 'token_expiry': new_expiry}
    gmail, creds = await asyncio.to_thread(build_gmail_service, updated_user)
    logger.info(f'[SYNC] Token refreshed. New expiry: {new_expiry}')
    return gmail, creds


def _build_gmail_query_params(
    user: dict, is_initial: bool, force_full_scan: bool, force_reprocess: bool,
) -> dict:
    """Build Gmail API list() params based on sync mode and last-sync timestamp."""
    base_q = 'in:inbox -from:me -category:promotions -category:social -category:updates -category:forums'
    params: dict = {'userId': 'me', 'maxResults': 50, 'labelIds': ['INBOX']}
    if not force_full_scan and not is_initial and not force_reprocess and user.get('last_synced'):
        try:
            ls = datetime.fromisoformat(user['last_synced'].replace('Z', '+00:00'))
            params['q'] = f'{base_q} after:{int(ls.timestamp())}'
            logger.info(f'[SYNC] Incremental scan after {user["last_synced"][:19]}')
        except Exception as e:
            logger.warning(f'[SYNC] Could not parse last_synced ({e}), falling back to full scan')
            params['q'] = base_q
    else:
        params['q'] = base_q
        logger.info(f'[SYNC] Full scan (force_full={force_full_scan}, initial={is_initial}, force_reprocess={force_reprocess})')
    return params


# ── Gmail sync ─────────────────────────────────────────────────────────────────────
async def _process_single_message(
    gmail, ref: dict, idx: int, total: int,
    user: dict, user_id: str,
    existing_thread_ids: set, fund_ctx: dict,
    force_reprocess: bool,
) -> str:
    """
    Fetch one Gmail message, run noise filters, and save to DB.
    Returns: 'dup' | 'noise' | 'gated' | 'saved' | 'unsaved'
    Raises on unrecoverable errors (caller catches and counts as 'error').
    """
    msg = await asyncio.to_thread(
        lambda mid=ref['id']: gmail.users().messages().get(
            userId='me', id=mid, format='full'
        ).execute()
    )
    headers = msg.get('payload', {}).get('headers', [])
    subject_for_log = get_header(headers, 'Subject') or '(No Subject)'
    thread_id = msg.get('threadId', ref['id'])

    if thread_id in existing_thread_ids:
        logger.debug(f'[SYNC] [{idx}/{total}] SKIP (dup) thread={thread_id}: "{subject_for_log}"')
        return 'dup'

    from_header = get_header(headers, 'From') or ''
    if '<' in from_header:
        from_name = from_header.split('<')[0].strip().strip('"')
        from_email = from_header.split('<')[1].strip('> ')
    else:
        from_email = from_header.strip()
        from_name = from_email.split('@')[0] if '@' in from_email else from_email

    subject = get_header(headers, 'Subject') or '(No Subject)'
    body = extract_body(msg.get('payload', {}))

    # ── Noise filters — run BEFORE Claude to save API credits ──
    if is_newsletter(headers):
        logger.info(f'[SYNC] [{idx}] SKIP (unsubscribe-header): "{subject_for_log}"')
        existing_thread_ids.add(thread_id)
        return 'noise'
    if is_automated_sender(from_email, from_name):
        logger.info(f'[SYNC] [{idx}] SKIP (automated-sender): {from_email}')
        existing_thread_ids.add(thread_id)
        return 'noise'
    if is_noisy_subject(subject):
        logger.info(f'[SYNC] [{idx}] SKIP (noisy-subject): "{subject_for_log}"')
        existing_thread_ids.add(thread_id)
        return 'noise'
    if len(body.strip()) < MIN_BODY_LENGTH:
        logger.info(f'[SYNC] [{idx}] SKIP (body-too-short {len(body.strip())} chars): "{subject_for_log}"')
        existing_thread_ids.add(thread_id)
        return 'noise'
    if from_email.lower() == (user.get('email') or '').lower():
        logger.info(f'[SYNC] [{idx}] SKIP (self-sent): "{subject_for_log}"')
        existing_thread_ids.add(thread_id)
        return 'noise'

    date_str = get_header(headers, 'Date')
    try:
        received_date = parsedate_to_datetime(date_str).isoformat() if date_str else None
    except Exception:
        received_date = None

    gmail_link = f'https://mail.google.com/mail/u/0/#inbox/{thread_id}'
    logger.info(f'[SYNC] [{idx}/{total}] SENDING TO CLAUDE: "{subject}" from {from_email}')

    result = await process_and_save_email(
        user_id=user_id, sender_name=from_name, sender_email=from_email,
        subject=subject, body=body, thread_id=thread_id,
        message_id=ref['id'], received_date=received_date,
        gmail_link=gmail_link, fund_ctx=fund_ctx,
        skip_dedup=True, force_replace=force_reprocess,
    )
    existing_thread_ids.add(thread_id)
    return result if result in ('gated', None) else 'saved'


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

    fund_ctx = await get_fund_settings(user_id)
    try:
        gmail, creds = await asyncio.to_thread(build_gmail_service, user)

        # Proactively refresh token — avoids mid-sync expiry
        gmail, creds = await _refresh_gmail_token_if_needed(user, user_id, gmail, creds)

        params = _build_gmail_query_params(user, is_initial, force_full_scan, force_reprocess)

        logger.info('[SYNC] Fetching messages from Gmail API...')

        is_full_scan = (force_full_scan or is_initial or not user.get('last_synced'))
        max_pages = 10 if is_initial else (6 if is_full_scan else 1)
        messages = []
        page_token = None

        for page_num in range(max_pages):
            page_params = {**params}
            if page_token:
                page_params['pageToken'] = page_token

            resp = await asyncio.to_thread(
                lambda p=page_params: gmail.users().messages().list(**p).execute()
            )
            batch = resp.get('messages', [])
            messages.extend(batch)
            page_token = resp.get('nextPageToken')

            if not page_token:
                break

        logger.info(f'[SYNC] Gmail API returned {len(messages)} messages across {page_num + 1} page(s)')
        _set_sync_progress(user_id, 2, f'Found {len(messages)} emails — filtering noise...', len(messages), 0)

        if not messages:
            await sb_update('users', {'last_synced': datetime.now(timezone.utc).isoformat()}, {'id': f'eq.{user_id}'})
            logger.info('[SYNC] No messages in Gmail response — inbox empty or no new mail since last sync')
            return 0

        # ── PRE-FETCH all existing thread IDs in ONE query (avoids 100 round-trip HTTP calls) ──
        if not force_reprocess:
            all_deals = await sb_select('deals', {'user_id': f'eq.{user_id}', 'select': 'thread_id'})
            existing_thread_ids: set = {d['thread_id'] for d in (all_deals or []) if d.get('thread_id')}
            logger.info(f'[SYNC] Pre-fetched {len(existing_thread_ids)} existing thread IDs (dedup set ready)')
        else:
            existing_thread_ids = set()
            logger.info('[SYNC] force_reprocess=True — deduplication bypassed, reprocessing all messages')

        processed = 0
        skipped_dup = 0
        skipped_noise = 0
        gated_out = 0
        errors = 0

        for i, ref in enumerate(messages):
            try:
                _set_sync_progress(user_id, 3, f'Processing email {i+1} of {len(messages)}…', len(messages), i + 1)
                outcome = await _process_single_message(
                    gmail, ref, i + 1, len(messages),
                    user, user_id, existing_thread_ids,
                    fund_ctx, force_reprocess,
                )
                if outcome == 'dup':
                    skipped_dup += 1
                elif outcome == 'noise':
                    skipped_noise += 1
                elif outcome == 'gated':
                    gated_out += 1
                elif outcome == 'saved':
                    processed += 1
                    logger.info(f'[SYNC] [{i+1}/{len(messages)}] SAVED')
                else:
                    logger.warning(f'[SYNC] [{i+1}/{len(messages)}] Save returned None')
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.error(f'[SYNC] [{i+1}/{len(messages)}] Error on message {ref["id"]}: {e}')
                errors += 1

        await sb_update('users', {'last_synced': datetime.now(timezone.utc).isoformat()}, {'id': f'eq.{user_id}'})
        fetched = len(messages)
        logger.info(
            f'[SYNC] ── Complete for {user.get("email")} — '
            f'fetched={fetched}, saved={processed}, skipped_dup={skipped_dup}, '
            f'filtered_noise={skipped_noise}, gated_out={gated_out}, errors={errors} ──'
        )
        _set_sync_progress(
            user_id, 5,
            f'Sync complete — {processed} new deal{"s" if processed != 1 else ""} added',
            processed, processed,
            fetched=fetched,
            passed_gate=fetched - skipped_dup - skipped_noise - gated_out,
            gated_out=gated_out,
            new_deals=processed,
        )
        return processed
    except Exception as e:
        err = str(e)
        logger.error(f'[SYNC] FATAL error for {user_id}: {e}')
        if 'invalid_scope' in err or 'invalid_grant' in err or 'unauthorized' in err.lower():
            raise
        return 0

@api_router.get("/sync/status")
async def sync_status_endpoint(current_user: dict = Depends(get_current_user)):
    """Returns current sync progress + last_synced time for the nav bar."""
    uid = current_user['user_id']
    progress = _sync_progress.get(uid, {})
    users = await sb_select('users', {'id': f'eq.{uid}'})
    last_synced = users[0].get('last_synced') if users else None
    return {
        'step': progress.get('step', 0),
        'message': progress.get('message', ''),
        'total': progress.get('total', 0),
        'current': progress.get('current', 0),
        'last_synced': last_synced,
        'is_syncing': uid in _syncing_users,
        'fetched': progress.get('fetched'),
        'passed_gate': progress.get('passed_gate'),
        'gated_out': progress.get('gated_out'),
        'new_deals': progress.get('new_deals'),
    }



async def sync_all_users():
    users = await sb_select('users', {'refresh_token': 'not.is.null'})
    for u in users:
        await sync_user_emails(u['id'])

# ── Action engine ──────────────────────────────────────────────────────────────
ACTION_PROMPTS = {
    'reject': (
        "Write a pass email from an investor — professional but warm, the way a respectful senior investor "
        "would actually write one. Use a proper greeting ('Hi [first name],') and a brief sign-off. "
        "3-4 sentences. Thank them briefly, give one honest and specific reason for passing tied to thesis "
        "or stage fit, and leave the door open genuinely if appropriate. "
        "NEVER use: 'at this time', 'at this stage', 'exciting opportunity', 'impressive work', "
        "'best of luck on your journey', 'we wish you all the best', or any hollow corporate filler. "
        "The reason for passing must be specific to this company — not a generic template excuse."
    ),
    'request_info': (
        "Write a follow-up email from an interested investor — professional, warm, and specific. "
        "Use a proper greeting ('Hi [first name],') and a brief sign-off. "
        "3-5 sentences. Open with a genuine line showing you read the pitch. "
        "Ask 2-3 targeted questions about what you actually need to evaluate this deal — "
        "current traction, round composition, team background, or market sizing. "
        "Close by proposing a short call. "
        "NEVER use: 'I hope this email finds you well', 'I wanted to reach out', "
        "'please don't hesitate', 'at your earliest convenience', or any corporate boilerplate opener."
    ),
    'forward_partner': (
        "Write a brief internal note forwarding a deal to a co-investor or fund partner. "
        "Professional but conversational — the tone of a trusted colleague sharing a deal, not a formal memo. "
        "3-4 sentences. Cover what the company does, the key signal or reason it's interesting, "
        "and a suggested next step. Be opinionated. "
        "NEVER use bullet points, formal headers, or memo-style language."
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
            max_tokens=500,
            system=(
                "You are a venture capital investor writing emails from your personal inbox. "
                "Your tone is professional and courteous but natural — never stiff or corporate. "
                "You write like an experienced investor who respects founders' time: clear, specific, and genuine. "
                "Emails have a proper greeting and sign-off but are not long-winded. "
                "Return ONLY valid JSON with 'subject' and 'body' fields. No markdown."
            ),
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
            user_data['trial_ends_at'] = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
            user_data['subscription_status'] = 'trialing'
            new_user = await sb_insert('users', user_data)
            # Prefer the id Supabase actually stored over our locally-generated UUID.
            # If the insert response is missing (rare Supabase edge-case), re-fetch to confirm.
            if new_user and new_user.get('id'):
                user_id = new_user['id']
            else:
                refetch = await sb_select('users', {'google_id': f'eq.{google_id}'})
                user_id = refetch[0]['id'] if refetch else user_data['id']
                logger.warning(f'[Auth] insert returned no id — refetched user_id: {user_id[:8]}')

        # Verify the id we're about to embed in the JWT actually exists in the DB.
        verify = await sb_select('users', {'id': f'eq.{user_id}'})
        if not verify:
            logger.error(f'[Auth] CRITICAL: user_id {user_id} not found in users table after insert/update')
        else:
            logger.info(f'[Auth] JWT will use verified user_id: {user_id[:8]}')

        # Mark that this user has completed the full OAuth flow (includes gmail.send scope)
        await sb_update('users', {'gmail_send_enabled': True}, {'id': f'eq.{user_id}'})

        token = create_jwt(user_id, email)
        background_tasks.add_task(sync_user_emails, user_id, True)
        _secure = FRONTEND_URL.startswith('https://')
        resp = RedirectResponse(url=f'{FRONTEND_URL}/oauth-callback', status_code=302)
        resp.set_cookie(
            key='vc_token', value=token,
            httponly=True, samesite='none', secure=True,
            max_age=30 * 24 * 3600, path='/',
        )
        return resp
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
        'gmail_send_enabled': bool(u.get('gmail_send_enabled')),
    }

@api_router.post("/auth/logout")
async def logout():
    _secure = FRONTEND_URL.startswith('https://')
    resp = JSONResponse({"message": "Logged out"})
    resp.delete_cookie('vc_token', samesite='none', secure=True, path='/')
    return resp

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
        sb_select('deals', {'user_id': f'eq.{uid}', 'status': 'neq.deleted', 'order': 'created_at.desc', 'limit': '200'}),
        sb_select('deals', {'user_id': f'eq.{SYSTEM_USER_ID}', 'status': 'neq.deleted', 'order': 'created_at.desc'}),
    )
    def is_relevant(d):
        cat = d.get('category', '')
        irrelevant = {'Spam / irrelevant', 'Service provider / vendor', 'Recruiter / hiring'}
        return cat not in irrelevant
    # User deals no longer contain skipped categories (filtered at save time).
    # Sample deals still need filtering since we cannot control the system user's data.
    return [d for d in (user_deals or [])] + [d for d in (sample_deals or []) if is_relevant(d)]


@api_router.get("/deals/fund")
async def get_fund_deals(current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    fund_info = await get_user_fund_info(uid)
    if not fund_info:
        return []
    SKIP = {'Spam / irrelevant', 'Service provider / vendor', 'Recruiter / hiring'}
    all_deals = []
    for member in fund_info['members']:
        rows = await sb_select('deals', {'user_id': f'eq.{member["user_id"]}', 'status': 'neq.deleted', 'order': 'created_at.desc', 'limit': '100'})
        for deal in (rows or []):
            if deal.get('category') not in SKIP:
                deal['inbox_owner_name'] = member['display_name']
                deal['inbox_owner_email'] = member['email']
                all_deals.append(deal)
    all_deals.sort(key=lambda d: d.get('created_at') or '', reverse=True)
    return all_deals


@api_router.get("/deals/archived")
async def get_archived_deals(current_user: dict = Depends(get_current_user)):
    """Return soft-deleted deals within the 30-day recovery window."""
    uid = current_user['user_id']
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    rows = await sb_select('deals', {
        'user_id': f'eq.{uid}',
        'status': 'eq.deleted',
        'updated_at': f'gte.{cutoff}',
        'order': 'updated_at.desc',
    })
    return rows or []


@api_router.post("/deals/process")
async def process_email_manual(data: dict, current_user: dict = Depends(get_current_user)):
    if not await check_subscription_access(current_user['user_id']):
        raise HTTPException(status_code=402, detail="subscription_required")
    body = data.get('body', '').strip()
    if not body:
        raise HTTPException(status_code=400, detail="Email body is required")
    fund_ctx = await get_fund_settings(current_user['user_id'])
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
    allowed = {'status', 'notes', 'next_action', 'deal_stage', 'follow_up_date'}
    update = {k: v for k, v in data.items() if k in allowed}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    # Auto-sync deal_stage when status is provided from the dashboard buttons
    # so Pipeline page (which reads deal_stage) stays in sync
    STATUS_TO_STAGE = {
        'Pipeline':  'First Look',
        'In Review': 'First Look',
        'Passed':    'Passed',
        'New':       'Inbound',
    }
    if 'status' in update and 'deal_stage' not in update:
        mapped_stage = STATUS_TO_STAGE.get(update['status'])
        if mapped_stage:
            update['deal_stage'] = mapped_stage

    uid = current_user['user_id']
    ok = await sb_update('deals', update, {
        'id': f'eq.{deal_id}',
        'user_id': f'in.({uid},{SYSTEM_USER_ID})'
    })
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to update deal")

    contact_result = None
    rows = await sb_select('deals', {'id': f'eq.{deal_id}'})
    if rows:
        deal = rows[0]
        contact_result = await sync_contact(uid, deal)
        logger.info(f'[Contact Trigger] PATCH /deals/{deal_id[:8]} result={contact_result}')
        if 'follow_up_date' in update and update.get('follow_up_date'):
            await _log_deal_activity(uid, deal, 'follow_up_set', f"Follow-up set for {update['follow_up_date']}")
    else:
        logger.warning(f'[Contact Trigger] Could not re-fetch deal {deal_id} after update')

    return {"message": "Updated", "deal_id": deal_id, "contact": contact_result}

@api_router.post("/deals/{deal_id}/generate-action")
async def generate_deal_action(deal_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    action_type = data.get('action_type', 'request_info')
    if action_type not in ('reject', 'request_info', 'forward_partner'):
        raise HTTPException(status_code=400, detail="Invalid action_type")
    deals = await sb_select('deals', {'id': f'eq.{deal_id}'})
    if not deals:
        raise HTTPException(status_code=404, detail="Deal not found")
    fund_ctx = await get_fund_settings(current_user['user_id'])
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
    stage_map = {
        'reject': 'Passed',
        'request_info': 'In Conversation',
        'forward_partner': 'In Conversation',
    }
    new_stage = stage_map.get(action_type, 'In Conversation')

    await sb_update('deals', {
        'deal_stage': new_stage,
        'status': 'Reviewed',
    }, {
        'id': f'eq.{deal_id}',
        'user_id': f'in.({uid},{SYSTEM_USER_ID})',
    })

    if new_stage == 'Passed':
        updated_deals = await sb_select('deals', {'id': f'eq.{deal_id}'})
        if updated_deals:
            await sync_contact(uid, updated_deals[0], is_new_deal=False)

    await _log_deal_activity(uid, deal, 'email_sent', f"Email sent ({action_type.replace('_', ' ')})")
    return {"message": "Email sent", "stage": new_stage}

# Sync
async def _run_background_sync(user_id: str, force_reprocess: bool = False):
    """Run a full inbox scan in the background, releasing the HTTP response immediately."""
    try:
        _set_sync_progress(user_id, 1, 'Connecting to Gmail...')
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
    if not await check_subscription_access(user_id):
        raise HTTPException(status_code=402, detail="subscription_required")
    if user_id in _syncing_users:
        return {"message": "Sync already running", "status": "already_syncing", "new_deals": 0}
    _syncing_users.add(user_id)
    background_tasks.add_task(_run_background_sync, user_id, force)
    logger.info(f'[SYNC] Triggered for user {user_id} (force_reprocess={force})')
    return {"message": "Sync started", "status": "started", "new_deals": 0}

# ── Contacts ──────────────────────────────────────────────────────────────────

@api_router.post("/contacts/upsert")
async def upsert_contact(data: dict, current_user: dict = Depends(get_current_user)):
    """Kept for backward compatibility — delegates to sync_contact."""
    uid = current_user['user_id']
    deal = data.get('deal', {})
    if not deal:
        raise HTTPException(status_code=400, detail="No deal payload provided")
    result = await sync_contact(uid, deal)
    if not result:
        raise HTTPException(status_code=400, detail="Contact not eligible — missing email or spam category")
    return result


@api_router.post("/contacts/rebuild")
async def rebuild_contacts(current_user: dict = Depends(get_current_user)):
    """Delete all contacts for this user and rebuild from ALL visible deals (own + sample)."""
    uid = current_user['user_id']
    await sb_delete('contacts', {'user_id': f'eq.{uid}'})
    # Mirror the same deal pool that GET /deals returns — own deals + shared sample deals
    deals = await sb_select('deals', {
        'user_id': f'in.({uid},{SYSTEM_USER_ID})',
        'status': 'neq.deleted',
    })
    created = skipped = 0
    for deal in (deals or []):
        r = await sync_contact(uid, deal)
        if r:
            created += 1
        else:
            skipped += 1
    logger.info(f'[Rebuild] user={uid[:8]} created={created} skipped={skipped} from {len(deals or [])} deals')
    return {'message': 'Contacts rebuilt', 'created': created, 'skipped': skipped}


@api_router.get("/contacts")
async def get_contacts(current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    logger.info(f'[Contacts] Fetching for user_id: {uid}')
    contacts = await sb_select('contacts', {
        'user_id': f'eq.{uid}',
        'order': 'last_contacted.desc',
    })
    count = len(contacts) if contacts else 0
    logger.info(f'[Contacts] Found: {count} contacts for user {uid[:8]}')
    if count == 0:
        # Cross-check: are there ANY contacts at all? Reveals user_id mismatch.
        all_contacts = await sb_select('contacts', {})
        total = len(all_contacts) if all_contacts else 0
        logger.info(f'[Contacts] Total in table: {total}')
        if total:
            unique_uids = set(c.get('user_id') for c in all_contacts)
            logger.info(f'[Contacts] user_ids in table: {unique_uids} — requesting uid={uid}')
    return contacts or []


@api_router.post("/contacts/sync-pipeline")
async def sync_contacts_from_pipeline(current_user: dict = Depends(get_current_user)):
    """Retroactively sync contacts from all visible deals (own + sample)."""
    uid = current_user['user_id']
    logger.info(f'[Pipeline Sync] Starting for user: {uid}')

    deals = await sb_select('deals', {
        'user_id': f'in.({uid},{SYSTEM_USER_ID})',
        'status': 'neq.deleted',
    })
    logger.info(f'[Pipeline Sync] Found {len(deals) if deals else 0} deals for user {uid[:8]}')

    created = updated = skipped = failed = 0
    for deal in (deals or []):
        result = await sync_contact(uid, deal)
        if result is None:
            skipped += 1
        elif result.get('status') == 'created':
            created += 1
        elif result.get('status') == 'updated':
            updated += 1
        else:
            failed += 1

    synced = created + updated
    logger.info(f'[Pipeline Sync] Done: created={created} updated={updated} skipped={skipped} failed={failed} user={uid[:8]}')
    return {'synced': synced, 'created': created, 'updated': updated, 'skipped': skipped, 'failed': failed, 'user_id': uid}


@api_router.patch("/contacts/{contact_id}")
async def update_contact(contact_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    _allowed = {'notes', 'tags', 'contact_status', 'name', 'email', 'company', 'role',
                'sector', 'stage', 'geography', 'intro_source', 'warm_or_cold', 'relevance_score'}
    update = {k: v for k, v in data.items() if k in _allowed}
    update['updated_at'] = datetime.now(timezone.utc).isoformat()
    await sb_update('contacts', update, {'id': f'eq.{contact_id}', 'user_id': f'eq.{uid}'})
    if 'notes' in update and update['notes'] is not None:
        await create_contact_activity(contact_id, uid, 'note_saved', 'Note updated')
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
        'fund_settings': u.get('fund_settings') or {},
        'weekly_digest_enabled': u.get('weekly_digest_enabled', True),
    }

# Fund settings
@api_router.get("/fund-settings")
async def get_fund_settings_route(current_user: dict = Depends(get_current_user)):
    return await get_fund_settings(current_user['user_id'])

@api_router.post("/fund-settings")
async def save_fund_settings_route(data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    # Merge into existing settings so onboarding_complete survives fund-settings saves
    existing = await get_fund_settings(uid)
    allowed = {'fund_name', 'fund_type', 'thesis', 'stages', 'sectors', 'check_size'}
    clean = {**existing, **{k: v for k, v in data.items() if k in allowed}}
    await save_fund_settings(uid, clean)
    return {"message": "Fund settings saved", "settings": clean}

@api_router.post("/onboarding-complete")
async def mark_onboarding_complete(current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    settings = await get_fund_settings(uid)
    settings['onboarding_complete'] = True
    await save_fund_settings(uid, settings)
    return {"ok": True}

# DB status for frontend
@api_router.get("/status/db")
async def db_status():
    exists = await sb_table_exists('users')
    return {"tables_ready": exists}

@api_router.get("/gated-emails")
async def get_gated_emails(current_user: dict = Depends(get_current_user)):
    """Return the last 30 gated emails for the current user."""
    uid = current_user['user_id']
    try:
        rows = await sb_select('gated_emails', {
            'user_id': f'eq.{uid}',
            'order': 'created_at.desc',
            'limit': '30',
        })
        return {'emails': [
            {k: v for k, v in r.items() if k != '_id'}
            for r in (rows or [])
        ]}
    except Exception as e:
        logger.warning(f'[GATED] Could not fetch gated_emails (table may not exist): {e}')
        return {'emails': [], 'table_missing': True}


@api_router.post("/gated-emails/{gated_id}/restore")
async def restore_gated_email(gated_id: str, current_user: dict = Depends(get_current_user)):
    """Run full extraction on a gated email, save to deals, remove from gated_emails."""
    uid = current_user['user_id']
    rows = await sb_select('gated_emails', {'id': f'eq.{gated_id}', 'user_id': f'eq.{uid}'})
    if not rows:
        raise HTTPException(status_code=404, detail="Gated email not found")
    g = rows[0]
    result = await process_and_save_email(
        user_id=uid,
        sender_name=g.get('sender_name', ''),
        sender_email=g.get('sender_email', ''),
        subject=g.get('subject', ''),
        body=g.get('body_preview', ''),
        received_date=g.get('received_date'),
        run_gate=False,  # bypass gate — user explicitly restoring
    )
    if result and result != 'gated':
        try:
            await sb_update('gated_emails', {'restored': True}, {'id': f'eq.{gated_id}'})
            # Delete the gated_emails row
            async with httpx.AsyncClient(timeout=15) as client:
                await client.delete(
                    f'{SUPABASE_URL}/rest/v1/gated_emails',
                    headers=SB_HEADERS,
                    params={'id': f'eq.{gated_id}'},
                )
        except Exception:
            pass
        return {'ok': True, 'deal_id': result.get('id') if isinstance(result, dict) else None}
    raise HTTPException(status_code=500, detail="Could not process email")




def generate_invite_code() -> str:
    """Format: 3 uppercase letters + dash + 4 uppercase alphanumeric. e.g. FFC-X7K2"""
    alphabet_upper = string.ascii_uppercase
    alphabet_alnum = string.ascii_uppercase + string.digits
    prefix = ''.join(secrets.choice(alphabet_upper) for _ in range(3))
    suffix = ''.join(secrets.choice(alphabet_alnum) for _ in range(4))
    return f"{prefix}-{suffix}"


async def get_user_fund_info(user_id: str) -> Optional[dict]:
    """Returns {fund, role, members} or None if user is not in a fund."""
    memberships = await sb_select('fund_members', {'user_id': f'eq.{user_id}'})
    if not memberships:
        return None
    membership = memberships[0]
    fund_id = membership['fund_id']
    funds = await sb_select('funds', {'id': f'eq.{fund_id}'})
    if not funds:
        return None
    fund = {k: v for k, v in funds[0].items() if k != '_id'}
    members_raw = await sb_select('fund_members', {'fund_id': f'eq.{fund_id}'})
    members = []
    for m in (members_raw or []):
        u_rows = await sb_select('users', {'id': f'eq.{m["user_id"]}'})
        uu = u_rows[0] if u_rows else {}
        members.append({
            'user_id': m['user_id'],
            'role': m.get('role', 'member'),
            'display_name': m.get('display_name') or uu.get('name') or uu.get('email', ''),
            'email': uu.get('email', ''),
            'joined_at': m.get('joined_at'),
        })
    return {'fund': fund, 'role': membership.get('role', 'member'), 'members': members}


async def create_notification(user_id: str, fund_id: str, notif_type: str, message: str, deal_id: str = None):
    await sb_insert('notifications', {
        'user_id': user_id, 'fund_id': fund_id, 'type': notif_type,
        'message': message, 'deal_id': deal_id, 'read': False,
    })


# ── Fund endpoints ──────────────────────────────────────────────────────────────

@api_router.post("/funds")
async def create_fund(data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    if await sb_select('fund_members', {'user_id': f'eq.{uid}'}):
        raise HTTPException(status_code=400, detail="You already belong to a fund. Leave it first.")
    fund_name = (data.get('name') or '').strip()
    if not fund_name:
        raise HTTPException(status_code=400, detail="Fund name is required")
    invite_code = generate_invite_code()
    for _ in range(10):
        if not await sb_select('funds', {'invite_code': f'eq.{invite_code}'}):
            break
        invite_code = generate_invite_code()
    fund = await sb_insert('funds', {
        'name': fund_name, 'created_by': uid, 'invite_code': invite_code,
        'created_at': datetime.now(timezone.utc).isoformat(),
    })
    if not fund:
        raise HTTPException(status_code=500, detail="Failed to create fund")
    u_rows = await sb_select('users', {'id': f'eq.{uid}'})
    display_name = u_rows[0].get('name', '') if u_rows else ''
    await sb_insert('fund_members', {'fund_id': fund['id'], 'user_id': uid, 'role': 'admin', 'display_name': display_name})
    return {'fund': {k: v for k, v in fund.items() if k != '_id'}, 'invite_code': invite_code, 'role': 'admin'}


@api_router.post("/funds/join")
async def join_fund(data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    invite_code = (data.get('invite_code') or '').strip().upper()
    if not invite_code:
        raise HTTPException(status_code=400, detail="Invite code is required")
    if await sb_select('fund_members', {'user_id': f'eq.{uid}'}):
        raise HTTPException(status_code=400, detail="You already belong to a fund. Leave it first.")
    funds = await sb_select('funds', {'invite_code': f'eq.{invite_code}'})
    if not funds:
        raise HTTPException(status_code=404, detail="Invalid invite code. Ask your fund admin for the correct code.")
    fund = funds[0]
    if await sb_select('fund_members', {'fund_id': f'eq.{fund["id"]}', 'user_id': f'eq.{uid}'}):
        raise HTTPException(status_code=400, detail="You are already a member of this fund.")
    u_rows = await sb_select('users', {'id': f'eq.{uid}'})
    display_name = u_rows[0].get('name', '') if u_rows else ''
    await sb_insert('fund_members', {'fund_id': fund['id'], 'user_id': uid, 'role': 'member', 'display_name': display_name})
    return {
        'fund': {k: v for k, v in fund.items() if k != '_id'}, 'role': 'member',
        'message': f"You joined {fund['name']}. Your inbox is now connected to your team's shared deal flow.",
    }


@api_router.get("/funds/me")
async def get_my_fund(current_user: dict = Depends(get_current_user)):
    return await get_user_fund_info(current_user['user_id']) or {}


@api_router.delete("/funds/{fund_id}/members/{member_user_id}")
async def remove_fund_member(fund_id: str, member_user_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    my_m = await sb_select('fund_members', {'fund_id': f'eq.{fund_id}', 'user_id': f'eq.{uid}'})
    if not my_m or my_m[0].get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only fund admins can remove members.")
    if member_user_id == uid:
        raise HTTPException(status_code=400, detail="Use 'Delete Fund' to remove yourself as admin.")
    await sb_delete('fund_members', {'fund_id': f'eq.{fund_id}', 'user_id': f'eq.{member_user_id}'})
    return {"ok": True}


@api_router.post("/funds/leave")
async def leave_fund(current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    memberships = await sb_select('fund_members', {'user_id': f'eq.{uid}'})
    if not memberships:
        raise HTTPException(status_code=404, detail="You are not in a fund.")
    if memberships[0].get('role') == 'admin':
        raise HTTPException(status_code=400, detail="Admins cannot leave. Delete the fund instead.")
    await sb_delete('fund_members', {'user_id': f'eq.{uid}', 'fund_id': f'eq.{memberships[0]["fund_id"]}'})
    return {"ok": True}


@api_router.delete("/funds/{fund_id}")
async def delete_fund(fund_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    my_m = await sb_select('fund_members', {'fund_id': f'eq.{fund_id}', 'user_id': f'eq.{uid}'})
    if not my_m or my_m[0].get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only the fund admin can delete the fund.")
    await sb_delete('fund_members', {'fund_id': f'eq.{fund_id}'})
    await sb_delete('funds', {'id': f'eq.{fund_id}'})
    return {"ok": True}


# ── Deal stage & assignment ─────────────────────────────────────────────────────

@api_router.delete("/deals/{deal_id}")
async def delete_deal(deal_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    rows = await sb_select('deals', {'id': f'eq.{deal_id}'})
    if not rows:
        raise HTTPException(status_code=404, detail="Deal not found")
    deal = rows[0]
    if deal.get('user_id') != uid:
        fund_id = deal.get('fund_id')
        if not fund_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        membership = await sb_select('fund_members', {'fund_id': f'eq.{fund_id}', 'user_id': f'eq.{uid}'})
        if not membership:
            raise HTTPException(status_code=403, detail="Not authorized")
    # Soft delete — move to archive with 30-day recovery window
    await sb_update('deals', {
        'status': 'deleted',
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }, {'id': f'eq.{deal_id}'})
    return {"ok": True}


@api_router.post("/deals/{deal_id}/recover")
async def recover_deal(deal_id: str, current_user: dict = Depends(get_current_user)):
    """Restore a soft-deleted deal back to Inbound."""
    uid = current_user['user_id']
    rows = await sb_select('deals', {'id': f'eq.{deal_id}', 'user_id': f'eq.{uid}', 'status': 'eq.deleted'})
    if not rows:
        raise HTTPException(status_code=404, detail="Archived deal not found")
    await sb_update('deals', {
        'status': 'New',
        'deal_stage': 'Inbound',
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }, {'id': f'eq.{deal_id}'})
    return {"ok": True}



# ── Contact sync engine ──────────────────────────────────────────────────────────────
# Categories that disqualify a sender from being tracked as a contact
_CONTACT_SKIP_CATEGORIES = frozenset({
    'Spam / irrelevant', 'Service provider / vendor', 'Recruiter / hiring'
})


async def sync_contact(user_id: str, deal: dict, is_new_deal: bool = False) -> Optional[dict]:
    """
    Create or update a contact from a categorized, non-passed deal.

    Inclusion rules:
      ✅  Deal has a meaningful AI-assigned category (not null / not yet classified)
      ✅  Category is NOT Spam, Vendor, or Recruiter
      ✅  Deal stage is NOT 'Passed'
      ✅  Deal has a usable email — or a company_name when the sender is the inbox owner

    Dedup key: UNIQUE(user_id, email).
    When sender_email = the user's own email (thread reply), we derive a
    synthetic contact email from company_name so each company gets its own
    contact entry.
    """
    # 1. Require a meaningful AI-assigned category — skip uncategorized / inbound emails
    category = (deal.get('category') or '').strip()
    if not category or category in _CONTACT_SKIP_CATEGORIES:
        logger.debug(f'[Contact] Skip — no/bad category={category!r}')
        return None

    # 2. Resolve the best email identifier
    raw_email = (deal.get('founder_email') or deal.get('sender_email') or '').strip().lower()

    # Detect "self-sent" deals — where sender_email is the inbox owner's own address.
    # This happens when Gmail sync captures a REPLY the user sent (thread reply),
    # so the From: header shows the user, not the founder.
    # Fix: use company_name to form a unique synthetic contact email.
    user_rows = await sb_select('users', {'id': f'eq.{user_id}'})
    user_row = user_rows[0] if user_rows else {}
    user_email = (user_row.get('email') or '').strip().lower()
    user_name = (user_row.get('name') or '').strip().lower()

    sender_name_lower = (deal.get('sender_name') or '').strip().lower()
    is_self_sent = bool(raw_email and raw_email == user_email)
    if not is_self_sent and user_name and sender_name_lower and sender_name_lower == user_name:
        is_self_sent = True

    if is_self_sent:
        company = (deal.get('company_name') or '').strip()
        if not company:
            logger.debug(f'[Contact] Skip — sender is self and no company_name')
            return None
        slug = ''.join(c if c.isalnum() else '_' for c in company.lower())[:40]
        email = f'{slug}@deal.funnl'
        logger.debug(f'[Contact] Self-sent thread — using company email {email} for {company}')
    else:
        email = raw_email

    if not email:
        logger.debug(f'[Contact] Skip — no email and no company_name')
        return None

    # 3. Handle Passed deals — remove the contact so it no longer appears in Contacts
    stage = (deal.get('deal_stage') or deal.get('status') or '').strip()
    if stage == 'Passed':
        existing = await sb_select('contacts', {'email': f'eq.{email}', 'user_id': f'eq.{user_id}'})
        if existing:
            await sb_delete('contacts', {'id': f'eq.{existing[0]["id"]}'})
            logger.info(f'[Contact] Deleted (deal Passed): {email} user={user_id[:8]}')
        else:
            logger.debug(f'[Contact] Skip — deal is Passed, no existing contact to remove')
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    last_stage = stage or 'Inbound'
    # Use thesis_match_score (0-100) if available; else scale relevance_score (0-10) × 10
    new_score = deal.get('thesis_match_score') or ((deal.get('relevance_score') or 0) * 10)

    existing = await sb_select('contacts', {'email': f'eq.{email}', 'user_id': f'eq.{user_id}'})

    if existing:
        contact = existing[0]
        update: dict = {
            'contact_status': last_stage,
            'last_contacted': deal.get('received_date') or now_iso,
            'updated_at': now_iso,
        }
        if is_new_deal:
            update['deal_count'] = (contact.get('deal_count') or 1) + 1
        if new_score > (contact.get('relevance_score') or 0):
            update['relevance_score'] = new_score

        # Fill any missing fields from the deal
        for cf, df in [
            ('company', 'company_name'), ('role', 'founder_role'),
            ('sector', 'sector'), ('geography', 'geography'),
            ('intro_source', 'intro_source'), ('warm_or_cold', 'warm_or_cold'),
        ]:
            if not contact.get(cf) and deal.get(df):
                update[cf] = deal[df]
        if not contact.get('name') and (deal.get('founder_name') or deal.get('sender_name')):
            update['name'] = (deal.get('founder_name') or deal.get('sender_name')).strip()

        # Merge tags (deduplicated, capped at 12)
        merged = list(dict.fromkeys((contact.get('tags') or []) + (deal.get('tags') or [])))[:12]
        if merged != (contact.get('tags') or []):
            update['tags'] = merged

        ok = await sb_update('contacts', update, {'id': f'eq.{contact["id"]}'})
        if ok:
            logger.info(f'[Contact] Updated: {email} stage={last_stage} user={user_id[:8]}')
            return {'status': 'updated', 'contact_id': contact['id'], 'email': email, 'returning': True}
        logger.error(f'[Contact] UPDATE FAILED email={email}')
        return None

    # New contact — insert
    # For self-sent threads, prefer company_name as the display name since
    # sender_name would just show the user's own name
    is_synthetic = email.endswith('@deal.funnl')
    display_name = (
        deal.get('company_name')
        if is_synthetic
        else (deal.get('founder_name') or deal.get('sender_name') or '').strip() or deal.get('company_name')
    )
    new_contact = {
        'user_id': user_id,
        'name': display_name or None,
        'email': email,
        'company': deal.get('company_name'),
        'role': deal.get('founder_role'),
        'sector': deal.get('sector'),
        'stage': deal.get('stage'),
        'geography': deal.get('geography'),
        'intro_source': deal.get('intro_source'),
        'warm_or_cold': deal.get('warm_or_cold'),
        'contact_status': last_stage,
        'relevance_score': new_score or None,
        'tags': deal.get('tags') or [],
        'deal_count': 1,
        'first_contacted': deal.get('received_date') or now_iso,
        'last_contacted': deal.get('received_date') or now_iso,
    }
    result = await sb_insert('contacts', new_contact)
    if result:
        logger.info(f'[Contact] Created: {email} stage={last_stage} id={result.get("id", "?")}')
        return {'status': 'created', 'contact_id': result.get('id'), 'email': email, 'returning': False}
    logger.error(f'[Contact] INSERT FAILED email={email} user={user_id[:8]}')
    return None


@api_router.patch("/deals/{deal_id}/stage")
async def update_deal_stage(deal_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    new_stage = (data.get('stage') or '').strip()

    logger.info(f'[STAGE] Request: deal={deal_id[:8]} stage={new_stage} user={uid[:8]}')

    if not new_stage:
        raise HTTPException(status_code=400, detail="stage is required")

    update_data = {'deal_stage': new_stage}
    if 'pass_reason' in data:
        update_data['pass_reason'] = data['pass_reason']
    if 'watchlist_revisit_date' in data:
        update_data['watchlist_revisit_date'] = data['watchlist_revisit_date']

    await sb_update('deals', update_data, {'id': f'eq.{deal_id}'})
    logger.info(f'[STAGE] Deal updated to {new_stage}')

    fund_info = await get_user_fund_info(uid)
    if fund_info:
        u = await sb_select('users', {'id': f'eq.{uid}'})
        name = u[0].get('name', 'Someone') if u else 'Someone'
        await sb_insert('deal_comments', {
            'deal_id': deal_id, 'user_id': uid, 'fund_id': fund_info['fund']['id'],
            'body': f"{name} moved this to {new_stage}", 'type': 'system',
        })

    contact_result = None
    deal_rows = await sb_select('deals', {'id': f'eq.{deal_id}'})
    if deal_rows:
        contact_result = await sync_contact(uid, deal_rows[0])
        logger.info(f'[STAGE] Contact result: {contact_result}')
        await _log_deal_activity(uid, deal_rows[0], 'stage_change', f"Stage moved to {new_stage}")
    else:
        logger.error(f'[STAGE] Deal {deal_id} not found after update')

    return {"ok": True, "stage": new_stage, "contact": contact_result}


@api_router.post("/deals/{deal_id}/assign")
async def assign_deal(deal_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    assignee_id = data.get('assigned_to')
    fund_info = await get_user_fund_info(uid)
    if not fund_info:
        raise HTTPException(status_code=403, detail="Must be in a fund to assign deals.")
    fund_id = fund_info['fund']['id']
    update_data = {'assigned_to': assignee_id, 'fund_id': fund_id,
                   'deal_stage': 'First Look' if assignee_id else 'Inbound'}
    await sb_update('deals', update_data, {'id': f'eq.{deal_id}'})
    u_by = await sb_select('users', {'id': f'eq.{uid}'})
    name_by = u_by[0].get('name', 'Someone') if u_by else 'Someone'
    contact_result = None
    if assignee_id:
        await sb_insert('deal_assignments', {
            'deal_id': deal_id, 'assigned_to': assignee_id,
            'assigned_by': uid, 'fund_id': fund_id, 'note': data.get('note', ''),
        })
        u_to = await sb_select('users', {'id': f'eq.{assignee_id}'})
        name_to = u_to[0].get('name', 'Someone') if u_to else 'Someone'
        await sb_insert('deal_comments', {
            'deal_id': deal_id, 'user_id': uid, 'fund_id': fund_id,
            'body': f"{name_by} assigned this deal to {name_to}", 'type': 'system',
        })
        d_rows = await sb_select('deals', {'id': f'eq.{deal_id}'})
        if assignee_id != uid and d_rows:
            company = d_rows[0].get('company_name') or d_rows[0].get('sender_name', 'a deal')
            await create_notification(assignee_id, fund_id, 'assignment', f"{name_by} assigned {company} to you", deal_id)
        # Auto-create contact for the assigning user since deal is now at First Look
        if d_rows:
            logger.info(f'[ASSIGN] Syncing contact for deal {deal_id[:8]} at First Look (assigned by {uid[:8]})')
            contact_result = await sync_contact(uid, d_rows[0])
            logger.info(f'[Assign Contact] deal={deal_id[:8]} result={contact_result}')
    else:
        await sb_insert('deal_comments', {
            'deal_id': deal_id, 'user_id': uid, 'fund_id': fund_id,
            'body': f"{name_by} unassigned this deal", 'type': 'system',
        })
    return {"ok": True, "assigned_to": assignee_id, "contact": contact_result}


# ── Votes ───────────────────────────────────────────────────────────────────────

@api_router.get("/deals/{deal_id}/votes")
async def get_deal_votes(deal_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    fund_info = await get_user_fund_info(uid)
    votes = await sb_select('deal_votes', {'deal_id': f'eq.{deal_id}'})
    result = []
    for v in (votes or []):
        u = await sb_select('users', {'id': f'eq.{v["user_id"]}'})
        uu = u[0] if u else {}
        display_name = uu.get('name') or uu.get('email', '?')
        if fund_info:
            fm = await sb_select('fund_members', {
                'fund_id': f'eq.{fund_info["fund"]["id"]}', 'user_id': f'eq.{v["user_id"]}'
            })
            if fm and fm[0].get('display_name'):
                display_name = fm[0]['display_name']
        result.append({'user_id': v['user_id'], 'vote': v['vote'], 'display_name': display_name, 'is_me': v['user_id'] == uid})
    return result


@api_router.post("/deals/{deal_id}/vote")
async def cast_vote(deal_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    vote = data.get('vote')
    if vote not in ('pass', 'not_now', 'monitor', 'dig_in', 'champion'):
        raise HTTPException(status_code=400, detail="vote must be 'pass', 'not_now', 'monitor', 'dig_in', or 'champion'")
    fund_info = await get_user_fund_info(uid)
    fund_id = fund_info['fund']['id'] if fund_info else None
    now = datetime.now(timezone.utc).isoformat()
    existing = await sb_select('deal_votes', {'deal_id': f'eq.{deal_id}', 'user_id': f'eq.{uid}'})
    if existing:
        await sb_update('deal_votes', {'vote': vote, 'updated_at': now}, {'deal_id': f'eq.{deal_id}', 'user_id': f'eq.{uid}'})
    else:
        await sb_insert('deal_votes', {'deal_id': deal_id, 'user_id': uid, 'fund_id': fund_id, 'vote': vote})
        if fund_id:
            u = await sb_select('users', {'id': f'eq.{uid}'})
            name = u[0].get('name', 'Someone') if u else 'Someone'
            vote_display = {'pass': 'Pass', 'not_now': 'Not Now', 'monitor': 'Monitor', 'dig_in': 'Dig In', 'champion': 'Champion'}.get(vote, vote.capitalize())
            await sb_insert('deal_comments', {
                'deal_id': deal_id, 'user_id': uid, 'fund_id': fund_id,
                'body': f"{name} voted {vote_display}", 'type': 'system',
            })
    return {"ok": True, "vote": vote}


# ── Comments ────────────────────────────────────────────────────────────────────

@api_router.get("/deals/{deal_id}/comments")
async def get_deal_comments(deal_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    comments = await sb_select('deal_comments', {'deal_id': f'eq.{deal_id}', 'order': 'created_at.asc'})
    result = []
    for c in (comments or []):
        u = await sb_select('users', {'id': f'eq.{c["user_id"]}'})
        uu = u[0] if u else {}
        result.append({
            'id': c['id'], 'deal_id': c['deal_id'], 'user_id': c['user_id'],
            'body': c['body'], 'type': c.get('type', 'comment'),
            'parent_id': c.get('parent_id'), 'mentions': c.get('mentions') or [],
            'created_at': c.get('created_at'), 'updated_at': c.get('updated_at'),
            'edited': c.get('edited', False),
            'display_name': uu.get('name') or uu.get('email', 'Unknown'),
            'is_me': c['user_id'] == uid,
        })
    return result


@api_router.post("/deals/{deal_id}/comments")
async def post_comment(deal_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    body = (data.get('body') or '').strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment body is required")
    fund_info = await get_user_fund_info(uid)
    fund_id = fund_info['fund']['id'] if fund_info else None
    mentions = data.get('mentions') or []
    saved = await sb_insert('deal_comments', {
        'deal_id': deal_id, 'user_id': uid, 'fund_id': fund_id,
        'body': body, 'parent_id': data.get('parent_id'),
        'mentions': mentions, 'type': 'comment',
    })
    if saved and mentions and fund_id:
        u = await sb_select('users', {'id': f'eq.{uid}'})
        poster = u[0].get('name', 'Someone') if u else 'Someone'
        d = await sb_select('deals', {'id': f'eq.{deal_id}'})
        company = d[0].get('company_name') or d[0].get('sender_name', 'a deal') if d else 'a deal'
        for m_uid in mentions:
            if m_uid != uid:
                await create_notification(m_uid, fund_id, 'mention', f"{poster} mentioned you in {company}", deal_id)
    if not saved:
        raise HTTPException(status_code=500, detail="Failed to post comment")
    u = await sb_select('users', {'id': f'eq.{uid}'})
    uu = u[0] if u else {}
    return {**{k: v for k, v in saved.items() if k != '_id'}, 'display_name': uu.get('name') or uu.get('email', ''), 'is_me': True}


@api_router.patch("/deal-comments/{comment_id}")
async def edit_comment(comment_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    body = (data.get('body') or '').strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment body required")
    rows = await sb_select('deal_comments', {'id': f'eq.{comment_id}'})
    if not rows:
        raise HTTPException(status_code=404, detail="Comment not found")
    fund_info = await get_user_fund_info(uid)
    is_admin = fund_info and fund_info['role'] == 'admin'
    if rows[0]['user_id'] != uid and not is_admin:
        raise HTTPException(status_code=403, detail="Can only edit your own comments.")
    await sb_update('deal_comments', {'body': body, 'edited': True, 'updated_at': datetime.now(timezone.utc).isoformat()}, {'id': f'eq.{comment_id}'})
    return {"ok": True, "body": body, "edited": True}


@api_router.delete("/deal-comments/{comment_id}")
async def delete_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    rows = await sb_select('deal_comments', {'id': f'eq.{comment_id}'})
    if not rows:
        raise HTTPException(status_code=404, detail="Comment not found")
    fund_info = await get_user_fund_info(uid)
    is_admin = fund_info and fund_info['role'] == 'admin'
    if rows[0]['user_id'] != uid and not is_admin:
        raise HTTPException(status_code=403, detail="Can only delete your own comments.")
    await sb_delete('deal_comments', {'id': f'eq.{comment_id}'})
    return {"ok": True}


# ── Notifications ───────────────────────────────────────────────────────────────

@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    rows = await sb_select('notifications', {'user_id': f'eq.{uid}', 'order': 'created_at.desc', 'limit': '10'})
    return rows or []


@api_router.patch("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    await sb_update('notifications', {'read': True}, {'user_id': f'eq.{current_user["user_id"]}', 'read': 'eq.false'})
    return {"ok": True}


@api_router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, current_user: dict = Depends(get_current_user)):
    await sb_update('notifications', {'read': True}, {'id': f'eq.{notif_id}', 'user_id': f'eq.{current_user["user_id"]}'})
    return {"ok": True}


# ── Weekly digest ───────────────────────────────────────────────────────────────

async def generate_weekly_digest(user_id: str, user: dict) -> str:
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    today_str = now.date().isoformat()

    new_deals = await sb_select('deals', {
        'user_id': f'eq.{user_id}',
        'created_at': f'gte.{week_ago.isoformat()}',
        'status': 'neq.deleted',
    }) or []

    fund_ctx = await get_fund_settings(user_id)
    fund_name = fund_ctx.get('fund_name', 'your fund')
    name = user.get('name', 'there')

    if not new_deals:
        return (f"Hi {name},\n\nNo new deals came in this week for {fund_name}. "
                f"Your pipeline is quiet — a good time to follow up on existing conversations.\n\nHave a great week!\n\n— funnl")

    scores = [d.get('relevance_score') or 0 for d in new_deals]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0
    high_count = sum(1 for s in scores if s >= 7)
    top3 = sorted(new_deals, key=lambda d: d.get('relevance_score') or 0, reverse=True)[:3]
    top3_lines = '\n'.join(
        f"{i+1}. {d.get('company_name') or d.get('sender_name', 'Unknown')} — "
        f"{d.get('relevance_score') or 0}/10 — {(d.get('summary') or 'No summary')[:100]}"
        for i, d in enumerate(top3)
    )

    all_deals = await sb_select('deals', {'user_id': f'eq.{user_id}', 'status': 'neq.deleted'}) or []
    overdue = [d for d in all_deals if d.get('follow_up_date') and str(d['follow_up_date'])[:10] <= today_str]
    overdue_names = ', '.join(d.get('company_name') or d.get('sender_name', 'Unknown') for d in overdue[:5]) or 'None'
    watchlist_overdue = [d for d in all_deals if d.get('deal_stage') == 'Watch List' and d.get('watchlist_revisit_date') and str(d['watchlist_revisit_date'])[:10] <= today_str]
    watchlist_names = ', '.join(d.get('company_name') or d.get('sender_name', 'Unknown') for d in watchlist_overdue[:5]) or 'None'
    two_weeks_ago = (now - timedelta(days=14)).isoformat()
    stuck = [d for d in all_deals if d.get('deal_stage') == 'First Look' and (d.get('created_at') or '') <= two_weeks_ago]
    stuck_names = ', '.join(d.get('company_name') or d.get('sender_name', 'Unknown') for d in stuck[:5]) or 'None'

    date_range = f"{week_ago.strftime('%b %d')} – {now.strftime('%b %d, %Y')}"
    prompt = f"""Write a weekly deal flow digest for {fund_name}.

This week ({date_range}):
- New deals received: {len(new_deals)}
- Average relevance score: {avg_score}/10
- High-quality deals (score ≥ 7): {high_count}

Top deals to review:
{top3_lines}

Items needing attention:
- Overdue follow-ups: {overdue_names}
- Watch List past revisit date: {watchlist_names}
- Stuck in First Look >14 days: {stuck_names}

Write a warm, brief Monday morning digest. Mention top deals by company name. Call out any overdue items directly. End with one sentence on what to focus on this week. Friendly but professional. Under 200 words. No bullet lists — use short paragraphs."""

    response = await claude_client.messages.create(
        model='claude-sonnet-4-20250514',
        max_tokens=400,
        system='You are writing a friendly weekly deal flow digest for a VC fund manager. Be concise, specific, and actionable.',
        messages=[{'role': 'user', 'content': prompt}],
    )
    return f"Hi {name},\n\n{response.content[0].text}\n\n— funnl"


async def send_weekly_digest():
    """Scheduled job: send weekly digest email to all eligible users."""
    logger.info('[DIGEST] Starting weekly digest send')
    users = await sb_select('users', {'refresh_token': 'not.is.null', 'weekly_digest_enabled': 'neq.false'}) or []
    sent = 0
    for user in users:
        try:
            body = await generate_weekly_digest(user['id'], user)
            success, _ = await send_gmail_message(
                user_id=user['id'],
                to_email=user['email'],
                to_name=user.get('name', ''),
                subject='Your weekly deal flow digest',
                body=body,
            )
            if success:
                sent += 1
        except Exception as e:
            logger.error(f'[DIGEST] Failed for user {user["id"][:8]}: {e}')
    logger.info(f'[DIGEST] Sent {sent}/{len(users)} digests')


@api_router.post("/digest/toggle")
async def toggle_digest(data: dict, current_user: dict = Depends(get_current_user)):
    enabled = bool(data.get('enabled', True))
    await sb_update('users', {'weekly_digest_enabled': enabled}, {'id': f'eq.{current_user["user_id"]}'})
    return {'weekly_digest_enabled': enabled}


# ── Contact activities ────────────────────────────────────────────────────────────

@api_router.get("/contacts/{contact_id}/activities")
async def get_contact_activities(contact_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    contacts = await sb_select('contacts', {'id': f'eq.{contact_id}', 'user_id': f'eq.{uid}'})
    if not contacts:
        raise HTTPException(status_code=404, detail="Contact not found")
    activities = await sb_select('contact_activities', {
        'contact_id': f'eq.{contact_id}',
        'order': 'created_at.desc',
        'limit': '10',
    })
    return activities or []


# ── Billing ─────────────────────────────────────────────────────────────────────

@api_router.get("/billing/status")
async def get_billing_status(current_user: dict = Depends(get_current_user)):
    users = await sb_select('users', {'id': f'eq.{current_user["user_id"]}'})
    if not users:
        raise HTTPException(status_code=404, detail="User not found")
    u = users[0]
    status = u.get('subscription_status')
    trial_ends = u.get('trial_ends_at')
    days_remaining = None
    if trial_ends and status == 'trialing':
        trial_dt = datetime.fromisoformat(trial_ends.replace('Z', '+00:00'))
        days_remaining = max(0, (trial_dt - datetime.now(timezone.utc)).days)
    return {'status': status, 'trial_ends_at': trial_ends, 'days_remaining': days_remaining}

@api_router.post("/billing/create-checkout")
async def create_checkout(current_user: dict = Depends(get_current_user)):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Billing not configured")
    uid = current_user['user_id']
    users = await sb_select('users', {'id': f'eq.{uid}'})
    u = users[0] if users else {}
    customer_id = u.get('stripe_customer_id')
    if not customer_id:
        customer = stripe.Customer.create(email=current_user['email'])
        customer_id = customer.id
        await sb_update('users', {'stripe_customer_id': customer_id}, {'id': f'eq.{uid}'})
    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=['card'],
        line_items=[{'price': STRIPE_PRICE_ID, 'quantity': 1}],
        mode='subscription',
        success_url=f'{FRONTEND_URL}/settings?subscription=success',
        cancel_url=f'{FRONTEND_URL}/settings',
    )
    return {'url': session.url}

@api_router.post("/billing/portal")
async def billing_portal(current_user: dict = Depends(get_current_user)):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Billing not configured")
    uid = current_user['user_id']
    users = await sb_select('users', {'id': f'eq.{uid}'})
    u = users[0] if users else {}
    customer_id = u.get('stripe_customer_id')
    if not customer_id:
        raise HTTPException(status_code=400, detail="No billing account found. Subscribe first.")
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f'{FRONTEND_URL}/settings',
    )
    return {'url': session.url}

@api_router.post("/billing/webhook")
async def billing_webhook(request: Request):
    # Webhook signature verification is skipped while running locally (no public URL yet).
    # TODO: Once deployed, replace the raw JSON parse below with:
    #   payload = await request.body()
    #   event = stripe.Webhook.construct_event(payload, request.headers.get('stripe-signature'), STRIPE_WEBHOOK_SECRET)
    payload = await request.json()
    event_type = payload.get('type', '')
    data_obj = payload.get('data', {}).get('object', {})
    if event_type in ('customer.subscription.created', 'customer.subscription.updated'):
        customer_id = data_obj.get('customer')
        sub_status = data_obj.get('status')
        sub_id = data_obj.get('id')
        if customer_id:
            await sb_update('users',
                {'subscription_status': sub_status, 'stripe_subscription_id': sub_id},
                {'stripe_customer_id': f'eq.{customer_id}'},
            )
    elif event_type == 'customer.subscription.deleted':
        customer_id = data_obj.get('customer')
        if customer_id:
            await sb_update('users', {'subscription_status': 'canceled'}, {'stripe_customer_id': f'eq.{customer_id}'})
    elif event_type == 'invoice.payment_failed':
        customer_id = data_obj.get('customer')
        if customer_id:
            await sb_update('users', {'subscription_status': 'past_due'}, {'stripe_customer_id': f'eq.{customer_id}'})
    return {'received': True}

# ── Call prep ────────────────────────────────────────────────────────────────────

@api_router.post("/deals/{deal_id}/call-prep")
async def generate_call_prep(deal_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    deals = await sb_select('deals', {'id': f'eq.{deal_id}'})
    if not deals:
        raise HTTPException(status_code=404, detail="Deal not found")
    deal = deals[0]
    if deal.get('deal_stage') not in ('First Look', 'In Conversation'):
        raise HTTPException(status_code=400, detail="Call prep is only available for First Look or In Conversation deals")
    fund_ctx = await get_fund_settings(uid)
    company = deal.get('company_name') or deal.get('sender_name', 'Unknown')
    founder = deal.get('founder_name', 'Unknown founder')
    role = deal.get('founder_role', '')
    sector = deal.get('sector', 'Unknown')
    geography = deal.get('geography', 'Unknown')
    stage = deal.get('stage', 'Unknown')
    check_size = deal.get('check_size_requested', 'Not specified')
    thesis_score = deal.get('thesis_match_score')
    thesis_score_str = f'{thesis_score}/100' if thesis_score is not None else 'Not scored'
    strengths = ', '.join(deal.get('fit_strengths') or []) or 'Not assessed'
    weaknesses = ', '.join(deal.get('fit_weaknesses') or []) or 'Not assessed'
    traction = 'Yes' if deal.get('traction_mentioned') else 'No'
    deck = 'Yes' if deal.get('deck_attached') else 'No'
    intro_source = deal.get('intro_source', 'Unknown')
    body = (deal.get('body_preview') or 'Not available')[:1500]
    fund_name = fund_ctx.get('fund_name', 'Our fund')
    thesis = fund_ctx.get('thesis', 'Not specified')
    sectors = fund_ctx.get('sectors', 'Not specified')
    stages = ', '.join(fund_ctx.get('stages') or []) if isinstance(fund_ctx.get('stages'), list) else str(fund_ctx.get('stages', 'Not specified'))
    check_size_fund = fund_ctx.get('check_size', 'Not specified')
    prompt = f"""Prepare a call brief for this deal.

Company: {company}
Founder: {founder}{f' ({role})' if role else ''}
Sector: {sector} | Geography: {geography}
Stage claimed: {stage} | Check size requested: {check_size}
Thesis match score: {thesis_score_str}
What fits our thesis: {strengths}
What doesn't fit: {weaknesses}
Traction mentioned: {traction} | Deck attached: {deck}
Intro source: {intro_source}

Original email:
{body}

Our fund: {fund_name} — {thesis}
We invest in: {sectors} at {stages} with check sizes of {check_size_fund}

Return exactly this structure with no additional commentary:
OBJECTIVE: [one sentence — what this call must determine]
KEY QUESTIONS:
1. [question]
2. [question]
3. [question]
4. [question]
5. [question]
RED FLAGS TO PROBE:
1. [red flag]
2. [red flag]
3. [red flag]
THE DECIDING FACTOR: [the single thing that will decide whether to proceed after this call]"""
    response = await claude_client.messages.create(
        model='claude-sonnet-4-20250514',
        max_tokens=800,
        system='You are a VC analyst preparing a partner for a first call with a potential portfolio company. Be specific to what is known and what is missing about this deal. Do not use generic questions.',
        messages=[{'role': 'user', 'content': prompt}],
    )
    return {'brief': response.content[0].text}

# ── Activity Feed ───────────────────────────────────────────────────────────────

STAGE_COLORS_FEED = {
    'Inbound':        '#9090a8',
    'First Look':     '#4da6ff',
    'In Conversation':'#f5a623',
    'Due Diligence':  '#a594ff',
    'Closed':         '#3dd68c',
    'Passed':         '#52527a',
    'Watch List':     '#2dd4bf',
}

@api_router.get("/activity-feed")
async def get_activity_feed(current_user: dict = Depends(get_current_user)):
    uid = current_user['user_id']
    items = []

    # Source 1 — contact_activities with joined contact + deal info
    try:
        rows = await sb_select('contact_activities', {
            'user_id': f'eq.{uid}',
            'select': 'id,type,description,created_at,deal_id,contact_id,metadata,'
                      'contacts(name,company),'
                      'deals(company_name,deal_stage,relevance_score)',
            'order': 'created_at.desc',
            'limit': '30',
        })
        for r in (rows or []):
            act_type = r.get('type', '')
            contact   = (r.get('contacts') or {})
            deal      = (r.get('deals') or {})
            contact_name  = contact.get('name') or contact.get('company') or ''
            company_name  = deal.get('company_name') or contact_name or 'Unknown'
            stage         = deal.get('deal_stage')
            score         = deal.get('relevance_score')

            if act_type == 'deal_received':
                title    = 'New pitch received'
                subtitle = company_name
                color    = '#7c6dfa'
            elif act_type == 'stage_change':
                title    = f'Moved to {stage}' if stage else 'Stage changed'
                subtitle = company_name
                color    = STAGE_COLORS_FEED.get(stage, '#9090a8')
            elif act_type == 'note_saved':
                title    = 'Note added'
                subtitle = company_name or contact_name
                color    = 'rgba(255,255,255,0.3)'
            elif act_type == 'email_sent':
                title    = 'Reply sent'
                subtitle = contact_name or company_name
                color    = '#3dd68c'
            elif act_type == 'follow_up_set':
                meta     = r.get('metadata') or {}
                date_str = meta.get('date', '')
                title    = 'Follow-up set'
                subtitle = f'{company_name}{", " + date_str if date_str else ""}'
                color    = '#f5a623'
            else:
                title    = act_type.replace('_', ' ').title()
                subtitle = company_name or contact_name
                color    = 'rgba(255,255,255,0.3)'

            items.append({
                'id':        r['id'],
                'type':      act_type,
                'title':     title,
                'subtitle':  subtitle,
                'timestamp': r['created_at'],
                'deal_stage': stage,
                'score':     score,
                'color':     color,
            })
    except Exception as e:
        logger.warning(f'[ActivityFeed] contact_activities query failed: {e}')

    # Source 2 — recent high-score deals from last 7 days
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        recent_deals = await sb_select('deals', {
            'user_id':    f'eq.{uid}',
            'is_deleted': 'eq.false',
            'created_at': f'gte.{cutoff}',
            'select':     'id,company_name,sender_name,relevance_score,created_at,deal_stage',
            'order':      'relevance_score.desc',
            'limit':      '10',
        })
        existing_deal_ids = {r.get('deal_id') for r in (rows or [])}
        today = datetime.now(timezone.utc).date().isoformat()
        for d in (recent_deals or []):
            if d['id'] in existing_deal_ids:
                continue  # already represented by a deal_received activity
            score    = d.get('relevance_score') or 0
            company  = d.get('company_name') or d.get('sender_name') or 'Unknown'
            if score >= 7:
                title = 'High-score pitch'
                color = '#3dd68c'
            else:
                title = 'New pitch received'
                color = '#7c6dfa'
            items.append({
                'id':        f'deal-{d["id"]}',
                'type':      'new_deal_high_score' if score >= 7 else 'deal_received',
                'title':     title,
                'subtitle':  f'{company} · {score}/10' if score else company,
                'timestamp': d['created_at'],
                'deal_stage': d.get('deal_stage'),
                'score':     score,
                'color':     color,
            })
    except Exception as e:
        logger.warning(f'[ActivityFeed] recent deals query failed: {e}')

    # Merge, sort by timestamp descending, cap at 20
    items.sort(key=lambda x: x['timestamp'], reverse=True)
    return items[:20]


# ── App setup ───────────────────────────────────────────────────────────────────
app.include_router(api_router)
_cors_origins = [FRONTEND_URL, 'http://localhost:3000']
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.on_event("startup")
async def on_startup():
    await init_database()
    scheduler.add_job(sync_all_users, 'interval', minutes=15, id='bg_sync', replace_existing=True)
    scheduler.add_job(send_weekly_digest, 'cron', day_of_week='mon', hour=9, minute=0,
                      timezone='UTC', id='weekly_digest', replace_existing=True)
    scheduler.start()
    logger.info("VC Deal Flow API started")

@app.on_event("shutdown")
async def on_shutdown():
    scheduler.shutdown(wait=False)
