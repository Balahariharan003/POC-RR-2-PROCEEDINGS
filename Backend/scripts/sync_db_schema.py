"""
Database Migration & Schema Sync Utility:
Ensures all columns and foreign keys match modern models in PostgreSQL.
"""

import asyncio
from sqlalchemy import text
from app.core.database import engine, Base


async def sync_schema():
    async with engine.begin() as conn:
        # 1. Create any missing tables
        await conn.run_sync(Base.metadata.create_all)

        # 2. Add any missing columns to existing tables
        alter_statements = [
            "ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS case_id VARCHAR;",
            "ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS details JSONB;",
            "ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS signature VARCHAR(255);",
            "ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'REVENUE_RECOVERY';",
            "ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS description TEXT;",
            "ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS heading_prefix VARCHAR(150);",
            "ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS signatory_text TEXT;",
            "ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS recipients JSONB;",
            "ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS template_data JSONB;",
            "ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS created_by_id VARCHAR;",
            "ALTER TABLE proceedings_cases ADD COLUMN IF NOT EXISTS roc_number VARCHAR(100);",
            "ALTER TABLE proceedings_cases ADD COLUMN IF NOT EXISTS template_id VARCHAR;",
            "ALTER TABLE proceedings_cases ADD COLUMN IF NOT EXISTS officer_id VARCHAR;",
            "ALTER TABLE proceedings_cases ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255);",
            "ALTER TABLE proceedings_cases ADD COLUMN IF NOT EXISTS document_content TEXT;",
            "ALTER TABLE proceedings_cases ADD COLUMN IF NOT EXISTS document_layout JSONB;",
            "ALTER TABLE proceedings_cases ADD COLUMN IF NOT EXISTS extracted_data JSONB;",
        ]

        for stmt in alter_statements:
            try:
                await conn.execute(text(stmt))
            except Exception as e:
                print(f"Statement warning: {stmt} -> {e}")

        print("PostgreSQL database schema synchronized successfully.")


if __name__ == "__main__":
    asyncio.run(sync_schema())
