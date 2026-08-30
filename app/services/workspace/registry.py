"""In-memory task registry (8_Decisions_2.md §1, 7_Implementation_Plan.md §Phase 5).

A process-wide ``dict[str, TaskState]`` keyed by ``task_id``. Each entry holds the
strong ``asyncio.Task`` handle **and** its streaming ``asyncio.Queue`` — keeping
the task reference alive is what stops the GC from silently killing a running
background task (§1).

State lives in process memory, so the app must run with a single uvicorn worker
(``--workers 1``); a multi-worker setup would not see another worker's tasks.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

# Terminal SSE frame the background runner pushes when a task ends (success or
# failure). The stream endpoint consumes frames until it sees this ``event``.
SENTINEL_EVENT = "complete"

TaskStatus = Literal["queued", "running", "done", "error"]


@dataclass
class TaskState:
    """One background agent run and everything needed to stream / track it."""

    task_id: str
    prompt: str
    file_path: str | None
    queue: "asyncio.Queue[dict]"
    task: "asyncio.Task | None" = None  # set immediately after create_task()
    status: TaskStatus = "queued"
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    file_id: str | None = None
    # Monotonic stamps bracketing the serialized graph execution (set by the
    # runner around ``_EXEC_LOCK``). Used to prove serialization in tests.
    exec_started_at: float | None = None
    exec_finished_at: float | None = None


_REGISTRY: dict[str, TaskState] = {}


def register(state: TaskState) -> None:
    _REGISTRY[state.task_id] = state


def get(task_id: str) -> TaskState | None:
    return _REGISTRY.get(task_id)


def pop(task_id: str) -> TaskState | None:
    """Remove an entry. Idempotent — safe to call from both cleanup paths (§1)."""
    return _REGISTRY.pop(task_id, None)


def active_ids() -> list[str]:
    return list(_REGISTRY)


def all_states() -> list[TaskState]:
    return list(_REGISTRY.values())
