"""Prompted-JSON parsing helpers (8_Decisions_2.md §3).

Small local models wrap their JSON in prose, fence it in ```` ```json ````,
or add a trailing comment. These helpers pull the payload back out and validate
it against a Pydantic model, raising a single catchable
:class:`StructuredOutputError` on any failure so nodes can apply a deterministic
fallback instead of crashing the graph.
"""

from __future__ import annotations

from typing import TypeVar

from pydantic import BaseModel, ValidationError

from core.logging import get_logger

logger = get_logger("sentinel.agent.structured")

M = TypeVar("M", bound=BaseModel)


class StructuredOutputError(ValueError):
    """The model's reply could not be parsed/validated into the expected schema."""


def _strip_fences(text: str) -> str:
    """Drop a single leading/trailing Markdown code fence if present."""
    s = text.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[1] if "\n" in s else s[3:]
        # first line may have been ```json / ```python — already removed above
        if s.rstrip().endswith("```"):
            s = s.rstrip()[:-3]
    return s.strip()


def _first_balanced_span(text: str, open_ch: str, close_ch: str) -> str | None:
    """Return the first ``open_ch ... close_ch`` balanced span, string-aware."""
    start = text.find(open_ch)
    if start == -1:
        return None
    depth = 0
    in_str = False
    esc = False
    quote = ""
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                in_str = False
            continue
        if ch in ('"', "'"):
            in_str = True
            quote = ch
        elif ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def extract_json_block(text: str) -> str:
    """Best-effort isolation of a JSON object from a chatty LLM reply."""
    if not text or not text.strip():
        raise StructuredOutputError("empty model response")
    candidate = _strip_fences(text)
    span = _first_balanced_span(candidate, "{", "}")
    if span is None:
        span = _first_balanced_span(text, "{", "}")
    if span is None:
        raise StructuredOutputError(f"no JSON object found in: {text[:200]!r}")
    return span


def extract_code_block(text: str) -> str:
    """Pull a Python snippet out of an LLM reply.

    Prefers a fenced block (```` ```python ... ``` ````); falls back to the whole
    reply stripped of a bare fence. Used by the Coder node.
    """
    if not text:
        return ""
    if "```" in text:
        after = text.split("```", 1)[1]
        # optional language tag on the same line as the opening fence
        if "\n" in after:
            first_line, rest = after.split("\n", 1)
            if first_line.strip().lower() in ("python", "py", ""):
                after = rest
        return after.split("```", 1)[0].strip()
    return text.strip()


def parse_as(model: type[M], text: str) -> M:
    """Extract JSON from ``text`` and validate it against ``model``.

    Raises :class:`StructuredOutputError` (only) on extraction or validation
    failure.
    """
    block = extract_json_block(text)
    try:
        return model.model_validate_json(block)
    except ValidationError as exc:
        logger.debug("structured parse failed for %s: %s", model.__name__, exc)
        raise StructuredOutputError(
            f"{model.__name__} validation failed: {exc.error_count()} error(s)"
        ) from exc
