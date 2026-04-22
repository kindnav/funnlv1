"""Tests for AI Gate feature - gate_email, gated_emails endpoints, restore, test-gate"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiYzA1NGJhY2MtNzI1Ni00MWFiLWI2MTMtMTM3OWZiOGVlODgzIiwiZW1haWwiOiJ0ZXN0QGZ1dHVyZWZyb250aWVyY2FwaXRhbC52YyIsImV4cCI6MTc3ODgwMzgwNn0.FxlgMkfUO2Y-f2oTIRAh0EKtSO7a5YgXwmU5sCDdb28"

@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {JWT}"}


class TestGateEndpoints:
    """AI Gate feature API tests"""

    def test_test_gate_returns_results(self, auth_headers):
        """GET /api/test-gate returns test results with pass/total counts"""
        resp = requests.get(f"{BASE_URL}/api/test-gate", headers=auth_headers, timeout=60)
        assert resp.status_code == 200
        data = resp.json()
        assert "passed" in data
        assert "total" in data
        assert data["total"] == 12
        assert data["passed"] >= 11  # 11/12 minimum per spec

    def test_test_gate_results_structure(self, auth_headers):
        """GET /api/test-gate returns tests array with id/name/result/pass fields"""
        resp = requests.get(f"{BASE_URL}/api/test-gate", headers=auth_headers, timeout=60)
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert len(data["results"]) == 12
        for t in data["results"]:
            assert "name" in t
            assert "actual" in t
            assert "expected" in t

    def test_gated_emails_returns_list(self, auth_headers):
        """GET /api/gated-emails returns emails array"""
        resp = requests.get(f"{BASE_URL}/api/gated-emails", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "emails" in data
        assert isinstance(data["emails"], list)

    def test_restore_nonexistent_gated_email(self, auth_headers):
        """POST /api/gated-emails/{id}/restore returns 404 for nonexistent id"""
        resp = requests.post(
            f"{BASE_URL}/api/gated-emails/nonexistent-id-12345/restore",
            headers=auth_headers
        )
        assert resp.status_code == 404

    def test_sync_status_has_gate_fields(self, auth_headers):
        """GET /api/sync/status returns passed_gate and gated_out fields"""
        resp = requests.get(f"{BASE_URL}/api/sync/status", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "passed_gate" in data
        assert "gated_out" in data
        assert "fetched" in data
        assert "new_deals" in data
