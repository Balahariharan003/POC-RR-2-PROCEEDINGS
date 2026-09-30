"""
SQLAlchemy ORM Database Models for PostgreSQL.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(30), default="ARREAR_CLERK", nullable=False)
    jurisdiction_district = Column(String(50), default="Erode")
    jurisdiction_taluk = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class DocumentTemplate(Base, TimestampMixin):
    __tablename__ = "document_templates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    department_type = Column(String(30), default="CUSTOMS", nullable=False)
    subject_template = Column(Text, nullable=False)
    reference_template = Column(Text, nullable=False)
    order_para1_template = Column(Text, nullable=False)
    order_para2_template = Column(Text, nullable=False)
    order_para3_template = Column(Text, nullable=False)
    enclosure_text = Column(String(200), default="கடித நகல்")
    template_data = Column(JSONB, nullable=True)  # PostgreSQL native JSONB for structured template specs
    is_active = Column(Boolean, default=True, nullable=False)


class AuditLedgerEntry(Base, TimestampMixin):
    __tablename__ = "audit_ledger"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    action = Column(String(50), index=True, nullable=False)
    file_id = Column(String(100), nullable=True, index=True)
    user_id = Column(String(50), nullable=True, index=True)
    details = Column(JSONB, nullable=True)  # PostgreSQL native JSONB for fast immutable queries
    signature = Column(String(255), nullable=True)  # Advanced Hybrid v2:hybrid:<salt>:<hmac>


class ProceedingsCase(Base, TimestampMixin):
    __tablename__ = "proceedings_cases"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    file_no = Column(String(50), index=True, nullable=False)
    case_file_no = Column(String(100), index=True, nullable=False)
    department_type = Column(String(30), nullable=False)
    defaulter_name = Column(String(200), nullable=False)
    total_amount = Column(Float, nullable=False)
    district_name = Column(String(50), default="ஈரோடு")
    taluk_name = Column(String(50), default="ஈரோடு")
    status = Column(String(30), default="GENERATED")  # GENERATED | SIGNED | DISPATCHED
    docx_path = Column(String(255), nullable=True)
    pdf_path = Column(String(255), nullable=True)
    hybrid_signature = Column(String(255), nullable=True)
    extracted_data = Column(JSONB, nullable=True)
