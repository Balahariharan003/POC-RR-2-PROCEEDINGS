"""
User schemas for RBAC (Collector, DRO, Tahsildar, Clerk).
"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserBase(BaseModel):
    username: str
    email: str
    full_name: str
    role: str = Field(default="ARREAR_CLERK", description="SUPER_ADMIN | COLLECTOR | DRO | TAHSILDAR | ARREAR_CLERK")
    jurisdiction_district: Optional[str] = "Erode"
    jurisdiction_taluk: Optional[str] = None
    is_active: bool = True



class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    jurisdiction_district: Optional[str] = None
    jurisdiction_taluk: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
