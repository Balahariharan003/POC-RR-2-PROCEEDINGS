"""
Integration Tests for Pipeline Recalculation, Legal Chat, and Document Delivery:
- POST /api/v1/pipeline/recalculate
- POST /api/v1/chat/query
- GET /api/v1/documents/{filename}/docx (404 handling and security)
- GET /api/v1/health & GET /health
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_financial_recalculation_endpoint(async_client: AsyncClient):
    # Test valid interest recalculation: Principal 100000, Interest 12%, 12 months = 12000 interest, total 112000
    form_data = {
        "principal": 100000.0,
        "penalty": 0.0,
        "interest_rate": 12.0,
        "months": 12
    }
    resp = await async_client.post("/api/v1/pipeline/recalculate", data=form_data)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_valid"] is True
    assert data["financials"]["interest_amount"] == 12000.0
    assert data["financials"]["total_recoverable_amount"] == 112000.0
    assert "ரூபாய்" in data["amount_in_words_tamil"]


@pytest.mark.asyncio
async def test_legal_chat_query_endpoint(async_client: AsyncClient):
    payload = {
        "question": "What is the procedure under Section 5 of Tamil Nadu Revenue Recovery Act 1864?",
        "context": "Revenue Recovery proceedings initiated for default in payment."
    }
    resp = await async_client.post("/api/v1/chat/query", json=payload)
    assert resp.status_code == 200
    res = resp.json()
    assert "answer" in res
    assert "jurisdiction_guidance" in res


@pytest.mark.asyncio
async def test_document_download_not_found(async_client: AsyncClient):
    resp = await async_client.get("/api/v1/documents/non_existent_file_999.docx/docx")
    assert resp.status_code == 404

    resp_pdf = await async_client.get("/api/v1/documents/non_existent_file_999.pdf/pdf")
    assert resp_pdf.status_code == 404


@pytest.mark.asyncio
async def test_system_health_and_readiness(async_client: AsyncClient):
    resp = await async_client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

    ready_resp = await async_client.get("/api/v1/ready")
    assert ready_resp.status_code == 200
    assert ready_resp.json()["status"] == "ready"
