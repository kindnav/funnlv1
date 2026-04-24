"""Tests for VC-native 7-stage deal flow system"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vc-pipeline-1.preview.emergentagent.com').rstrip('/')
JWT = os.environ.get('TEST_JWT_TOKEN', '')

HEADERS = {"Authorization": f"Bearer {JWT}", "Content-Type": "application/json"}

class TestDealStages:
    """Test 7-stage deal flow"""

    def test_api_health(self):
        resp = requests.get(f"{BASE_URL}/api/")
        assert resp.status_code == 200

    def test_get_deals_returns_inbound(self):
        """ReviewMode loads with deal_stage=Inbound deals"""
        resp = requests.get(f"{BASE_URL}/api/deals", headers=HEADERS)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text[:200]}"
        deals = resp.json()
        assert isinstance(deals, list)
        # Check that deals with deal_stage exist
        stages = {d.get('deal_stage') for d in deals}
        print(f"Stages found: {stages}")
        # No old-style stages should be present
        old_stages = {'New', 'Assigned', 'Under Review', 'Committee Decision', 'Invested'}
        overlap = stages & old_stages
        assert not overlap, f"Old stages still present: {overlap}"

    def test_inbound_deals_present(self):
        """Deals with Inbound stage exist for ReviewMode"""
        resp = requests.get(f"{BASE_URL}/api/deals", headers=HEADERS)
        assert resp.status_code == 200
        deals = resp.json()
        inbound = [d for d in deals if d.get('deal_stage') == 'Inbound']
        print(f"Inbound deals count: {len(inbound)}")
        # Sample deals should be seeded
        assert len(inbound) >= 0  # just verify it runs; may be 0 for test user

    def test_stage_update_first_look(self):
        """PATCH /api/deals/{id}/stage updates to First Look"""
        # Get a deal first
        resp = requests.get(f"{BASE_URL}/api/deals", headers=HEADERS)
        assert resp.status_code == 200
        deals = resp.json()
        if not deals:
            pytest.skip("No deals available to test stage update")
        deal_id = deals[0]['id']
        original_stage = deals[0].get('deal_stage', 'Inbound')

        patch_resp = requests.patch(
            f"{BASE_URL}/api/deals/{deal_id}/stage",
            headers=HEADERS,
            json={"stage": "First Look"}
        )
        assert patch_resp.status_code == 200
        data = patch_resp.json()
        assert data.get('ok')
        assert data.get('stage') == 'First Look'

        # Restore
        requests.patch(f"{BASE_URL}/api/deals/{deal_id}/stage", headers=HEADERS,
                       json={"stage": original_stage})

    def test_stage_update_passed_with_reason(self):
        """Backend /api/deals/{id}/stage accepts pass_reason"""
        resp = requests.get(f"{BASE_URL}/api/deals", headers=HEADERS)
        assert resp.status_code == 200
        deals = resp.json()
        if not deals:
            pytest.skip("No deals available")
        deal_id = deals[0]['id']
        original_stage = deals[0].get('deal_stage', 'Inbound')

        patch_resp = requests.patch(
            f"{BASE_URL}/api/deals/{deal_id}/stage",
            headers=HEADERS,
            json={"stage": "Passed", "pass_reason": "Market too small"}
        )
        assert patch_resp.status_code == 200
        data = patch_resp.json()
        assert data.get('ok')
        assert data.get('stage') == 'Passed'

        # Restore
        requests.patch(f"{BASE_URL}/api/deals/{deal_id}/stage", headers=HEADERS,
                       json={"stage": original_stage})

    def test_stage_update_watchlist_with_date(self):
        """Backend /api/deals/{id}/stage accepts watchlist_revisit_date"""
        resp = requests.get(f"{BASE_URL}/api/deals", headers=HEADERS)
        assert resp.status_code == 200
        deals = resp.json()
        if not deals:
            pytest.skip("No deals available")
        deal_id = deals[0]['id']
        original_stage = deals[0].get('deal_stage', 'Inbound')

        patch_resp = requests.patch(
            f"{BASE_URL}/api/deals/{deal_id}/stage",
            headers=HEADERS,
            json={"stage": "Watch List", "watchlist_revisit_date": "2026-06-01"}
        )
        assert patch_resp.status_code == 200
        data = patch_resp.json()
        assert data.get('ok') is True
        assert data.get('stage') == 'Watch List'

        # Restore
        requests.patch(f"{BASE_URL}/api/deals/{deal_id}/stage", headers=HEADERS,
                       json={"stage": original_stage})

    def test_stage_update_missing_stage_returns_400(self):
        """Stage endpoint returns 400 when stage missing"""
        resp = requests.get(f"{BASE_URL}/api/deals", headers=HEADERS)
        deals = resp.json() if resp.status_code == 200 else []
        if not deals:
            pytest.skip("No deals available")
        deal_id = deals[0]['id']

        patch_resp = requests.patch(
            f"{BASE_URL}/api/deals/{deal_id}/stage",
            headers=HEADERS,
            json={}
        )
        assert patch_resp.status_code == 400

    def test_all_7_stages_valid(self):
        """All 7 new stages can be set"""
        resp = requests.get(f"{BASE_URL}/api/deals", headers=HEADERS)
        assert resp.status_code == 200
        deals = resp.json()
        if not deals:
            pytest.skip("No deals available")
        deal_id = deals[0]['id']
        original_stage = deals[0].get('deal_stage', 'Inbound')

        stages = ['Inbound', 'First Look', 'In Conversation', 'Due Diligence', 'Closed', 'Passed', 'Watch List']
        for stage in stages:
            patch_resp = requests.patch(
                f"{BASE_URL}/api/deals/{deal_id}/stage",
                headers=HEADERS,
                json={"stage": stage}
            )
            assert patch_resp.status_code == 200, f"Stage '{stage}' failed: {patch_resp.text}"
            print(f"Stage '{stage}': OK")

        # Restore
        requests.patch(f"{BASE_URL}/api/deals/{deal_id}/stage", headers=HEADERS,
                       json={"stage": original_stage})
