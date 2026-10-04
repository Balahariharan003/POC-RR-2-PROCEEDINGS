"""
SQLAlchemy ORM Database Models for PostgreSQL.
Unified Enterprise Data Architecture with Explicit Foreign Key Relationships.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
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

    # Relationships
    created_templates = relationship("DocumentTemplate", back_populates="created_by_user", foreign_keys="DocumentTemplate.created_by_id")
    assigned_cases = relationship("ProceedingsCase", back_populates="officer", foreign_keys="ProceedingsCase.officer_id")
    audit_entries = relationship("AuditLedgerEntry", back_populates="user", foreign_keys="AuditLedgerEntry.user_id")


class DocumentTemplate(Base, TimestampMixin):
    __tablename__ = "document_templates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    department_type = Column(String(30), default="CUSTOMS", nullable=False)
    category = Column(String(50), default="REVENUE_RECOVERY")
    description = Column(Text, nullable=True)
    heading_prefix = Column(String(150), nullable=True)
    subject_template = Column(Text, nullable=True)
    reference_template = Column(Text, nullable=True)
    order_para1_template = Column(Text, nullable=True)
    order_para2_template = Column(Text, nullable=True)
    order_para3_template = Column(Text, nullable=True)
    enclosure_text = Column(String(200), default="கடித நகல்")
    signatory_text = Column(Text, nullable=True)
    recipients = Column(JSONB, nullable=True)
    template_data = Column(JSONB, nullable=True)  # Native JSONB
    locked_template = Column(Text, nullable=True)  # Official locked template format with «SLOTS»
    slot_instructions = Column(Text, nullable=True)  # LLM instructions for variable red slots
    file_name = Column(String(255), nullable=True)  # File name of uploaded docx
    file_base64 = Column(Text, nullable=True)  # Base64 encoded DOCX file binary stored in DB
    created_by_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    created_by_user = relationship("User", back_populates="created_templates", foreign_keys=[created_by_id])
    cases = relationship("ProceedingsCase", back_populates="template")


class ProceedingsCase(Base, TimestampMixin):
    __tablename__ = "proceedings_cases"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    file_no = Column(String(50), index=True, nullable=False)
    case_file_no = Column(String(100), index=True, nullable=False)
    roc_number = Column(String(100), index=True, nullable=True)
    department_type = Column(String(30), nullable=False)
    template_id = Column(String, ForeignKey("document_templates.id", ondelete="SET NULL"), nullable=True)
    officer_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    defaulter_name = Column(String(200), nullable=False)
    total_amount = Column(Float, nullable=False)
    district_name = Column(String(50), default="ஈரோடு")
    taluk_name = Column(String(50), default="ஈரோடு")
    status = Column(String(30), default="DRAFT", index=True)  # DRAFT | VERIFIED | SIGNED | DISPATCHED_TO_DRO
    original_file_name = Column(String(255), nullable=True)
    docx_path = Column(String(255), nullable=True)
    pdf_path = Column(String(255), nullable=True)
    hybrid_signature = Column(String(255), nullable=True)
    document_content = Column(Text, nullable=True)
    document_layout = Column(JSONB, nullable=True)
    ocr_data = Column(JSONB, nullable=True)  # Complete OCR payload stored natively as JSONB
    extracted_data = Column(JSONB, nullable=True)  # Master Prompt verified CASE JSON
    generated_documents = Column(JSONB, nullable=True)  # Generated documents manifest

    # Relationships
    template = relationship("DocumentTemplate", back_populates="cases")
    officer = relationship("User", back_populates="assigned_cases")
    audit_entries = relationship("AuditLedgerEntry", back_populates="case")


class OfficeConfiguration(Base, TimestampMixin):
    __tablename__ = "office_configurations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    config_key = Column(String(50), unique=True, index=True, nullable=False)  # e.g. "ERODE_COLLECTORATE"
    collector_line = Column(String(150), default="திரு.ச.கந்தசாமி, இ.ஆ.ப.,", nullable=False)
    office_section = Column(String(20), default="ஈ2", nullable=False)
    taluks = Column(JSONB, nullable=True)  # ERODE_TALUKS JSON list
    taluk_to_rdo = Column(JSONB, nullable=True)  # TALUK_TO_RDO JSON mapping
    dept_configs = Column(JSONB, nullable=True)  # DEPT dictionary configuration
    is_active = Column(Boolean, default=True, nullable=False)


class AuditLedgerEntry(Base, TimestampMixin):
    __tablename__ = "audit_ledger"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    action = Column(String(50), index=True, nullable=False)
    case_id = Column(String, ForeignKey("proceedings_cases.id", ondelete="SET NULL"), nullable=True)
    file_id = Column(String(100), nullable=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    details = Column(JSONB, nullable=True)  # Native JSONB
    signature = Column(String(255), nullable=True)  # Advanced Hybrid v2:hybrid:<salt>:<hmac>

    # Relationships
    case = relationship("ProceedingsCase", back_populates="audit_entries")
    user = relationship("User", back_populates="audit_entries")


class HistoricalRRLedger(Base, TimestampMixin):
    __tablename__ = "historical_rr_ledger"

    rr_record_id = Column(Integer, primary_key=True, autoincrement=True)
    defaulter_name = Column(String(255), index=True, nullable=False)
    old_rr_reference = Column(String(100), nullable=False)
    associated_case_number = Column(String(100), nullable=True)
    total_recovered_amount = Column(Float, default=0.0)
    is_active_dispute = Column(Boolean, default=True)


class SystemJobQueue(Base, TimestampMixin):
    __tablename__ = "system_job_queue"

    job_id = Column(Integer, primary_key=True, autoincrement=True)
    worker_target = Column(String(50), nullable=False)  # OFFICE_NOTE | PROCEEDINGS | MEMORANDUM | WARRANT
    status = Column(String(50), default="QUEUED", index=True, nullable=False)  # QUEUED | PROCESSING | COMPLETED | FAILED | RETRYING
    payload_ocr_text = Column(Text, nullable=False)
    output_storage_path = Column(String(512), nullable=True)
    historical_rr_ref = Column(String(100), nullable=True)
    judicial_classification = Column(String(50), default="GENERAL_RECOVERY")  # FAMILY_MAINTENANCE | HUMAN_WELFARE_ARREARS | GENERAL_RECOVERY
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    error_log = Column(Text, nullable=True)

