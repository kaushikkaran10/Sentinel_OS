"""Standard error-response contract (8_Decisions_2.md §5).

- 400 Bad Request      -> ``{"detail": "Validation error: <reason>"}``
- 422 Unprocessable    -> FastAPI's built-in RequestValidationError body
                          (pinned explicitly by the handler in app/main.py)
- 503 Service Unavailable -> ``{"detail": "Dependency failure: <dep> unreachable"}``

All three serialise as :class:`ErrorResponse`. The helpers build the exact
``detail`` strings §5 mandates so call sites don't hand-format them.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """The body shape for 400 and 503 responses."""

    detail: str = Field(..., examples=["Validation error: unsupported file type"])


def validation_error(reason: str) -> ErrorResponse:
    """400 payload."""
    return ErrorResponse(detail=f"Validation error: {reason}")


def dependency_error(dependency: str) -> ErrorResponse:
    """503 payload. ``dependency`` is e.g. 'Docker daemon' or 'Ollama'."""
    return ErrorResponse(detail=f"Dependency failure: {dependency} unreachable")
