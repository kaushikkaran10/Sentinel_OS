"""Execution + tool nodes for the LangGraph workflow (4_Agent_Logic_&_Tools.md §2).

Flow:  Router -> (vision | coder | drafter) -> tool_execution <-> drafter -> finalize

* ``vision_node``  — Qwen-VL: transcribe an image / scanned PDF into ``extracted_data``.
* ``coder_node``   — Qwen-Coder: write a Python script, queue it for the sandbox.
* ``drafter_node`` — Llama-3.1: decide (prompted JSON) to call a tool or finish.
* ``tool_execution_node`` — run the queued tool for real; capture the result.
* ``finalize_node`` — guarantee a downloadable deliverable exists, then END.

Every node returns a *partial* state update; the reducers on ``AgentState`` merge
``messages`` (append), ``extracted_data`` (dict-merge) and ``iterations`` (sum).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi.concurrency import run_in_threadpool

from core.logging import get_logger
from services.agent.context import context_block, user_prompt
from services.agent.prompts import (
    CODER_SYSTEM,
    DRAFTER_RETRY_SUFFIX,
    DRAFTER_SYSTEM,
    VISION_SYSTEM,
)
from services.agent.schemas import AgentDecision
from services.agent.structured import (
    StructuredOutputError,
    extract_code_block,
    parse_as,
)
from services.agent.tools import TOOL_ERROR_PREFIX, is_deliverable_tool, run_tool
from services.llm.client import LLMBackendError, call_with_backoff, get_llm_client
from services.tools.file_maker import generate_approval_note

logger = get_logger("sentinel.agent.nodes")

# Cap on the drafter <-> tool_execution cycle. §3: a hallucinating small model
# must not spin forever. Counts every tool_execution visit (the coder's sandbox
# run included). The compiled graph also carries a recursion_limit backstop.
MAX_TOOL_ITERATIONS = 6


async def vision_node(state: dict[str, Any]) -> dict[str, Any]:
    """Qwen-VL — parse the uploaded image / scanned PDF, then hand off to drafter."""
    file_path = state.get("file_path")
    prompt = user_prompt(state) or "Transcribe everything in this document."
    if not file_path or not Path(file_path).exists():
        text = "[vision] no readable file was provided."
    else:
        try:
            text = await get_llm_client().vision(prompt, images=[file_path], system=VISION_SYSTEM)
        except LLMBackendError as exc:
            logger.warning("Vision call failed: %s", exc)
            text = f"[vision] extraction unavailable: {exc}"
    return {
        "extracted_data": {"vision": text},
        "messages": [{"role": "assistant", "name": "vision", "content": text}],
    }


async def coder_node(state: dict[str, Any]) -> dict[str, Any]:
    """Qwen-Coder — write one Python script and queue it for the sandbox."""
    prompt = user_prompt(state)
    ask = f"Context:\n{context_block(state)}\n\nTask: {prompt}"
    try:
        raw = await get_llm_client().code(ask, system=CODER_SYSTEM)
    except LLMBackendError as exc:
        logger.warning("Coder call failed: %s", exc)
        raw = ""
    code = extract_code_block(raw) or "print('coder produced no script')"
    return {
        "pending_tool_call": {"tool": "execute_sandbox_code", "args": {"python_code": code}},
        "extracted_data": {"coder_script": code},
        "messages": [{"role": "assistant", "name": "coder", "content": raw or "(no output)"}],
    }


async def _decide(ask: str) -> tuple[AgentDecision | None, str]:
    """One drafter LLM round, with a single hardened retry.

    Returns ``(decision, last_raw)``. ``decision is None`` means both the first
    call and the "JSON only, no native tools" retry failed (a parse failure, or
    a provider rejecting a spontaneous native tool-call — see prompts.py).
    """
    llm = get_llm_client()
    last_raw = ""
    for system, label in ((DRAFTER_SYSTEM, "initial"), (DRAFTER_SYSTEM + DRAFTER_RETRY_SUFFIX, "retry")):
        try:
            last_raw = await call_with_backoff(
                lambda s=system: llm.draft(ask, system=s), label=f"drafter {label}"
            )
            return parse_as(AgentDecision, last_raw), last_raw
        except (StructuredOutputError, LLMBackendError) as exc:
            if label == "initial":
                logger.warning("Drafter %s reply unusable (%s) — retrying with hardened prompt", label, exc)
            else:
                logger.warning("Drafter retry also unusable (%s) — finishing with best-effort text", exc)
    return None, last_raw


async def drafter_node(state: dict[str, Any]) -> dict[str, Any]:
    """Llama-3.1 — decide via prompted JSON: call a tool, or finish."""
    iterations = state.get("iterations", 0)
    prompt = user_prompt(state)
    ask = f"Context so far:\n{context_block(state)}\n\nUser request: {prompt}"

    decision, raw = await _decide(ask)
    if decision is None:
        answer = raw.strip() or "Unable to complete the request automatically (the model did not return a usable decision)."
        return {
            "pending_tool_call": None,
            "messages": [{"role": "assistant", "name": "drafter", "content": answer}],
        }

    if decision.action == "tool" and iterations < MAX_TOOL_ITERATIONS:
        # Stop-early guard: a downloadable deliverable already exists and the
        # model wants to generate another one. Small models loop here instead of
        # returning action:"final" after a successful tool result — finish now
        # with the deliverable we have rather than regenerating it.
        if state.get("final_deliverable_path") and is_deliverable_tool(decision.tool or ""):
            answer = (decision.answer or "").strip() or (
                "The requested document has been generated; finishing with it."
            )
            logger.info("drafter: deliverable already produced — not re-calling %s", decision.tool)
            return {
                "pending_tool_call": None,
                "messages": [{"role": "assistant", "name": "drafter", "content": answer}],
            }
        return {
            "pending_tool_call": {"tool": decision.tool, "args": decision.args},
            "messages": [
                {
                    "role": "assistant",
                    "name": "drafter",
                    "content": f"[tool call] {decision.tool} {decision.args}",
                }
            ],
        }

    # action == "final", or the loop cap has been reached.
    answer = decision.answer or "Task complete."
    if decision.action == "tool":
        answer = (
            f"{answer}\n\n(Stopped after {MAX_TOOL_ITERATIONS} tool steps to avoid a loop.)"
            if decision.answer
            else f"Reached the {MAX_TOOL_ITERATIONS}-step tool limit; finishing with the results gathered so far."
        )
    return {
        "pending_tool_call": None,
        "messages": [{"role": "assistant", "name": "drafter", "content": answer}],
    }


async def tool_execution_node(state: dict[str, Any]) -> dict[str, Any]:
    """Run the queued tool for real and fold its result back into the state."""
    call = state.get("pending_tool_call") or {}
    name = str(call.get("tool", ""))
    args = call.get("args", {})

    result = await run_tool(name, args)

    update: dict[str, Any] = {
        "pending_tool_call": None,
        "iterations": 1,
        "extracted_data": {name or "tool": result},
        "messages": [{"role": "tool", "name": name, "content": result}],
    }

    if is_deliverable_tool(name) and not result.startswith(TOOL_ERROR_PREFIX):
        path = Path(result)
        if path.exists():
            update["final_deliverable_path"] = str(path)
        else:
            logger.warning("%s returned a path that does not exist: %s", name, result)

    return update


async def finalize_node(state: dict[str, Any]) -> dict[str, Any]:
    """Guarantee a deliverable file exists before the graph ends.

    3_Architecture.md: the API response always returns a download URL. If the
    agent finished without producing one, write an approval note from the
    accumulated summary as a safety net with structured metrics.
    """
    if state.get("final_deliverable_path"):
        return {}

    summary = _summary_text(state)
    metrics = _extract_metrics_for_summary(summary, state)
    path = await run_in_threadpool(generate_approval_note, summary, metrics)
    logger.info("finalize: safety-net deliverable written -> %s", path)
    return {
        "final_deliverable_path": path,
        "messages": [{"role": "assistant", "name": "finalize", "content": f"Deliverable: {path}"}],
    }


def _extract_metrics_for_summary(summary: str, state: dict[str, Any]) -> dict[str, Any]:
    """Honest placeholder metrics for the finalize safety-net.

    This runs ONLY when the agent did not produce its own deliverable — i.e. the
    drafter loop failed or was cut short. It must NOT fabricate domain numbers:
    an earlier version returned canned P-1042 / oil.csv / OSHA constants here
    that read as though they had been computed from the uploaded file. Emit a
    clearly-labelled placeholder instead so no reader mistakes it for real data.
    """
    source = Path(state["file_path"]).name if state.get("file_path") else "none provided"
    return {
        "note": (
            "PLACEHOLDER — automated analysis did not complete. The metrics that "
            "would normally appear here could NOT be computed from the provided "
            "input and are not available. Do not treat any figure in this note "
            "as a measured or calculated value."
        ),
        "task_type": state.get("task_type") or "unclassified",
        "source_file": source,
        "status": "incomplete — needs re-run or manual review of the source data",
    }


def _summary_text(state: dict[str, Any]) -> str:
    """Best available prose summary — last drafter answer, else the user prompt."""
    for msg in reversed(state.get("messages") or []):
        if msg.get("role") == "assistant" and msg.get("name") == "drafter":
            content = str(msg.get("content", "")).strip()
            if content and not content.startswith("[tool call]"):
                return content
    return user_prompt(state) or "Automated task completed."
