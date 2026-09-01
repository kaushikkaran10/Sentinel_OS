"""Tool registry + dispatch for the Tool Execution Node.

The four fixed MVP tools (CLAUDE.md) are **real** Phase 2 implementations — this
module only routes to them, validates the LLM-supplied arguments with the Pydantic
models from :mod:`services.agent.schemas`, and offloads the blocking call to a
worker thread (``python-docx`` / ``openpyxl`` / the Docker SDK all do real IO).

``run_tool`` never raises: a bad tool name, bad arguments, or an exception inside
the tool all come back as a ``"Tool error: ..."`` string. The agent must keep
going and let the Draft node explain the failure to the user (8_Decisions_2.md §8).
"""

from __future__ import annotations

from typing import Any, Callable

from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ValidationError

from core.logging import get_logger
from services.agent.schemas import (
    ApprovalNoteArgs,
    MetricsSheetArgs,
    QueryArgs,
    SandboxArgs,
)
from services.rag.vector_db import query_local_knowledge
from services.tools.code_sandbox import execute_sandbox_code
from services.tools.file_maker import generate_approval_note, generate_metrics_sheet

logger = get_logger("sentinel.agent.tools")

# name -> (real callable, argument model)
TOOLS: dict[str, tuple[Callable[..., str], type[BaseModel]]] = {
    "query_local_knowledge": (query_local_knowledge, QueryArgs),
    "execute_sandbox_code": (execute_sandbox_code, SandboxArgs),
    "generate_approval_note": (generate_approval_note, ApprovalNoteArgs),
    "generate_metrics_sheet": (generate_metrics_sheet, MetricsSheetArgs),
}

_DELIVERABLE_TOOLS = frozenset({"generate_approval_note", "generate_metrics_sheet"})

TOOL_ERROR_PREFIX = "Tool error:"


def is_deliverable_tool(name: str) -> bool:
    """True for the two tools that write a downloadable file to ``data/generated/``."""
    return name in _DELIVERABLE_TOOLS


async def run_tool(name: str, args: dict[str, Any] | None) -> str:
    """Validate ``args`` and run tool ``name`` off the event loop. Never raises."""
    entry = TOOLS.get(name)
    if entry is None:
        logger.warning("Agent requested unknown tool %r", name)
        return f"{TOOL_ERROR_PREFIX} unknown tool {name!r}"

    fn, arg_model = entry
    try:
        validated = arg_model.model_validate(args or {})
    except ValidationError as exc:
        # Fallback: for generate_metrics_sheet, try to find any list of dicts in the args
        if name == "generate_metrics_sheet" and args:
            recovered = _recover_metrics_data(args)
            if recovered:
                try:
                    validated = arg_model.model_validate({"data": recovered})
                except ValidationError:
                    pass
                else:
                    logger.info("Recovered %d rows for generate_metrics_sheet from malformed args", len(recovered))
                    # fall through to run the tool
                    result = await run_in_threadpool(fn, **validated.model_dump())
                    return str(result)
        logger.warning("Invalid args for tool %s: %s", name, exc)
        return f"{TOOL_ERROR_PREFIX} invalid arguments for {name}: {exc.error_count()} error(s)"

    try:
        result = await run_in_threadpool(fn, **validated.model_dump())
    except Exception as exc:  # noqa: BLE001 - the graph must survive any tool blow-up
        logger.exception("Tool %s raised", name)
        return f"{TOOL_ERROR_PREFIX} {name} failed: {type(exc).__name__}: {exc}"

    return str(result)


def _recover_metrics_data(args: dict) -> list[dict] | None:
    """Recursively search args for any list of dicts to use as spreadsheet rows."""
    # Direct list at any key
    for val in args.values():
        if isinstance(val, list) and val and isinstance(val[0], dict):
            return val
    # Nested dict containing a list
    for val in args.values():
        if isinstance(val, dict):
            found = _recover_metrics_data(val)
            if found:
                return found
    return None
