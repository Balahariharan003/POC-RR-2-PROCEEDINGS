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
        # Check direct match in output, upload, sample
        for directory in [self.output_dir, self.upload_dir, settings.SAMPLE_DIR]:
            try:
                target = resolve_safe_path(directory, filename)
                if target.exists():
                    return target
            except Exception:
                continue
        # Check prefix/suffix glob in upload and output
        for directory in [self.upload_dir, self.output_dir, settings.SAMPLE_DIR]:
            matches = list(directory.glob(f"*{filename}*"))
            if matches:
                return matches[0]
        raise FileNotFoundError(f"Requested file not found: {filename}")
