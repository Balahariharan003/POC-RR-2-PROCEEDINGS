"""
Database Seeder: Seeds default administrator, revenue officer accounts,
official 4-worker revenue recovery templates, and Erode Collectorate configuration.
All credentials are read exclusively from environment variables via settings.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.security import hash_password
from app.core.logging import logger
from app.core.config import settings
from app.domain.models import User, DocumentTemplate, OfficeConfiguration
from app.services.document_service import (
    OFFICE_NOTE_TEMPLATE,
    OFFICE_NOTE_SLOTS,
    PROCEEDINGS_TEMPLATE,
    PROCEEDINGS_SLOTS,
    MEMO_TEMPLATE,
    MEMO_SLOTS,
    WARRANT_TEMPLATE,
    WARRANT_SLOTS,
)
from app.services.llm_service import (
    COLLECTOR_LINE,
    OFFICE_SECTION,
    TALUK_TO_RDO,
    ERODE_TALUKS,
)


INITIAL_DATABASE_USERS = [
    {
        "username": "admin",
        "email": "admin@erode.tn.gov.in",
        "default_password": "Govt@2026",
        "full_name": "District Collector / DRO Erode",
        "role": "admin",
        "jurisdiction_district": "Erode",
        "jurisdiction_taluk": "Erode",
        "is_active": True,
    },
    {
        "username": "user",
        "email": "user@erode.tn.gov.in",
        "default_password": "Govt@2026",
        "full_name": "S. Ramanathan (Revenue Officer)",
        "role": "user",
        "jurisdiction_district": "Erode",
        "jurisdiction_taluk": "Erode",
        "is_active": True,
    },
    {
        "username": "auditor",
        "email": "auditor@erode.tn.gov.in",
        "default_password": "Govt@2026",
        "full_name": "Section Superintendent (E2)",
        "role": "auditor",
        "jurisdiction_district": "Erode",
        "jurisdiction_taluk": "Erode",
        "is_active": True,
    }
]


async def seed_default_accounts(session: AsyncSession) -> None:
    """Seeds initial administrative and revenue officer accounts into the database if not present."""
    try:
        for acc in INITIAL_DATABASE_USERS:
            stmt = select(User).where(or_(User.username == acc["username"], User.email == acc["email"]))
            result = await session.execute(stmt)
            existing = result.scalars().first()

            if not existing:
                new_user = User(
                    username=acc["username"],
                    email=acc["email"],
                    hashed_password=hash_password(acc["default_password"]),
                    full_name=acc["full_name"],
                    role=acc["role"],
                    jurisdiction_district=acc["jurisdiction_district"],
                    jurisdiction_taluk=acc["jurisdiction_taluk"],
                    is_active=acc["is_active"],
                )
                session.add(new_user)
                logger.info(f"Seeded initial DB user: {acc['username']} ({acc['email']})")

        await session.commit()
    except Exception as e:
        await session.rollback()
        logger.error(f"Failed to seed default accounts: {e}")


OFFICIAL_TEMPLATES = [
    {
        "template_code": "office_note_default",
        "name": "அலுவலகக் குறிப்பு (Office Note File Order)",
        "department_type": "GENERAL_RR",
        "category": "INTERNAL_NOTE",
        "description": "Internal section note submitted to the District Collector / DRO for RR authorization under RSO 41 & Sec 5.",
        "locked_template": OFFICE_NOTE_TEMPLATE,
        "slot_instructions": OFFICE_NOTE_SLOTS,
        "enclosure_text": "கடித நகல்",
        "template_data": {
            "worker_target": "OFFICE_NOTE",
            "statute": "Tamil Nadu Revenue Recovery Act 1864",
            "rso": "RSO 41",
            "section": "Section 5"
        },
        "is_active": True,
    },
    {
        "template_code": "proceedings_default",
        "name": "மாவட்ட ஆட்சித் தலைவர் செயல்முறைகள் (Proceedings Order)",
        "department_type": "GENERAL_RR",
        "category": "PROCEEDINGS",
        "description": "Official Collector & District Magistrate Proceedings Order empowering the jurisdictional Tahsildar.",
        "locked_template": PROCEEDINGS_TEMPLATE,
        "slot_instructions": PROCEEDINGS_SLOTS,
        "enclosure_text": "கடித நகல்",
        "template_data": {
            "worker_target": "PROCEEDINGS",
            "statute": "Tamil Nadu Revenue Recovery Act 1864",
            "rso": "RSO 41",
            "section": "Section 5"
        },
        "is_active": True,
    },
    {
        "template_code": "memorandum_default",
        "name": "மாவட்ட ஆட்சியர் அலுவலக குறிப்பாணை (Memorandum / Memo)",
        "department_type": "GENERAL_RR",
        "category": "MEMORANDUM",
        "description": "Official Collectorate Memorandum forwarding recovery requisition and reminders to Tahsildar.",
        "locked_template": MEMO_TEMPLATE,
        "slot_instructions": MEMO_SLOTS,
        "enclosure_text": "கடித நகல்",
        "template_data": {
            "worker_target": "MEMORANDUM",
            "statute": "Tamil Nadu Revenue Recovery Act 1864"
        },
        "is_active": True,
    },
    {
        "template_code": "warrant_maintenance",
        "name": "ஜப்தி மற்றும் கைது வாரண்ட் ஆணை (Execution Warrant)",
        "department_type": "MAINTENANCE",
        "category": "WARRANT",
        "description": "Execution Warrant for Maintenance Arrears under BNSS 144 / CrPC 125 and TN Revenue Recovery Act 1864.",
        "locked_template": WARRANT_TEMPLATE,
        "slot_instructions": WARRANT_SLOTS,
        "enclosure_text": "நீதிமன்ற ஆணை நகல்",
        "template_data": {
            "worker_target": "WARRANT",
            "statute": "BNSS 144 / CrPC 125 & Tamil Nadu Revenue Recovery Act 1864"
        },
        "is_active": True,
    }
]


import base64
from pathlib import Path

OFFICIAL_PROCEEDINGS_FILE = Path(r"E:\Documents\Personal\My_docs\IMP_Files\Documentation\Erode Collectorate\Confidential\AI Tools\RR_to_release\RR ACT PROCEEDINGS FORMAT.docx")

async def seed_default_templates(session: AsyncSession) -> None:
    """Seeds standard Tamil Nadu government proceedings templates and office configuration with docx file binaries."""
    try:
        # Load user docx template if available on disk
        proceedings_b64 = None
        proceedings_filename = None
        if OFFICIAL_PROCEEDINGS_FILE.exists():
            try:
                raw_bytes = OFFICIAL_PROCEEDINGS_FILE.read_bytes()
                proceedings_b64 = base64.b64encode(raw_bytes).decode("utf-8")
                proceedings_filename = OFFICIAL_PROCEEDINGS_FILE.name
                logger.info(f"Loaded official DOCX template file: {OFFICIAL_PROCEEDINGS_FILE} ({len(raw_bytes)} bytes)")
            except Exception as e:
                logger.warning(f"Could not read official DOCX file {OFFICIAL_PROCEEDINGS_FILE}: {e}")

        # 1. Seed Templates
        for tpl in OFFICIAL_TEMPLATES:
            tpl_copy = dict(tpl)
            if tpl_copy["template_code"] == "proceedings_default" and proceedings_b64:
                tpl_copy["file_base64"] = proceedings_b64
                tpl_copy["file_name"] = proceedings_filename

            # Ensure compatibility with existing schemas
            tpl_copy.setdefault("subject_template", tpl_copy.get("name", ""))
            tpl_copy.setdefault("reference_template", "")
            tpl_copy.setdefault("order_para1_template", "")
            tpl_copy.setdefault("order_para2_template", "")
            tpl_copy.setdefault("order_para3_template", "")

            stmt = select(DocumentTemplate).where(DocumentTemplate.template_code == tpl_copy["template_code"])
            result = await session.execute(stmt)
            existing = result.scalars().first()
            if not existing:
                new_tpl = DocumentTemplate(**tpl_copy)
                session.add(new_tpl)
                logger.info(f"Seeded default template: {tpl_copy['template_code']} ({tpl_copy['name']})")
            else:
                existing.name = tpl_copy.get("name", existing.name)
                existing.locked_template = tpl_copy.get("locked_template")
                existing.slot_instructions = tpl_copy.get("slot_instructions")
                existing.template_data = tpl_copy.get("template_data")
                if tpl_copy.get("file_base64"):
                    existing.file_base64 = tpl_copy.get("file_base64")
                    existing.file_name = tpl_copy.get("file_name")
                logger.info(f"Updated existing template format: {tpl_copy['template_code']}")

        # 2. Seed Office Configuration
        cfg_stmt = select(OfficeConfiguration).where(OfficeConfiguration.config_key == "ERODE_COLLECTORATE")
        cfg_res = await session.execute(cfg_stmt)
        existing_cfg = cfg_res.scalars().first()

        if not existing_cfg:
            new_cfg = OfficeConfiguration(
                config_key="ERODE_COLLECTORATE",
                collector_line=COLLECTOR_LINE,
                office_section=OFFICE_SECTION,
                taluks=ERODE_TALUKS,
                taluk_to_rdo=TALUK_TO_RDO,
                dept_configs={},
                is_active=True,
            )
            session.add(new_cfg)
            logger.info("Seeded default OfficeConfiguration for ERODE_COLLECTORATE.")
        else:
            existing_cfg.collector_line = COLLECTOR_LINE
            existing_cfg.office_section = OFFICE_SECTION
            existing_cfg.taluks = ERODE_TALUKS
            existing_cfg.taluk_to_rdo = TALUK_TO_RDO

        await session.commit()
    except Exception as e:
        await session.rollback()
        logger.error(f"Failed to seed default templates and configuration: {e}")
