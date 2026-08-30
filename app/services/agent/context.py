"""Tiny helpers for reading the agent state — shared by the router and nodes.

Kept separate so ``router.py`` and ``nodes.py`` don't import each other.
"""

from __future__ import annotations

from typing import Any

_MAX_CTX_CHARS = 6000  # keep the assembled context well under the model window


def user_prompt(state: dict[str, Any]) -> str:
    """The user's task text — the most recent ``role == "user"`` message."""
    for msg in reversed(state.get("messages") or []):
        if msg.get("role") == "user":
            return str(msg.get("content", "")).strip()
    return ""


def context_block(state: dict[str, Any]) -> str:
    """Everything gathered so far (vision text, code output, tool results).

    Rendered as labelled sections for the Coder / Drafter prompt. Truncated so a
    long RAG dump can't blow the context window.
    """
    extracted = state.get("extracted_data") or {}
    if not extracted:
        return "(no additional context yet)"
    parts = [f"[{key}]\n{str(value).strip()}" for key, value in extracted.items()]
    block = "\n\n".join(parts)
    if len(block) > _MAX_CTX_CHARS:
        block = block[:_MAX_CTX_CHARS] + "\n…(truncated)"
    return block
