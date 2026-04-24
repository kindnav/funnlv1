"""Shared pytest fixtures for VC Deal Flow tests."""
import os
import pytest

# Read test JWT from environment — set in backend/.env or CI secrets
TEST_TOKEN: str = os.environ.get('TEST_JWT_TOKEN', '')

TEST_HEADERS: dict[str, str] = {
    'Authorization': f'Bearer {TEST_TOKEN}',
    'Content-Type': 'application/json',
}


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Authenticated headers for test requests."""
    return TEST_HEADERS
