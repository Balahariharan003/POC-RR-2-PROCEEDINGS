"""
PostgreSQL Database Layer for AI Administrative Co-Pilot (Revenue Recovery).
Provides enterprise connection pooling, schema initialization, and transactional CRUD.
Strictly uses PostgreSQL for all data storage (Templates, Users, Audit Logs, Settings).
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor, Json
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

logger = logging.getLogger("rr_proceedings.db")

# PostgreSQL Connection Configuration
PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = int(os.getenv("PG_PORT", 5432))
PG_USER = os.getenv("PG_USER", "postgres")
PG_PASSWORD = os.getenv("PG_PASSWORD", "")
PG_DATABASE = os.getenv("PG_DATABASE", "rr_proceedings_db")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{PG_DATABASE}"
)

_connection_pool: Optional[pool.SimpleConnectionPool] = None


def get_db_pool() -> pool.SimpleConnectionPool:
    """Returns or creates the global connection pool."""
    global _connection_pool
    if _connection_pool is None or _connection_pool.closed:
        ensure_database_exists()
        try:
            _connection_pool = pool.SimpleConnectionPool(
                minconn=2,
                maxconn=20,
                host=PG_HOST,
                port=PG_PORT,
                user=PG_USER,
                password=PG_PASSWORD,
                dbname=PG_DATABASE,
            )
            logger.info("PostgreSQL connection pool initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to create PG connection pool: {e}")
            raise
    return _connection_pool


def ensure_database_exists():
    """Connects to the default 'postgres' database and creates 'rr_proceedings_db' if absent."""
    try:
        conn = psycopg2.connect(
            host=PG_HOST,
            port=PG_PORT,
            user=PG_USER,
            password=PG_PASSWORD,
            dbname="postgres",
            connect_timeout=3
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (PG_DATABASE,))
        if not cur.fetchone():
            cur.execute(f'CREATE DATABASE "{PG_DATABASE}"')
            logger.info(f"Created PostgreSQL database: {PG_DATABASE}")
        cur.close()
        conn.close()
    except Exception as e:
        logger.warning(f"ensure_database_exists check completed or skipped: {e}")


def execute_query(query: str, params: Tuple = None, fetch_one: bool = False, fetch_all: bool = False, commit: bool = True) -> Any:
    """Executes a SQL query safely using connection pooling."""
    pool_instance = get_db_pool()
    conn = pool_instance.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params or ())
            result = None
            if fetch_one:
                result = cur.fetchone()
                if result:
                    result = dict(result)
            elif fetch_all:
                result = [dict(row) for row in cur.fetchall()]
            if commit:
                conn.commit()
            return result
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error executing query: {query[:100]}... Error: {e}")
        raise
    finally:
        pool_instance.putconn(conn)


def init_db():
    """Initializes tables and seeds default records in PostgreSQL."""
    ensure_database_exists()

    schema_sql = """
    -- 1. Users & RBAC
    CREATE TABLE IF NOT EXISTS app_users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'user', -- 'admin', 'user'
        status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'inactive'
        taluk VARCHAR(255),
        department VARCHAR(255) DEFAULT 'Revenue Recovery',
        mobile_number VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Dynamic Revenue Recovery Templates (Add / Edit / Delete by Admin)
    CREATE TABLE IF NOT EXISTS proceedings_templates (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        department VARCHAR(64) NOT NULL, -- 'CUSTOMS', 'MCOP', 'TNRERA', 'WARRANT', 'GENERAL'
        category VARCHAR(64) NOT NULL,   -- 'PROCEEDINGS', 'MEMORANDUM', 'OFFICE_NOTE', 'CUSTOM'
        description TEXT,
        heading_prefix VARCHAR(255) DEFAULT 'பிறப்பிப்பவர்: திரு.ச.கந்தசாமி, இ.ஆ.ப.,',
        subject_template TEXT NOT NULL,
        reference_template TEXT NOT NULL,
        order_paras JSONB NOT NULL DEFAULT '[]'::jsonb,
        enclosure_text VARCHAR(255) DEFAULT 'கடித நகல்',
        signatory_text TEXT DEFAULT 'மாவட்ட ஆட்சித் தலைவர்,\n{{district_name}}.',
        recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
        submission_paras JSONB DEFAULT '[]'::jsonb,
        font_name VARCHAR(64) NOT NULL DEFAULT 'TAU-Marutham',
        is_system BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Audit Trail & Proceedings Record Ledger
    CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        case_number VARCHAR(255),
        roc_number VARCHAR(255),
        defaulter_name VARCHAR(255),
        amount VARCHAR(255),
        taluk VARCHAR(255),
        district VARCHAR(255),
        officer_name VARCHAR(255),
        status VARCHAR(64) DEFAULT 'DRAFT',
        template_code VARCHAR(64),
        document_content TEXT,
        file_name VARCHAR(255),
        file_size VARCHAR(64),
        sha256_digest VARCHAR(128),
        dispatch_receipt VARCHAR(128),
        grounding_score NUMERIC(5, 4),
        hallucination_score NUMERIC(5, 4),
        prompt_history JSONB DEFAULT '[]'::jsonb,
        entities_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """
    execute_query(schema_sql)
    _seed_default_users()
    _seed_default_templates()
    logger.info("PostgreSQL database tables initialized and verified.")


def _seed_default_users():
    """Seeds default admin and user officers if not already present."""
    count_row = execute_query("SELECT count(*) as c FROM app_users", fetch_one=True)
    count = count_row["c"] if count_row else 0
    if count == 0:
        default_users = [
            ("admin-1", "நிர்வாகி (District Collectorate)", "collector.erode@tn.gov.in", "admin", "active", "ஈரோடு", "Revenue Administration", "+91 94450 00001"),
            ("user-1", "வருவாய் வட்டாட்சியர் (Tahsildar Erode)", "tahsildar.erode@tn.gov.in", "user", "active", "ஈரோடு", "Taluk Revenue Office", "+91 94450 00002"),
            ("user-2", "பிரிவு எழுத்தர் (Section Officer - E Section)", "so.erevenue@tn.gov.in", "user", "active", "ஈரோடு", "Revenue Recovery Cell", "+91 94450 00003"),
            ("user-3", "வருவாய் வட்டாட்சியர் (Tahsildar Perundurai)", "tahsildar.perundurai@tn.gov.in", "user", "active", "பெருந்துறை", "Taluk Revenue Office", "+91 94450 00004"),
        ]
        insert_sql = """
        INSERT INTO app_users (id, name, email, role, status, taluk, department, mobile_number)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (email) DO NOTHING
        """
        for u in default_users:
            execute_query(insert_sql, u)
        logger.info(f"Seeded {len(default_users)} default users into PostgreSQL app_users table.")


def _seed_default_templates():
    """Seeds official Tamil Nadu proceedings templates matching real-world court references."""
    count_row = execute_query("SELECT count(*) as c FROM proceedings_templates", fetch_one=True)
    count = count_row["c"] if count_row else 0
    if count == 0:
        templates = [
            # 1. Customs Act Proceedings (செயல்முறைகள்) - Reference from M/s Prisma Garments
            {
                "id": "tpl-customs-proc",
                "code": "customs_proceedings",
                "name": "சுங்கச் சட்டம் 1962 - மாவட்ட ஆட்சியர் செயல்முறைகள் (Customs Proceedings)",
                "department": "CUSTOMS",
                "category": "PROCEEDINGS",
                "description": "Customs Act 1962 Sec 142(1)(c)(ii) recovery proceedings issued by District Collector to Tahsildar with Demand Draft instructions.",
                "heading_prefix": "பிறப்பிப்பவர்: திரு.ச.கந்தசாமி, இ.ஆ.ப.,",
                "subject_template": "வருவாய் வசூல் சட்டம் 1864 – சுங்கவரி – {{district_name}} மாவட்டம் - {{taluk_name}} வட்டம் மற்றும் நகரம் - {{defaulter_name}}, {{door_no}}, {{street_and_locality}}, {{taluk_name}} - அரசிற்கு செலுத்த வேண்டிய சுங்கவரி நிலுவைத் தொகை ரூ.{{total_amount}}/- (நிலுவைத் தொகை ரூ.{{principal_amount}}/- + அபராதத் தொகை ரூ.{{penalty_amount}}/-) - வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்ய கோரியது – உத்திரவிடுதல்.",
                "reference_template": "1. சுங்கத்துறை உதவி ஆணையர், வருவாய் வசூலிப்பு பிரிவு, ஏற்றுமதி ஆணையரகம், சுங்க அலுவலகம், சென்னை அவர்களின் கடிதம் எண்.{{case_file_no}}, நாள்: {{letter_date}}.\n2. இவ்வலுவலக செயல்முறை ஆணை ந.க.{{file_no}}/{{file_year}}/{{section_code}}, நாள் .01.{{file_year}}.",
                "order_paras": json.dumps([
                    "{{district_name}} மாவட்டம், {{taluk_name}} வட்டம் மற்றும் நகரம், {{street_and_locality}}, கதவு எண்.{{door_no}} என்ற முகவரியில் {{living_verb}} {{defaulter_name}} என்ற நிறுவனம் அரசிற்கு செலுத்த வேண்டிய சுங்கவரி நிலுவைத் தொகை ரூ.{{total_amount}}/-ஐ (நிலுவைத் தொகை ரூ.{{principal_amount}}/- + அபராதத் தொகை ரூ.{{penalty_amount}}/-) வருவாய் வசூல் சட்டத்தின் கீழ் வசூலிக்குமாறு பார்வையில் காணும் கடிதத்தில் தெரிவிக்கப்பட்டுள்ளதன் பேரில் மேற்படி {{defaulter_name}} என்ற நிறுவனத்திடம் தொகை ரூ.{{total_amount}}/-ஐ வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {{taluk_name}} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி பார்வையில் கண்டுள்ளவாறு உத்திரவிடப்பட்டுள்ளது.",
                    "மேற்படி முகவரியில் {{living_verb}} {{defaulter_name}} (IEC No : {{iec_no}}) என்ற நிறுவனத்தின் அசையும் மற்றும் அசையா சொத்துகளிலிருந்து அரசிற்கு செலுத்த வேண்டிய சுங்கவரி நிலுவைத் தொகை ரூ.{{total_amount}}/-ஐ (நிலுவைத் தொகை ரூ.{{principal_amount}}/- + அபராதத் தொகை ரூ.{{penalty_amount}}/-) ({{amount_in_tamil_words}}) வருவாய் வசூல் சட்டப்படி வசூல் செய்து “{{dd_favour_of}}” என்ற பெயரில் வங்கி வரைவோலையாக (Demand Draft - {{head_of_account}}) எடுத்து {{dispatch_address}} என்ற அலுவலகத்திற்கு அசலினை அனுப்பி அதன் விவரத்தினை நகல் வங்கி வரைவோலையுடன் இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {{taluk_name}} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது."
                ]),
                "enclosure_text": "கடித நகல்",
                "signatory_text": "மாவட்ட ஆட்சித் தலைவர்,\n{{district_name}}.",
                "recipients": json.dumps([
                    {"label": "பெறுநர்", "value": "வருவாய் வட்டாட்சியர், {{taluk_name}}."},
                    {"label": "நகல்", "value": "வருவாய் கோட்டாட்சியர், {{district_name}}."},
                    {"label": "நகல்", "value": "{{dispatch_address}}"},
                    {"label": "நகல்", "value": "{{defaulter_name}}, கதவு எண்.{{door_no}}, {{street_and_locality}}, {{taluk_name}} - {{pincode}}."}
                ]),
                "submission_paras": json.dumps([]),
                "font_name": "TAU-Marutham",
                "is_system": True
            },
            # 2. Customs Memorandum (குறிப்பாணை) - Matching Page 2 & 3 of user reference
            {
                "id": "tpl-customs-memo",
                "code": "customs_memorandum",
                "name": "சுங்கத்துறை நிலுவை - மாவட்ட ஆட்சியர் குறிப்பாணை (Customs Memorandum)",
                "department": "CUSTOMS",
                "category": "MEMORANDUM",
                "description": "District Collectorate Memorandum (குறிப்பாணை) issuing directions to Tahsildar with official reference tracking 1, 2, 3.",
                "heading_prefix": "மாவட்ட ஆட்சியர் அலுவலகம், {{district_name}}.",
                "subject_template": "வருவாய் வசூல் சட்டம் 1864 – சுங்கவரி – {{district_name}} மாவட்டம் - {{taluk_name}} வட்டம் மற்றும் நகரம் - {{defaulter_name}}, {{door_no}}, {{street_and_locality}}, {{taluk_name}} - அரசிற்கு செலுத்த வேண்டிய சுங்கவரி நிலுவைத் தொகை ரூ.{{total_amount}}/- (நிலுவைத் தொகை ரூ.{{principal_amount}}/- + அபராதத் தொகை ரூ.{{penalty_amount}}/-) - வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்ய கோரியது – உத்திரவிடுதல்.",
                "reference_template": "1. சுங்கத்துறை உதவி ஆணையர், வருவாய் வசூலிப்பு பிரிவு, ஏற்றுமதி ஆணையரகம், சுங்க அலுவலகம், சென்னை அவர்களின் கடிதம் எண்.{{case_file_no}}, நாள்: {{letter_date}}.\n2. இவ்வலுவலக செயல்முறை ஆணை ந.க.{{file_no}}/{{file_year}}/{{section_code}}, நாள் .01.{{file_year}}.\n3. சுங்கத்துறை உதவி ஆணையர், வருவாய் வசூலிப்பு பிரிவு, கடிதம் நாள்: {{order_date}}.",
                "order_paras": json.dumps([
                    "{{district_name}} மாவட்டம், {{taluk_name}} வட்டம் மற்றும் நகரம், {{street_and_locality}}, கதவு எண்.{{door_no}} என்ற முகவரியில் {{living_verb}} {{defaulter_name}} என்ற நிறுவனம் அரசிற்கு செலுத்த வேண்டிய சுங்கவரி நிலுவைத் தொகை ரூ.{{total_amount}}/-ஐ (நிலுவைத் தொகை ரூ.{{principal_amount}}/- + அபராதத் தொகை ரூ.{{penalty_amount}}/-) வருவாய் வசூல் சட்டத்தின் கீழ் வசூலிக்குமாறு பார்வை 1ல் காணும் கடிதத்தில் தெரிவிக்கப்பட்டுள்ளதன் பேரில் மேற்படி {{defaulter_name}} என்ற நிறுவனத்திடம் தொகை ரூ.{{total_amount}}/-ஐ வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {{taluk_name}} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி பார்வை 2ல் கண்டுள்ளவாறு உத்திரவிடப்பட்டுள்ளது.",
                    "எனவே, நிலுவைதாரர் {{defaulter_name}} நிறுவனத்தின் மீது மேற்கொள்ளப்பட்ட வருவாய் வசூல் சட்ட நடவடிக்கைகளை உடனடியாக மேற்கொள்ளுமாறு {{taluk_name}} வட்டாட்சியர் கேட்டுக்கொள்ளப்படுகிறார்."
                ]),
                "enclosure_text": "கடித நகல்",
                "signatory_text": "மாவட்ட ஆட்சித் தலைவருக்காக/\nமாவட்ட ஆட்சியரின் நேர்முக உதவியாளர்(பொது),\n{{district_name}}.",
                "recipients": json.dumps([
                    {"label": "பெறுநர்", "value": "வருவாய் வட்டாட்சியர், {{taluk_name}}."},
                    {"label": "நகல்", "value": "வருவாய் கோட்டாட்சியர், {{district_name}}."},
                    {"label": "நகல்", "value": "{{dispatch_address}}"},
                    {"label": "நகல்", "value": "{{defaulter_name}}, கதவு எண்.{{door_no}}, {{street_and_locality}}, {{taluk_name}} - {{pincode}}."}
                ]),
                "submission_paras": json.dumps([]),
                "font_name": "TAU-Marutham",
                "is_system": True
            },
            # 3. Customs Office Note (அலுவலகக் குறிப்பு) - Matching Page 5 & 6 of user reference
            {
                "id": "tpl-customs-note",
                "code": "customs_office_note",
                "name": "சுங்கத்துறை நிலுவை - அலுவலகக் குறிப்பு (Customs Office Note Submission)",
                "department": "CUSTOMS",
                "category": "OFFICE_NOTE",
                "description": "Official Section Submission Note (அலுவலகக் குறிப்பு) submitted to District Collector for approval of recovery order.",
                "heading_prefix": "//அலுவலகக் குறிப்பு//",
                "subject_template": "வருவாய் வசூல் சட்டம் – சுங்கவரி – {{district_name}} மாவட்டம், {{taluk_name}} வட்டம், {{street_and_locality}}, கதவு எண்.{{door_no}} என்ற முகவரியில் {{living_verb}} {{defaulter_name}} என்ற நிறுவனம் அரசிற்கு செலுத்த வேண்டிய சுங்கவரி நிலுவைத் தொகை ரூ.{{principal_amount}}/- மற்றும் அபராதத் தொகை ரூ.{{penalty_amount}}/- உடன் சேர்த்து மொத்தம் ரூ.{{total_amount}}/-ஐ வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்ய கோரியது - உத்திரவிடுதல் -தொடர்பாக.",
                "reference_template": "உதவி சுங்க ஆணையர், வருவாய் வசூலிப்பு பிரிவு, ஏற்றுமதி ஆணையரகம், சுங்க அலுவலகம், சென்னை அவர்களின் கடிதம் எண்.{{case_file_no}}, நாள்: {{letter_date}}.",
                "order_paras": json.dumps([]),
                "enclosure_text": "கோப்பு தாள்கள்",
                "signatory_text": "ஒப்பம்/–\nபிரிவு எழுத்தர் / கண்காணிப்பாளர்\n{{section_code}} பிரிவு, மாவட்ட ஆட்சியர் அலுவலகம், {{district_name}}.",
                "recipients": json.dumps([]),
                "submission_paras": json.dumps([
                    "{{district_name}} மாவட்டம், {{taluk_name}} வட்டம், {{street_and_locality}}, கதவு எண்.{{door_no}} என்ற முகவரியில் {{living_verb}} {{defaulter_name}} என்ற நிறுவனம் அரசிற்கு செலுத்த வேண்டிய சுங்கவரி நிலுவைத் தொகை ரூ.{{principal_amount}}/- மற்றும் அபராதத்தொகை ரூ.{{penalty_amount}}/- உடன் சேர்த்து மொத்தம் ரூ.{{total_amount}}/-ஐ வருவாய் வசூல் சட்டத்தின் கீழ் வசூலிக்குமாறு பார்வையில் காணும் உதவி சுங்க ஆணையர் கடிதத்தில் தெரிவிக்கப்பட்டுள்ளது.",
                    "மேற்படி முகவரியில் {{living_verb}} {{defaulter_name}} (IEC No : {{iec_no}}) என்ற நிறுவனத்தின் அசையும் மற்றும் அசையா சொத்துகளிலிருந்து அரசிற்கு செலுத்த வேண்டிய சுங்கவரி நிலுவைத் தொகை ரூ.{{principal_amount}}/- மற்றும் அபராதத் தொகை ரூ.{{penalty_amount}}/- உடன் சேர்த்து மொத்தம் ரூ.{{total_amount}}/-ஐ ({{amount_in_tamil_words}}) வருவாய் வசூல் சட்டப்படி வசூல் செய்து “{{dd_favour_of}}” என்ற பெயரில் வங்கி வரைவோலையாக (Demand Draft - {{head_of_account}}) எடுத்து {{dispatch_address}} என்ற அலுவலகத்திற்கு அசல் வங்கி வரைவோலையினை அனுப்பி அதன் விவரத்தினை நகல் வங்கி வரைவோலையுடன் இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {{taluk_name}} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கலாம்.",
                    "எனவே மேற்படி தொகையை வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {{taluk_name}} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடலாம்.",
                    "உத்திரவினை எதிர்நோக்கி செயல்முறை வரைவு ஒப்புதலுக்காக மாவட்ட ஆட்சித்தலைவர் அவர்களுக்கு பணிவுடன் சமர்ப்பிக்கப்படுகிறது."
                ]),
                "font_name": "TAU-Marutham",
                "is_system": True
            },
            # 4. MCOP Motor Accident Claims Proceedings
            {
                "id": "tpl-mcop-proc",
                "code": "mcop_proceedings",
                "name": "மோட்டார் வாகன விபத்து இழப்பீடு - செயல்முறைகள் (MCOP Proceedings)",
                "department": "MCOP",
                "category": "PROCEEDINGS",
                "description": "Motor Accidents Claims Tribunal decree execution under Section 174 of MV Act 1988 & Section 5 of TN RR Act 1864.",
                "heading_prefix": "பிறப்பிப்பவர்: திரு.ச.கந்தசாமி, இ.ஆ.ப.,",
                "subject_template": "வருவாய் வசூல் சட்டம் 1864 – மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174 – {{district_name}} மாவட்டம் – {{taluk_name}} வட்டம் - {{defaulter_name}}, கதவு எண் {{door_no}}, {{street_and_locality}}, {{taluk_name}} – இழப்பீட்டுத் தொகை ரூ.{{total_amount}}/- வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யக் கோருதல் - உத்திரவிடுதல்.",
                "reference_template": "{{issuing_authority_name}}, வழக்கு எண். {{case_file_no}}, உத்தரவு நாள் {{order_date}}.",
                "order_paras": json.dumps([
                    "{{district_name}} மாவட்டம், {{taluk_name}} வட்டம், {{street_and_locality}}, கதவு எண் {{door_no}}, என்ற முகவரியில் {{living_verb}} {{defaulter_name}} {{defaulter_suffix}} மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174-ன்படி நீதிமன்றத்தால் தீர்ப்பளிக்கப்பட்ட தொகை ரூ.{{total_amount}}/- ஐ தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யுமாறு பார்வையில் காணும் உத்தரவின் வாயிலாக தெரிவிக்கப்பட்டுள்ளது.",
                    "மேற்படி {{defaulter_name}} {{defaulter_suffix}} தொகை ரூ.{{total_amount}}/- ஐ வருவாய் நிலை ஆணை எண் 41 மற்றம் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {{taluk_name}} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது.",
                    "எனவே, மேற்படி முகவரியில் {{living_verb}} {{defaulter_name}} என்பாரின் {{asset_clause}} மொத்தம் தொகை ரூ.{{total_amount}}/- ({{amount_in_tamil_words}}) வசூல் செய்து “{{dd_favour_of}}“ என்ற பெயரில் வங்கி வரைவோலையாக எடுத்து {{dispatch_address}} என்ற அலுவலகத்திற்கு அசலினை அனுப்பி அதன் விவரத்தினை இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {{taluk_name}} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது."
                ]),
                "enclosure_text": "நீதிமன்ற உத்தரவு நகல்",
                "signatory_text": "மாவட்ட ஆட்சித் தலைவர்,\n{{district_name}}.",
                "recipients": json.dumps([
                    {"label": "பெறுநர்", "value": "வருவாய் வட்டாட்சியர், {{taluk_name}}."},
                    {"label": "நகல்", "value": "வருவாய் கோட்டாட்சியர், {{district_name}}."},
                    {"label": "நகல்", "value": "{{dispatch_address}}"},
                    {"label": "நகல்", "value": "{{defaulter_name}}, {{door_no}}, {{street_and_locality}}, {{taluk_name}} - {{pincode}}."}
                ]),
                "submission_paras": json.dumps([]),
                "font_name": "TAU-Marutham",
                "is_system": True
            },
            # 5. TNRERA Proceedings
            {
                "id": "tpl-tnrera-proc",
                "code": "tnrera_proceedings",
                "name": "ரியல் எஸ்டேட் ஒழுங்குமுறை ஆணை - செயல்முறைகள் (TNRERA Proceedings)",
                "department": "TNRERA",
                "category": "PROCEEDINGS",
                "description": "TNRERA Section 40(1) penalty recovery under TN Revenue Recovery Act 1864.",
                "heading_prefix": "பிறப்பிப்பவர்: திரு.ச.கந்தசாமி, இ.ஆ.ப.,",
                "subject_template": "வருவாய் வசூல் சட்டம் 1864 – தமிழ்நாடு ரியல் எஸ்டேட் சட்டம் 2016 பிரிவு 40(1) – {{district_name}} மாவட்டம் – {{taluk_name}} வட்டம் - {{defaulter_name}}, {{door_no}}, {{street_and_locality}} – அபராதத் தொகை ரூ.{{total_amount}}/- வசூல் செய்யக் கோருதல் - உத்திரவிடுதல்.",
                "reference_template": "தமிழ்நாடு ரியல் எஸ்டேட் ஒழுங்குமுறை குழுமம் (TNRERA) கடித எண். {{case_file_no}}, நாள் {{order_date}}.",
                "order_paras": json.dumps([
                    "{{district_name}} மாவட்டம், {{taluk_name}} வட்டம், {{street_and_locality}}, கதவு எண் {{door_no}}, என்ற முகவரியில் {{living_verb}} {{defaulter_name}} {{defaulter_suffix}} தமிழ்நாடு ரியல் எஸ்டேட் சட்டம் 2016 பிரிவு 40(1)-ன் படி விதிக்கப்பட்ட அபராதத் தொகை ரூ.{{total_amount}}/- ஐ தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யுமாறு பார்வையில் காணும் உத்தரவின் வாயிலாக தெரிவிக்கப்பட்டுள்ளது.",
                    "மேற்படி {{defaulter_name}} {{defaulter_suffix}} தொகை ரூ.{{total_amount}}/- ஐ வருவாய் நிலை ஆணை எண் 41 மற்றம் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {{taluk_name}} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது."
                ]),
                "enclosure_text": "TNRERA ஆணை நகல்",
                "signatory_text": "மாவட்ட ஆட்சித் தலைவர்,\n{{district_name}}.",
                "recipients": json.dumps([
                    {"label": "பெறுநர்", "value": "வருவாய் வட்டாட்சியர், {{taluk_name}}."},
                    {"label": "நகல்", "value": "வருவாய் கோட்டாட்சியர், {{district_name}}."},
                    {"label": "நகல்", "value": "{{dispatch_address}}"}
                ]),
                "submission_paras": json.dumps([]),
                "font_name": "TAU-Marutham",
                "is_system": True
            },
            # 6. Criminal Warrant Execution (வழக்கு வாரண்ட்)
            {
                "id": "tpl-warrant-proc",
                "code": "warrant_proceedings",
                "name": "குற்றவியல் நீதிமன்ற வாரண்ட் - செயல்முறைகள் (Judicial Warrant Proceedings)",
                "department": "WARRANT",
                "category": "PROCEEDINGS",
                "description": "Criminal court warrant execution under CrPC / BNSS and Section 5 of TN Revenue Recovery Act.",
                "heading_prefix": "பிறப்பிப்பவர்: திரு.ச.கந்தசாமி, இ.ஆ.ப.,",
                "subject_template": "வருவாய் வசூல் சட்டம் 1864 – குற்றவியல் நடைமுறைச் சட்டம் – வாரண்ட் வசூலித்தல் – {{district_name}} மாவட்டம் – {{taluk_name}} வட்டம் - {{defaulter_name}}, {{door_no}}, {{street_and_locality}} – நிலுவைத் தொகை ரூ.{{total_amount}}/- வசூல் செய்யக் கோருதல் - உத்திரவிடுதல்.",
                "reference_template": "நீதிமன்ற வாரண்ட் ஆணை எண். {{case_file_no}}, நாள் {{order_date}}.",
                "order_paras": json.dumps([
                    "{{district_name}} மாவட்டம், {{taluk_name}} வட்டம், {{street_and_locality}}, கதவு எண் {{door_no}}, என்ற முகவரியில் {{living_verb}} {{defaulter_name}} {{defaulter_suffix}} நீதிமன்ற வாரண்ட் ஆணைப்படி தொகை ரூ.{{total_amount}}/- ஐ தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யுமாறு பார்வையில் காணும் உத்தரவின் வாயிலாக தெரிவிக்கப்பட்டுள்ளது.",
                    "மேற்படி {{defaulter_name}} {{defaulter_suffix}} தொகை ரூ.{{total_amount}}/- ஐ வருவாய் நிலை ஆணை எண் 41 மற்றம் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {{taluk_name}} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது."
                ]),
                "enclosure_text": "நீதிமன்ற வாரண்ட் நகல்",
                "signatory_text": "மாவட்ட ஆட்சித் தலைவர்,\n{{district_name}}.",
                "recipients": json.dumps([
                    {"label": "பெறுநர்", "value": "வருவாய் வட்டாட்சியர், {{taluk_name}}."},
                    {"label": "நகல்", "value": "வருவாய் கோட்டாட்சியர், {{district_name}}."}
                ]),
                "submission_paras": json.dumps([]),
                "font_name": "TAU-Marutham",
                "is_system": True
            }
        ]

        insert_sql = """
        INSERT INTO proceedings_templates (
            id, code, name, department, category, description, heading_prefix,
            subject_template, reference_template, order_paras, enclosure_text,
            signatory_text, recipients, submission_paras, font_name, is_system
        ) VALUES (
            %(id)s, %(code)s, %(name)s, %(department)s, %(category)s, %(description)s, %(heading_prefix)s,
            %(subject_template)s, %(reference_template)s, %(order_paras)s, %(enclosure_text)s,
            %(signatory_text)s, %(recipients)s, %(submission_paras)s, %(font_name)s, %(is_system)s
        ) ON CONFLICT (code) DO NOTHING
        """
        for t in templates:
            execute_query(insert_sql, t)
        logger.info(f"Seeded {len(templates)} master proceedings templates into PostgreSQL.")
