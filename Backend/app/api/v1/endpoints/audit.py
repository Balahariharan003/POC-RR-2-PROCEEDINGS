"""
Audit & Cryptographic Verification Endpoints.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domain.models import AuditLedgerEntry
from app.repositories.audit_repository import AuditRepository
from app.services.audit_service import AuditService

router = APIRouter()
audit_repo = AuditRepository()
audit_service = AuditService()


@router.get("/logs", tags=["Audit"])
async def get_audit_logs(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Retrieves immutable audit ledger logs."""
    logs = await audit_repo.get_recent_logs(db, limit=limit)
    return [
        {
            "id": str(log.id),
            "action": log.action,
            "file_id": log.file_id,
            "user_id": log.user_id,
            "details": log.details,
            "signature": log.signature,
            "timestamp": log.created_at.isoformat() if log.created_at else None
        }
        for log in logs
    ]


@router.post("/verify", tags=["Audit"])
async def verify_signature(
    extracted_data: Dict[str, Any] = Body(...),
    raw_ocr_text: str = Body(...),
    signature: str = Body(...)
):
    """
    Cryptographically verifies an Advanced Hybrid HMAC-SHA256 signature (v2:hybrid:<salt>:<hmac>).
    Proves mathematical non-tampering and authenticity against brute force attacks.
    """
    is_valid, message = audit_service.verify_hybrid_signature(
        extracted_data=extracted_data,
        raw_ocr_text=raw_ocr_text,
        signature_string=signature
    )
    return {
        "verified": is_valid,
        "status": "VALID" if is_valid else "TAMPERED_OR_INVALID",
        "message": message,
        "signature_examined": signature
    }
