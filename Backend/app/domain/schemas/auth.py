"""
Authentication Schemas.
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    username_or_email: str = Field(..., description="Staff username or email")
    password: str = Field(..., description="User password")
    role: Optional[str] = Field(None, description="Requested access role (admin or user)")


class UserSummary(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    name: str
    role: str
    section: Optional[str] = "Administration"
    taluk: Optional[str] = "Erode"
    district: Optional[str] = "Erode"
    status: str = "active"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    role: str
    full_name: str
    user: Optional[UserSummary] = None


class UserClaims(BaseModel):
    sub: str  # user id
    role: str
    email: Optional[str] = None
    exp: Optional[int] = None
