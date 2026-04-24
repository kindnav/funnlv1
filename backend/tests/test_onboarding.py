"""
Tests for onboarding feature:
- POST /api/onboarding-complete
- Fund settings persistence
- Landing page / DB status endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TOKEN = os.environ.get('TEST_JWT_TOKEN', '')
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestOnboardingComplete:

    def test_post_onboarding_complete_returns_ok(self, client):
        """POST /api/onboarding-complete returns {ok: true}"""
        r = client.post(f"{BASE_URL}/api/onboarding-complete", headers=AUTH)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok")

    def test_onboarding_complete_persists_in_fund_settings(self, client):
        """After marking complete, fund-settings should have onboarding_complete=true"""
        client.post(f"{BASE_URL}/api/onboarding-complete", headers=AUTH)
        r = client.get(f"{BASE_URL}/api/fund-settings", headers=AUTH)
        assert r.status_code == 200
        settings = r.json()
        assert settings.get("onboarding_complete")

    def test_onboarding_complete_requires_auth(self, client):
        """POST without token should return 401/403"""
        r = client.post(f"{BASE_URL}/api/onboarding-complete")
        assert r.status_code in [401, 403]

    def test_fund_settings_save_preserves_onboarding_flag(self, client):
        """Saving fund-settings should NOT overwrite onboarding_complete"""
        # First mark complete
        client.post(f"{BASE_URL}/api/onboarding-complete", headers=AUTH)
        # Now save fund settings
        client.post(f"{BASE_URL}/api/fund-settings", headers=AUTH, json={"fund_name": "Test Fund", "thesis": "Test thesis"})
        # Verify onboarding_complete still present
        r = client.get(f"{BASE_URL}/api/fund-settings", headers=AUTH)
        assert r.status_code == 200
        assert r.json().get("onboarding_complete")

    def test_db_status_endpoint(self, client):
        """GET /api/status/db returns tables_ready boolean"""
        r = client.get(f"{BASE_URL}/api/status/db")
        assert r.status_code == 200
        data = r.json()
        assert "tables_ready" in data
        assert isinstance(data["tables_ready"], bool)
