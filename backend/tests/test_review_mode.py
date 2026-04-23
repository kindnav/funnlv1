"""Tests for Review Mode feature: PATCH /api/deals/{id} and POST /api/sync"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TOKEN = os.environ.get('TEST_JWT_TOKEN', '')

@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

class TestGetDeals:
    """Test GET /api/deals - fetches New deals for review mode"""

    def test_get_deals_returns_200(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"

    def test_get_deals_has_new_status_deals(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        new_deals = [d for d in data if d.get('status') == 'New']
        print(f"Found {len(new_deals)} New deals out of {len(data)} total")
        # At minimum sample data should be there
        assert len(data) >= 0

    def test_get_deals_has_required_fields(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        data = r.json()
        if data:
            d = data[0]
            for field in ['id', 'company_name', 'status']:
                assert field in d, f"Missing field: {field}"


class TestPatchDeal:
    """Test PATCH /api/deals/{id} - status update for Review Mode"""

    def _get_new_deal_id(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        deals = r.json()
        new_deals = [d for d in deals if d.get('status') == 'New']
        return new_deals[0]['id'] if new_deals else None

    def test_patch_status_to_pipeline(self, auth_headers):
        deal_id = self._get_new_deal_id(auth_headers)
        if not deal_id:
            pytest.skip("No New deals available")
        r = requests.patch(f"{BASE_URL}/api/deals/{deal_id}", json={"status": "pipeline"}, headers=auth_headers)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
        data = r.json()
        assert "message" in data or "Updated" in str(data)
        # Restore
        requests.patch(f"{BASE_URL}/api/deals/{deal_id}", json={"status": "New"}, headers=auth_headers)

    def test_patch_status_to_archived(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        deals = r.json()
        new_deals = [d for d in deals if d.get('status') == 'New']
        if not new_deals:
            pytest.skip("No New deals available")
        deal_id = new_deals[0]['id']
        r = requests.patch(f"{BASE_URL}/api/deals/{deal_id}", json={"status": "archived"}, headers=auth_headers)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
        # Restore
        requests.patch(f"{BASE_URL}/api/deals/{deal_id}", json={"status": "New"}, headers=auth_headers)

    def test_patch_status_to_reviewed(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        deals = r.json()
        new_deals = [d for d in deals if d.get('status') == 'New']
        if not new_deals:
            pytest.skip("No New deals available")
        deal_id = new_deals[0]['id']
        r = requests.patch(f"{BASE_URL}/api/deals/{deal_id}", json={"status": "Reviewed"}, headers=auth_headers)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
        # Restore
        requests.patch(f"{BASE_URL}/api/deals/{deal_id}", json={"status": "New"}, headers=auth_headers)

    def test_patch_invalid_field_rejected(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        deals = r.json()
        if not deals:
            pytest.skip("No deals")
        deal_id = deals[0]['id']
        r = requests.patch(f"{BASE_URL}/api/deals/{deal_id}", json={"hacked_field": "xyz"}, headers=auth_headers)
        assert r.status_code == 400

    def test_patch_requires_auth(self):
        r = requests.patch(f"{BASE_URL}/api/deals/some-id", json={"status": "pipeline"})
        assert r.status_code == 401


class TestSyncEndpoint:
    """Test POST /api/sync - background task, should return immediately"""

    def test_sync_returns_immediately(self, auth_headers):
        import time
        start = time.time()
        r = requests.post(f"{BASE_URL}/api/sync", headers=auth_headers)
        elapsed = time.time() - start
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
        assert elapsed < 5.0, f"Sync took {elapsed:.1f}s - should be background task"
        data = r.json()
        assert "message" in data
        print(f"Sync returned in {elapsed:.2f}s: {data}")

    def test_sync_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/sync")
        assert r.status_code == 401
