"""Response models for the System / Air-Gap Telemetry endpoints (5_Api_Spec.md §3)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class TelemetryResponse(BaseModel):
    """GET /api/v1/system/telemetry."""

    air_gapped: bool = Field(..., description="Always true — no cloud inference path exists.")
    outbound_traffic_kbps: float = Field(
        ..., description="Outbound NIC traffic. Reported as 0.0 for the MVP."
    )
    ram_usage_percent: float = Field(..., description="System RAM utilisation (0-100).")
    gpu_memory_used_gb: float | None = Field(
        None, description="Used VRAM in GiB, or null when no NVIDIA GPU is present."
    )
    ollama_status: str = Field(..., description="'connected' or 'unreachable'.")
    degraded_mode: bool = Field(
        ..., description="True when a startup dependency check (Docker) failed."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "air_gapped": True,
                "outbound_traffic_kbps": 0.0,
                "ram_usage_percent": 54.2,
                "gpu_memory_used_gb": 4.8,
                "ollama_status": "connected",
                "degraded_mode": False,
            }
        }
    }


class ModelsResponse(BaseModel):
    """GET /api/v1/system/models."""

    active_models: list[str] = Field(
        ...,
        description="Model tags this deployment is configured to route to.",
        examples=[["llama3.1:8b", "qwen2.5-coder:7b", "qwen2.5-vl:latest"]],
    )
