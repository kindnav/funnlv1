# VC Deal Flow Intelligence Tool — PRD
**Project**: VC Deal Flow Intelligence  
**Created**: 2026-04-15  
**Status**: MVP Complete — Spam Filtering + Fund Thesis UI done (2026-04-15)

---

## Problem Statement
Build a full-stack VC deal flow intelligence tool that:
- Connects to Gmail via OAuth to auto-ingest inbound emails
- Uses Claude AI (Anthropic) to extract structured deal signals
- Scores and categorizes emails (relevance 1–10, category, next action)
- Displays everything in a dark, professional internal dashboard
- Supports manual email processing via paste modal

---

## Architecture
- **Frontend**: React (Create React App), Tailwind CSS, Lucide icons, DM Sans / DM Mono fonts
- **Backend**: FastAPI (Python 3.11) on port 8001
- **Database**: Supabase (PostgreSQL via REST/PostgREST API)
- **AI**: Anthropic Claude (`claude-sonnet-4-5`) via `anthropic` Python SDK (AsyncAnthropic)
- **Gmail**: Google OAuth 2.0 (`gmail.readonly` scope) via `google-auth-oauthlib`
- **Scheduling**: APScheduler (AsyncIOScheduler) — syncs every 15 min
- **Auth**: JWT (PyJWT) stored in localStorage

---

## User Personas
- **VC Partner/Associate**: Receives 50–200+ emails per week, needs to triage quickly
- **Fund Admin**: Sets up integrations, manages settings

---

## Core Requirements (Static)
1. Gmail OAuth connect/disconnect
2. Auto-sync inbox every 15 minutes (skip newsletters, duplicates, own emails)
3. Claude AI extraction: company, founder, sector, stage, check size, score, next action, tags
4. Dashboard: stats bar, filter toolbar, data table, right-side detail panel
5. Manual email processing modal
6. Settings page: API key status, Gmail status, redirect URI info
7. 4 pre-seeded sample deals for demo

---

## What's Been Implemented (2026-04-15)

### Backend (server.py)
- ✅ Google OAuth flow (`/api/auth/google`, `/api/auth/callback`)
- ✅ JWT auth middleware (30-day tokens)
- ✅ Supabase REST API client (httpx-based, no direct DB connection needed)
- ✅ Database auto-init with Management API fallback
- ✅ Sample data seeding (4 deals via system user)
- ✅ Claude AI email analysis (AsyncAnthropic, model: claude-sonnet-4-5)
- ✅ Gmail API integration (token refresh, email fetch, body extraction)
- ✅ Background sync scheduler (APScheduler, 15-min interval)
- ✅ API routes: `/api/deals`, `/api/deals/process`, `/api/deals/{id}`, `/api/stats`, `/api/sync`, `/api/settings`, `/api/auth/*`
- ✅ Ownership check on PATCH endpoint

### Frontend
- ✅ ConnectPage (dark, grid background, Google OAuth button)
- ✅ OAuthCallback (token extraction, localStorage storage)
- ✅ Dashboard (full-screen, TopNav, StatsBar, Toolbar, DealTable, DetailPanel)
- ✅ DetailPanel (AI summary, score bars, deal signals grid, tags, action buttons)
- ✅ ProcessEmailModal (sender/subject/body form, Claude AI submit)
- ✅ Settings page (Gmail status, AI config, OAuth URI info, logout)
- ✅ Filter buttons (All/New/Score≥7/Pitches/Warm Intros) + search
- ✅ Category color coding (purple/blue/teal/green/red/gray)
- ✅ Score pills (green/amber/red) + glowing status dots
- ✅ Deal status actions (Mark Reviewed, Add to Pipeline, Archive)

---

## Database Tables (Supabase)
- `users`: Google OAuth tokens, profile, last_synced
- `deals`: Full AI-extracted deal data, status, notes
- System user (`00000000-0000-0000-0000-000000000001`) for sample data

---

## Environment Variables (backend/.env)
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`
- `JWT_SECRET` / `FRONTEND_URL`

---

## Prioritized Backlog

### P0 (Critical — setup required)
- [ ] Add `https://vc-pipeline-1.preview.emergentagent.com/api/auth/callback` to Google Cloud Console OAuth redirect URIs
- [ ] Verify Supabase tables exist (run `/app/setup/migration.sql` if not)

### P1 (High value next features)
- [ ] Deal notes field — editable text note on each deal
- [ ] Pipeline view — Kanban board of deals by stage
- [ ] Email thread view — full conversation history
- [ ] Bulk actions — archive/mark-reviewed multiple deals
- [ ] Email notifications for high-score deals (>8)

### P2 (Enhancement)
- [ ] Export to CSV / Airtable
- [ ] Team collaboration (multiple users per fund)
- [ ] Deal tagging / custom categories
- [ ] Webhook for new high-score deals (Slack notification)
- [ ] Mobile-responsive layout

---

## Next Tasks
1. Connect Gmail in Google Cloud Console (add redirect URI)
2. Test full OAuth flow with real Gmail account
3. Verify 15-min background sync works after first connect
4. Add P1 notes field to detail panel
