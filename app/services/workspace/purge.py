"""Manual data-retention purge (8_Decisions_2.md §7).

``DELETE /api/v1/system/purge`` removes files in ``data/uploads/`` and
``data/generated/`` older than 24 hours. It touches **physical files only** — the
LangGraph SQLite checkpoint records are intentionally left as an orphaned
historical log (accepted MVP gap, §7). ChromaDB, the embedding model cache and
``.gitkeep`` markers are never touched.
"""

from __future__ import annotations

import time
from pathlib import Path

from core.config import GENERATED_DIR, UPLOADS_DIR
from core.logging import get_logger

logger = get_logger("sentinel.workspace.purge")

_PROTECTED_NAMES = {".gitkeep"}


def purge_old_files(max_age_hours: int = 24) -> dict:
    """Delete regular files older than ``max_age_hours`` in the two data dirs."""
    cutoff = time.time() - max_age_hours * 3600
    deleted = 0
    freed_bytes = 0

    for directory in (UPLOADS_DIR, GENERATED_DIR):
        if not directory.exists():
            continue
        for path in directory.iterdir():
            if not path.is_file() or path.name in _PROTECTED_NAMES:
                continue
            try:
                stat = path.stat()
            except OSError:  # pragma: no cover - race with another deleter
                continue
            if stat.st_mtime >= cutoff:
                continue
            try:
                path.unlink()
            except OSError as exc:  # pragma: no cover
                logger.warning("purge: could not remove %s: %s", path, exc)
                continue
            deleted += 1
            freed_bytes += stat.st_size

    logger.info("purge: removed %d file(s), freed %d bytes", deleted, freed_bytes)
    return {"deleted": deleted, "freed_bytes": freed_bytes}
