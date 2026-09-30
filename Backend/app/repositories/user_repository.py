"""
User Repository.
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.domain.models import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self):
        super().__init__(User)

    async def get_by_username_or_email(self, db: AsyncSession, identifier: str) -> Optional[User]:
        stmt = select(User).where(or_(User.username == identifier, User.email == identifier))
        result = await db.execute(stmt)
        return result.scalars().first()
