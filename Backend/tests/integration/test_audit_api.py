"""
Integration Tests for Audit Logs and Cryptographic Signature Verification API:
- GET /api/v1/audit/logs
- POST /api/v1/audit/verify with valid signature
- POST /api/v1/audit/verify with tampered data
"""

import pytest
from httpx import AsyncClient
from app.services.audit_service import AuditService


@pytest.mark.asyncio
async def test_audit_logs_retrieval(async_client: AsyncClient):
    resp = await async_client.get("/api/v1/audit/logs?limit=10")
    assert resp.status_code == 200
    logs = resp.json()
    assert isinstance(logs, list)


@pytest.mark.asyncio
async def test_audit_cryptographic_verification_valid_and_tampered(async_client: AsyncClient):
    audit_service = AuditService()
    
    extracted_data = {
        "case_file_no": "MCOP-225/2026",
        "defaulter_name": "T.P. Ramalingam",
        "total_amount": 460690.0,
        "jurisdiction_taluk": "Kodumudi"
    }
    raw_ocr = "SAMPLE OFFICIAL COURT ORDER OCR TEXT FROM TAHSILDAR ERODE"

    # Generate a valid hybrid signature
    sig_result = audit_service.generate_hybrid_signature(
        extracted_data=extracted_data,
        raw_ocr_text=raw_ocr
    )
    signature = sig_result["signature"]


    # 1. TEST VALID SIGNATURE
    verify_payload = {
        "extracted_data": extracted_data,
        "raw_ocr_text": raw_ocr,
        "signature": signature
    }
    valid_resp = await async_client.post("/api/v1/audit/verify", json=verify_payload)
    assert valid_resp.status_code == 200
    valid_res = valid_resp.json()
    assert valid_res["verified"] is True
    assert valid_res["status"] == "VALID"

    # 2. TEST TAMPERED AMOUNT (TAMPERED DATA)
    tampered_data = dict(extracted_data)
    tampered_data["total_amount"] = 999999.0  # Fraudulent change

    tampered_payload = {
        "extracted_data": tampered_data,
        "raw_ocr_text": raw_ocr,
        "signature": signature
    }
    tampered_resp = await async_client.post("/api/v1/audit/verify", json=tampered_payload)
    assert tampered_resp.status_code == 200
    tampered_res = tampered_resp.json()
    assert tampered_res["verified"] is False
    assert tampered_res["status"] == "TAMPERED_OR_INVALID"
