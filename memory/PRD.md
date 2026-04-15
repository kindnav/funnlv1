# VC Deal Flow Intelligence Tool — PRD
**Project**: VC Deal Flow Intelligence  
**Created**: 2026-04-15  
**Last Updated**: 2026-04-15  
**Status**: MVP Complete — Action Engine + Thesis Match Engine live

---

## Problem Statement
Build a full-stack VC deal flow intelligence tool that:
- Connects to Gmail via OAuth to auto-ingest inbound emails
- Uses Claude AI to extract structured deal signals + score thesis alignment
- Scores, categorizes, and generates one-click email responses
- Displays everything in a dark, professional internal dashboard

---

## Architecture
- **Frontend**: React (CRA), Tailwind CSS, Lucide icons
- **Backend**: FastAPI (Python 3.11) on port 8001
- **Database**: Supabase (PostgreSQL via REST/PostgREST API)
- **AI**: Anthropic Claude (`claude-sonnet-4-5`) via `anthropic` SDK
- **Gmail**: Google OAuth 2.0 (`gmail.readonly` + `gmail.send` scopes)
- **Scheduling**: APScheduler (15-min background sync)
- **Auth**: JWT (PyJWT) stored in localStorage

---

## Core Product Pillars

### 1. Thesis-Aware Scoring (LIVE)
- Claude outputs `thesis_match_score` (0-100), `fit_strengths[]`, `fit_weaknesses[]`, `match_reasoning`
- Requires DB schema migration (see below)
- Detail panel shows SVG ring chart + strength/weakness bullets

### 2. Action Engine (LIVE)
- Three one-click actions: Decline (reject), Request Info, Forward to Partner
- Claude generates personalized email draft per action type
- User can edit To/Subject/Body before sending
- Sends via Gmail API using `gmail.send` scope
- Status auto-updates after send (reject → Archived, others → Reviewed)

### 3. Spam Filtering (LIVE)
- `get_deals` and `get_stats` exclude: Spam/irrelevant, Service provider/vendor, Recruiter/hiring
- Ingestion pipeline skips Spam/irrelevant category emails

### 4. Pitch Signal Heuristics (LIVE)
- `pitch_signal_score()` function pre-screens emails before Claude
- 20 keyword vocabulary: raising, deck, seed, founder, MRR, valuation, etc.

---

## Database Schema

### users
`id, google_id, email, name, picture, access_token, refresh_token, token_expiry, last_synced`

### deals
`id, user_id, thread_id, message_id, received_date, sender_name, sender_email, subject, body_preview, gmail_thread_link, company_name, founder_name, founder_role, category, warm_or_cold, sector, stage, check_size_requested, geography, deck_attached, traction_mentioned, intro_source, summary, relevance_score, urgency_score, next_action, confidence, tags, thesis_match_score, fit_strengths, fit_weaknesses, match_reasoning, status, notes, processed_at, created_at`

### REQUIRED SCHEMA MIGRATION SQL (run in Supabase SQL Editor)
```sql
ALTER TABLE deals ADD COLUMN IF NOT EXISTS thesis_match_score INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS fit_strengths TEXT[];
ALTER TABLE deals ADD COLUMN IF NOT EXISTS fit_weaknesses TEXT[];
ALTER TABLE deals ADD COLUMN IF NOT EXISTS match_reasoning TEXT;
```

---

## API Endpoints
- `GET /api/auth/google` — Initiate OAuth
- `GET /api/auth/callback` — OAuth redirect handler
- `GET /api/auth/me` — Current user
- `POST /api/auth/logout` / `POST /api/auth/disconnect`
- `GET /api/deals` — Get filtered deals (no spam/vendor/recruiter)
- `POST /api/deals/process` — Manual email processing
- `PATCH /api/deals/{id}` — Update status/notes
- `POST /api/deals/{id}/generate-action` — Claude email draft (reject/request_info/forward_partner)
- `POST /api/deals/{id}/send-action` — Send email via Gmail API
- `GET /api/stats` — Dashboard stats (filtered)
- `POST /api/sync` — Trigger Gmail sync
- `GET/POST /api/fund-settings` — Fund thesis CRUD

---

## What's Been Implemented

### 2026-04-15 (Session 1)
- ✅ Gmail OAuth + background sync (15-min APScheduler)
- ✅ Claude AI extraction pipeline
- ✅ Dashboard: stats, filters, deals table, detail panel
- ✅ Manual email processing modal
- ✅ Settings page with Fund Thesis

### 2026-04-15 (Session 2)
- ✅ Spam/vendor/recruiter filtering from dashboard + stats
- ✅ Fund Thesis — prominent "Fund Thesis" button in nav + callout banner in Settings
- ✅ Gmail `gmail.send` scope added to OAuth flow
- ✅ Thesis Match Engine: thesis_match_score (0-100), fit_strengths[], fit_weaknesses[], match_reasoning
- ✅ Action Engine: generate-action + send-action endpoints
- ✅ ActionModal component (edit draft, send, loading/success states)
- ✅ Detail panel: Thesis Ring chart, strength/weakness bullets, 3 action buttons
- ✅ Dashboard table: "Fit %" column showing thesis_match_score
- ✅ Pitch signal heuristics: pitch_signal_score() pre-filter function

---

## Prioritized Backlog

### P0 (Required for full thesis match to show)
- [ ] Run schema migration SQL in Supabase SQL Editor (4 ALTER TABLE statements)
- [ ] Existing connected Gmail users must reconnect to grant `gmail.send` scope

### P1 (Next features)
- [ ] Deal notes — editable text note on each deal in detail panel
- [ ] Pipeline/Kanban view — deals by stage
- [ ] Sync Now — visual success confirmation after sync completes
- [ ] Email thread view — full conversation history

### P2 (Future)
- [ ] CSV export
- [ ] Slack webhook for high-score deals (>8)
- [ ] Mobile responsive layout
- [ ] Bulk actions
- [ ] Team collaboration (multi-user per fund)
