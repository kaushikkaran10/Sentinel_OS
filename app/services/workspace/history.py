"""Task history, reconstructed from the LangGraph SQLite checkpointer.

``GET /api/v1/workspace/history`` (5_Api_Spec.md §1) must survive a restart, so it
reads the persistent checkpoint DB (8_Decisions_2.md §2) rather than the volatile
in-memory registry. Each LangGraph ``thread_id`` is one task (the runner uses the
``task_id`` as the thread id).
"""

from __future__ import annotations

from core.logging import get_logger
from services.agent.orchestrator import get_checkpointer

logger = get_logger("sentinel.workspace.history")


def _first_user_prompt(checkpoint: dict) -> str:
    messages = (checkpoint.get("channel_values") or {}).get("messages") or []
    for msg in messages:
        if isinstance(msg, dict) and msg.get("role") == "user":
            return str(msg.get("content", "")).strip()
    return ""


async def list_task_history() -> list[dict]:
    """All past runs, newest first: ``[{task_id, prompt, timestamp}, ...]``."""
    cp = await get_checkpointer()
    threads: dict[str, dict] = {}

    try:
        async for tup in cp.alist(None):
            cfg = (tup.config or {}).get("configurable", {})
            tid = cfg.get("thread_id")
            if not tid:
                continue
            checkpoint = tup.checkpoint or {}
            ts = checkpoint.get("ts") or ""
            entry = threads.setdefault(
                tid, {"task_id": tid, "prompt": "", "timestamp": ts}
            )
            if ts and (not entry["timestamp"] or ts < entry["timestamp"]):
                entry["timestamp"] = ts
            if not entry["prompt"]:
                prompt = _first_user_prompt(checkpoint)
                if prompt:
                    entry["prompt"] = prompt
    except (NotImplementedError, TypeError):  # pragma: no cover - alist(None) unsupported
        logger.warning("checkpointer.alist(None) unsupported — falling back to raw thread_id scan")
        return await _fallback_thread_ids(cp)

    return sorted(threads.values(), key=lambda e: e["timestamp"], reverse=True)


async def _fallback_thread_ids(cp) -> list[dict]:  # pragma: no cover
    """Last resort: distinct thread ids straight from the checkpoints table."""
    conn = getattr(cp, "conn", None)
    if conn is None:
        return []
    rows = await (await conn.execute("SELECT DISTINCT thread_id FROM checkpoints")).fetchall()
    return [{"task_id": r[0], "prompt": "", "timestamp": ""} for r in rows]
