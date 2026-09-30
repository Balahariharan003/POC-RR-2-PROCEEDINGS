"""
Async Client for Local Ollama LLM.
"""

from typing import Dict, Any, Optional
import httpx

from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import LLMExtractionError


class OllamaClient:
    def __init__(self, base_url: str = settings.OLLAMA_BASE_URL, default_model: str = settings.OLLAMA_MODEL):
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model
        self.timeout = settings.OLLAMA_TIMEOUT_SECONDS

    async def generate_completion(self, prompt: str, system: Optional[str] = None, format: Optional[str] = None) -> str:
        payload = {
            "model": self.default_model,
            "prompt": prompt,
            "stream": False,
        }
        if system:
            payload["system"] = system
        if format:
            payload["format"] = format

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(f"{self.base_url}/api/generate", json=payload)
                if res.status_code == 200:
                    return res.json().get("response", "")
                raise LLMExtractionError(f"Ollama returned HTTP {res.status_code}: {res.text}")
        except Exception as e:
            logger.error(f"Ollama completion failure: {e}")
            raise
