# VC Deal Flow Intelligence Tool — PRD
**Project**: VC Deal Flow Intelligence  
**Created**: 2026-04-15  
**Last Updated**: 2026-04-24

## Latest Changes (2026-04-25 v5) — 7 Fixes + 3 Cleanups

### Fixes
- **FIX 1** `Contacts.jsx`: Removed auto-rebuild `useRef`/`useEffect` that silently wiped contacts on empty load
- **FIX 2** `server.py` + `Contacts.jsx`: Removed `contact_status: neq.Passed` server filter; added "Passed" to frontend filter tabs so the Passed filter actually works
- **FIX 3** `Pipeline.jsx`: Due Diligence column color changed from `#3dd68c` (green) to `#a594ff` (purple) — matches app-wide usage
- **FIX 4** `Dashboard.jsx`: "Assigned to me" filter hidden for solo users — only shown when `fundInfo` is set
- **FIX 5** `ReviewMode.jsx`: Added `SYSTEM_USER_ID` constant and filter to exclude demo/sample deals from review queue
- **FIX 6** `Dashboard.jsx`: Removed redundant `getStats()` from `fetchAll` and sync polling; removed `stats` state; StatsBar uses `deals` prop directly
- **FIX 7** `server.py` + `Dashboard.jsx`: Added `gmail_send_enabled` field — set `True` on OAuth callback completion; `Enable Sending` button hidden when `user.gmail_send_enabled` is true

### Cleanups
- **CLEANUP 1** `Contacts.jsx`: Debug panel already absent from previous rewrite — confirmed clean
- **CLEANUP 2** `Settings.jsx` + `AIGateSection.jsx`: Removed gate test runner (state, function, button, results) — Filtered Emails section retained
- **CLEANUP 3** `Settings.jsx`: Removed "Sync contacts from pipeline" button and Data Management section

## Latest Changes (2026-04-25 v4) — Contacts/Pipeline Sync Fixes
- **FIX 1** `PATCH /deals/{id}` now auto-maps `status → deal_stage` (`Pipeline→First Look`, `In Review→First Look`, `Passed→Passed`, `New→Inbound`) so Dashboard categorization immediately appears in the correct Pipeline column
- **FIX 2** `sync_contact`: When deal moves to Passed, resolves the contact email then DELETES the contact row — previously it returned None without cleanup, leaving stale contacts
- **FIX 3** `sync_contact`: Relevance score now stored as 0-100 (`thesis_match_score` preferred; fallback `relevance_score × 10`) instead of raw 0-10 — fixes the "all scores show red" issue in Contacts UI
- **FIX 4** `Contacts.jsx`: Added `normScore()` helper to display existing 0-10 scores as 0-100 until user runs rebuild

## Latest Changes (2026-04-25 v3) — Bug Fixes
- **FIX 1** `Contacts.jsx` syntax error: Missing `const AVATAR_COLORS = [` declaration at line 52 caused a Babel parse failure — restored the declaration
- **FIX 2** `server.py` self-sent email detection: Added name-based fallback in `sync_contact` — if `deal.sender_name` matches user's registered `name` from DB, treats it as self-sent even when Gmail alias differs from login email (e.g. `kindranaveen@gmail.com` vs `navbir12345@gmail.com`)

