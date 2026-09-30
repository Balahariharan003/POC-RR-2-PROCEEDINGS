"""
Document Template Repository.
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.domain.models import DocumentTemplate
from app.repositories.base import BaseRepository


class TemplateRepository(BaseRepository[DocumentTemplate]):
    def __init__(self):
        super().__init__(DocumentTemplate)

    async def get_by_code(self, db: AsyncSession, code: str) -> Optional[DocumentTemplate]:
        stmt = select(DocumentTemplate).where(DocumentTemplate.template_code == code)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_by_department(self, db: AsyncSession, dept: str) -> List[DocumentTemplate]:
        stmt = select(DocumentTemplate).where(
            DocumentTemplate.department_type == dept,
            DocumentTemplate.is_active == True
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())
