"""Logging setup. One consistent format for the whole app."""

from __future__ import annotations

import logging
import sys

from core.config import settings

_LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

_configured = False


def configure_logging() -> None:
    """Attach a single stdout handler to the root logger. Idempotent."""
    global _configured
    if _configured:
        return

    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    # Windows consoles often default to cp1252; keep non-ASCII log text readable.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        pass

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(fmt=_LOG_FORMAT, datefmt=_DATE_FORMAT))

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    # uvicorn ships its own handlers; let them propagate to ours instead.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        lg.propagate = True

    # Third-party libs are chatty at INFO (httpx logs every Ollama probe).
    for name in ("httpx", "httpcore", "urllib3", "docker", "watchfiles"):
        logging.getLogger(name).setLevel(logging.WARNING)

    # RAG stack: quiet the routine noise. We deliberately tokenize whole
    # documents before windowing them, which trips a benign length warning.
    for name in ("sentence_transformers", "chromadb", "transformers"):
        logging.getLogger(name).setLevel(logging.WARNING)
    logging.getLogger("transformers.tokenization_utils_base").setLevel(logging.ERROR)

    _configured = True


def get_logger(name: str) -> logging.Logger:
    """Return a module logger. Call ``configure_logging()`` once at startup first."""
    return logging.getLogger(name)


def log_critical(message: str) -> None:
    """Emit a CRITICAL line — used for Degraded Mode and dependency failures."""
    logging.getLogger("sentinel.core").critical(message)
