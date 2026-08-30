"""Agentic-workspace runtime: task registry, SSE event translation, history, purge.

Public surface used by :mod:`api.workspace` and :mod:`api.system`:

* :class:`TaskState`, :data:`SENTINEL_EVENT` — the in-memory registry (§1).
* :func:`start_task` / :func:`shutdown_all` — launch / tear down background runs.
* :func:`format_sse` — render a frame dict as an SSE wire block.
* :func:`list_task_history` — past runs from the SQLite checkpointer.
* :func:`purge_old_files` — 24 h data-retention purge (§7).
"""

from services.workspace import registry
from services.workspace.events import format_sse
from services.workspace.history import list_task_history
from services.workspace.purge import purge_old_files
from services.workspace.registry import SENTINEL_EVENT, TaskState
from services.workspace.runner import shutdown_all, start_task

__all__ = [
    "registry",
    "TaskState",
    "SENTINEL_EVENT",
    "start_task",
    "shutdown_all",
    "format_sse",
    "list_task_history",
    "purge_old_files",
]
