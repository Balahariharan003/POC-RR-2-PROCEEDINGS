"""
Health & Readiness Check Endpoints.
"""

from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()


@router.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "ocr_engine": f"{settings.OCR_VERSION} ({settings.CHANDRA_PRIMARY_MODE} -> {settings.CHANDRA_FALLBACK_MODE})",
        "rapid_ocr": "REMOVED",
        "crypto_stamping": "Advanced Keyed Hybrid (HMAC-SHA256)",
        "font_enforcement": settings.PRIMARY_FONT_TAMIL
    }


@router.get("/ready", tags=["Health"])
async def readiness_check():
    return {"status": "ready"}
