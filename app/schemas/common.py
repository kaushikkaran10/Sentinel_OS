"""Shared response models not tied to one feature area."""

from __future__ import annotations

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """GET / and GET /health — liveness only, no dependency checks."""

    status: str = Field("ok", examples=["ok"])
    app: str = Field(..., examples=["Sentinel_OS"])
    version: str = Field(..., examples=["0.1.0"])
    degraded_mode: bool = Field(
        ..., description="True when a startup dependency check (Docker) failed."
    )
