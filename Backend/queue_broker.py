"""
Enterprise PostgreSQL Event-Driven Task Broker & Routing Engine.
Listens to pg_notify on 'task_channel', verifies input structures with Regex Firewall,
enforces 16GB RAM concurrency throttling via asyncio.Semaphore, and dispatches to high-fidelity daemons.
"""

import asyncio
import asyncpg
import os
import re
from pathlib import Path
from typing import Optional, Dict, Any

from app.core.config import settings
from app.core.logging import logger
from workers import (
    process_office_note,
    process_proceedings,
    process_memorandum,
    process_warrant
)

DB_DSN = os.getenv("DATABASE_URL") or f"postgresql://{settings.PG_USER}:{settings.PG_PASSWORD}@{settings.PG_HOST}:{settings.PG_PORT}/{settings.PG_DATABASE}"

WORKER_ROUTING_MATRIX = {
    "OFFICE_NOTE": process_office_note,
    "PROCEEDINGS": process_proceedings,
    "MEMORANDUM": process_memorandum,
    "WARRANT": process_warrant
}

# Strict 16GB RAM / VRAM Governor: Serializes heavy LLM inference passes
INFERENCE_SEMAPHORE = asyncio.Semaphore(1)


class IncomingDocumentValidator:
    """
    Structural Regex Ingestion Pre-Filter Firewall.
    Tolerant to bilingual OCR noise while ensuring minimal required structural parameters.
    """
    CURRENCY_PATTERN = re.compile(r'(?:Rs\.?|INR|ரூ\.?)\s*([\d,]+(?:\.\d{2})?)', re.IGNORECASE)
    FILE_REF_PATTERN = re.compile(r'(?:F\.?\s*NO\.?|ROC\.?\s*NO\.?|ந\.?\s*க\.?\s*எண்\.?|EP\.?\s*NO\.?|C\.?\s*NO\.?)\s*([\w\-\.\/]+)', re.IGNORECASE)
    STATUTORY_ACT_PATTERN = re.compile(r'(?:Section|பிரிவு|Act|சட்டம்|1864|1962|144|125)', re.IGNORECASE)

    @classmethod
    def pre_verify_structural_composition(cls, text: str) -> Dict[str, Any]:
        if not text or len(text.strip()) < 50:
            return {"valid": False, "reason": "Input document text token composition is critically low (< 50 chars)."}

        currency_matches = cls.CURRENCY_PATTERN.findall(text)
        file_ref_matches = cls.FILE_REF_PATTERN.findall(text)
        statutory_matches = cls.STATUTORY_ACT_PATTERN.findall(text)

        # Ensure at least one grounding anchor exists
        if not file_ref_matches and not currency_matches and not statutory_matches:
            return {"valid": False, "reason": "Missing required structural File Reference, Currency amount, and Statutory identifiers."}

        return {
            "valid": True,
            "extracted_meta": {
                "primary_reference": file_ref_matches[0] if file_ref_matches else "N/A",
                "currency_count": len(currency_matches),
                "statutory_matches_count": len(statutory_matches)
            }
        }


