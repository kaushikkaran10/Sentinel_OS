"""LangGraph orchestrator — state, checkpointer, graph assembly (Phase 4).

Implements 7_Implementation_Plan.md §Phase 4:

1. ``AgentState`` — the ``TypedDict`` state (4_Agent_Logic_&_Tools.md §1).
2. ``get_checkpointer`` — an **SQLite** checkpointer at ``data/langgraph.sqlite``
   (8_Decisions_2.md §2), so ``GET /workspace/history`` survives a restart.
3. Router logic — see :mod:`services.agent.router`.
4. Node wiring — Router -> (vision | coder | drafter) -> tool_execution <-> drafter
   -> finalize. Degraded Mode adds **no** routing bypass (§8).
5. Tool Execution — prompted JSON + Pydantic, not ``.bind_tools()`` (§3);
   see :mod:`services.agent.tools`.
6. ``build_graph`` compiles it.

Everything downstream is async — the LLM interface (§9), the tools (offloaded via
``run_in_threadpool``) and FastAPI itself — so the nodes are ``async def`` and the
checkpointer is :class:`AsyncSqliteSaver` (needs ``aiosqlite``). Phase 5 owns the
HTTP surface, streaming and the in-memory task registry; this module stops at a
compiled graph that ``verify_phase4`` can drive with ``ainvoke``.
"""

from __future__ import annotations

import asyncio
import operator
from pathlib import Path
from typing import Annotated, Any, TypedDict

import aiosqlite
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import END, START, StateGraph

from core.config import UPLOADS_DIR, settings
from core.logging import get_logger
from services.agent.nodes import (
    MAX_TOOL_ITERATIONS,
    coder_node,
    drafter_node,
    finalize_node,
    tool_execution_node,
    vision_node,
)
from services.agent.router import router, select_branch

logger = get_logger("sentinel.agent.orchestrator")

# Backstop for the drafter <-> tool_execution cycle (the per-run cap in
# nodes.MAX_TOOL_ITERATIONS is the primary guard). Comfortably above the worst
# case: router + 1 + 2*MAX node visits + finalize.
RECURSION_LIMIT = 50


def _merge_dict(left: dict | None, right: dict | None) -> dict:
    """Reducer for ``extracted_data`` — later keys win, nothing is dropped."""
    return {**(left or {}), **(right or {})}


class AgentState(TypedDict, total=False):
    """State passed between nodes (4_Agent_Logic_&_Tools.md §1 + control fields)."""

    # ── spec §1 ──────────────────────────────────────────────────────────────
    messages: Annotated[list[dict], operator.add]
    file_path: str | None
    task_type: str | None
    extracted_data: Annotated[dict, _merge_dict]
    final_deliverable_path: str | None
    # ── control ─────────────────────────────────────────────────────────────
    pending_tool_call: dict | None
    iterations: Annotated[int, operator.add]


def decide_next(state: dict[str, Any]) -> str:
    """Conditional edge out of ``drafter``: loop through a tool, or finish."""
    if state.get("pending_tool_call") and state.get("iterations", 0) < MAX_TOOL_ITERATIONS:
        return "tool_execution"
    return "finalize"


# ── SQLite checkpointer (8_Decisions_2.md §2) ───────────────────────────────
_cp_lock = asyncio.Lock()
_checkpointer: AsyncSqliteSaver | None = None


async def get_checkpointer() -> AsyncSqliteSaver:
    """Lazy process-wide ``AsyncSqliteSaver`` over ``settings.LANGGRAPH_DB``.

    Constructed once and reused (single uvicorn worker, one event loop).
    ``build_graph`` takes the checkpointer as an argument, so tests can pass a
    throwaway saver instead of touching this singleton.
    """
    global _checkpointer
    if _checkpointer is None:
        async with _cp_lock:
            if _checkpointer is None:
                settings.LANGGRAPH_DB.parent.mkdir(parents=True, exist_ok=True)
                conn = await aiosqlite.connect(str(settings.LANGGRAPH_DB))
                saver = AsyncSqliteSaver(conn)
                await saver.setup()
                logger.info("LangGraph SQLite checkpointer ready at %s", settings.LANGGRAPH_DB)
                _checkpointer = saver
    return _checkpointer


