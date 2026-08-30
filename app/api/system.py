"""System & Air-Gap Telemetry endpoints (5_Api_Spec.md §3).

Phase 1 scope: read-only status reporting so the API can be verified end to end
before any AI is wired in. ``/models`` returns the configured model list; making
it query the live Ollama daemon is deferred to Phase 3.
"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from core.config import settings
from core.telemetry import collect_telemetry
from schemas.errors import ErrorResponse
from schemas.system import ModelsResponse, TelemetryResponse
from schemas.workspace import PurgeResponse
from services.workspace import purge_old_files

router = APIRouter(prefix="/system", tags=["system"])

_503 = {503: {"model": ErrorResponse, "description": "Dependency unreachable"}}

_PURGE_MAX_AGE_HOURS = 24  # 8_Decisions_2.md §7


@router.get(
    "/telemetry",
    response_model=TelemetryResponse,
    responses=_503,
    summary="Host + air-gap telemetry",
)
async def telemetry() -> TelemetryResponse:
    data = await collect_telemetry()
    return TelemetryResponse(**data)


@router.get(
    "/models",
    response_model=ModelsResponse,
    responses=_503,
    summary="Models this deployment routes to",
)
async def models() -> ModelsResponse:
    return ModelsResponse(active_models=list(settings.ACTIVE_MODELS))


@router.delete(
    "/purge",
    response_model=PurgeResponse,
    summary="Delete uploaded + generated files older than 24 hours",
)
async def purge() -> PurgeResponse:
    """Manual data-retention purge (8_Decisions_2.md §7).

    Removes physical files only; the LangGraph SQLite checkpoint records are
    intentionally left as an orphaned historical log (accepted MVP gap).
    """
    result = await run_in_threadpool(purge_old_files, _PURGE_MAX_AGE_HOURS)
    return PurgeResponse(**result)
