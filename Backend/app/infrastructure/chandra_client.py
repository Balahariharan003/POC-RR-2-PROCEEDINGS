"""
Datalab Chandra OCR API Client.
Communicates asynchronously with Datalab's cloud endpoint.
Supports:
- mode="accurate" (Primary high-fidelity legal mode)
- mode="balance" (Fallback fast mode)
"""

import io
from typing import Dict, Any
from PIL import Image
import httpx

from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import OCRProcessingError


class ChandraOCRClient:
    def __init__(self, api_url: str = settings.CHANDRA_OCR_URL, api_key: str = settings.DATALAB_API_KEY):
        self.api_url = api_url
        self.api_key = api_key
        self.timeout = settings.CHANDRA_TIMEOUT_SECONDS

    async def recognize_image(self, image: Image.Image, mode: str = "accurate") -> Dict[str, Any]:
        """Submits an image to Datalab Chandra OCR API in specified mode."""
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        buf.seek(0)
        image_bytes = buf.getvalue()

        headers = {
            "User-Agent": "TN-Revenue-Recovery-Agent/2.0",
        }
        if self.api_key:
            headers["X-Api-Key"] = self.api_key
            headers["Authorization"] = f"Bearer {self.api_key}"

        files = {
            "file": ("page.png", image_bytes, "image/png")
        }
        data = {
            "mode": mode,
            "languages": "ta,en"
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(self.api_url, files=files, data=data, headers=headers)
                
                if res.status_code == 200:
                    data = res.json()
                    extracted_text = data.get("text", "") or data.get("markdown", "")
                    return {
                        "text": extracted_text,
                        "mode": mode,
                        "confidence": data.get("confidence", 0.95),
                        "raw_response": data
                    }
                else:
                    raise OCRProcessingError(f"HTTP {res.status_code}: {res.text}")
        except Exception as e:
            logger.error(f"Chandra OCR request failed (mode={mode}): {e}")
            raise
