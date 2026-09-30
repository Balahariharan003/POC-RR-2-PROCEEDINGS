"""
Audit Service: Advanced Hybrid Cryptographic Verification & Immutable Ledger.
Replaces plain, brute-force-vulnerable SHA-256 with:
- Server-side private pepper (never stored with document or DB)
- 128-bit CSPRNG dynamic salt
- Keyed HMAC-SHA256 composite state digest
- Immutable tamper-evident audit logging
"""

import hmac
import hashlib
import secrets
import json
from typing import Dict, Any, Tuple, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.repositories.audit_repository import AuditRepository


class AuditService:
    def __init__(self, audit_repo: Optional[AuditRepository] = None):
        self.audit_repo = audit_repo or AuditRepository()
        self.pepper = settings.CRYPTO_PEPPER.encode("utf-8")

    def _canonicalize_payload(self, payload: Dict[str, Any]) -> bytes:
        """Serializes dictionary to deterministic sorted canonical JSON bytes."""
        clean = {k: v for k, v in payload.items() if not k.startswith("_") and k != "hybrid_signature"}
        return json.dumps(clean, sort_keys=True, ensure_ascii=False).encode("utf-8")

    def generate_hybrid_signature(
        self,
        extracted_data: Dict[str, Any],
        raw_ocr_text: str,
        custom_salt: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Generates an Advanced Keyed Hybrid Signature:
        Format: v2:hybrid:<salt_hex>:<hmac_hex>
        """
        salt = custom_salt or secrets.token_hex(16)
        salt_bytes = salt.encode("utf-8")
        
        # Dual-Layer Composite Digest
        ocr_digest = hashlib.sha256(raw_ocr_text.encode("utf-8")).digest()
        payload_bytes = self._canonicalize_payload(extracted_data)
        
        composite_hasher = hashlib.sha256()
        composite_hasher.update(salt_bytes)
        composite_hasher.update(ocr_digest)
        composite_hasher.update(payload_bytes)
        composite_inner_digest = composite_hasher.digest()
        
        # Outer Keyed HMAC using private server pepper
        mac = hmac.new(self.pepper, msg=composite_inner_digest, digestmod=hashlib.sha256)
        hmac_hex = mac.hexdigest()
        
        full_sig = f"v2:hybrid:{salt}:{hmac_hex}"
        
        return {
            "signature": full_sig,
            "salt": salt,
            "hmac": hmac_hex,
            "version": "v2:hybrid",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    def verify_hybrid_signature(
        self,
        extracted_data: Dict[str, Any],
        raw_ocr_text: str,
        signature_string: str
    ) -> Tuple[bool, str]:
        """Verifies if the signature is authentic and untampered."""
        try:
            parts = signature_string.split(":")
            if len(parts) != 4 or parts[0] != "v2" or parts[1] != "hybrid":
                return False, "Invalid signature format. Expected 'v2:hybrid:<salt>:<hmac>'."
            
            salt = parts[2]
            provided_hmac = parts[3]
            
            recomputed = self.generate_hybrid_signature(extracted_data, raw_ocr_text, custom_salt=salt)
            if hmac.compare_digest(recomputed["hmac"], provided_hmac):
                return True, "Cryptographic integrity verified. Document and extraction are authentic."
            else:
                return False, "TAMPERING DETECTED: Computed HMAC signature does not match stored value."
        except Exception as e:
            return False, f"Verification failed with error: {str(e)}"

    async def record_audit_entry(
        self,
        db: AsyncSession,
        action: str,
        file_id: Optional[str],
        user_id: Optional[str],
        metadata: Dict[str, Any],
        signature: Optional[str] = None
    ):
        """Records an immutable audit entry in the database."""
        return await self.audit_repo.create_entry(
            db=db,
            action=action,
            file_id=file_id,
            user_id=user_id,
            details=metadata,
            signature=signature
        )
