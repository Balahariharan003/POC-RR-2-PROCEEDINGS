"""
Database Seeder: Seeds default administrator and revenue officer accounts.
All credentials are read exclusively from environment variables via settings.
No plaintext passwords exist in source code.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.security import hash_password
from app.core.logging import logger
from app.core.config import settings
from app.domain.models import User, DocumentTemplate


async def seed_default_accounts(session: AsyncSession) -> None:
    """Seeds one admin and one user account from .env credentials if they don't already exist."""
    accounts = []

    if settings.SEED_ADMIN_USERNAME and settings.SEED_ADMIN_PASSWORD:
        accounts.append({
            "username": settings.SEED_ADMIN_USERNAME,
            "email": settings.SEED_ADMIN_EMAIL,
            "password": settings.SEED_ADMIN_PASSWORD,
            "full_name": settings.SEED_ADMIN_FULLNAME or "Administrator",
            "role": "admin",
            "jurisdiction_district": "Erode",
            "jurisdiction_taluk": "Erode",
            "is_active": True,
        })

    if settings.SEED_USER_USERNAME and settings.SEED_USER_PASSWORD:
        accounts.append({
            "username": settings.SEED_USER_USERNAME,
            "email": settings.SEED_USER_EMAIL,
            "password": settings.SEED_USER_PASSWORD,
            "full_name": settings.SEED_USER_FULLNAME or "Revenue Officer",
            "role": "user",
            "jurisdiction_district": "Erode",
            "jurisdiction_taluk": "Erode",
            "is_active": True,
        })

    if not accounts:
        logger.info("No seed account credentials found in .env — skipping account seeding.")
        return

    try:
        for acc in accounts:
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
            else:
                existing.hashed_password = hash_password(acc["password"])
                existing.is_active = True
                logger.info(f"Synchronized seed account credentials: {acc['username']} ({acc['email']})")

        await session.commit()
    except Exception as e:
        await session.rollback()
        logger.error(f"Failed to seed default accounts: {e}")


