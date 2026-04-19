# VC Deal Flow Intelligence Tool — PRD
**Project**: VC Deal Flow Intelligence  
**Created**: 2026-04-15  
**Last Updated**: 2026-04-18  
**Status**: MVP Complete — Onboarding wizard, Review Mode, background sync, dynamic fund name all live

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

### 5. Review Mode — Mobile Swipe Triage (LIVE — 2026-04-18)
- Full-screen card-swipe interface at `/review` route
- "Review Mode" button in Dashboard nav (prominent, purple glow)
- Swipe RIGHT → pipeline, LEFT → archive, UP → review; status updated via PATCH immediately
- 60fps drag animation via direct DOM manipulation (refs), no React re-renders during drag
- Action overlays: directional gradient + label (green/red/blue)
- 4-button bar: Archive/Pipeline/Review/Details (48px tap targets)
- Keyboard shortcuts on desktop (← → ↑ ↵)
- Progress bar + unreviewed count at top; Empty state when queue is empty
- Touch events (passive:false) + mouse drag for desktop

### 6. Dynamic Fund Name (LIVE — 2026-04-18)
- Dashboard nav shows fund name from Settings instead of hardcoded "Future Frontier Capital"
- Logo initials and nav title computed dynamically from saved fund_name

### 9. Post-Login Onboarding Wizard (LIVE — 2026-04-18)
- **Route**: `/onboarding` — registered in App.js, protected by `token` only (not requiring `user` object to avoid timing issues)
- **OAuthCallback** now navigates to `/onboarding` after every successful login
- **Returning users**: if `onboarding_complete=true` in fund_settings, wizard skips instantly to dashboard
- **Step 1 — Fund Profile Setup**: Fund name, Investment thesis (required for best Claude scoring), Sector focus, Stage. Saves via `POST /api/fund-settings`. "Skip for now" marks complete + triggers background sync.
- **Step 2 — How It Works**: 3 animated feature cards (Brain/Target/Zap icons, stagger animation), "Go to my dashboard" button marks `onboarding_complete=true` + navigates to `/`
- **Step progress dots**: 2-step progress indicator with green checkmark on completed step
- **Background sync** triggered automatically when thesis is saved (step 1 continue) or skipped
- **Landing page** replaces old ConnectPage — Signalflow branding, hero with gradient headline, beta banner, HOW IT WORKS (3 steps), FEATURES (6 cards), footer. DM Sans/Mono fonts. Scroll reveal via IntersectionObserver. Mobile responsive.
- **Setup checklist** shown in Dashboard for new users (0 deals, onboarding not complete). 4 items: Gmail connected / First sync / Fund thesis / First email. Progress bar. Completion state with "Go to Dashboard" CTA. Saves `onboarding_complete` flag via `POST /api/onboarding-complete`.
- **Empty states**: Loading spinner, no-deals-ever (with Sync Now + Process Email), filter-returns-nothing (with Clear filters), Review Mode animated SVG checkmark "All caught up"
**Root causes diagnosed and fixed:**
1. Self-sent email filter removed — users testing with their own Gmail were silently dropping all test emails
2. Per-email Supabase dedup (100 HTTP requests → 1) — sync now runs in seconds, not 3+ minutes
3. Spam emails no longer dropped at ingestion — saved to DB with spam category, filtered at display layer
4. Claude error fallback: 'Unprocessed' category instead of silent drop
5. Frontend polling extended from 120s to 240s (sync with pre-fetch completes in ~30s now)
6. Upsert support in sb_insert for force=true reprocessing
7. Comprehensive [SYNC]/[CLAUDE]/[PROCESS] logging for all decisions

**Diagnostic endpoints added:**
- GET /api/test-gmail — raw Gmail API test showing last 5 inbox messages
- POST /api/test-insert — inserts a hardcoded test deal to validate Supabase writes
- POST /api/sync?force=true — reprocesses last 10 emails (upsert, bypass dedup)

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
- `POST /api/contacts/upsert` — Create or update contact from deal (dedup by email)
- `GET /api/contacts` — Get user contacts
- `PATCH /api/contacts/{id}` — Update contact notes/tags/status
- `GET /api/contacts/{id}/deals` — Get deals linked to a contact

---

## What's Been Implemented

