"""FastAPI application entrypoint.

Launch (single worker only — task state is in-process from Phase 5 onward):

    cd app && python -m uvicorn main:app --workers 1

Phase 1 wires up: config + logging, the data-dir layout, a non-fatal Docker
health check (Degraded Mode per 8_Decisions_2.md §8), CORS for the React and
Streamlit dev origins (§9), the standard error contract (§5), and the System
Telemetry endpoints (5_Api_Spec.md §3).
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.health import router as health_router
from api.router import api_router
from core.config import ensure_dirs, settings
from core.docker_health import check_docker
from core.logging import configure_logging, get_logger, log_critical
from core.runtime import runtime

logger = get_logger("sentinel.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: prepare storage, probe Docker, set Degraded Mode. Never crashes."""
    configure_logging()
    logger.info("Starting %s v%s", settings.APP_NAME, settings.VERSION)

    ensure_dirs()
    logger.info("Data directories ready under %s", settings.DATA_DIR)

    docker_ok, reason = await check_docker()
    runtime.docker_available = docker_ok
    if not docker_ok:
        runtime.mark_degraded(f"Docker daemon unreachable ({reason})")
        log_critical(
            "Docker daemon unreachable - starting in DEGRADED MODE. "
            "The code sandbox tool will return a hardcoded error until Docker is "
            f"available. Reason: {reason}"
        )
    else:
        logger.info("Startup checks passed — running in normal mode.")

    # Mirror runtime state onto the app for request-scoped access.
    app.state.runtime = runtime

    yield

    logger.info("Shutting down %s", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    summary="Self-hosted, air-gapped agentic AI workbench.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.CORS_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Pin the 422 body shape from the error contract (§5)."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": jsonable_encoder(exc.errors())},
    )


app.include_router(health_router)
app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, workers=1)
