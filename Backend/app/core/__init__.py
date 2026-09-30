"""
Foundation Layer: Core configuration, security, database engine, logging, and exceptions.
"""

from .config import settings
from .exceptions import (
    AppException,
    EntityNotFoundError,
    AuthenticationError,
    PermissionDeniedError,
    ValidationError,
)

__all__ = [
    "settings",
    "AppException",
    "EntityNotFoundError",
    "AuthenticationError",
    "PermissionDeniedError",
    "ValidationError",
]
