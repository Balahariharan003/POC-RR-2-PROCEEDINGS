"""
Generic Repository Interface.
"""

from typing import Generic, TypeVar, Type, Optional, List, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

T = TypeVar("T")


class BaseRepository(Generic[T]):
    def __init__(self, model: Type[T]):
        self.model = model

    async def get_by_id(self, db: AsyncSession, id: Any) -> Optional[T]:
        result = await db.execute(select(self.model).filter(self.model.id == id))
        return result.scalars().first()

    async def list_all(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[T]:
        result = await db.execute(select(self.model).offset(skip).limit(limit))
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, obj_in: T) -> T:
        db.add(obj_in)
        await db.commit()
        await db.refresh(obj_in)
        return obj_in

    async def update(self, db: AsyncSession, id: Any, **kwargs) -> Optional[T]:
        await db.execute(update(self.model).where(self.model.id == id).values(**kwargs))
        await db.commit()
        return await self.get_by_id(db, id)

    async def delete(self, db: AsyncSession, id: Any) -> bool:
        await db.execute(delete(self.model).where(self.model.id == id))
        await db.commit()
        return True