DEFAULT_TEMPLATES = [
    {
        "template_code": "customs_sec142",
        "name": "Customs Act 1962 Sec 142(1)(c)(i) Recovery",
        "department_type": "CUSTOMS",
        "subject_template": "வருவாய் வசூல் சட்டம் 1864 – சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(i) – சென்னை சுங்கத்துறை ஏற்றுமதி ஆணையரகம் – நிலுவைத் தொகை வசூலிக்கக் கோருதல் – ஆணை பிறப்பிக்கப்படுகிறது.",
        "reference_template": "1. உதவி ஆணையர் (ஏற்றுமதி), சுங்கத்துறை ஆணையரகம் (சென்னை IV), கடித ந.க.எண் {case_no}, நாள்: {order_date}.\n2. இணை சுங்க ஆணையர், சுங்கத்துறை ஆணையரகம் (சென்னை IV), சென்னை அவர்களின் ஆணை.",
        "order_para1_template": "பார்வை 1-ல் காணும் சென்னை, சுங்கத்துறை ஆணையரகம் கடிதத்தில், {taluk} வட்டம், {defaulter_address} என்ற முகவரியில் இயங்கி வரும் {defaulter_name} என்ற நிறுவனம் சுங்கச் சட்டம் 1962-ன்படி அரசுக்குச் செலுத்த வேண்டிய நிலுவைத் தொகை ரூ.{total_amount}/- ({amount_in_words})-யினை தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன்படி வசூலித்துத் தருமாறு கோரப்பட்டுள்ளது.",
        "order_para2_template": "எனவே, தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 மற்றும் சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(i)-ன் கீழ் வழங்கப்பட்டுள்ள அதிகாரத்தின்படி, மேற்படி நிறுவனத்திடமிருந்து அரசுக்குச் சேர வேண்டிய நிலுவைத் தொகையான ரூ.{total_amount}/- மற்றும் அதற்குரிய வட்டியினை உடனடியாக வசூலித்து \"Commissioner of Customs, Export Commissionerate, Chennai IV\" என்ற பெயரில் வங்கி வரைவோலையாக (Head of Account: 037 - Customs) பெற்று இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {taluk} வட்டாட்சியர் அவர்களுக்கு உத்தரவிடப்படுகிறது.",
        "order_para3_template": "மேற்படி நிறுவனத்தின் அசையும் மற்றும் அசையா சொத்துகளிலிருந்து மற்றும் வங்கிக் கணக்குகளிலிருந்து தொகையினை உடனடியாக வசூலிக்க உரிய நடவடிக்கை மேற்கொள்ளுமாறு உத்தரவிடப்படுகிறது.",
        "enclosure_text": "கடித நகல்",
        "template_data": {
            "department": "Customs Export Commissionerate",
            "statutory_act": "Customs Act 1962",
            "section": "142(1)(c)(i)",
            "recovery_act": "Tamil Nadu Revenue Recovery Act 1864 Section 5",
            "head_of_account": "037 - Customs",
            "dd_favour_of": "Commissioner of Customs, Export Commissionerate, Chennai IV",
            "dispatch_to": ["Tahsildar", "Revenue Divisional Officer", "Assistant Commissioner of Customs"],
            "variables": ["case_no", "order_date", "taluk", "defaulter_name", "defaulter_address", "total_amount", "amount_in_words"]
        },
        "is_active": True,
    },
    {
        "template_code": "mcop_award",
        "name": "Motor Accidents Claims Tribunal (MCOP) Recovery",
        "department_type": "MCOP",
        "subject_template": "வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 – மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம் – MCOP எண். {case_no} – இழப்பீட்டுத் தொகை வசூலித்தல் – குறித்து.",
        "reference_template": "1. நீதிமன்ற ஆணை {case_no}, நாள்: {order_date}.\n2. வருவாய் நிலை ஆணை எண் 41 (RSO 41).",
        "order_para1_template": "பார்வை 1-ல் காணும் நீதிமன்ற ஆணையில், {taluk} வட்டம், {defaulter_address} என்ற முகவரியில் வசிக்கும் {defaulter_name} என்பவர் மோட்டார் வாகன விபத்து இழப்பீட்டுத் தொகையான ரூ.{total_amount}/- ({amount_in_words})-யினை வழங்கத் தவறியதால், மேற்படி தொகையினை தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன்படி வசூலிக்க உத்தரவிடப்பட்டுள்ளது.",
        "order_para2_template": "எனவே, தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வழங்கப்பட்டுள்ள அதிகாரத்தின்படி, எதிர்தரப்பினரின் அசையும் மற்றும் அசையா சொத்துக்களிலிருந்து மேற்படி இழப்பீட்டுத் தொகை ரூ.{total_amount}/- மற்றும் உரிய வட்டியினை உடனடியாக வசூலித்து இழப்பீட்டுத் தீர்ப்பாயத்தில் செலுத்துமாறு {taluk} வட்டாட்சியர் அவர்களுக்கு உத்தரவிடப்படுகிறது.",
        "order_para3_template": "மேற்படி வழக்கின் வசூல் விவரங்களை இவ்வலுவலகத்திற்கு உடனடியாக அறிக்கை சமர்ப்பிக்குமாறு தெரிவிக்கப்படுகிறது.",
        "enclosure_text": "நீதிமன்ற ஆணை நகல்",
        "template_data": {
            "department": "Motor Accidents Claims Tribunal",
            "statutory_act": "Motor Vehicles Act 1988",
            "section": "Award Decree",
            "recovery_act": "Tamil Nadu Revenue Recovery Act 1864 Section 5",
            "guideline": "Revenue Standing Order 41 (RSO 41)",
            "dispatch_to": ["Tahsildar", "Revenue Divisional Officer", "Petitioner / Insurer"],
            "variables": ["case_no", "order_date", "taluk", "defaulter_name", "defaulter_address", "total_amount", "amount_in_words"]
        },
        "is_active": True,
    },
    {
        "template_code": "gst_arrears",
        "name": "Commercial Taxes & GST Revenue Recovery",
        "department_type": "GST",
        "subject_template": "தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 – வணிகவரித் துறை (GST) வரி நிலுவைத் தொகை வசூலித்தல் – ஆணை பிறப்பித்தல் – சார்பு.",
        "reference_template": "1. வணிகவரி அலுவலர் கடித ந.க. எண் {case_no}, நாள்: {order_date}.\n2. தமிழ்நாடு சரக்கு மற்றும் சேவை வரிச் சட்டம் 2017 பிரிவு 79.",
        "order_para1_template": "பார்வை 1-ல் காணும் வணிகவரி அலுவலர் அவர்களின் கடிதத்தில், {defaulter_name} நிறுவனம் செலுத்த வேண்டிய ஜி.எஸ்.டி வரி நிலுவைத் தொகை ரூ.{total_amount}/- ({amount_in_words})-யினை வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூலிக்கக் கோரப்பட்டுள்ளது.",
        "order_para2_template": "எனவே, தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வழங்கப்பட்டுள்ள அதிகாரத்தின்படி, எதிர்தரப்பினரிடமிருந்து மேற்படி நிலுவைத் தொகையை உடனடியாக வசூலித்து அரசு கணக்கில் செலுத்துமாறு {taluk} வட்டாட்சியர் அவர்களுக்கு உத்தரவிடப்படுகிறது.",
        "order_para3_template": "வசூல் நடவடிக்கையின் முன்னேற்ற அறிக்கை இவ்வலுவலகத்திற்கு அனுப்பி வைக்கப்பட வேண்டும்.",
        "enclosure_text": "வரி விதிப்பு ஆணை நகல்",
        "template_data": {
            "department": "Commercial Taxes Department",
            "statutory_act": "Tamil Nadu GST Act 2017",
            "section": "79",
            "recovery_act": "Tamil Nadu Revenue Recovery Act 1864 Section 5",
            "dispatch_to": ["Tahsildar", "Assistant Commissioner (ST)", "Dealer / Defaulter"],
            "variables": ["case_no", "order_date", "taluk", "defaulter_name", "total_amount", "amount_in_words"]
        },
        "is_active": True,
    }
]


async def seed_default_templates(session: AsyncSession) -> None:
    """Seeds standard Tamil Nadu government proceedings templates if not existing."""
    try:
        for tpl in DEFAULT_TEMPLATES:
            stmt = select(DocumentTemplate).where(DocumentTemplate.template_code == tpl["template_code"])
            result = await session.execute(stmt)
            existing = result.scalars().first()
            if not existing:
                new_tpl = DocumentTemplate(**tpl)
                session.add(new_tpl)
                logger.info(f"Seeded default template: {tpl['template_code']} ({tpl['name']})")
            elif existing.template_data is None:
                existing.template_data = tpl.get("template_data")
                logger.info(f"Updated existing template template_data: {tpl['template_code']}")
        await session.commit()
    except Exception as e:
        await session.rollback()
        logger.error(f"Failed to seed default templates: {e}")
