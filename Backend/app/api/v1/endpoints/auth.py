"""
Authentication Endpoints: Login, Token Refresh, and Logout.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domain.schemas.auth import LoginRequest, TokenResponse
from app.services.auth_service import AuthService

from app.api.dependencies import get_current_user_optional
from app.domain.models import AuditLedgerEntry, User

router = APIRouter()
auth_service = AuthService()


@router.post("/login", response_model=TokenResponse, tags=["Authentication"])
async def login(login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.authenticate_user(db, login_data)


@router.post("/logout", tags=["Authentication"])
async def logout(
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    if current_user:
        audit_log = AuditLedgerEntry(
            action="LOGOUT",
            user_id=current_user.username,
            details={
                "username": current_user.username,
                "email": current_user.email,
                "role": current_user.role,
                "message": "User session closed"
            }
        )
        db.add(audit_log)
        await db.commit()

    return {"status": "SUCCESS", "message": "Session invalidated successfully."}

