"""Router node + branch selector (4_Agent_Logic_&_Tools.md §2).

Two-stage classification:

1. Deterministic pre-check — an image / photo file goes straight to the Vision
   branch with no LLM call.
2. Otherwise one LLM call (general model, "orchestration" role per
   2_Tech_Stack.md §2) returns ``{"task_type": ...}`` as prompted JSON; a parse
   or backend failure falls back to ``draft`` (the safe natural-language path).

``select_branch`` is a pure function of ``task_type`` and **never** consults
``runtime.docker_available`` — Degraded Mode must not add a routing bypass
(8_Decisions_2.md §8); the sandbox tool itself returns the hardcoded error and
the Draft node explains it.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from core.logging import get_logger
from services.agent.context import user_prompt
from services.agent.prompts import ROUTER_SYSTEM
from services.agent.schemas import RouterDecision
from services.agent.structured import StructuredOutputError, parse_as
from services.llm.client import LLMBackendError, call_with_backoff, get_llm_client

logger = get_logger("sentinel.agent.router")

_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg"}
# Unambiguously non-visual inputs — the Vision node must never receive these,
# whatever the LLM classifier says (it sometimes mislabels a text analysis task
# as "vision", and vision_node then feeds the text file to an image endpoint).
_TEXTUAL_SUFFIXES = {".txt", ".csv", ".json", ".md", ".log", ".tsv", ".docx", ".xlsx"}
_SCANNED_HINT = re.compile(r"\b(scan|scanned|photo|photograph|image|ocr|screenshot)\b", re.I)

# task_type (spec §1 vocabulary) -> graph node name
_BRANCH = {"vision": "vision", "code": "coder", "draft": "drafter"}


async def router(state: dict[str, Any]) -> dict[str, Any]:
    """Classify the task, write ``task_type`` into the state."""
    file_path = state.get("file_path")
    prompt = user_prompt(state)
    suffix = Path(file_path).suffix.lower() if file_path else ""

    if suffix in _IMAGE_SUFFIXES or (suffix == ".pdf" and _SCANNED_HINT.search(prompt)):
        return _decided("vision", f"file {suffix or 'n/a'} needs visual extraction")

    try:
        raw = await call_with_backoff(
            lambda: get_llm_client().draft(prompt, system=ROUTER_SYSTEM), label="router"
        )
        task_type = parse_as(RouterDecision, raw).task_type
    except StructuredOutputError as exc:
        logger.warning("Router could not parse a decision (%s) — defaulting to draft", exc)
        task_type = "draft"
    except LLMBackendError as exc:
        logger.warning("Router LLM call failed (%s) — defaulting to draft", exc)
        task_type = "draft"

    # Hard override: the Vision node only handles images / scanned PDFs. A text
    # file (or no file at all) must never reach it, whatever the classifier said.
    if task_type == "vision" and (not file_path or suffix in _TEXTUAL_SUFFIXES):
        logger.warning(
            "Router LLM returned 'vision' for a non-visual input (%s) — overriding to 'draft'",
            suffix or "no file",
        )
        return _decided("draft", "llm said vision but input is not visual — overridden")

    return _decided(task_type, "llm classification")


def select_branch(state: dict[str, Any]) -> str:
    """Map ``task_type`` to the next node. Pure — no Degraded-Mode special-casing."""
    return _BRANCH.get(state.get("task_type") or "", "drafter")


def _decided(task_type: str, reason: str) -> dict[str, Any]:
    return {
        "task_type": task_type,
        "messages": [
            {"role": "assistant", "name": "router", "content": f"[router] {task_type} ({reason})"}
        ],
    }
