"""Agentic Workspace endpoints — 5_Api_Spec.md §1.

    POST /api/v1/workspace/task            multipart ingestion -> queued task
    GET  /api/v1/workspace/stream/{id}     Server-Sent Events for a running task
    GET  /api/v1/workspace/download/{id}   serve a generated .docx / .xlsx / .py
    GET  /api/v1/workspace/history         past runs, from the SQLite checkpointer

Upload constraints are the §6 allowlist (10 MB, MIME allowlist), enforced with the
same pattern as :mod:`api.kb`. The task registry, background execution and SSE
translation live in :mod:`services.workspace`.
"""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse

from core.config import ALLOWED_MIME_TYPES, GENERATED_DIR, UPLOADS_DIR, settings
from core.logging import get_logger
from schemas.errors import ErrorResponse
from schemas.workspace import HistoryResponse, HistoryTask, TaskCreateResponse
from services.workspace import (
    SENTINEL_EVENT,
    format_sse,
    list_task_history,
    registry,
    start_task,
)

logger = get_logger("sentinel.api.workspace")

router = APIRouter(prefix="/workspace", tags=["workspace"])

_400 = {400: {"model": ErrorResponse, "description": "Validation error"}}
_404 = {404: {"model": ErrorResponse, "description": "Not found"}}

_MEDIA_TYPES = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".py": "text/x-python",
}

# How long the SSE generator blocks on the queue before checking for a dropped
# client. Keeps a vanished connection from wedging the generator forever.
_QUEUE_POLL_S = 1.0


def _bad_request(reason: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Validation error: {reason}")


@router.post(
    "/task",
    response_model=TaskCreateResponse,
    responses=_400,
    summary="Submit a file + prompt for agentic processing",
)
async def create_task(
    prompt: str = Form(...),
    file: UploadFile | None = File(None),
) -> TaskCreateResponse:
    """Accept a task and launch it in the background. Returns immediately.

    ``file`` is optional (deviation from 5_Api_Spec.md, which lists it as
    required): a prompt-only task is valid and routes straight to the drafter.
    """
    stored_path: str | None = None

    if file is not None and (file.filename or ""):
        content = await file.read()
        if len(content) > settings.MAX_UPLOAD_BYTES:
            raise _bad_request("file exceeds 10 MB limit")
        mime = file.content_type or "application/octet-stream"
        if mime not in ALLOWED_MIME_TYPES:
            raise _bad_request("unsupported file type")

        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        safe_name = Path(file.filename or "upload").name
        path = UPLOADS_DIR / f"{uuid.uuid4().hex}_{safe_name}"
        path.write_bytes(content)
        stored_path = str(path)

    task_state = start_task(prompt=prompt, file_path=stored_path)
    return TaskCreateResponse(task_id=task_state.task_id)


async def _event_source(request: Request, task_id: str):
    """Yield SSE blocks from a task's queue until the ``complete`` sentinel."""
    state = registry.get(task_id)
    if state is None:  # popped between the handler check and here
        return
    try:
        while True:
            try:
                frame = await asyncio.wait_for(state.queue.get(), timeout=_QUEUE_POLL_S)
            except asyncio.TimeoutError:
                if await request.is_disconnected():
                    logger.info("Client disconnected from stream %s; task keeps running", task_id)
                    return
                continue
            yield format_sse(frame)
            if frame.get("event") == SENTINEL_EVENT:
                return
    finally:
        # §1 cleanup: drop the volatile registry entry. SQLite + generated files
        # are untouched so /history and /download keep working.
        registry.pop(task_id)


@router.get(
    "/stream/{task_id}",
    responses=_404,
    summary="Server-Sent Events stream for a running task",
    response_class=StreamingResponse,
)
async def stream_task(task_id: str, request: Request) -> StreamingResponse:
    if registry.get(task_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Validation error: unknown task_id")
    return StreamingResponse(
        _event_source(request, task_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.get(
    "/download/{file_id}",
    responses=_404,
    summary="Download a generated deliverable",
    response_class=FileResponse,
)
async def download_file(file_id: str) -> FileResponse:
    name = Path(file_id).name
    if not name or name != file_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Validation error: file not found")

    path = GENERATED_DIR / name
    try:
        resolved = path.resolve()
    except OSError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Validation error: file not found")

    if resolved.parent != GENERATED_DIR.resolve() or not resolved.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Validation error: file not found")

    media_type = _MEDIA_TYPES.get(resolved.suffix.lower(), "application/octet-stream")
    return FileResponse(resolved, filename=name, media_type=media_type)


@router.get(
    "/history",
    response_model=HistoryResponse,
    summary="List past task runs (from the SQLite checkpointer)",
)
async def task_history() -> HistoryResponse:
    return HistoryResponse(tasks=[HistoryTask(**t) for t in await list_task_history()])
