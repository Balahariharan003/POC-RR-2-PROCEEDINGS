"""
Custom Domain Exceptions for Tamil Nadu RR Proceedings Application.
"""

from typing import Any, Optional


class AppException(Exception):
    """Base exception for application-specific errors."""
    def __init__(self, message: str, status_code: int = 400, details: Optional[Any] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


class EntityNotFoundError(AppException):
    def __init__(self, entity_name: str, identifier: Any):
        super().__init__(
            message=f"{entity_name} with identifier '{identifier}' not found.",
            status_code=404
        )


class AuthenticationError(AppException):
    def __init__(self, message: str = "Could not validate credentials"):
        super().__init__(message=message, status_code=401)


class PermissionDeniedError(AppException):
    def __init__(self, message: str = "You do not have permission to perform this action"):
        super().__init__(message=message, status_code=403)


class ValidationError(AppException):
    def __init__(self, message: str, violations: Optional[Any] = None):
        super().__init__(message=message, status_code=422, details=violations)


class OCRProcessingError(AppException):
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message=f"OCR Processing Failure: {message}", status_code=502, details=details)


class LLMExtractionError(AppException):
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message=f"LLM Legal Extraction Failure: {message}", status_code=502, details=details)


class CryptographicIntegrityError(AppException):
    def __init__(self, message: str = "Cryptographic signature mismatch or ledger tampering detected"):
        super().__init__(message=message, status_code=409)
