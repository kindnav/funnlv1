# Changelog

## 2026-04-21 — Team Collaboration (Parts 1-9)

### New tables (SQL migration required)
- `funds` — fund entity with invite code (format: XXX-XXXX)
- `fund_members` — users ↔ funds with role (admin/member)
- `deal_assignments` — assignment history with notes
- `deal_votes` — per-deal per-user votes (yes/no/maybe) with unique constraint
- `deal_comments` — threaded comments + system messages with `type` field
- `notifications` — assignment + mention + high-score notifications
- New columns on `deals`: `fund_id`, `deal_stage`, `assigned_to`, `inbox_owner`

### Backend endpoints added
- `POST /api/funds` — create fund, auto-generates invite code
- `POST /api/funds/join` — join by invite code
- `GET /api/funds/me` — get fund info + members + role
- `DELETE /api/funds/{id}/members/{uid}` — admin removes member
- `POST /api/funds/leave` — member leaves fund
- `DELETE /api/funds/{id}` — admin deletes fund
- `GET /api/deals/fund` — all deals from all fund members (shared dashboard)
- `PATCH /api/deals/{id}/stage` — update stage + creates system comment
- `POST /api/deals/{id}/assign` — assign deal + creates notification + system comment
- `GET /api/deals/{id}/votes` / `POST /api/deals/{id}/vote` — vote CRUD
- `GET /api/deals/{id}/comments` / `POST /api/deals/{id}/comments` — comments
- `PATCH /api/deal-comments/{id}` / `DELETE /api/deal-comments/{id}` — edit/delete
- `GET /api/notifications` / `PATCH /api/notifications/read-all` / `PATCH /api/notifications/{id}/read`

### New frontend components
- `MemberAvatar.jsx` — colored initials circles with consistent hash-based color
- `TeamSetup.jsx` — create/join fund UI + member management + leave/delete
- `VotingSection.jsx` — Yes/Maybe/No vote buttons + tally + leaning badge + voter initials
- `CommentThread.jsx` — threaded comments with @mentions, system messages, edit/delete, replies
- `NotificationBell.jsx` — bell icon with red badge + dropdown showing last 10 notifications

### Modified frontend
- `Settings.jsx` — Team Collaboration section added (above Gmail Integration)
- `Dashboard.jsx` — My Inbox/Fund Dashboard toggle, Owner/Assigned/Stage/Votes columns, NotificationBell in nav, fundInfo passed to DetailPanel, Assigned-to-me filter
- `DetailPanel.jsx` — Stage selector bar, assignment dropdown, VotingSection+CommentThread for fund members (solo users keep Notes field)
- `api.js` — All new API helper functions

## 2026-04-19 — Gmail Pipeline Rebuild

### Extraction accuracy
- `test-extraction` endpoint: 10/10 tests passing
- Removed ambiguous "Cold outreach" category (now = "Founder pitch" + warm_or_cold field)
- `deck_attached=true` now detects verbal deck offers ("happy to send the deck")
- `/api/sync/status` always returns structured `{step, message, total, current, last_synced, is_syncing}`

### Sync pipeline
- Step 1: Connecting, Step 2: Found N emails, Step 3: Processing per-email, Step 5: Complete
- 500ms rate limit between Claude calls
- Fallback: Claude failure → category='Unprocessed', relevance_score=0
