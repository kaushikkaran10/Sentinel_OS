"""Background task runner — launches a LangGraph run and streams its events.

7_Implementation_Plan.md §Phase 5 items 2, 4, 5 + 8_Decisions_2.md §1:

* ``start_task`` mints a ``task_id``, creates the ``asyncio.Queue`` and the
  ``asyncio.Task`` **immediately** (never fire-and-forget the handle — §1), and
  registers both. It does not wait for anything.
* ``_run`` drives ``graph.astream(..., stream_mode="updates")``, translating each
  node update into SSE frames pushed onto the queue, then a ``deliverable`` frame
  and finally the ``complete`` sentinel (exactly once, on success **or** error).
* Graph execution is serialized by ``_EXEC_LOCK`` so only one run touches the
  shared compiled graph / single ``aiosqlite`` checkpointer connection at a time
  (defensive hardening — see PROGRESS.md; not required by spec). Tasks are still
  accepted and queued instantly; a second run just waits its turn.
* Cleanup: the task's ``done_callback`` pops the registry entry, covering the
  "client disconnected / never connected" case. The stream endpoint also pops in
  its ``finally``. Both are idempotent. Neither touches SQLite or generated files.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from pathlib import Path

from core.config import settings
from core.logging import get_logger
from services.agent import get_agent, new_state, run_config
from services.workspace import registry
from services.workspace.events import EVENT_COMPLETE, EVENT_DELIVERABLE, EVENT_THOUGHT, translate
from services.workspace.registry import TaskState

logger = get_logger("sentinel.workspace.runner")

# Serializes actual graph execution across concurrently-accepted tasks.
_EXEC_LOCK = asyncio.Lock()


def start_task(prompt: str, file_path: str | None) -> TaskState:
    """Accept a task: register it and launch its background run. Returns at once."""
    task_id = str(uuid.uuid4())
    state = TaskState(
        task_id=task_id,
        prompt=prompt,
        file_path=file_path,
        queue=asyncio.Queue(),
    )
    registry.register(state)

    task = asyncio.create_task(_run(state), name=f"agent-task-{task_id}")
    state.task = task
    task.add_done_callback(lambda t: _on_done(task_id, t))
    logger.info("Task %s accepted (file=%s)", task_id, file_path or "-")
    return state


def _on_done(task_id: str, task: "asyncio.Task") -> None:
    registry.pop(task_id)
    if not task.cancelled():
        exc = task.exception()
        if exc is not None:  # _run swallows its own errors; this would be a bug
            logger.error("Task %s crashed outside _run: %r", task_id, exc)
    logger.info("Task %s finished; registry entry removed", task_id)


async def _run(state: TaskState) -> None:
    queue = state.queue
    sentinel_sent = False

    async def _sentinel() -> None:
        nonlocal sentinel_sent
        if not sentinel_sent:
            await queue.put({"event": EVENT_COMPLETE, "data": {"file_id": state.file_id}})
            sentinel_sent = True

    try:
        if _EXEC_LOCK.locked():
            await queue.put(
                {"event": EVENT_THOUGHT,
                 "data": {"node": "queue", "message": "queued — waiting for the executor"}}
            )

        async with _EXEC_LOCK:
            state.exec_started_at = time.monotonic()
            state.status = "running"
            try:
                agent = await get_agent()
                cfg = run_config(state.task_id)
                async for chunk in agent.astream(
                    new_state(state.prompt, state.file_path), cfg, stream_mode="updates"
                ):
                    for frame in translate(chunk):
                        await queue.put(frame)

                final = (await agent.aget_state(cfg)).values
                path_str = final.get("final_deliverable_path")
                path = Path(path_str) if path_str else None
                if path and path.exists():
                    state.file_id = path.name
                    await queue.put({
                        "event": EVENT_DELIVERABLE,
                        "data": {
                            "file_id": path.name,
                            "filename": path.name,
                            "download_url": f"{settings.API_V1_PREFIX}/workspace/download/{path.name}",
                            "size_bytes": path.stat().st_size,
                        },
                    })
                else:
                    await queue.put({
                        "event": EVENT_THOUGHT,
                        "data": {"node": "finalize", "message": "no downloadable deliverable was produced"},
                    })
            finally:
                state.exec_finished_at = time.monotonic()

        state.status = "done"
        await _sentinel()

    except asyncio.CancelledError:
        state.status = "error"
        # Best-effort terminal frames so a still-connected client's stream ends.
        queue.put_nowait({"event": EVENT_THOUGHT,
                          "data": {"node": "error", "message": "task cancelled during shutdown"}})
        queue.put_nowait({"event": EVENT_COMPLETE, "data": {"file_id": state.file_id}})
        raise
    except Exception as exc:  # noqa: BLE001 - the stream must always terminate cleanly
        logger.exception("Task %s failed during execution", state.task_id)
        state.status = "error"
        await queue.put({
            "event": EVENT_THOUGHT,
            "data": {"node": "error", "message": f"{type(exc).__name__}: {exc}"},
        })
        await _sentinel()


async def shutdown_all(timeout: float = 5.0) -> None:
    """Cancel every still-running background task. Called from the app lifespan."""
    states = registry.all_states()
    pending = [s.task for s in states if s.task and not s.task.done()]
    for t in pending:
        t.cancel()
    if pending:
        logger.info("Cancelling %d in-flight task(s) on shutdown", len(pending))
        try:
            await asyncio.wait_for(
                asyncio.gather(*pending, return_exceptions=True), timeout=timeout
            )
        except asyncio.TimeoutError:  # pragma: no cover
            logger.warning("Some tasks did not cancel within %.1fs", timeout)
