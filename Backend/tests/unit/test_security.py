"""
Unit Tests for Cryptographic Security and Anti-Brute-Force Hybrid Stamping.
"""

from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.services.audit_service import AuditService


def test_password_hashing():
    pwd = "SecretGovPassword2026!"
    hashed = hash_password(pwd)
    assert ":" in hashed
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_lifecycle():
    claims = {"sub": "user_42", "role": "COLLECTOR"}
    token = create_access_token(claims)
    decoded = decode_access_token(token)
    assert decoded["sub"] == "user_42"
    assert decoded["role"] == "COLLECTOR"


def test_advanced_hybrid_crypto_signature():
    audit_service = AuditService()
    extracted_data = {
        "file_no": "1248",
        "defaulter": "M/s Prisma Garments",
        "total_amount": 182308.0
    }
    raw_ocr = "Sub: Realization of Government Dues recoverable from M/s Prisma Garments"
    
    # 1. Generate Signature
    stamp = audit_service.generate_hybrid_signature(extracted_data, raw_ocr)
    assert stamp["version"] == "v2:hybrid"
    assert stamp["signature"].startswith("v2:hybrid:")

    # 2. Verify Valid Signature
    is_valid, msg = audit_service.verify_hybrid_signature(extracted_data, raw_ocr, stamp["signature"])
    assert is_valid is True
    assert "verified" in msg.lower()

    # 3. Detect Tampering (Tampered amount)
    tampered_data = extracted_data.copy()
    tampered_data["total_amount"] = 50000.0
    is_tampered_valid, tampered_msg = audit_service.verify_hybrid_signature(tampered_data, raw_ocr, stamp["signature"])
    assert is_tampered_valid is False
    assert "TAMPERING DETECTED" in tampered_msg
