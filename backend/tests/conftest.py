"""Shared pytest fixtures for VC Deal Flow tests."""
import os
import pytest

# Read test JWT from environment — set in backend/.env or CI secrets
TEST_TOKEN = os.environ.get(
    'TEST_JWT_TOKEN',
    # Fallback to allow running tests without setting the env var explicitly
    os.environ.get('TEST_JWT_TOKEN', ''),
)

TEST_HEADERS = {
    'Authorization': f'Bearer {TEST_TOKEN}',
    'Content-Type': 'application/json',
}


@pytest.fixture
def auth_headers():
    """Authenticated headers for test requests."""
    return TEST_HEADERS
