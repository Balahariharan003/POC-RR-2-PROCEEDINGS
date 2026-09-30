"""
Integration Tests for Authentication Endpoints.
"""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint(async_client: AsyncClient):
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["rapid_ocr"] == "REMOVED"


@pytest.mark.asyncio
async def test_auth_login_success_and_logout(async_client: AsyncClient):
    # 1. Login with seeded Admin credentials
    login_payload = {
        "username_or_email": "admin",
        "password": "Admin@123",
        "role": "admin"
    }
    resp = await async_client.post("/api/v1/auth/login", json=login_payload)
    assert resp.status_code == 200
    res_data = resp.json()
    assert "access_token" in res_data
    assert res_data["role"] == "admin"
    assert res_data["user"]["username"] == "admin"

    # 2. Logout endpoint
    logout_resp = await async_client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200
    assert logout_resp.json()["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_auth_login_invalid_credentials(async_client: AsyncClient):
    bad_payload = {
        "username_or_email": "admin",
        "password": "WrongPassword!999"
    }
    resp = await async_client.post("/api/v1/auth/login", json=bad_payload)
    assert resp.status_code == 401

