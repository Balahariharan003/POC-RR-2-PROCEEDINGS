"""
Integration Tests for Live PDF Processing Pipeline:
- Uploads and parses live PDFs (TNRERA, MCOP, Customs)
- Verifies entity extraction, mathematical validation, document synthesis (DOCX/PDF), and hybrid cryptographic stamping.
- Tests both Legacy /api/process-document and v1 /api/v1/pipeline/process
"""

import pytest
from pathlib import Path
from httpx import AsyncClient
from app.core.config import settings


@pytest.mark.asyncio
async def test_live_pdf_processing_v1_endpoint(admin_client: AsyncClient):
    # Find a sample or uploaded test PDF
    test_pdf = None
    candidate_paths = [
        settings.UPLOAD_DIR / "ab0b19c0_2087-2026-D2.pdf",
        settings.UPLOAD_DIR / "734c9c98_1248-2026-D2.pdf",
        settings.SAMPLE_DIR / "sample_mcop_order.pdf",
    ]
    for p in candidate_paths:
        if p.exists() and p.stat().st_size > 0:
            test_pdf = p
            break

    if not test_pdf:
        pytest.skip("No sample PDF available for live pipeline execution.")

    with open(test_pdf, "rb") as f:
        file_bytes = f.read()

    files = {"file": (test_pdf.name, file_bytes, "application/pdf")}
    resp = await admin_client.post("/api/v1/pipeline/process", files=files)
    assert resp.status_code == 200
    res = resp.json()
    assert res["status"] == "SUCCESS"
    assert "entities" in res
    assert "output_docx" in res
    assert "output_pdf" in res
    assert "crypto_audit" in res
    assert res["crypto_audit"]["signature"].startswith("v2:hybrid:")


@pytest.mark.asyncio
async def test_legacy_api_process_document_live(async_client: AsyncClient):
    test_pdf = None
    candidate_paths = [
        settings.UPLOAD_DIR / "ab0b19c0_2087-2026-D2.pdf",
        settings.UPLOAD_DIR / "734c9c98_1248-2026-D2.pdf",
    ]
    for p in candidate_paths:
        if p.exists() and p.stat().st_size > 0:
            test_pdf = p
            break

    if not test_pdf:
        pytest.skip("No sample PDF available for live legacy pipeline execution.")

    with open(test_pdf, "rb") as f:
        file_bytes = f.read()

    files = {"file": (test_pdf.name, file_bytes, "application/pdf")}
    resp = await async_client.post("/api/process-document", files=files)
    assert resp.status_code == 200
    res = resp.json()
    assert res["status"] == "SUCCESS"
    assert "entities" in res
    assert "case_details" in res["entities"]
    assert "defaulter" in res["entities"]
    assert "financials" in res["entities"]
    assert res["entities"]["financials"]["total_recoverable_amount"] > 0
