"""
Datalab Chandra OCR API Client.
Communicates asynchronously with Datalab's cloud endpoint.
Supports:
- mode="accurate" (Primary high-fidelity legal mode)
- mode="balance" (Fallback fast mode)
"""

import io
from typing import Dict, Any, Optional
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
        self.auth_failed = False

    async def recognize_image(self, image: Image.Image, mode: str = "accurate") -> Dict[str, Any]:
        """Submits an image to Datalab Chandra / Marker API in specified mode with async polling."""
        if self.auth_failed:
            raise OCRProcessingError("Datalab cloud OCR disabled due to previous HTTP 401 Authentication Failure.")

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
            "languages": "ta,en",
            "langs": "ta,en",
        }
        if self.api_key:
            data["api_key"] = self.api_key

        # Candidate endpoints to try if primary fails or gives 404/405
        candidate_urls = [
            self.api_url,
            "https://www.datalab.to/api/v1/marker",
            "https://www.datalab.to/api/v1/convert",
            "https://www.datalab.to/api/v1/ocr"
        ]
        # Deduplicate while preserving order
        endpoints = list(dict.fromkeys(candidate_urls))

        last_err = None
        for endpoint in endpoints:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    res = await client.post(endpoint, files=files, data=data, headers=headers)
                    
                    if res.status_code == 200:
                        res_data = res.json()

                        # Check if async polling check url is returned
                        check_url = res_data.get("request_check_url")
                        if check_url:
                            import asyncio
                            max_polls = 15
                            for _ in range(max_polls):
                                await asyncio.sleep(1.5)
                                poll_res = await client.get(check_url, headers=headers)
                                if poll_res.status_code == 200:
                                    poll_data = poll_res.json()
                                    if poll_data.get("status") == "complete":
                                        text = poll_data.get("markdown", "") or poll_data.get("text", "")
                                        return {
                                            "text": text,
                                            "mode": mode,
                                            "confidence": 0.96,
                                            "raw_response": poll_data
                                        }
                                    elif poll_data.get("status") == "failed":
                                        raise OCRProcessingError(f"Datalab processing failed: {poll_data.get('error')}")

                        # If text is directly returned
                        extracted_text = res_data.get("text", "") or res_data.get("markdown", "")
                        if extracted_text:
                            return {
                                "text": extracted_text,
                                "mode": mode,
                                "confidence": res_data.get("confidence", 0.95),
                                "raw_response": res_data
                            }
                    elif res.status_code == 401:
                        self.auth_failed = True
                        last_err = f"HTTP 401: {res.text}"
                        break
                    elif res.status_code in {404, 405}:
                        last_err = f"HTTP {res.status_code} on {endpoint}"
                        continue
                    else:
                        last_err = f"HTTP {res.status_code}: {res.text}"
            except Exception as e:
                last_err = str(e)
                continue

        logger.warning(f"All Datalab cloud OCR endpoints failed: {last_err}")
        raise OCRProcessingError(f"Chandra OCR request failed: {last_err}")
