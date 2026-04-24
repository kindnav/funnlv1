"""Tests for iteration 15: code quality refactoring validation."""
import os
import pytest
import requests

BASE_URL: str = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TOKEN: str = os.environ.get('TEST_JWT_TOKEN', '')
AUTH_HEADERS: dict[str, str] = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}


class TestHealthCheck:
    def test_health(self) -> None:
        """GET /api/ returns {status: healthy}"""
        r = requests.get(f'{BASE_URL}/api/')
        assert r.status_code == 200
        data = r.json()
        assert data.get('status') == 'healthy'
        print(f"PASS: /api/ => {data}")


class TestAuthMe:
    def test_auth_me_with_bearer(self) -> None:
        """GET /api/auth/me with valid Bearer returns 200 + user data"""
        r = requests.get(f'{BASE_URL}/api/auth/me', headers=AUTH_HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert 'email' in data or 'user_id' in data
        print(f"PASS: /api/auth/me => {data.get('email')}")

    def test_auth_me_without_token_returns_401(self) -> None:
        """GET /api/auth/me without token returns 401"""
        r = requests.get(f'{BASE_URL}/api/auth/me')
        assert r.status_code == 401
        print("PASS: unauthenticated => 401")


class TestDeals:
    def test_get_deals_returns_list(self) -> None:
        """GET /api/deals returns list with required fields"""
        r = requests.get(f'{BASE_URL}/api/deals', headers=AUTH_HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            deal = data[0]
            # Check required fields
            for field in ['id', 'company_name']:
                assert field in deal, f"Missing field: {field}"
        print(f"PASS: /api/deals => {len(data)} deals, fields ok")


class TestContactUpsert:
    def test_upsert_missing_email_returns_400(self) -> None:
        """POST /api/contacts/upsert with missing email returns 400"""
        r = requests.post(
            f'{BASE_URL}/api/contacts/upsert',
            json={'name': 'No Email Contact'},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 400
        print(f"PASS: upsert missing email => 400")

    def test_upsert_valid_contact(self) -> None:
        """POST /api/contacts/upsert with valid deal data returns 200 or 201"""
        r = requests.post(
            f'{BASE_URL}/api/contacts/upsert',
            json={
                'deal': {
                    'sender_email': 'TEST_refactor_contact@example.com',
                    'sender_name': 'TEST Refactor Contact',
                    'company_name': 'TEST Corp',
                },
                'contact_status': 'In Review',
            },
            headers=AUTH_HEADERS,
        )
        assert r.status_code in [200, 201]
        data = r.json()
        assert 'contact_id' in data or 'id' in data or 'email' in data
        print(f"PASS: upsert valid => {r.status_code}")


class TestConftest:
    def test_auth_headers_type_hint(self) -> None:
        """conftest.py fixture auth_headers has -> dict[str, str] return type hint"""
        with open('/app/backend/tests/conftest.py') as f:
            content = f.read()
        assert 'dict[str, str]' in content
        print("PASS: auth_headers has dict[str, str] type hint")

    def test_no_hardcoded_jwt_in_conftest(self) -> None:
        """conftest.py must not have hardcoded JWT"""
        import re
        with open('/app/backend/tests/conftest.py') as f:
            content = f.read()
        jwt_pattern = re.compile(r'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}')
        assert not jwt_pattern.findall(content)
        print("PASS: no hardcoded JWT in conftest.py")


class TestServerRefactor:
    def test_helper_functions_in_server(self) -> None:
        """server.py has _validate_contact_email, _update_existing_contact, _create_new_contact"""
        with open('/app/backend/server.py') as f:
            content = f.read()
        for fn in ['_validate_contact_email', '_update_existing_contact', '_create_new_contact']:
            assert fn in content, f"Missing helper function: {fn}"
        print("PASS: all helper functions present in server.py")
