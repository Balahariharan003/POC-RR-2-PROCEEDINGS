"""
Local File Storage Provider.
"""

from pathlib import Path
import shutil
from typing import BinaryIO

from app.core.config import settings
from app.infrastructure.storage.safe_path import resolve_safe_path


class LocalStorageProvider:
    def __init__(self, upload_dir: Path = settings.UPLOAD_DIR, output_dir: Path = settings.OUTPUT_DIR):
        self.upload_dir = upload_dir
        self.output_dir = output_dir

    def save_upload(self, file_obj: BinaryIO, filename: str) -> Path:
        target = resolve_safe_path(self.upload_dir, filename)
        with open(target, "wb") as f:
            shutil.copyfileobj(file_obj, f)
        return target

    def get_output_file(self, filename: str) -> Path:
        target = resolve_safe_path(self.output_dir, filename)
        if not target.exists():
            raise FileNotFoundError(f"Requested output file does not exist: {filename}")
        return target

    def get_upload_file(self, filename: str) -> Path:
        target = resolve_safe_path(self.upload_dir, filename)
        if not target.exists():
            raise FileNotFoundError(f"Requested upload file does not exist: {filename}")
        return target

    def find_file(self, filename: str) -> Path:
        # Candidate search directories
        directories = [self.output_dir, self.upload_dir, settings.TEMPLATE_DIR, settings.SAMPLE_DIR]
        candidates = [filename]
        if not filename.endswith(".docx"):
            candidates.append(f"{filename}.docx")
        if filename.endswith(".docx"):
            candidates.append(filename[:-5])

        # 1. Direct and candidate exact match
        for directory in directories:
            for cand in candidates:
                try:
                    target = resolve_safe_path(directory, cand)
                    if target.exists():
                        return target
                except Exception:
                    continue

        # 2. Glob matching across directories
        for directory in directories:
            for cand in candidates:
                matches = list(directory.glob(f"*{cand}*"))
                if matches:
                    return matches[0]

        raise FileNotFoundError(f"Requested file not found: {filename}")

