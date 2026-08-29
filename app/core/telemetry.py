"""Host + dependency telemetry for GET /api/v1/system/telemetry.

Everything here is read locally (psutil, NVML) or over localhost (the Ollama
probe hits 127.0.0.1:11434 only). No external network calls.
"""

from __future__ import annotations

import asyncio

import httpx
import psutil

from core.config import settings
from core.logging import get_logger
from core.runtime import runtime

logger = get_logger("sentinel.core.telemetry")

# MVP simplification: the host is air-gapped at inference time, so outbound
# traffic is reported as a flat zero rather than sampled from the NIC.
_OUTBOUND_TRAFFIC_KBPS = 0.0


def _gpu_memory_used_gb() -> float | None:
    """Total used VRAM across NVIDIA GPUs, or None when unavailable.

    The target is a 16GB laptop that may have no discrete GPU, so failure here
    is normal, not an error.
    """
    try:
        import pynvml  # provided by the `nvidia-ml-py` package
    except Exception:
        return None

    try:
        pynvml.nvmlInit()
    except Exception:
        return None

    try:
        count = pynvml.nvmlDeviceGetCount()
        if count == 0:
            return None
        used_bytes = 0
        for idx in range(count):
            handle = pynvml.nvmlDeviceGetHandleByIndex(idx)
            used_bytes += pynvml.nvmlDeviceGetMemoryInfo(handle).used
        return round(used_bytes / (1024**3), 2)
    except Exception:
        return None
    finally:
        try:
            pynvml.nvmlShutdown()
        except Exception:
            pass


def _host_stats() -> tuple[float, float | None]:
    """Blocking host reads, grouped so they run in one worker thread."""
    return psutil.virtual_memory().percent, _gpu_memory_used_gb()


async def _probe_ollama() -> str:
    """'connected' if the local Ollama daemon answers, else 'unreachable'."""
    url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/version"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(url)
        return "connected" if resp.status_code == 200 else "unreachable"
    except Exception as exc:
        logger.debug("Ollama probe failed: %s", exc)
        return "unreachable"


async def collect_telemetry() -> dict[str, object]:
    """Assemble the telemetry payload. Blocking reads are offloaded."""
    ram_percent, gpu_gb = await asyncio.to_thread(_host_stats)
    ollama_status = await _probe_ollama()
    return {
        "air_gapped": True,
        "outbound_traffic_kbps": _OUTBOUND_TRAFFIC_KBPS,
        "ram_usage_percent": ram_percent,
        "gpu_memory_used_gb": gpu_gb,
        "ollama_status": ollama_status,
        "degraded_mode": runtime.degraded_mode,
    }
