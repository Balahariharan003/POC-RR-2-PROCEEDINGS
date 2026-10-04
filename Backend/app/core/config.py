"""
Enterprise Configuration using Pydantic Settings.
Strict typing, environment variable parsing, and secure defaults.
"""

import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    # Application Basics
    APP_NAME: str = "TN-RR-Proceedings-API"
    APP_ENV: str = "development"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    API_V1_STR: str = "/api/v1"

    # Base Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    PROJECT_DIR: Path = BASE_DIR.parent
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    OUTPUT_DIR: Path = BASE_DIR / "outputs"
    TEMPLATE_DIR: Path = BASE_DIR / "templates"
    SAMPLE_DIR: Path = BASE_DIR / "sample_data"

    # Security & JWT — MUST be set via .env, no hardcoded defaults
    SECRET_KEY: str = Field(
        ...,
        description="JWT signing secret. MUST be set in .env"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours

    # Cryptographic Anti-Brute-Force Pepper — MUST be set via .env
    CRYPTO_PEPPER: str = Field(
        ...,
        description="Private server pepper for keyed HMAC document stamping. MUST be set in .env"
    )

    # Database Configuration (PostgreSQL with asyncpg)
    PG_HOST: str = "localhost"
    PG_PORT: int = 5432
    PG_USER: str = "postgres"
    PG_PASSWORD: str = ""
    PG_DATABASE: str = "rr_proceedings_db"
    DATABASE_URL: Optional[str] = None

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            # ensure asyncpg driver prefix
            if self.DATABASE_URL.startswith("postgresql://"):
                return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
            return self.DATABASE_URL
        return f"postgresql+asyncpg://{self.PG_USER}:{self.PG_PASSWORD}@{self.PG_HOST}:{self.PG_PORT}/{self.PG_DATABASE}"

    # Datalab Chandra OCR API Configuration (RapidOCR completely removed)
    OCR_VERSION: str = "Chandra-v2"
    CHANDRA_OCR_URL: str = "https://www.datalab.to/api/v1/marker"
    CHANDRA_PRIMARY_MODE: str = "accurate"
    CHANDRA_FALLBACK_MODE: str = "balance"

    DATALAB_API_KEY: str = Field(default="", description="Datalab API Key")
    CHANDRA_TIMEOUT_SECONDS: int = 45

    # Local Ollama LLM Configuration
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b-instruct-q4_K_M"
    OLLAMA_TIMEOUT_SECONDS: int = 95

    # Typography & Government Style Guide Enforcement
    PRIMARY_FONT_TAMIL: str = "TAU-Marutham"

    LATIN_FONT: str = "TAU-Marutham"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "http://localhost:8000", "*"]

    model_config = SettingsConfigDict(env_file=[".env", "../.env"], extra="allow")


settings = Settings()

# Ensure directories exist
for path in [settings.UPLOAD_DIR, settings.OUTPUT_DIR, settings.TEMPLATE_DIR, settings.SAMPLE_DIR]:
    path.mkdir(parents=True, exist_ok=True)
