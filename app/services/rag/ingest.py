"""Text extraction + normalization for the RAG layer.

Turns an uploaded file into plain text ready for chunking. Supported inputs are
the §6 allowlist minus images (no OCR until the vision layer, Phase 3+):

    text/plain  .docx  application/pdf   -> extracted text
    image/png   image/jpeg              -> "" (stored, not indexed)
"""

from __future__ import annotations

import re
from pathlib import Path

from core.logging import get_logger

logger = get_logger("sentinel.rag.ingest")

MIME_TXT = "text/plain"
MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
MIME_PDF = "application/pdf"
MIME_PNG = "image/png"
MIME_JPG = "image/jpeg"

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def preprocess(text: str) -> str:
    """Strip HTML/XML tags and normalize whitespace (6_Vector_Store_&_Data.md §3)."""
    if not text:
        return ""
    return _WS_RE.sub(" ", _TAG_RE.sub(" ", text)).strip()


def _from_txt(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _from_docx(path: Path) -> str:
    from docx import Document

    doc = Document(str(path))
    return "\n".join(p.text for p in doc.paragraphs if p.text)


def _from_pdf(path: Path) -> str:
    import pdfplumber

    parts: list[str] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            parts.append(page.extract_text() or "")
    return "\n".join(parts)


def extract_text(path: Path, mime: str) -> str:
    """Best-effort plain-text extraction. Images and unknown types return ""."""
    try:
        if mime == MIME_TXT:
            return _from_txt(path)
        if mime == MIME_DOCX:
            return _from_docx(path)
        if mime == MIME_PDF:
            return _from_pdf(path)
        if mime in (MIME_PNG, MIME_JPG):
            return ""  # requires OCR (vision layer)
    except Exception as exc:  # extraction failure must not 500 the endpoint
        logger.warning("Text extraction failed for %s (%s): %s", path.name, mime, exc)
        return ""
    logger.warning("No extractor for MIME %s (%s)", mime, path.name)
    return ""
