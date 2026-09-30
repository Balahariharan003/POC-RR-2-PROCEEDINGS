"""
Database Seeder: Seeds default administrator and revenue officer staff accounts.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.security import hash_password
from app.core.logging import logger
from app.domain.models import User


DEFAULT_ACCOUNTS = [
    {
        "username": "admin",
        "email": "admin@erode.tn.gov.in",
        "password": "Admin@123",
        "full_name": "District Collector / DRO Erode",
        "role": "admin",
        "jurisdiction_district": "Erode",
        "jurisdiction_taluk": "Erode",
        "is_active": True,
    },
    {
        "username": "user",
        "email": "user@erode.tn.gov.in",
        "password": "User@123",
        "full_name": "S. Ramanathan (Revenue Officer)",
        "role": "user",
        "jurisdiction_district": "Erode",
        "jurisdiction_taluk": "Erode",
        "is_active": True,
    },
]


async def seed_default_accounts(session: AsyncSession) -> None:
    """Ensures at least one administrator and one standard officer account exist in the database."""
    try:
        for acc in DEFAULT_ACCOUNTS:
            stmt = select(User).where(or_(User.username == acc["username"], User.email == acc["email"]))
            result = await session.execute(stmt)
            existing = result.scalars().first()

            if not existing:
                new_user = User(
                    username=acc["username"],
                    email=acc["email"],
                    hashed_password=hash_password(acc["password"]),
                    full_name=acc["full_name"],
                    role=acc["role"],
                    jurisdiction_district=acc["jurisdiction_district"],
                    jurisdiction_taluk=acc["jurisdiction_taluk"],
                    is_active=acc["is_active"],
                )
                session.add(new_user)
                logger.info(f"Seeded default {acc['role']} account: {acc['username']} ({acc['email']})")

        await session.commit()
    except Exception as e:
        await session.rollback()
        logger.error(f"Failed to seed default accounts: {e}")