async def dispatch_worker_task(pool: asyncpg.Pool, job_id: int, initial_target: str):
    """Transactional check, row locking (FOR UPDATE SKIP LOCKED), routing, and daemon execution."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            job = await conn.fetchrow(
                """
                SELECT job_id, payload_ocr_text, retry_count, max_retries 
                FROM system_job_queue 
                WHERE job_id = $1 AND status IN ('QUEUED', 'RETRYING') 
                FOR UPDATE SKIP LOCKED
                """,
                job_id
            )
            if not job:
                return

            ocr_text = job['payload_ocr_text']
            current_retry = job['retry_count']
            max_retries = job['max_retries']

            # STAGE 0: Regex Firewall Pre-Verification
            if current_retry == 0:
                report = IncomingDocumentValidator.pre_verify_structural_composition(ocr_text)
                if not report["valid"]:
                    logger.warning(f"❌ Regex Firewall Reject on Job {job_id}: {report['reason']}")
                    await conn.execute(
                        "UPDATE system_job_queue SET status = 'FAILED', error_log = $2, updated_at = NOW() WHERE job_id = $1",
                        job_id, f"Regex Reject: {report['reason']}"
                    )
                    return

            # STAGE 1: Routing & Context Cross-Linking
            first_lines = " ".join(ocr_text.split('\n')[:6])
            
            # Check historical records ledger
            historical_hit = None
            try:
                historical_hit = await conn.fetchrow(
                    "SELECT old_rr_reference FROM historical_rr_ledger WHERE $1 ILIKE '%' || defaulter_name || '%' LIMIT 1",
                    first_lines
                )
            except Exception as e:
                logger.debug(f"Historical lookup skipped: {e}")

            is_judicial = any(kw in ocr_text for kw in [
                "பராமரிப்புத் தொகை", "Family Maintenance", "Welfare Case",
                "Section 125", "BNSS 144", "CrPC 125", "குடும்ப நல நீதிமன்றம்"
            ])

            final_target = initial_target
            linked_ref = ""

            if historical_hit:
                final_target = "MEMORANDUM"
                linked_ref = historical_hit['old_rr_reference']
                await conn.execute(
                    "UPDATE system_job_queue SET worker_target = 'MEMORANDUM', historical_rr_ref = $2 WHERE job_id = $1",
                    job_id, linked_ref
                )
            elif is_judicial:
                final_target = "WARRANT"
                await conn.execute(
                    "UPDATE system_job_queue SET worker_target = 'WARRANT', judicial_classification = 'FAMILY_MAINTENANCE' WHERE job_id = $1",
                    job_id
                )

            await conn.execute("UPDATE system_job_queue SET status = 'PROCESSING', updated_at = NOW() WHERE job_id = $1", job_id)

    # STAGE 2: Local LLM Execution with Semaphore & Timeout
    try:
        handler = WORKER_ROUTING_MATRIX.get(final_target, process_proceedings)
        
        async with INFERENCE_SEMAPHORE:
            output_path = await asyncio.wait_for(
                handler(ocr_text, job_id, linked_ref),
                timeout=90.0  # 90-second safety wall
            )

        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE system_job_queue SET status = 'COMPLETED', output_storage_path = $2, updated_at = NOW() WHERE job_id = $1",
                job_id, output_path
            )
        logger.info(f"🎉 Job {job_id} ({final_target}) Completed Successfully. Output: {output_path}")

    except Exception as err:
        new_retry = current_retry + 1
        error_msg = f"Inference Exception: {str(err)}"
        logger.warning(f"⚠️ Exception on Job {job_id} (Retry {new_retry}/{max_retries}): {error_msg}")

        async with pool.acquire() as conn:
            if new_retry <= max_retries:
                backoff = 2 ** new_retry
                await conn.execute(
                    "UPDATE system_job_queue SET status = 'RETRYING', retry_count = $2, error_log = $3, updated_at = NOW() WHERE job_id = $1",
                    job_id, new_retry, error_msg
                )
                await asyncio.sleep(backoff)
                asyncio.create_task(dispatch_worker_task(pool, job_id, final_target))
            else:
                await conn.execute(
                    "UPDATE system_job_queue SET status = 'FAILED', error_log = $2, updated_at = NOW() WHERE job_id = $1",
                    job_id, f"Max retries exhausted. Base error: {error_msg}"
                )


async def listen_to_postgres_bus():
    """Event bus listener for PostgreSQL pg_notify on 'task_channel'."""
    logger.info("🚀 PostgreSQL Event Bus Monitor Online (Channel: 'task_channel')...")
    pool = await asyncpg.create_pool(DB_DSN, min_size=2, max_size=5)

    def handle_notification(connection, pid, channel, payload):
        try:
            job_id_str, worker_target = payload.split(":")
            asyncio.create_task(dispatch_worker_task(pool, int(job_id_str), worker_target))
        except Exception as e:
            logger.error(f"⚠️ Notification parse error on payload '{payload}': {e}")

    listener_conn = await pool.acquire()
    await listener_conn.add_listener('task_channel', handle_notification)

    try:
        while True:
            await asyncio.sleep(3600)
    finally:
        await pool.release(listener_conn)
        await pool.close()


if __name__ == "__main__":
    asyncio.run(listen_to_postgres_bus())
