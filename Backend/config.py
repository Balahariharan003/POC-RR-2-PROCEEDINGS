"""
Configuration module for the Tamil Nadu Revenue Recovery Proceedings Generation System.
Strictly configured for PostgreSQL storage, TAU-Marutham font, Chandra OCR v2 (balanced mode),
and Local Ollama qwen2.5:3b-instruct.
"""

import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
TEMPLATE_DIR = BASE_DIR / "templates"
MODELS_DIR = BASE_DIR / "models"
SAMPLE_DIR = BASE_DIR / "sample_data"

# Create required directories
for d in [UPLOAD_DIR, OUTPUT_DIR, TEMPLATE_DIR, SAMPLE_DIR, MODELS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Ingestion Settings
DEFAULT_DPI = 150
SUPPORTED_IMAGE_FORMATS = {".png", ".jpg", ".jpeg", ".tiff", ".webp", ".bmp"}
SUPPORTED_DOC_FORMATS = {".pdf", ".docx", ".doc"} | SUPPORTED_IMAGE_FORMATS

# OCR Settings: Datalab Chandra OCR v2 (Balanced Mode) + Local RapidOCR ONNX fallback
OCR_VERSION = "Chandra-v2-PaddleOCR"
CHANDRA_OCR_URL = os.getenv("CHANDRA_OCR_URL", "https://api.datalab.to/v1/ocr")
CHANDRA_OCR_MODE = os.getenv("CHANDRA_OCR_MODE", "balance")  # Balanced throughput & precision
DATALAB_API_KEY = os.getenv("DATALAB_API_KEY", "")
CHANDRA_TIMEOUT_SECONDS = int(os.getenv("CHANDRA_TIMEOUT_SECONDS", 25))

# Local RapidOCR PP-OCRv4 ONNX Settings (Resilient Fallback)
OCR_LANGUAGES = ["ta", "en"]
OCR_DET_LIMIT_SIDE_LEN = 960
OCR_CONFIDENCE_THRESHOLD = 0.52
PP_OCR_V4_DET_PATH = str(MODELS_DIR / "ch_PP-OCRv4_det_infer.onnx")
PP_OCR_V4_REC_PATH = str(MODELS_DIR / "ta_PP-OCRv4_rec_infer.onnx")
PP_OCR_V4_REC_DICT_PATH = str(MODELS_DIR / "ta_dict.txt")

# Ollama LLM Settings (qwen2.5:3b-instruct)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct")
OLLAMA_FALLBACK_MODEL = os.getenv("OLLAMA_FALLBACK_MODEL", "qwen2.5:3b")
OLLAMA_TIMEOUT_SECONDS = 20

# Typography & Document Styling - TAU-Marutham Font Alone
PRIMARY_FONT_TAMIL = "TAU-Marutham"
FALLBACK_FONT_TAMIL = "TAU-Marutham"
LATIN_FONT = "TAU-Marutham"

# Default Template Path
PROCEEDINGS_TEMPLATE_PATH = TEMPLATE_DIR / "proceedings_template.docx"

# PostgreSQL Database Configuration
PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = int(os.getenv("PG_PORT", 5432))
PG_USER = os.getenv("PG_USER", "postgres")
PG_PASSWORD = os.getenv("PG_PASSWORD", "")
PG_DATABASE = os.getenv("PG_DATABASE", "rr_proceedings_db")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{PG_DATABASE}"
)

# Server Settings
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8000))
