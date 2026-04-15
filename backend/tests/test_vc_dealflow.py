"""
VC Deal Flow API Tests
Tests: auth/me, deals, stats, process email, update deal, settings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiYzA1NGJhY2MtNzI1Ni00MWFiLWI2MTMtMTM3OWZiOGVlODgzIiwiZW1haWwiOiJ0ZXN0QGZ1dHVyZWZyb250aWVyY2FwaXRhbC52YyIsImV4cCI6MTc3ODgwMzgwNn0.FxlgMkfUO2Y-f2oTIRAh0EKtSO7a5YgXwmU5sCDdb28"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def auth_headers():
    return HEADERS


class TestHealth:
    """Health check"""
    def test_api_root(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "healthy"
        print("PASS: API root healthy")


class TestAuth:
    """Auth endpoints"""
    def test_get_me(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert "email" in data
        assert "gmail_connected" in data
        assert data["email"] == "test@futurefrontiercapital.vc"
        print(f"PASS: /auth/me returns user, gmail_connected={data['gmail_connected']}")

    def test_get_me_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401
        print("PASS: /auth/me requires auth")


class TestDeals:
    """Deals endpoints"""
    def test_get_deals(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 4
        print(f"PASS: GET /deals returns {len(data)} deals")

    def test_deals_contain_sample_companies(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        data = r.json()
        companies = [d.get("company_name") for d in data]
        assert "VaultAI" in companies
        assert "GreenLoop" in companies
        assert "CloudBase Solutions" in companies
        print(f"PASS: Sample companies present: {companies}")

    def test_deals_have_required_fields(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        data = r.json()
        deal = data[0]
        for field in ["id", "sender_name", "sender_email", "subject", "relevance_score", "status", "category"]:
            assert field in deal, f"Missing field: {field}"
        print("PASS: Deals have required fields")

    def test_vault_ai_score(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        data = r.json()
        vault = next((d for d in data if d.get("company_name") == "VaultAI"), None)
        assert vault is not None
        assert vault["relevance_score"] == 9
        assert vault["status"] == "New"
        print("PASS: VaultAI has score=9, status=New")


class TestStats:
    """Stats endpoint"""
    def test_get_stats(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/stats", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total" in data
        assert "founder_pitches" in data
        assert "avg_relevance" in data
        assert "high_score" in data
        assert "unreviewed" in data
        assert data["total"] >= 4
        print(f"PASS: /stats returns {data}")

    def test_stats_values(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/stats", headers=auth_headers)
        data = r.json()
        # 2 new deals (VaultAI, GreenLoop), 1 reviewed (LP Partners), 1 archived (CloudBase)
        assert data["unreviewed"] >= 2
        assert data["founder_pitches"] >= 1
        assert data["avg_relevance"] > 0
        print(f"PASS: Stats values correct: {data}")


class TestProcessEmail:
    """Process email (Claude AI) endpoint"""
    def test_process_email_requires_body(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/deals/process", json={"sender_name": "Test"}, headers=auth_headers)
        assert r.status_code == 400
        print("PASS: process requires body field")

    def test_process_email_claude_ai(self, auth_headers):
        payload = {
            "sender_name": "TEST_John Founder",
            "sender_email": "test_john@testcorp.io",
            "subject": "TEST_Corp – Series A Pitch",
            "body": "Hi, I'm the CEO of TestCorp. We're raising a $5M Series A. We have $200k MRR and 50 enterprise customers. Please review our deck."
        }
        r = requests.post(f"{BASE_URL}/api/deals/process", json=payload, headers=auth_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert "relevance_score" in data
        assert isinstance(data["relevance_score"], int)
        assert 1 <= data["relevance_score"] <= 10
        assert "category" in data
        assert "summary" in data
        print(f"PASS: Claude AI processed email - score={data['relevance_score']}, category={data['category']}")
        return data["id"]


class TestUpdateDeal:
    """PATCH /deals/{id}"""
    def test_update_deal_status(self, auth_headers):
        # Get any available deal
        r = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        deals = r.json()
        assert len(deals) > 0
        deal_id = deals[0]["id"]
        # Mark as reviewed
        r2 = requests.patch(f"{BASE_URL}/api/deals/{deal_id}", json={"status": "Reviewed"}, headers=auth_headers)
        assert r2.status_code == 200
        print(f"PASS: PATCH /deals/{deal_id} status=Reviewed")

        # Reset to New
        requests.patch(f"{BASE_URL}/api/deals/{deal_id}", json={"status": "New"}, headers=auth_headers)

    def test_update_invalid_field(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        deal_id = r.json()[0]["id"]
        r2 = requests.patch(f"{BASE_URL}/api/deals/{deal_id}", json={"invalid_field": "hack"}, headers=auth_headers)
        assert r2.status_code == 400
        print("PASS: PATCH rejects invalid fields")


class TestSettings:
    """Settings endpoint"""
    def test_get_settings(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "gmail_connected" in data
        assert "anthropic_key_set" in data
        assert data["anthropic_key_set"] is True
        print(f"PASS: /settings returns {data}")

    def test_db_status(self):
        r = requests.get(f"{BASE_URL}/api/status/db")
        assert r.status_code == 200
        data = r.json()
        assert data.get("tables_ready") is True
        print("PASS: DB tables ready")