### 2026-04-19 (Session 4 — Pipeline & Categorization Fix)
- ✅ Pipeline Kanban: added Pipeline and Archived columns (deals no longer disappear after swiping)
- ✅ ReviewMode: fixed status case (`pipeline` → `Pipeline`, `archived` → `Archived`, `Reviewed` → `In Review`)
- ✅ ReviewMode: toast notifications after each swipe with "View Pipeline" / "View Archived" / "View In Review" action links
- ✅ DetailPanel: "Status" section replaced with "Move Deal To" — 4 buttons (Add to Pipeline, Save for Review, Pass, Archive) with active-state highlighting + Restore/Reconsider
- ✅ Pipeline.jsx: `normalizeStatus()` helper handles old lowercase status values for backward compat
- ✅ No deal is ever lost — every status maps to a visible Pipeline column

- ✅ Contacts system fully implemented and tested
- ✅ Contacts table created in Supabase (SQL run manually)
- ✅ POST /api/contacts/upsert — creates or updates contact from deal, dedup by email, increments deal_count
- ✅ GET /api/contacts — fetch user contacts ordered by last_contacted
- ✅ PATCH /api/contacts/{id} — update notes, tags, contact_status
- ✅ GET /api/contacts/{id}/deals — linked deals via sender_email match
- ✅ Contacts page (/contacts) — stats bar, searchable/filterable datatable, detail panel
- ✅ ContactDetailPanel — notes, tags, status buttons, linked deals, score bar
- ✅ Export CSV → contacts-export-{date}.csv with 15 columns
- ✅ "Add to Pipeline" & "Save for Review" in DetailPanel → upsertContact API call
- ✅ Returning founder detection (deal_count > 1 → "Returning" badge)
- ✅ CRITICAL FIX: /api/stats was missing @api_router.get('/stats') decorator → dashboard was broken
- ✅ Cleaned up failing auto-migration code (SCHEMA_MIGRATION_SQL, migrate_schema removed from server.py)
- ✅ Backend startup now clean — no migration errors

### 2026-04-15 (Session 1)
- ✅ Gmail OAuth + background sync (15-min APScheduler)
- ✅ Claude AI extraction pipeline
- ✅ Dashboard: stats, filters, deals table, detail panel
- ✅ Manual email processing modal
- ✅ Settings page with Fund Thesis

### 2026-04-16 (Bug Fix)
- ✅ CRITICAL: Fixed `invalid_scope` sync crash — `build_gmail_service` was requesting `gmail.send` scope using stored tokens that were only authorized for `gmail.readonly`, crashing every background sync since the send scope was added
- ✅ Fix: Introduced `GMAIL_SERVICE_SCOPES` (readonly only) for credential building, `GOOGLE_SCOPES` (full incl. send) only for new OAuth flows
- ✅ Sync endpoint now surfaces auth errors as HTTP 403 with clear message instead of silently returning 0
- ✅ Dashboard sync button now shows red "Sync failed — check Settings" state on error
- ✅ Connect page redesigned — "Your inbox, AI-powered." with 4 feature pillars, split layout
- ✅ Gmail scope text updated: "Gmail read + send access · Your emails never leave your account"
- ✅ Pipeline/Kanban view — 4 columns (Inbox, In Review, In Diligence, Passed), deal cards with thesis ring + sector/stage chips + quick move arrows
- ✅ Settings: "Reconnect Gmail" button with explanation for send scope grant
- ✅ ActionModal: 403 insufficient_scope error shows "Go to Settings to reconnect Gmail" link
- ✅ Dashboard nav: Pipeline button added
- ✅ Schema migration applied (thesis_match_score, fit_strengths, fit_weaknesses, match_reasoning columns)
- ✅ Sample deals patched with thesis data (VaultAI 88, GreenLoop 62)
- ✅ auto-migrate_sample_thesis() runs on startup
- ✅ Sync Now — synchronous endpoint (45s timeout), returns new_deals count
- ✅ Sync button shows "Synced · X new" / "Up to date" state for 5s after sync
- ✅ Deal Notes — editable textarea in detail panel, auto-saves on blur with "Saved" confirmation
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

### P0 (DONE ✅)
- ✅ Contacts table created in Supabase
- ✅ Full Contacts system implemented and tested

### P1 (Next features)
- [ ] Deal CSV export (user mentioned for deals table)
- [ ] Slack webhook for high-score deals (score ≥ 70)

### P2 (Future)
- [ ] Email thread view — full conversation history
- [ ] Bulk actions (multi-select deals)
- [ ] Team collaboration (multi-user per fund)
