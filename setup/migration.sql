-- VC Deal Flow – Complete Supabase Schema
-- Run this once in Supabase SQL Editor

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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  fund_id UUID,
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
  deal_stage TEXT DEFAULT 'Inbound',
  assigned_to UUID,
  pass_reason TEXT,
  watchlist_revisit_date TIMESTAMPTZ,
  notes TEXT,
  thesis_match_score INTEGER,
  fit_strengths TEXT[],
  fit_weaknesses TEXT[],
  match_reasoning TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, thread_id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  fund_id UUID,
  name TEXT,
  email TEXT NOT NULL,
  company TEXT,
  role TEXT,
  sector TEXT,
  stage TEXT,
  geography TEXT,
  intro_source TEXT,
  warm_or_cold TEXT,
  contact_status TEXT DEFAULT 'First Look',
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

CREATE TABLE IF NOT EXISTS funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fund_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID REFERENCES funds(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  display_name TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fund_id, user_id)
);

CREATE TABLE IF NOT EXISTS deal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  fund_id UUID REFERENCES funds(id),
  vote TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deal_id, user_id)
);

CREATE TABLE IF NOT EXISTS deal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  fund_id UUID REFERENCES funds(id),
  body TEXT NOT NULL,
  type TEXT DEFAULT 'comment',
  parent_id UUID,
  mentions TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  edited BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS deal_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id),
  assigned_by UUID REFERENCES users(id),
  fund_id UUID REFERENCES funds(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  fund_id UUID,
  type TEXT,
  message TEXT,
  deal_id UUID,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gated_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  sender_email TEXT,
  sender_name TEXT,
  subject TEXT,
  received_date TIMESTAMPTZ,
  gate_reason TEXT,
  body_preview TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (open policies for service key access)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE gated_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_users" ON users;
DROP POLICY IF EXISTS "open_deals" ON deals;
DROP POLICY IF EXISTS "open_contacts" ON contacts;
DROP POLICY IF EXISTS "open_funds" ON funds;
DROP POLICY IF EXISTS "open_fund_members" ON fund_members;
DROP POLICY IF EXISTS "open_votes" ON deal_votes;
DROP POLICY IF EXISTS "open_comments" ON deal_comments;
DROP POLICY IF EXISTS "open_assignments" ON deal_assignments;
DROP POLICY IF EXISTS "open_notifications" ON notifications;
DROP POLICY IF EXISTS "open_gated" ON gated_emails;

CREATE POLICY "open_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_deals" ON deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_funds" ON funds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_fund_members" ON fund_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_votes" ON deal_votes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_comments" ON deal_comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_assignments" ON deal_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_gated" ON gated_emails FOR ALL USING (true) WITH CHECK (true);

-- Add missing columns to existing tables if they were created without them
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_stage TEXT DEFAULT 'Inbound';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS fund_id UUID;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS pass_reason TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS watchlist_revisit_date TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS thesis_match_score INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS fit_strengths TEXT[];
ALTER TABLE deals ADD COLUMN IF NOT EXISTS fit_weaknesses TEXT[];
ALTER TABLE deals ADD COLUMN IF NOT EXISTS match_reasoning TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
