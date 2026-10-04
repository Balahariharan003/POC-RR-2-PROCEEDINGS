"""
Database Core: SQLAlchemy Async Engine, Session Factory, and Declarative Base.
Supports PostgreSQL (asyncpg) with resilient connection pooling.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime

from app.core.config import settings
from app.core.logging import logger

Base = declarative_base()


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


# Initialize Async Engine with resilient options
DATABASE_URL = settings.async_database_url

try:
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.DEBUG,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
except Exception as e:
    logger.warning(f"Async database engine initialization with asyncpg deferred ({e}). Using local fallback engine.")
    # Local resilient fallback
    try:
        engine = create_async_engine("sqlite+aiosqlite:///./rr_dev.db", echo=False)
    except Exception:
        # Fallback in-memory null engine for standalone execution
        from sqlalchemy.pool import NullPool
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", poolclass=NullPool)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def ensure_db_schema_migrated() -> None:
    """Safely adds newly created columns and relaxes legacy constraints on existing PostgreSQL tables."""
    from sqlalchemy import text
    statements = [
        "ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS locked_template TEXT;",
        "ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS slot_instructions TEXT;",
        "ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS template_data JSONB;",
        "ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);",
        "ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS file_base64 TEXT;",
        "ALTER TABLE document_templates ALTER COLUMN subject_template DROP NOT NULL;",
        "ALTER TABLE document_templates ALTER COLUMN reference_template DROP NOT NULL;",
        "ALTER TABLE document_templates ALTER COLUMN order_para1_template DROP NOT NULL;",
        "ALTER TABLE document_templates ALTER COLUMN order_para2_template DROP NOT NULL;",
        "ALTER TABLE document_templates ALTER COLUMN order_para3_template DROP NOT NULL;",
        "ALTER TABLE document_templates ALTER COLUMN heading_prefix DROP NOT NULL;",
        "ALTER TABLE document_templates ALTER COLUMN signatory_text DROP NOT NULL;",
        "ALTER TABLE proceedings_cases ADD COLUMN IF NOT EXISTS ocr_data JSONB;",
        "ALTER TABLE proceedings_cases ADD COLUMN IF NOT EXISTS generated_documents JSONB;",
    ]
    try:
        async with engine.begin() as conn:
            for stmt in statements:
                try:
                    await conn.execute(text(stmt))
                except Exception as ex:
                    logger.debug(f"Migration statement ignored: {ex}")
    except Exception as e:
        logger.warning(f"Schema column check skipped or unsupported on this backend: {e}")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields an async database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session rollback triggered: {str(e)}")
            raise
        finally:
            await session.close()

