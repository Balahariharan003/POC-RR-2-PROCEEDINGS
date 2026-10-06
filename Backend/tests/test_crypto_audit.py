"""
Unit Test Suite for Phase P4: Cryptographic Hybrid Stamping
===========================================================
Verifies HMAC-SHA256 hybrid signature generation and tamper detection.
"""

import pytest
from app.services.audit_service import AuditService


def test_signature_generation_and_verification():
    service = AuditService()
    case = {
        "case_file_no": "1248/2026",
        "total_recoverable_amount": 315000.0,
        "defaulter_name": "M/s Sri Venkateshwara Tex"
    }
    raw_ocr = "Requisition order 1248/2026 Rs 315000"
    
    stamp = service.generate_hybrid_signature(case, raw_ocr)
    sig = stamp["signature"]
    
    assert sig.startswith("v2:hybrid:")
    
    is_valid, msg = service.verify_hybrid_signature(case, raw_ocr, sig)
    assert is_valid
    assert "verified" in msg.lower()


def test_tampering_detected():
    service = AuditService()
    case = {
        "case_file_no": "1248/2026",
        "total_recoverable_amount": 315000.0,
        "defaulter_name": "M/s Sri Venkateshwara Tex"
    }
    raw_ocr = "Requisition order 1248/2026 Rs 315000"
    stamp = service.generate_hybrid_signature(case, raw_ocr)
    sig = stamp["signature"]
    
    # Tamper with total amount
    tampered_case = dict(case)
    tampered_case["total_recoverable_amount"] = 350000.0
    
    is_valid, msg = service.verify_hybrid_signature(tampered_case, raw_ocr, sig)
    assert not is_valid
    assert "TAMPERING DETECTED" in msg
