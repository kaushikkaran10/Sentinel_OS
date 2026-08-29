"""Liveness endpoints. No dependency checks — use /system/telemetry for those."""

from __future__ import annotations

from fastapi import APIRouter

from core.config import settings
from core.runtime import runtime
from schemas.common import HealthResponse

router = APIRouter(tags=["health"])


def _health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        app=settings.APP_NAME,
        version=settings.VERSION,
        degraded_mode=runtime.degraded_mode,
    )


@router.get("/", response_model=HealthResponse, summary="Root liveness check")
async def root() -> HealthResponse:
    return _health()


@router.get("/health", response_model=HealthResponse, summary="Liveness check")
async def health() -> HealthResponse:
    return _health()
