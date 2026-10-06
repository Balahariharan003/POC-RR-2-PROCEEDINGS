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


class ExtractionUnavailable(AppException):
    """LLM is offline or retry budget exhausted. Case goes to DEAD_LETTER queue."""
    def __init__(self, message: str = "LLM extraction service unavailable after retries", details: Optional[Any] = None):
        super().__init__(message=f"Extraction Unavailable: {message}", status_code=503, details=details)


class GateRejectionError(AppException):
    """Extraction gate rejected the case. It goes to NEEDS_REVIEW — never to a renderer."""
    def __init__(self, gate_errors: list, error_details: Optional[dict] = None):
        error_names = [str(e) for e in gate_errors]
        super().__init__(
            message=f"Extraction gate rejected: {', '.join(error_names)}",
            status_code=422,
            details={"gate_errors": error_names, "error_details": error_details or {}}
        )
        self.gate_errors = gate_errors
        self.error_details = error_details or {}


class RenderContractError(AppException):
    """Safety net: invalid state somehow reached the renderer. Blocks rendering loudly."""
    def __init__(self, message: str = "Render contract violated — invalid data reached document renderer"):
        super().__init__(message=message, status_code=500)
