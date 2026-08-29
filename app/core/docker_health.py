"""Docker daemon reachability check (8_Decisions_2.md §8).

Used at startup to decide whether the app enters Degraded Mode. This function
never raises — a missing or stopped Docker daemon is an expected condition, not
a crash.
"""

from __future__ import annotations

import asyncio

from core.logging import get_logger

logger = get_logger("sentinel.core.docker")


def _ping() -> tuple[bool, str | None]:
    """Blocking ping. Returns (ok, reason_if_failed)."""
    try:
        import docker  # imported lazily so a missing SDK cannot break startup
    except Exception as exc:  # pragma: no cover - defensive
        return False, f"docker SDK import failed: {exc}"

    client = None
    try:
        client = docker.from_env()
        client.ping()
        return True, None
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass


async def check_docker() -> tuple[bool, str | None]:
    """Async wrapper — runs the blocking ping off the event loop."""
    ok, reason = await asyncio.to_thread(_ping)
    if ok:
        logger.info("Docker daemon reachable.")
    else:
        logger.warning("Docker daemon not reachable: %s", reason)
    return ok, reason
