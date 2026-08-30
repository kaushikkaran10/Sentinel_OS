"""Request/response models for the Agentic Workspace endpoints (5_Api_Spec.md §1).

    POST   /api/v1/workspace/task            -> TaskCreateResponse
    GET    /api/v1/workspace/stream/{id}     -> text/event-stream (no model)
    GET    /api/v1/workspace/download/{id}   -> FileResponse (no model)
    GET    /api/v1/workspace/history         -> HistoryResponse
    DELETE /api/v1/system/purge              -> PurgeResponse
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TaskCreateResponse(BaseModel):
    """POST /api/v1/workspace/task.

    ``task_type`` is the literal string ``"auto_detect"`` per 5_Api_Spec.md §1 —
    the real classification happens in the LangGraph router node and is reported
    on the SSE stream, not here.
    """

    task_id: str = Field(..., description="uuid4 — use it to open the SSE stream.")
    status: Literal["queued"] = "queued"
    task_type: Literal["auto_detect"] = "auto_detect"


class DeliverableMeta(BaseModel):
    """Payload of the ``event: deliverable`` SSE frame (documentation only)."""

    file_id: str = Field(..., examples=["a1b2c3d4_approval_note.docx"])
    filename: str = Field(..., examples=["approval_note.docx"])
    download_url: str = Field(..., examples=["/api/v1/workspace/download/a1b2c3d4_approval_note.docx"])
    size_bytes: int = Field(..., ge=0)


class HistoryTask(BaseModel):
    """One past run, reconstructed from the SQLite checkpointer."""

    task_id: str
    prompt: str
    timestamp: str = Field(..., description="ISO-8601 timestamp of the run's first checkpoint.")


class HistoryResponse(BaseModel):
    """GET /api/v1/workspace/history."""

    tasks: list[HistoryTask]


class PurgeResponse(BaseModel):
    """DELETE /api/v1/system/purge (8_Decisions_2.md §7)."""

    deleted: int = Field(..., ge=0, description="Number of files removed.")
    freed_bytes: int = Field(..., ge=0, description="Total size of the removed files.")
