"""
Integration Tests for Pipeline Endpoints.
"""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_recalculate_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/pipeline/recalculate",
            data={
                "principal": 173308.0,
                "penalty": 9000.0,
                "interest_rate": 0.0,
                "months": 0
            }
        )
    assert response.status_code == 200
    data = response.json()
    assert data["financials"]["total_recoverable_amount"] == 182308.0
    assert data["is_valid"] is True
    assert "ரூபாய்" in data["amount_in_words_tamil"]
