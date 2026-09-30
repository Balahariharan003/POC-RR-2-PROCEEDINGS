"""
Auth Service: User authentication, JWT issuance, and credential verification.
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password, create_access_token
from app.core.exceptions import AuthenticationError
from app.domain.schemas.auth import LoginRequest, TokenResponse
from app.repositories.user_repository import UserRepository


class AuthService:
    def __init__(self, user_repo: Optional[UserRepository] = None):
        self.user_repo = user_repo or UserRepository()

    async def authenticate_user(self, db: AsyncSession, login_data: LoginRequest) -> TokenResponse:
        user = await self.user_repo.get_by_username_or_email(db, login_data.username_or_email)
        if not user or not verify_password(login_data.password, user.hashed_password):
            raise AuthenticationError("Invalid username, email, or password")

        if not user.is_active:
            raise AuthenticationError("User account is inactive. Please contact your District Administrator.")

        # Check role permission if specific role is requested
        if login_data.role:
            normalized_req_role = login_data.role.strip().lower()
            normalized_user_role = user.role.strip().lower()
            if normalized_req_role != normalized_user_role:
                expected = "Administrator" if normalized_req_role == "admin" else "Officer"
                raise AuthenticationError(f"Account does not have {expected} access privileges. Please verify your role selection.")

        token = create_access_token(
            data={
                "sub": str(user.id),
                "role": user.role,
                "email": user.email,
                "full_name": user.full_name,
                "district": user.jurisdiction_district
            }
        )

        from app.domain.schemas.auth import UserSummary

        user_summary = UserSummary(
            id=str(user.id),
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            name=user.full_name,
            role=user.role,
            section="Administration" if user.role.lower() == "admin" else "Revenue Department",
            taluk=user.jurisdiction_taluk or "Erode",
            district=user.jurisdiction_district or "Erode",
            status="active" if user.is_active else "inactive"
        )

        import uuid
        from datetime import datetime, timezone
        from app.domain.models import AuditLedgerEntry
        audit_log = AuditLedgerEntry(
            id=str(uuid.uuid4()),
            action="LOGIN",
            file_id=None,
            user_id=user.username,
            details={
                "username": user.username,
                "role": user.role,
                "full_name": user.full_name,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            signature=f"v2:login:{user.username}:{uuid.uuid4().hex[:12]}",
        )
        db.add(audit_log)
        await db.commit()

        return TokenResponse(
            access_token=token,
            expires_in=60 * 60 * 8,
            user_id=str(user.id),
            role=user.role,
            full_name=user.full_name,
            user=user_summary
        )
