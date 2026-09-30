"""
Authentication Endpoints: Login, Token Refresh, and Logout.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domain.schemas.auth import LoginRequest, TokenResponse
from app.services.auth_service import AuthService

router = APIRouter()
auth_service = AuthService()


@router.post("/login", response_model=TokenResponse, tags=["Authentication"])
async def login(login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.authenticate_user(db, login_data)


@router.post("/logout", tags=["Authentication"])
async def logout():
    return {"status": "SUCCESS", "message": "Session invalidated successfully."}
