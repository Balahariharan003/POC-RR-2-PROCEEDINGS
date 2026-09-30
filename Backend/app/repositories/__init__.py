"""
Data Access Layer (Repository Pattern).
"""

from .base import BaseRepository
from .user_repository import UserRepository
from .template_repository import TemplateRepository
from .audit_repository import AuditRepository

__all__ = ["BaseRepository", "UserRepository", "TemplateRepository", "AuditRepository"]
