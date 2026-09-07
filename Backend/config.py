"""
Configuration module for the Tamil Nadu Revenue Recovery Proceedings Generation System.
Optimized for Intel i5 CPU / 8GB RAM local deployment.
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

# OCR Settings (PP-OCRv4 ONNX Multilingual Tamil + English)
OCR_VERSION = "PP-OCRv4"
OCR_LANGUAGES = ["ta", "en"]  # Tamil and English
OCR_DET_LIMIT_SIDE_LEN = 960  # Optimized for CPU memory efficiency
OCR_CONFIDENCE_THRESHOLD = 0.52

# Model and Dictionary Paths
PP_OCR_V4_DET_PATH = str(MODELS_DIR / "ch_PP-OCRv4_det_infer.onnx")
PP_OCR_V4_REC_PATH = str(MODELS_DIR / "ta_PP-OCRv4_rec_infer.onnx")
PP_OCR_V4_REC_DICT_PATH = str(MODELS_DIR / "ta_dict.txt")

# Ollama LLM Settings
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")
OLLAMA_FALLBACK_MODEL = os.getenv("OLLAMA_FALLBACK_MODEL", "qwen2.5:7b")
OLLAMA_TIMEOUT_SECONDS = 15

# Typography & Document Styling
PRIMARY_FONT_TAMIL = "TAU-Marutham"
FALLBACK_FONT_TAMIL = "Noto Sans Tamil"
LATIN_FONT = "Calibri"

# Default Template Path
PROCEEDINGS_TEMPLATE_PATH = TEMPLATE_DIR / "proceedings_template.docx"

# Server Settings
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8000))
