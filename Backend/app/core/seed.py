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
        "heading_prefix": "// அலுவலகக் குறிப்பு //",
        "subject_template": "வருவாய் வசூல் சட்டம் – {{statute_cited}} – {{district_name}} மாவட்டம், {{taluk_name}} வட்டம், {{street_and_locality}} என்ற முகவரியில் {{living_verb}} {{defaulter_name}} என்ற {{entity_label}} அரசிற்கு செலுத்த வேண்டிய {{dues_label}} மொத்தம் {{total_amount}}ஐ வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்ய கோரியது - உத்திரவிடுதல் - தொடர்பாக.",
        "reference_template": "{{reference_text}}",
        "order_para1_template": "{{district_name}} மாவட்டம், {{taluk_name}} வட்டம், {{street_and_locality}} என்ற முகவரியில் {{living_verb}} {{defaulter_name}} என்ற {{entity_label}} அரசிற்கு செலுத்த வேண்டிய {{dues_label}} மொத்தம் {{total_amount}}ஐ வருவாய் வசூல் சட்டத்தின் கீழ் வசூலிக்குமாறு பார்வையில் காணும் கடிதத்தில் தெரிவிக்கப்பட்டுள்ளது.",
        "order_para2_template": "மேற்படி முகவரியில் {{living_verb}} {{defaulter_name}} என்பவரின் அசையும் மற்றும் அசையா சொத்துகளிலிருந்து அரசிற்கு செலுத்த வேண்டிய {{dues_label}} மொத்தம் {{total_amount}}ஐ ({{amount_in_tamil_words}}) வருவாய் வசூல் சட்டப்படி வசூல் செய்து “{{dd_favour_of}}” என்ற பெயரில் வங்கி வரைவோலையாக (Demand Draft) எடுத்து {{dispatch_address}} என்ற அலுவலகத்திற்கு அசல் வங்கி வரைவோலையினை அனுப்பி அதன் விவரத்தினை நகல் வங்கி வரைவோலையுடன் இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {{taluk_name}} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கலாம்.",
        "order_para3_template": "எனவே மேற்படி தொகையை வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {{taluk_name}} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்தரவிடலாம்.",
        "signatory_text": "உத்தரவினை எதிர்நோக்கி செயல்முறை வரைவு ஒப்புதலுக்காக மாவட்ட ஆட்சித்தலைவர் அவர்களுக்கு பணிவுடன் சமர்ப்பிக்கப்படுகிறது.",
        "enclosure_text": "கடித நகல்",
        "locked_template": OFFICE_NOTE_TEMPLATE,
        "slot_instructions": OFFICE_NOTE_SLOTS,
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
        "heading_prefix": "ஈரோடு மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள், ஈரோடு",
        "subject_template": "வருவாய் வசூல் சட்டம் 1864 – {{statute_cited}} – {{district_name}} மாவட்டம் - {{taluk_name}} வட்டம் மற்றும் நகரம் – {{defaulter_name}}, {{street_and_locality}} - அரசிற்கு செலுத்த வேண்டிய {{dues_label}} {{total_amount}} - வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்ய கோரியது – உத்திரவிடுதல்.",
        "reference_template": "{{reference_text}}",
        "order_para1_template": "{{district_name}} மாவட்டம், {{taluk_name}} வட்டம் மற்றும் நகரம், {{street_and_locality}} என்ற முகவரியில் {{living_verb}} {{defaulter_name}} என்ற {{entity_label}} அரசிற்கு செலுத்த வேண்டிய {{dues_label}} {{total_amount}}ஐ வருவாய் வசூல் சட்டத்தின் கீழ் வசூலிக்குமாறு பார்வையில் காணும் கடிதத்தில் தெரிவிக்கப்பட்டுள்ளது.",
        "order_para2_template": "மேற்படி {{defaulter_name}} {{defaulter_suffix}} தொகை {{total_amount}}ஐ வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {{taluk_name}} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி உத்திரவிடப்படுகிறது.",
        "order_para3_template": "எனவே, மேற்படி முகவரியில் {{living_verb}} {{defaulter_name}} என்பவரின் அசையும் மற்றும் அசையா சொத்துகளிலிருந்து அரசிற்கு செலுத்த வேண்டிய {{dues_label}} {{total_amount}}ஐ ({{amount_in_tamil_words}}) வருவாய் வசூல் சட்டப்படி வசூல் செய்து “{{dd_favour_of}}” என்ற பெயரில் வங்கி வரைவோலையாக (Demand Draft) எடுத்து {{dispatch_address}} என்ற அலுவலகத்திற்கு அசலினை அனுப்பி அதன் விவரத்தினை நகல் வங்கி வரைவோலையுடன் இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {{taluk_name}} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது.",
        "signatory_text": "மாவட்ட ஆட்சித் தலைவர்,\nஈரோடு.",
        "enclosure_text": "கடித நகல்",
        "locked_template": PROCEEDINGS_TEMPLATE,
        "slot_instructions": PROCEEDINGS_SLOTS,
        "template_data": {
            "worker_target": "PROCEEDINGS",
            "statute": "Tamil Nadu Revenue Recovery Act 1864",
            "rso": "RSO 41",
            "section": "Section 5"
        },
        "is_active": True,
    }
]


from app.services.editor_service import EditorService
from sqlalchemy import delete

async def seed_default_templates(session: AsyncSession) -> None:
    """Seeds standard Tamil Nadu government proceedings and office note templates and deletes removed templates."""
    try:
        editor_service = EditorService()

        # Remove any deprecated templates (e.g. memorandum_default, warrant_maintenance)
        valid_codes = [t["template_code"] for t in OFFICIAL_TEMPLATES]
        del_stmt = delete(DocumentTemplate).where(~DocumentTemplate.template_code.in_(valid_codes))
        await session.execute(del_stmt)
 
        # 1. Seed Templates
        for tpl in OFFICIAL_TEMPLATES:
            tpl_copy = dict(tpl)
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
                if not new_tpl.template_data:
                    new_tpl.template_data = editor_service.template_model_to_layout(new_tpl)
                session.add(new_tpl)
                logger.info(f"Seeded default template: {tpl_copy['template_code']} ({tpl_copy['name']})")
            else:
                # Retain existing user modifications in the DB; only backfill if empty
                if not existing.locked_template:
                    existing.locked_template = tpl_copy.get("locked_template")
                if not existing.slot_instructions:
                    existing.slot_instructions = tpl_copy.get("slot_instructions")
                if not existing.subject_template:
                    existing.subject_template = tpl_copy.get("subject_template")
                if not existing.reference_template:
                    existing.reference_template = tpl_copy.get("reference_template")
                if not existing.order_para1_template:
                    existing.order_para1_template = tpl_copy.get("order_para1_template")
                if not existing.order_para2_template:
                    existing.order_para2_template = tpl_copy.get("order_para2_template")
                if not existing.order_para3_template:
                    existing.order_para3_template = tpl_copy.get("order_para3_template")
                if not existing.heading_prefix:
                    existing.heading_prefix = tpl_copy.get("heading_prefix")
                if not existing.signatory_text:
                    existing.signatory_text = tpl_copy.get("signatory_text")
                if not existing.enclosure_text:
                    existing.enclosure_text = tpl_copy.get("enclosure_text")
                if not existing.template_data or not isinstance(existing.template_data, dict) or "blocks" not in existing.template_data:
                    existing.template_data = editor_service.template_model_to_layout(existing)
                logger.info(f"Verified and synchronized existing template in DB: {tpl_copy['template_code']}")

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
