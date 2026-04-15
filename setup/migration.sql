-- VC Deal Flow – Supabase Migration
-- Run this once in Supabase Dashboard > SQL Editor

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
