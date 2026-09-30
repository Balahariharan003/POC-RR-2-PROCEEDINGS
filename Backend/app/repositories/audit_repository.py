"""
Audit Repository for Immutable Ledger Entries.
"""

from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.domain.models import AuditLedgerEntry
from app.repositories.base import BaseRepository


class AuditRepository(BaseRepository[AuditLedgerEntry]):
    def __init__(self):
        super().__init__(AuditLedgerEntry)

    async def create_entry(
        self,
        db: AsyncSession,
        action: str,
        file_id: Optional[str] = None,
        user_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        signature: Optional[str] = None,
    ) -> AuditLedgerEntry:
        entry = AuditLedgerEntry(
            action=action,
            file_id=file_id,
            user_id=user_id,
            details=details,
            signature=signature,
        )
        return await self.create(db, entry)

    async def get_recent_logs(self, db: AsyncSession, limit: int = 50) -> List[AuditLedgerEntry]:
        stmt = select(AuditLedgerEntry).order_by(desc(AuditLedgerEntry.created_at)).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())
