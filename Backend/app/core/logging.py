"""
Clean, Production-Ready Formatted Logging Configuration.
Provides high-readability console output with precise timestamps and levels.
"""

import sys
import logging
from datetime import datetime


class CleanConsoleFormatter(logging.Formatter):
    """
    Formats log records into clean, readable terminal format:
    YYYY-MM-DD HH:MM:SS,mmm [LEVEL] module: Message
    """
    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S,%f")[:23]
        module_name = record.name
        if module_name == "tn_rr_backend" or module_name == "root":
            module_name = record.module
        msg = record.getMessage()
        if record.exc_info:
            msg += "\n" + self.formatException(record.exc_info)
        return f"{timestamp} [{record.levelname}] {module_name}: {msg}"


def setup_logging():
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(CleanConsoleFormatter())
    
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.handlers = [handler]
    
    # Silence noisy external loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("watchfiles").setLevel(logging.WARNING)


logger = logging.getLogger("tn_rr_backend")
