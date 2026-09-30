"""
User Management Endpoints (RBAC protected).
"""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import hash_password
from app.domain.models import User
from app.domain.schemas.user import UserCreate, UserResponse, UserUpdate
from app.api.dependencies import get_current_user, require_role
from app.repositories.user_repository import UserRepository

router = APIRouter()
user_repo = UserRepository()


@router.get("/", response_model=List[UserResponse], tags=["Users"])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "COLLECTOR", "DRO"]))
):
    return await user_repo.list_all(db, skip=skip, limit=limit)


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["Users"])
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "COLLECTOR"]))
):
    user_obj = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        jurisdiction_district=user_in.jurisdiction_district,
        jurisdiction_taluk=user_in.jurisdiction_taluk,
        is_active=user_in.is_active,
    )
    return await user_repo.create(db, user_obj)
