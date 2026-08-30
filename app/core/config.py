"""Application configuration.

Single source of truth for settings and filesystem paths. Values come from
environment variables / a repo-root ``.env`` file, falling back to the defaults
below. Paths are resolved as absolute paths from this module's location, so the
app behaves identically no matter which directory ``uvicorn`` is launched from.
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# ── Filesystem layout (absolute, launch-dir independent) ──────────────────────
#   config.py -> app/core/config.py ; parents[1] == app/
BASE_DIR: Path = Path(__file__).resolve().parents[1]        # .../Sentinel_OS/app
REPO_ROOT: Path = BASE_DIR.parent                            # .../Sentinel_OS
DATA_DIR: Path = BASE_DIR / "data"                           # per 3_Architecture.md
UPLOADS_DIR: Path = DATA_DIR / "uploads"
GENERATED_DIR: Path = DATA_DIR / "generated"
MODELS_DIR: Path = DATA_DIR / "models"
CHROMA_DIR: Path = DATA_DIR / "chroma_db"
LANGGRAPH_DB: Path = DATA_DIR / "langgraph.sqlite"           # created in Phase 4

# ── RAG layer (6_Vector_Store_&_Data.md) ─────────────────────────────────────
#   Decision: all-MiniLM-L6-v2, pre-downloaded to data/models/, loaded offline.
EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
EMBEDDING_MODEL_REPO: str = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_MODEL_DIR: Path = MODELS_DIR / EMBEDDING_MODEL_NAME
CHROMA_COLLECTION: str = "sentinel_sops"
CHUNK_SIZE_TOKENS: int = 500          # 6_Vector_Store_&_Data.md §3
CHUNK_OVERLAP_TOKENS: int = 50        # 6_Vector_Store_&_Data.md §3
RAG_TOP_K: int = 4

# ── Docker code sandbox (4_Agent_Logic_&_Tools.md §3, 8_Decisions_2.md §8) ────
SANDBOX_IMAGE_DEFAULT: str = "python:3.12-alpine"
SANDBOX_TIMEOUT_S: int = 30
SANDBOX_MEM_LIMIT: str = "256m"
SANDBOX_PIDS_LIMIT: int = 128
SANDBOX_NANO_CPUS: int = 1_000_000_000  # 1.0 CPU
# Exact string the sandbox tool returns in Degraded Mode (8_Decisions_2.md §8).
DOCKER_UNAVAILABLE_MSG: str = "Error: Docker sandbox is unavailable on this host."

# Upload allowlist (8_Decisions_2.md §6). Defined now, enforced from Phase 2.
ALLOWED_MIME_TYPES: frozenset[str] = frozenset(
    {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "image/png",
        "image/jpeg",
    }
)


class Settings(BaseSettings):
    """Environment-overridable settings. Instantiated once as ``settings``."""

    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "Sentinel_OS"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"
    LOG_LEVEL: str = "INFO"

    # ── CORS (8_Decisions_2.md §9): React :3000 + Streamlit :8501 ────────────
    CORS_ORIGINS: Annotated[list[str], NoDecode] = [
        "http://localhost:3000",
        "http://localhost:8501",
    ]

    # ── LLM provider (used from Phase 3) ────────────────────────────────────
    LLM_PROVIDER: Literal["ollama", "groq"] = "ollama"
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # ── Sandbox override (Phase 2) ─────────────────────────────────────────
    #   The embedding model is fixed (see EMBEDDING_MODEL_* constants above) —
    #   only the sandbox base image is env-overridable.
    SANDBOX_IMAGE: str = SANDBOX_IMAGE_DEFAULT

    # ── Models reported by GET /system/models (2_Tech_Stack.md) ─────────────
    ACTIVE_MODELS: Annotated[list[str], NoDecode] = [
        "llama3.1:8b",
        "qwen2.5-coder:7b",
        "qwen2.5-vl:latest",
    ]

    # ── Upload limit (8_Decisions_2.md §6). Enforced from Phase 2. ──────────
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024  # 10 MB

    @field_validator("CORS_ORIGINS", "ACTIVE_MODELS", mode="before")
    @classmethod
    def _split_csv(cls, v: object) -> object:
        """Accept a comma-separated string from the environment or a real list."""
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    # Paths are module constants; surface them on the settings object too so
    # callers only need to import one thing.
    @property
    def BASE_DIR(self) -> Path:
        return BASE_DIR

    @property
    def DATA_DIR(self) -> Path:
        return DATA_DIR

    @property
    def UPLOADS_DIR(self) -> Path:
        return UPLOADS_DIR

    @property
    def GENERATED_DIR(self) -> Path:
        return GENERATED_DIR

    @property
    def MODELS_DIR(self) -> Path:
        return MODELS_DIR

    @property
    def CHROMA_DIR(self) -> Path:
        return CHROMA_DIR

    @property
    def LANGGRAPH_DB(self) -> Path:
        return LANGGRAPH_DB

    @property
    def EMBEDDING_MODEL_DIR(self) -> Path:
        return EMBEDDING_MODEL_DIR

    @property
    def ALLOWED_MIME_TYPES(self) -> frozenset[str]:
        return ALLOWED_MIME_TYPES


def ensure_dirs() -> None:
    """Create every runtime data directory if missing. Safe to call repeatedly."""
    for path in (DATA_DIR, UPLOADS_DIR, GENERATED_DIR, MODELS_DIR, CHROMA_DIR):
        path.mkdir(parents=True, exist_ok=True)


settings = Settings()
