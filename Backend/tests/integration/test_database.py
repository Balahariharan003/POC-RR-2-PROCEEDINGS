"""
Integration Tests for Database Session and Models.
"""

import pytest
from app.core.database import Base
from app.domain.models import User, DocumentTemplate, AuditLedgerEntry, ProceedingsCase


def test_models_defined():
    assert User.__tablename__ == "users"
    assert DocumentTemplate.__tablename__ == "document_templates"
    assert AuditLedgerEntry.__tablename__ == "audit_ledger"
    assert ProceedingsCase.__tablename__ == "proceedings_cases"
