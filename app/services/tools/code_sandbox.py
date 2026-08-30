"""Isolated code-execution sandbox (4_Agent_Logic_&_Tools.md §3, 8_Decisions_2.md §8).

``execute_sandbox_code(python_code) -> str`` spins up a throwaway
``python:*-alpine`` container with **no network**, runs the code string, captures
combined stdout/stderr, and destroys the container — always, even on error.

Degraded Mode (§8): if the Phase 1 startup Docker check failed
(``runtime.docker_available is False``), the function returns the exact hardcoded
string and never touches the Docker SDK. The agent's Draft node then explains the
failure to the user instead of the pipeline hard-failing.

Synchronous by spec; the Phase 4 Tool Execution Node offloads it to a thread.
"""

from __future__ import annotations

import uuid

from core.config import (
    DOCKER_UNAVAILABLE_MSG,
    SANDBOX_MEM_LIMIT,
    SANDBOX_NANO_CPUS,
    SANDBOX_PIDS_LIMIT,
    SANDBOX_TIMEOUT_S,
    settings,
)
from core.logging import get_logger
from core.runtime import runtime

logger = get_logger("sentinel.tools.sandbox")

_TIMEOUT_MSG = f"Error: sandbox execution timed out after {SANDBOX_TIMEOUT_S}s."


def _docker_ready() -> bool:
    """Mirror of the Phase 1 startup probe result (app/main.py lifespan)."""
    return runtime.docker_available


def execute_sandbox_code(python_code: str) -> str:
    """Run ``python_code`` in a locked-down container and return its output."""
    if not _docker_ready():
        logger.warning("Sandbox requested while Docker unavailable — returning degraded string.")
        return DOCKER_UNAVAILABLE_MSG

    import docker
    from docker.errors import ImageNotFound

    client = None
    container = None
    name = f"sentinel-sandbox-{uuid.uuid4().hex[:12]}"
    try:
        client = docker.from_env()
        container = client.containers.run(
            settings.SANDBOX_IMAGE,
            command=["python", "-c", python_code],
            name=name,
            detach=True,
            network_mode="none",       # 4_Agent_Logic_&_Tools.md §3 — no egress
            network_disabled=True,
            mem_limit=SANDBOX_MEM_LIMIT,
            pids_limit=SANDBOX_PIDS_LIMIT,
            nano_cpus=SANDBOX_NANO_CPUS,
            read_only=True,
            tmpfs={"/tmp": "size=16m,mode=1777"},
            user="65534:65534",        # nobody
            cap_drop=["ALL"],
            security_opt=["no-new-privileges:true"],
            stdout=True,
            stderr=True,
        )

        try:
            container.wait(timeout=SANDBOX_TIMEOUT_S)
        except Exception as exc:  # requests ReadTimeout on wall-clock overrun
            container.reload()
            if container.status == "running":
                logger.warning("Sandbox %s exceeded %ss — killing.", name, SANDBOX_TIMEOUT_S)
                try:
                    container.kill()
                except Exception:
                    pass
                return _TIMEOUT_MSG
            logger.debug("wait() raised but container not running: %s", exc)

        raw = container.logs(stdout=True, stderr=True)
        output = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)
        logger.info("Sandbox %s finished (%d bytes output).", name, len(output))
        return output

    except ImageNotFound:
        msg = (
            f"Error: sandbox image '{settings.SANDBOX_IMAGE}' not found on host. "
            f"Run: docker pull {settings.SANDBOX_IMAGE}"
        )
        logger.error(msg)
        return msg
    except Exception as exc:  # never propagate — the agent must keep going
        logger.exception("Sandbox execution failed.")
        return f"Error: sandbox execution failed: {type(exc).__name__}: {exc}"
    finally:
        if container is not None:
            try:
                container.remove(force=True)
            except Exception:
                logger.warning("Could not remove sandbox container %s", name)
        if client is not None:
            try:
                client.close()
            except Exception:
                pass


if __name__ == "__main__":  # pragma: no cover - manual smoke test
    import asyncio

    from core.docker_health import check_docker

    ok, reason = asyncio.run(check_docker())
    runtime.docker_available = ok
    print(f"docker_available={ok} ({reason})")
    print("---")
    print(execute_sandbox_code("print('hello')"))
