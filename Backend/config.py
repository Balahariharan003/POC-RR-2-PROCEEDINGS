"""
Configuration module for the Tamil Nadu Revenue Recovery Proceedings Generation System.
Strictly configured for PostgreSQL storage, TAU-Marutham font, Chandra OCR v2 (balanced mode),
and Local Ollama qwen2.5:3b-instruct.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Base Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

# Keep Backend/.env as the documented local override while also supporting a
# project-root .env. Existing process variables retain highest priority.
load_dotenv(BASE_DIR / ".env")
load_dotenv(PROJECT_DIR / ".env")

UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
TEMPLATE_DIR = BASE_DIR / "templates"
MODELS_DIR = BASE_DIR / "models"
SAMPLE_DIR = BASE_DIR / "sample_data"

# Create required directories
for d in [UPLOAD_DIR, OUTPUT_DIR, TEMPLATE_DIR, SAMPLE_DIR, MODELS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Ingestion Settings
DEFAULT_DPI = int(os.getenv("DEFAULT_DPI", 150))
SUPPORTED_IMAGE_FORMATS = {".png", ".jpg", ".jpeg", ".tiff", ".webp", ".bmp"}
SUPPORTED_DOC_FORMATS = {".pdf", ".docx", ".doc"} | SUPPORTED_IMAGE_FORMATS

# OCR Settings: Datalab Chandra OCR v2 (Balanced Mode) + Local RapidOCR ONNX fallback
OCR_VERSION = os.getenv("OCR_VERSION", "Chandra-v2-PaddleOCR")
CHANDRA_OCR_URL = os.getenv("CHANDRA_OCR_URL", "https://api.datalab.to/v1/ocr")
CHANDRA_OCR_MODE = os.getenv("CHANDRA_PRIMARY_MODE") or os.getenv("CHANDRA_OCR_MODE", "balance")
DATALAB_API_KEY = os.getenv("DATALAB_API_KEY", "")
CHANDRA_TIMEOUT_SECONDS = int(os.getenv("CHANDRA_TIMEOUT_SECONDS", 25))

# Local RapidOCR PP-OCRv4 ONNX Settings (Resilient Fallback)
OCR_LANGUAGES = [lang.strip() for lang in os.getenv("OCR_LANGUAGES", "ta,en").split(",") if lang.strip()]
OCR_DET_LIMIT_SIDE_LEN = int(os.getenv("OCR_DET_LIMIT_SIDE_LEN", 960))
OCR_CONFIDENCE_THRESHOLD = float(os.getenv("OCR_CONFIDENCE_THRESHOLD", 0.52))
PP_OCR_V4_DET_PATH = str(MODELS_DIR / "ch_PP-OCRv4_det_infer.onnx")
PP_OCR_V4_REC_PATH = str(MODELS_DIR / "ta_PP-OCRv4_rec_infer.onnx")
PP_OCR_V4_REC_DICT_PATH = str(MODELS_DIR / "ta_dict.txt")

# Ollama LLM Settings (qwen2.5:3b-instruct)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct")
OLLAMA_FALLBACK_MODEL = os.getenv("OLLAMA_FALLBACK_MODEL", "qwen2.5:3b")
OLLAMA_TIMEOUT_SECONDS = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", 20))

# Typography & Document Styling - TAU-Marutham Font Alone
PRIMARY_FONT_TAMIL = os.getenv("PRIMARY_FONT_TAMIL", "TAU-Marutham")
FALLBACK_FONT_TAMIL = os.getenv("FALLBACK_FONT_TAMIL", "TAU-Marutham")
LATIN_FONT = os.getenv("LATIN_FONT", "TAU-Marutham")

# Default Template Path
PROCEEDINGS_TEMPLATE_PATH = TEMPLATE_DIR / "proceedings_template.docx"
FINAL_CUSTOMS_TEMPLATE_PATH = TEMPLATE_DIR / "final_customs_template_source.docx"

# PostgreSQL Database Configuration
PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = int(os.getenv("PG_PORT", 5432))
PG_USER = os.getenv("PG_USER", "postgres")
PG_PASSWORD = os.getenv("PG_PASSWORD", "")
PG_DATABASE = os.getenv("PG_DATABASE") or os.getenv("PG_DB", "rr_proceedings_db")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{PG_DATABASE}"
)

# Server Settings
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8000))
