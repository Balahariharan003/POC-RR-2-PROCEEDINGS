"""
User Management Endpoints (RBAC protected).
"""

from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession


from app.core.database import get_db
from app.core.security import hash_password
from app.domain.models import User
from app.domain.schemas.user import UserCreate, UserResponse, UserUpdate
from app.api.dependencies import get_current_user, require_role
from app.repositories.user_repository import UserRepository

router = APIRouter()
user_repo = UserRepository()


@router.get("", response_model=List[UserResponse], tags=["Users"])
@router.get("/", response_model=List[UserResponse], tags=["Users"])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "COLLECTOR", "DRO", "admin"]))
):
    return await user_repo.list_all(db, skip=skip, limit=limit)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["Users"])
@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["Users"])
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "COLLECTOR", "admin"]))
):
    existing = await user_repo.get_by_username_or_email(db, user_in.username)
    if not existing:
        existing = await user_repo.get_by_username_or_email(db, str(user_in.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with username/email '{user_in.username}' already exists."
        )

    user_obj = User(
        username=user_in.username,
        email=str(user_in.email),
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        jurisdiction_district=user_in.jurisdiction_district,
        jurisdiction_taluk=user_in.jurisdiction_taluk,
        is_active=user_in.is_active,
    )
    return await user_repo.create(db, user_obj)


@router.get("/{user_id}", response_model=UserResponse, tags=["Users"])
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "COLLECTOR", "DRO", "admin"]))
):
    user = await user_repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse, tags=["Users"])
async def update_user(
    user_id: str,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "COLLECTOR", "admin"]))
):
    user = await user_repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = user_in.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = hash_password(update_data.pop("password"))
    elif "password" in update_data:
        update_data.pop("password")

    updated_user = await user_repo.update(db, user_id, **update_data)
    return updated_user


@router.delete("/{user_id}", tags=["Users"])
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["SUPER_ADMIN", "COLLECTOR", "admin"]))
):
    user = await user_repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await user_repo.delete(db, user_id)
    return {"status": "SUCCESS", "message": f"User {user_id} deleted successfully."}

