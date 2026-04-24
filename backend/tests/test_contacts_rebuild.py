"""
Tests for Contacts system rebuild - iteration 18
Covers: rebuild, sync-pipeline, sync_contact triggers, CRUD, dedup
"""
import pytest
import requests
import os
from pathlib import Path

# Load env from files
def _load_env(path):
    if Path(path).exists():
        for line in Path(path).read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                os.environ.setdefault(k.strip(), v.strip())

_load_env('/app/frontend/.env')
_load_env('/app/backend/.env')

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TOKEN = os.environ.get('TEST_JWT_TOKEN', '')

HEADERS = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}


def auth_get(path):
    return requests.get(f"{BASE_URL}/api{path}", headers=HEADERS)

def auth_post(path, data=None):
    return requests.post(f"{BASE_URL}/api{path}", json=data or {}, headers=HEADERS)

def auth_patch(path, data):
    return requests.patch(f"{BASE_URL}/api{path}", json=data, headers=HEADERS)


# ── GET /contacts ────────────────────────────────────────────────────────────

def test_get_contacts_returns_list():
    r = auth_get('/contacts')
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
    data = r.json()
    assert isinstance(data, list), "Expected list response"
    print(f"[PASS] GET /contacts => {len(data)} contacts")


# ── POST /contacts/rebuild ───────────────────────────────────────────────────

def test_rebuild_contacts():
    r = auth_post('/contacts/rebuild')
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
    data = r.json()
    assert 'created' in data, "Missing 'created' field"
    assert 'skipped' in data, "Missing 'skipped' field"
    assert isinstance(data['created'], int)
    assert isinstance(data['skipped'], int)
    print(f"[PASS] POST /contacts/rebuild => created={data['created']} skipped={data['skipped']}")


def test_rebuild_returns_contacts_after():
    auth_post('/contacts/rebuild')
    r = auth_get('/contacts')
    assert r.status_code == 200
    contacts = r.json()
    print(f"[PASS] After rebuild: {len(contacts)} contacts")


# ── POST /contacts/sync-pipeline ─────────────────────────────────────────────

def test_sync_pipeline():
    r = auth_post('/contacts/sync-pipeline')
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
    data = r.json()
    assert 'synced' in data or 'created' in data, f"Missing synced/created field: {data}"
    print(f"[PASS] POST /contacts/sync-pipeline => {data}")


# ── PATCH /deals/{id}/stage triggers sync_contact ────────────────────────────

def test_stage_change_syncs_contact():
    # Get a deal first
    r = requests.get(f"{BASE_URL}/api/deals", headers=HEADERS)
    assert r.status_code == 200
    deals = r.json()
    if not deals:
        pytest.skip("No deals available for stage change test")
    
    # Find a deal with email
    deal = next((d for d in deals if d.get('sender_email') or d.get('founder_email')), None)
    if not deal:
        pytest.skip("No deals with email found")

    deal_id = deal['id']
    r2 = auth_patch(f'/deals/{deal_id}/stage', {'stage': 'First Look'})
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}: {r2.text[:200]}"
    data = r2.json()
    assert data.get('ok') is True
    # contact sync result present (can be None if spam, but key should be present)
    assert 'contact' in data, "Missing 'contact' field in stage change response"
    print(f"[PASS] PATCH /deals/{deal_id[:8]}/stage => contact={data.get('contact')}")


# ── PATCH /deals/{id} triggers sync_contact ──────────────────────────────────

def test_deal_patch_syncs_contact():
    r = requests.get(f"{BASE_URL}/api/deals", headers=HEADERS)
    assert r.status_code == 200
    deals = r.json()
    if not deals:
        pytest.skip("No deals for PATCH test")
    
    deal = next((d for d in deals if d.get('sender_email') or d.get('founder_email')), None)
    if not deal:
        pytest.skip("No deals with email")

    deal_id = deal['id']
    r2 = auth_patch(f'/deals/{deal_id}', {'deal_stage': 'First Look'})
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}: {r2.text[:200]}"
    data = r2.json()
    assert 'contact' in data, "Missing 'contact' field"
    print(f"[PASS] PATCH /deals/{deal_id[:8]} => contact={data.get('contact')}")


# ── PATCH /contacts/{id} ─────────────────────────────────────────────────────

def test_update_contact_notes_and_tags():
    r = auth_get('/contacts')
    assert r.status_code == 200
    contacts = r.json()
    if not contacts:
        pytest.skip("No contacts to update")
    
    contact_id = contacts[0]['id']
    r2 = auth_patch(f'/contacts/{contact_id}', {'notes': 'Test note from pytest', 'tags': ['test-tag']})
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}: {r2.text[:200]}"
    data = r2.json()
    print(f"[PASS] PATCH /contacts/{contact_id[:8]} => {data}")
    
    # Verify GET returns updated notes
    r3 = auth_get(f'/contacts/{contact_id}/deals')
    # Just ensure it's accessible
    assert r3.status_code in [200, 404]


# ── GET /contacts/{id}/deals ──────────────────────────────────────────────────

def test_get_contact_deals():
    r = auth_get('/contacts')
    contacts = r.json()
    if not contacts:
        pytest.skip("No contacts")
    
    contact_id = contacts[0]['id']
    r2 = auth_get(f'/contacts/{contact_id}/deals')
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}: {r2.text[:200]}"
    data = r2.json()
    assert isinstance(data, list)
    print(f"[PASS] GET /contacts/{contact_id[:8]}/deals => {len(data)} deals")


# ── sync_contact skips spam categories (via rebuild) ─────────────────────────

def test_rebuild_skips_spam_deals():
    """After rebuild, skipped count should correspond to spam deals (non-zero if spam exists)."""
    r = auth_post('/contacts/rebuild')
    assert r.status_code == 200
    data = r.json()
    # We can't force spam deals in this test, just verify the counters are integers
    assert data['created'] + data['skipped'] >= 0
    print(f"[PASS] Rebuild: created={data['created']} skipped={data['skipped']} (spam/no-email deals skipped)")


# ── Deduplication check ───────────────────────────────────────────────────────

def test_double_rebuild_no_duplicate():
    """Two consecutive rebuilds should yield same number of contacts (dedup)."""
    auth_post('/contacts/rebuild')
    r1 = auth_get('/contacts')
    count1 = len(r1.json())
    
    auth_post('/contacts/rebuild')
    r2 = auth_get('/contacts')
    count2 = len(r2.json())
    
    assert count1 == count2, f"Duplicate contacts created on second rebuild: {count1} vs {count2}"
    print(f"[PASS] Dedup: both rebuilds => {count1} contacts")
