"""
Contacts API tests - covers GET /contacts, POST /contacts/upsert,
PATCH /contacts/{id}, GET /contacts/{id}/deals
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TOKEN = os.environ.get('TEST_JWT_TOKEN', '')
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

SAMPLE_DEAL = {
    "sender_name": "TEST_Alice Smith",
    "sender_email": "test_alice_contacts@example.com",
    "company_name": "TEST_AlphaTech",
    "founder_role": "CEO",
    "sector": "SaaS",
    "stage": "Seed",
    "geography": "New York, NY",
    "warm_or_cold": "Warm",
    "intro_source": "Test Source",
    "tags": ["test", "saas"],
    "thesis_match_score": 75,
    "relevance_score": 8,
    "received_date": "2026-01-01T00:00:00+00:00"
}

created_contact_id = None


class TestGetContacts:
    """GET /api/contacts"""

    def test_get_contacts_returns_200(self):
        r = requests.get(f"{BASE_URL}/api/contacts", headers=HEADERS)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert isinstance(r.json(), list), "Response should be a list"
        print(f"GET /api/contacts: {r.status_code}, {len(r.json())} contacts")

    def test_get_contacts_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/contacts")
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"
        print(f"Unauthorized GET contacts: {r.status_code} ✓")


class TestUpsertContact:
    """POST /api/contacts/upsert"""

    def test_create_new_contact(self):
        global created_contact_id
        payload = {"deal": SAMPLE_DEAL, "contact_status": "In Pipeline"}
        r = requests.post(f"{BASE_URL}/api/contacts/upsert", json=payload, headers=HEADERS)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get('status') in ('created', 'updated'), f"Expected created/updated, got {data}"
        created_contact_id = data.get('contact_id')
        assert created_contact_id, "Expected contact_id in response"
        print(f"Upsert (create): status={data['status']}, id={created_contact_id}")

    def test_deduplication_same_email_returns_updated(self):
        payload = {"deal": SAMPLE_DEAL, "contact_status": "In Pipeline"}
        r = requests.post(f"{BASE_URL}/api/contacts/upsert", json=payload, headers=HEADERS)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get('status') == 'updated', f"Expected 'updated' for duplicate, got {data['status']}"
        print(f"Dedup upsert: status={data['status']} ✓")

    def test_upsert_missing_email_returns_400(self):
        bad_deal = {"sender_name": "No Email", "company_name": "X"}
        r = requests.post(f"{BASE_URL}/api/contacts/upsert", json={"deal": bad_deal, "contact_status": "In Pipeline"}, headers=HEADERS)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        print(f"Upsert missing email: {r.status_code} ✓")

    def test_upsert_in_review_status(self):
        review_deal = {**SAMPLE_DEAL, "sender_email": "test_review_contact@example.com"}
        payload = {"deal": review_deal, "contact_status": "In Review"}
        r = requests.post(f"{BASE_URL}/api/contacts/upsert", json=payload, headers=HEADERS)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get('status') in ('created', 'updated')
        print(f"Upsert In Review: status={data['status']} ✓")


class TestUpdateContact:
    """PATCH /api/contacts/{id}"""

    def test_update_notes(self):
        global created_contact_id
        if not created_contact_id:
            # Fetch existing contacts
            r = requests.get(f"{BASE_URL}/api/contacts", headers=HEADERS)
            contacts = r.json()
            if contacts:
                created_contact_id = contacts[0]['id']
            else:
                pytest.skip("No contacts available to update")
        r = requests.patch(
            f"{BASE_URL}/api/contacts/{created_contact_id}",
            json={"notes": "TEST_Note updated by test"},
            headers=HEADERS
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get('status') == 'updated'
        print(f"PATCH contact notes: {data['status']} ✓")

    def test_update_status(self):
        global created_contact_id
        if not created_contact_id:
            pytest.skip("No contact id")
        r = requests.patch(
            f"{BASE_URL}/api/contacts/{created_contact_id}",
            json={"contact_status": "Portfolio"},
            headers=HEADERS
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        print(f"PATCH contact status: ✓")


class TestGetContactDeals:
    """GET /api/contacts/{id}/deals"""

    def test_get_contact_deals(self):
        global created_contact_id
        if not created_contact_id:
            pytest.skip("No contact id")
        r = requests.get(f"{BASE_URL}/api/contacts/{created_contact_id}/deals", headers=HEADERS)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert isinstance(r.json(), list), "Response should be a list"
        print(f"GET contact deals: {r.status_code}, {len(r.json())} deals ✓")

    def test_get_contact_deals_invalid_id(self):
        r = requests.get(f"{BASE_URL}/api/contacts/00000000-0000-0000-0000-000000000000/deals", headers=HEADERS)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}"
        print(f"GET contact deals (invalid id): {r.status_code} ✓")
