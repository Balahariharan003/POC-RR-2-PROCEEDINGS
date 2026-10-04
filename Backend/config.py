"""
Configuration Bridge module.
Directly bridges all settings from the centralized app.core.config.settings.
"""

from pathlib import Path
from app.core.config import settings

# Base Paths
BASE_DIR = settings.BASE_DIR
PROJECT_DIR = settings.PROJECT_DIR
UPLOAD_DIR = settings.UPLOAD_DIR
OUTPUT_DIR = settings.OUTPUT_DIR
TEMPLATE_DIR = settings.TEMPLATE_DIR
SAMPLE_DIR = settings.SAMPLE_DIR

# Settings
DEFAULT_DPI = 150
OCR_VERSION = settings.OCR_VERSION
CHANDRA_OCR_URL = settings.CHANDRA_OCR_URL
CHANDRA_PRIMARY_MODE = settings.CHANDRA_PRIMARY_MODE
CHANDRA_FALLBACK_MODE = settings.CHANDRA_FALLBACK_MODE
DATALAB_API_KEY = settings.DATALAB_API_KEY
CHANDRA_TIMEOUT_SECONDS = settings.CHANDRA_TIMEOUT_SECONDS
CRYPTO_PEPPER = settings.CRYPTO_PEPPER

OLLAMA_BASE_URL = settings.OLLAMA_BASE_URL
OLLAMA_MODEL = settings.OLLAMA_MODEL
OLLAMA_FALLBACK_MODEL = settings.OLLAMA_FALLBACK_MODEL
OLLAMA_TIMEOUT_SECONDS = settings.OLLAMA_TIMEOUT_SECONDS

PRIMARY_FONT_TAMIL = settings.PRIMARY_FONT_TAMIL
LATIN_FONT = settings.LATIN_FONT

HOST = settings.HOST
PORT = settings.PORT
DATABASE_URL = settings.async_database_url
