"""Translate LangGraph node updates into SSE event frames (5_Api_Spec.md §1).

The background runner drives ``graph.astream(state, cfg, stream_mode="updates")``,
which yields ``{node_name: partial_state_update}`` chunks. :func:`translate` maps
each chunk to zero or more frame dicts ``{"event": <name>, "data": {...}}`` using
the event vocabulary from 5_Api_Spec.md §1:

    thought      — router / coder / finalize internal planning lines
    tool_call    — vision OCR, RAG lookup, sandbox run, file generation
    token        — draft text generation (see the note on ``chunk_tokens`` below)
    deliverable  — download URL + file metadata (emitted by the runner, not here)

``token`` note: the mandated LLM interface (8_Decisions_2.md §9) is
``async def generate(...) -> str`` — it returns a whole string, so there are no
real token deltas to stream. The drafter's final answer is therefore split into
small word-chunks and emitted as sequential ``token`` frames so a UI can still
animate the draft. Documented deviation.
"""

from __future__ import annotations

import re
from typing import Any, Iterator

EVENT_THOUGHT = "thought"
EVENT_TOOL_CALL = "tool_call"
EVENT_TOKEN = "token"
EVENT_DELIVERABLE = "deliverable"
EVENT_COMPLETE = "complete"

_PREVIEW_CHARS = 300
_TOOL_ERROR_PREFIX = "Tool error:"  # matches services.agent.tools.TOOL_ERROR_PREFIX


def _preview(value: Any, limit: int = _PREVIEW_CHARS) -> str:
    text = str(value).strip().replace("\r\n", "\n")
    return text if len(text) <= limit else text[:limit] + "…"


def chunk_tokens(text: str, words_per_chunk: int = 6) -> list[str]:
    """Split ``text`` into chunks of ~``words_per_chunk`` words, whitespace-preserving.

    ``"".join(chunk_tokens(t)) == t`` for any ``t`` — the chunks carry their own
    surrounding whitespace so the client can concatenate them verbatim.
    """
    if not text:
        return []
    pieces = re.findall(r"\s*\S+\s*", text)
    if not pieces:  # text was all whitespace
        return [text]
    return [
        "".join(pieces[i : i + words_per_chunk])
        for i in range(0, len(pieces), words_per_chunk)
    ]


def _last_message(update: dict[str, Any]) -> dict[str, Any] | None:
    msgs = update.get("messages") or []
    return msgs[-1] if msgs else None


def _translate_node(node: str, update: dict[str, Any]) -> Iterator[dict[str, Any]]:
    msg = _last_message(update)
    content = str((msg or {}).get("content", "")).strip()

    if node == "router":
        yield {
            "event": EVENT_THOUGHT,
            "data": {"node": "router", "task_type": update.get("task_type"), "message": content},
        }
        return

    if node == "vision":
        yield {
            "event": EVENT_TOOL_CALL,
            "data": {"tool": "vision_ocr", "status": "done", "preview": _preview(content)},
        }
        return

    if node == "coder":
        script = (update.get("extracted_data") or {}).get("coder_script", "")
        yield {
            "event": EVENT_THOUGHT,
            "data": {"node": "coder", "message": "wrote a script for the sandbox",
                     "preview": _preview(script)},
        }
        return

    if node == "drafter":
        if update.get("pending_tool_call"):
            yield {
                "event": EVENT_THOUGHT,
                "data": {"node": "drafter", "message": content or "planning a tool call"},
            }
        else:
            for piece in chunk_tokens(content) or [content]:
                if piece:
                    yield {"event": EVENT_TOKEN, "data": {"text": piece}}
        return

    if node == "tool_execution":
        name = str((msg or {}).get("name", "") or "tool")
        ok = not content.startswith(_TOOL_ERROR_PREFIX)
        yield {
            "event": EVENT_TOOL_CALL,
            "data": {"tool": name, "ok": ok, "preview": _preview(content)},
        }
        return

    if node == "finalize":
        yield {
            "event": EVENT_THOUGHT,
            "data": {"node": "finalize", "message": content or "finalising the deliverable"},
        }
        return

    # Unknown node — surface it rather than silently dropping.
    yield {"event": EVENT_THOUGHT, "data": {"node": node, "message": content}}


def translate(chunk: dict[str, Any]) -> list[dict[str, Any]]:
    """Map one ``stream_mode="updates"`` chunk to a list of SSE frame dicts."""
    frames: list[dict[str, Any]] = []
    for node, update in (chunk or {}).items():
        if isinstance(update, dict):
            frames.extend(_translate_node(node, update))
    return frames


def format_sse(frame: dict[str, Any]) -> str:
    """Render a frame dict as an SSE wire block: ``event: <name>\\ndata: <json>\\n\\n``."""
    import json

    return f"event: {frame['event']}\ndata: {json.dumps(frame.get('data', {}), ensure_ascii=False)}\n\n"