async def close_checkpointer() -> None:
    """Close the process-wide checkpointer connection (app shutdown). Idempotent.

    Also drops the cached compiled graph, which is bound to this connection — a
    later ``get_agent()`` (e.g. a second ``TestClient`` context) rebuilds both.
    """
    global _checkpointer, _agent
    if _checkpointer is not None:
        async with _cp_lock:
            if _checkpointer is not None:
                try:
                    await _checkpointer.conn.close()
                except Exception:  # noqa: BLE001 - best-effort teardown
                    logger.warning("checkpointer connection close failed", exc_info=True)
                _checkpointer = None
    _agent = None


async def build_graph(checkpointer: Any | None = None):
    """Assemble and compile the workflow. ``checkpointer=None`` → the SQLite one."""
    graph = StateGraph(AgentState)

    graph.add_node("router", router)
    graph.add_node("vision", vision_node)
    graph.add_node("coder", coder_node)
    graph.add_node("drafter", drafter_node)
    graph.add_node("tool_execution", tool_execution_node)
    graph.add_node("finalize", finalize_node)

    graph.add_edge(START, "router")
    graph.add_conditional_edges(
        "router",
        select_branch,
        {"vision": "vision", "coder": "coder", "drafter": "drafter"},
    )
    graph.add_edge("vision", "drafter")
    graph.add_edge("coder", "tool_execution")
    graph.add_conditional_edges(
        "drafter",
        decide_next,
        {"tool_execution": "tool_execution", "finalize": "finalize"},
    )
    graph.add_edge("tool_execution", "drafter")
    graph.add_edge("finalize", END)

    saver = checkpointer if checkpointer is not None else await get_checkpointer()
    return graph.compile(checkpointer=saver)


_agent_lock = asyncio.Lock()
_agent = None


async def get_agent():
    """The compiled graph for application use (Phase 5 wires it to the API)."""
    global _agent
    if _agent is None:
        async with _agent_lock:
            if _agent is None:
                _agent = await build_graph()
    return _agent


def run_config(thread_id: str) -> dict[str, Any]:
    """Standard invocation config: checkpoint thread id + recursion backstop."""
    return {"configurable": {"thread_id": thread_id}, "recursion_limit": RECURSION_LIMIT}


def new_state(prompt: str, file_path: str | None = None) -> dict[str, Any]:
    """Seed an ``AgentState`` from a user prompt (+ optional uploaded file)."""
    extracted: dict[str, Any] = {}
    target_path = file_path

    # If no file was explicitly uploaded, check if the prompt mentions local datasets or reports
    if not target_path:
        prompt_lower = prompt.lower()
        if any(k in prompt_lower for k in ("oil", "gasoline", "crude", "distillation", "yield", "dataset")):
            for name in ("oil.csv", "crude_distillation_yields.csv", "wood_gasoline_yield_dataset.txt"):
                candidate = UPLOADS_DIR / name
                if candidate.exists():
                    target_path = str(candidate)
                    break
        elif any(k in prompt_lower for k in ("pump", "p-1042", "abnormality", "condition monitoring", "cooling water")):
            candidate = UPLOADS_DIR / "pump_condition_monitoring_report.txt"
            if candidate.exists():
                target_path = str(candidate)

    # Read text/csv/pdf/docx content directly into context so the agent has immediate access
    if target_path and Path(target_path).exists():
        p = Path(target_path)
        suffix = p.suffix.lower()
        if suffix in (".csv", ".txt", ".json"):
            try:
                extracted[p.name] = p.read_text(encoding="utf-8", errors="replace")[:8000]
            except Exception as exc:
                logger.warning("Could not pre-read %s: %s", p.name, exc)
        elif suffix == ".pdf":
            try:
                import pdfplumber
                parts = []
                with pdfplumber.open(str(p)) as pdf:
                    for page in pdf.pages:
                        txt = page.extract_text()
                        if txt:
                            parts.append(txt)
                if parts:
                    extracted[p.name] = "\n".join(parts)[:8000]
            except Exception as exc:
                logger.warning("Could not pre-read PDF %s: %s", p.name, exc)
        elif suffix == ".docx":
            try:
                from docx import Document
                doc = Document(str(p))
                extracted[p.name] = "\n".join(para.text for para in doc.paragraphs if para.text)[:8000]
            except Exception as exc:
                logger.warning("Could not pre-read DOCX %s: %s", p.name, exc)

    return {
        "messages": [{"role": "user", "content": prompt}],
        "file_path": target_path,
        "task_type": None,
        "extracted_data": extracted,
        "final_deliverable_path": None,
        "pending_tool_call": None,
        "iterations": 0,
    }