## Latest Changes (2026-04-25 v2) — Contacts Auto-Populate Fix
- **Root cause**: rebuild/sync/auto-populate were only fetching `user_id = uid` deals, but the UI shows system/sample deals too (same as `GET /deals` which uses `user_id in (uid, SYSTEM_USER_ID)`)
- **Fix**: Updated `POST /contacts/rebuild`, `POST /contacts/sync-pipeline`, and `_auto_populate_contacts_if_empty` to use the inclusive deal query (own + system sample deals)
- **Result**: Contacts now auto-populate from ALL deals visible in the dashboard on every startup (not just user's own deals); rebuild correctly syncs from all visible deals

## Latest Changes (2026-04-25) — Contacts System Complete Rewrite
- **DELETED** 8 old scattered contact helpers: `_determine_contact_status`, `_build_new_contact_dict`, `_validate_contact_email`, `_update_existing_contact`, `_create_new_contact`, `normalize_contact_stage`, `should_create_contact_from_deal`, `auto_upsert_contact`
- **NEW** single `sync_contact_from_deal(user_id, deal, trigger_value=None)` — sole owner of contact logic
  - Email resolution: `founder_email` first, fallback `sender_email`
  - Skips spam/vendor/recruiter categories
  - Normalizes stage aliases (`'In Review' → 'First Look'` etc.)
  - Skips non-contact stages (Passed, Archived, New, Inbound)
  - Deduplicates by `UNIQUE(user_id, email)` — never creates duplicates
  - Status never downgrades (uses STATUS_ORDER)
  - Keeps the higher of two relevance scores
  - Fills in missing contact fields from deal on update
- **WIRED** into all 3 backend triggers: `PATCH /deals/{id}`, `PATCH /deals/{id}/stage`, `POST /deals/{id}/assign`
- **REBUILT** `POST /contacts/upsert` (backward-compat wrapper → calls `sync_contact_from_deal`)
- **REBUILT** `POST /contacts/sync-pipeline` (retroactive backfill, no old `should_create` logic)
- **Frontend untouched** — `CategorizeDealSection.jsx` already just calls `updateDeal`, never called upsertContact directly

## Latest Changes (2026-04-24 v4) — Contacts user_id Mismatch Diagnosis & Fix
- **Diagnostic logging** added to `get_contacts`: when user has 0 contacts, logs ALL unique user_ids in table revealing mismatches
- **`/api/debug/user-check`** endpoint added: returns `jwt_user_id`, `db_user_found`, `ids_match`, `contacts_for_this_user`, `total_contacts_in_table`, `all_contact_user_ids`, `pipeline_deals_sample`
- **`sync_contacts_from_pipeline`** enhanced: per-deal logging (CREATED/UPDATED/FAILED/skipped), `skipped` count in response, `user_id` in return value
- **Auth callback hardened**: after insert, re-fetches user by google_id if `new_user` response has no id; adds a verify step that logs CRITICAL if user_id isn't in DB before creating JWT — prevents stale/mismatched UUIDs in tokens
- **Contacts.jsx debug panel**: added `runDebugCheck()` function calling `/api/debug/user-check`; shows `IDs match: yes/no`, all contact user_ids, comparison counts; added amber "Run diagnostic" button
- **Fixed Fund Focus nav link** in Contacts.jsx to route to `/fund-focus` instead of `/settings`

## Latest Changes (2026-04-24 v3) — Five Bug Fixes
- **FIX 1** `setup/migration.sql`: Replaced with complete schema including all missing columns (`deal_stage`, `fund_id`, `assigned_to`, `pass_reason`, `watchlist_revisit_date`, `thesis_match_score`, `fit_strengths/weaknesses`, `match_reasoning`, `updated_at`), all 10 tables with RLS, and `ALTER TABLE ADD COLUMN IF NOT EXISTS` guards for live databases
- **FIX 2** Contact stage aliases: Frontend `CategorizeDealSection.jsx` — `upsertContact` calls now pass `'First Look'` (valid stage) instead of `'In Pipeline'`/`'In Review'` (invalid). Backend `upsert_contact` — added `_STATUS_ALIASES` dict mapping `'In Pipeline'`, `'Pipeline'`, `'In Review'`, `'Reviewed'` → `'First Look'` for backward compatibility
- **FIX 3** FastAPI route ordering: Moved `GET /deals/fund` and `GET /deals/archived` to register before `PATCH /deals/{deal_id}` in `server.py` — static paths now precede dynamic `{deal_id}` routes preventing shadowing
- **FIX 4** ProductTour: Already correctly implemented — `measure()` skips missing elements and overlay uses `pointerEvents: none` when `rect` is null
- **FIX 5** data-testids: All 6 required testids verified present (`fund-thesis-btn`, `fit-pct-header`, `deals-table`, `pipeline-btn`, `contacts-btn`, `review-mode-btn`)

## Latest Changes (2026-04-24 v2) — Fund Focus Separate Page
- **New route `/fund-focus`**: `FundFocus.jsx` page with full thesis form (fund name, type, investment focus, sectors, check size, preferred stages) — extracted from Settings
- **Settings.jsx pruned**: All Fund Focus state, handlers, constants, and UI removed; page now shows Team, Gmail, AI Config, Data Management, Account only
- **Dashboard.jsx nav updated**: Fund Focus button now routes to `/fund-focus`; new Settings gear button added routing to `/settings`
- **App.js**: `/fund-focus` route registered, protected behind auth
- **Test coverage**: iteration_17.json — 100% frontend pass

## Latest Changes (2026-04-24) — Code Quality Report: Full Polish Pass
- **Nested ternaries eliminated**: Dashboard.jsx (`syncBtnStyle`/`syncBtnLabel`), Settings.jsx (`thesisBtnIcon`/`thesisBtnLabel`), DetailPanel.jsx (`outreachColor`, `pipelineBtnStyle`, `reviewBtnStyle`, `passBtnStyle`, `archiveBtnStyle`, `pipelineBtnLabel`, `reviewBtnLabel`) — all replaced with explicit `if/else` blocks before `return`
- **Backend refactoring — upsert_contact**: Split into `_validate_contact_email()`, `_update_existing_contact()`, `_create_new_contact()` helpers + thin `upsert_contact()` orchestrator; full type annotations added
- **Type hints — Python test files**: All test methods across all 10 test files have `-> None` return type; module-level dicts annotated `dict[str, str]`; `conftest.py` rewritten with full type annotations
- **Component extraction — Dashboard.jsx** (931→731 lines):
  - `DealRow` → `/components/dashboard/DealRow.jsx` (self-contained with local style helpers)
  - `SyncLogModal` → `/components/dashboard/SyncLogModal.jsx`
- **Component extraction — DetailPanel.jsx** (713→410 lines):
  - `DealStageSection` → `/components/detail/DealStageSection.jsx` (manages own dealStage/assignedTo/passReason/watchlistDate state)
  - `CategorizeDealSection` → `/components/detail/CategorizeDealSection.jsx` (manages own saving state)
- **Test fix**: `test_no_auth_header_in_apijs` updated to reflect intentional conditional Bearer fallback
- **Lint fixes**: ruff auto-fixed f-string placeholders in server.py and test files

## Latest Changes (2026-04-23 Round 2) — Code Quality Report Round 2
- **Empty catch blocks fixed**: Dashboard polling `catch (_) {}` now handles max-polls on error; Onboarding silent catch documented
- **console.log removed**: All 4 production console.log calls removed from DetailPanel.jsx
- **Index-as-key fixed**: ProductTour (`tour-dot-${i}`), CommentThread (`mention-${i}`, `text-${i}`)
- **Hook dep comments**: ReviewMode eslint-disable-lines now have `--` explanations; Settings initial-load effect documented
- **Backend refactoring**: `_build_fund_context_block`, `_build_analysis_prompt` extracted from `analyze_email`; `_process_single_message` extracted from `sync_user_emails` inner loop; `EmailPayload` dataclass added
- **Bug fix**: Settings.jsx Promise.all accidentally dropped then restored; em-dash in eslint-disable comments fixed to double-dash
- **Phase 1 (Security)**: Hardcoded JWTs removed from all 7 test files → `TEST_JWT_TOKEN` env var; `random.choices` → `secrets.choice`; `is True/False` → `== True/False`; `conftest.py` created
- **Phase 2 (React Hooks)**: Dashboard `useEffect` deps fixed; `console.warn` removed
- **Phase 3 (httpOnly Cookies)**: Full auth migration — `get_current_user` dual-mode (cookie first, Bearer fallback); `auth_callback` sets httpOnly cookie; `api.js` uses `credentials:include`; `App.js` cookie-based auth; CORS scoped to `FRONTEND_URL`
- **Phase 4 (Console Logs)**: Production `console.warn` removed from Dashboard
- **Phase 5 (Component Splitting)**: `PassModal`, `WatchlistModal`, `CardContent` → `/components/review/`; `StatsBar` → `/components/dashboard/`; `AIGateSection` → `/components/settings/`; Array index keys fixed in DetailPanel
- **Phase 6 (Backend Refactoring)**: `_build_deal_dict`, `_refresh_gmail_token_if_needed`, `_build_gmail_query_params`, `_determine_contact_status`, `_build_new_contact_dict` helpers extracted in server.py
**Status**: MVP Complete — 7-stage VC deal flow system live

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

### 2026-04-19 (Session 8 — Gmail Pipeline Rebuild & AI Extraction Validation)
- ✅ Noise filters: List-Unsubscribe header check, automated sender detection (exact list + prefix + name keywords), noisy subject keywords, body < 50 chars, self-sent
- ✅ Gmail query updated: `in:inbox -from:me -category:promotions -category:social -category:updates`, maxResults=50
- ✅ Claude prompt rebuilt: 13-field extraction (category, relevance_score, warm_or_cold, traction_mentioned, deck_attached, stage, check_size_requested, founder background, urgency_score, next_action, summary, tags, confidence) + thesis fields
- ✅ Removed "Cold outreach" category — cold founder pitches now use "Founder pitch" (warm/cold captured via warm_or_cold field separately)
- ✅ deck_attached=true now includes verbal offers ("happy to send the deck") in addition to actual attachments/links
- ✅ /api/test-extraction endpoint: 10 hardcoded test emails, 10/10 pass rate validated
- ✅ /api/sync/status: always returns step/message/total/current/last_synced/is_syncing (even when idle)
- ✅ Real-time sync progress: _run_background_sync sets step 1 ("Connecting"), sync_user_emails sets step 2 ("Found N emails"), step 3 per email ("Processing..."), step 5 ("Complete")
- ✅ Dashboard sync button: polls /sync/status every 5s, shows live message during sync, "synced X ago" in toolbar
- ✅ 500ms rate limit delay between email Claude calls
- ✅ Claude fallback: if Claude fails → category="Unprocessed", relevance_score=0, no silent drops



### 2026-04-19 (Session 7 — Updated Product Tour)
- ✅ Tour expanded from 4 → 6 steps: Fund Focus → AI Match Score → Categorize Deals → Pipeline View → Contacts → Review Mode
- ✅ "Got it, don't show again" restored on the final step (writes vc_tour_dismissed to localStorage)
- ✅ X button and "Skip tour" remain session-only (tour reappears next login)
- ✅ Removed dependency on firstDealId — deals-table used instead of dynamic deal-row selector
- ✅ Confirmed via screenshots: step 1 (Fund Focus spotlight) and step 6 (Review Mode + "Got it, don't show again" button)

- ✅ Tour now shows on EVERY login (removed localStorage gate + cleared old dismissed flag)
- ✅ "Don't show again" replaced with "Skip tour" (session-only close, no persistence)
- ✅ "Got it, don't show again" final button renamed to "Got it"
- ✅ Confirmed via screenshot: tour spotlight fires correctly on Fund Focus (step 1 of 4)

- ✅ ROOT CAUSE FOUND: DetailPanel had 2 disconnected sections — 'Save Contact' (only saved contact, didn't update deal) and 'Move Deal To' (only updated deal, never created contact)
- ✅ FIX: Merged into single 'Categorize Deal' section — 'Add to Pipeline' and 'Save for Review' now do BOTH: update deal status AND call upsertContact in one click
- ✅ ReviewMode: swipe right (Pipeline) and swipe up (Review) now also call upsertContact
- ✅ Added backend logging: '[Contact] upsert triggered — user=... email=... status=...'
- ✅ Contacts page: error banner on fetch failure, console.log diagnostics, Test Contact dev button
- ✅ 100% test pass rate (9/9 tests passed, 1 skipped due to no New deals in test data)

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
- ✅ 7-stage VC deal flow system (Inbound, First Look, In Conversation, Due Diligence, Closed, Passed, Watch List)
- ✅ Backend auto-migration on startup: old stage names → new ones
- ✅ ReviewMode 4-way swipe: Right=First Look, Left=Pass (reason modal), Up=Watch List (date modal), Down=Draft Reply
- ✅ PassModal: presets + custom text input, skip option
- ✅ WatchlistModal: 1/3/6/12 month presets + custom date picker
- ✅ DetailPanel stage selector: Progress row (active stages) + Exit State row (Passed/Watch List)
- ✅ pass_reason and watchlist_revisit_date saved via /api/deals/{id}/stage
- ✅ Dashboard STAGE_STYLES updated for all 7 new stages
- ✅ Team Collaboration Engine (Funds, Member Invites, Deal Assignments, VC-term Voting, Comments)
- ✅ Contacts table created in Supabase
- ✅ Full Contacts system implemented and tested
- ✅ **Auto Contact Upsert** — `auto_upsert_contact()` fires automatically on every PATCH /deals/{id}/stage for contact-worthy stages
- ✅ **No-downgrade logic** — STATUS_ORDER ensures contact_status never moves backwards
- ✅ **POST /api/contacts/sync-pipeline** — retroactive sync endpoint backfills Contacts from all active pipeline deals
- ✅ **Contacts.jsx overhaul** — new STATUS_STYLES for 6 VC stages (+ legacy aliases), 7 filter tabs, 4 stats bar, Returning badge for deal_count>1
- ✅ **Settings.jsx Data Management card** — "Sync contacts from pipeline" button with toast feedback

### P1 (Next features)
- [ ] Deal CSV export (user mentioned for deals table)
- [ ] Slack webhook for high-score deals (score ≥ 70)
- [ ] Watch List reminders banner on dashboard (if watchlist_revisit_date <= today)

### P2 (Future)
- [ ] Email thread view — full conversation history
- [ ] Bulk actions (multi-select deals)
