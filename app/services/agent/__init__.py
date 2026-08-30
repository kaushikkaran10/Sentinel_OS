"""LangGraph state machine, nodes, and router logic (Phase 4).

Public surface:

* :class:`AgentState`      — the ``TypedDict`` state (4_Agent_Logic_&_Tools.md §1).
* :func:`build_graph`      — assemble + compile the workflow (takes a checkpointer).
* :func:`get_agent`        — the cached compiled graph for app use.
* :func:`get_checkpointer` — the SQLite checkpointer at ``data/langgraph.sqlite``.
* :func:`new_state` / :func:`run_config` — helpers to drive an invocation.
"""

from services.agent.orchestrator import (
    AgentState,
    build_graph,
    decide_next,
    get_agent,
    get_checkpointer,
    new_state,
    run_config,
)

__all__ = [
    "AgentState",
    "build_graph",
    "decide_next",
    "get_agent",
    "get_checkpointer",
    "new_state",
    "run_config",
]
