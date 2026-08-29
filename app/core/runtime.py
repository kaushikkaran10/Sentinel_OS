"""Process-wide runtime state.

A single mutable object describing whether optional host dependencies are
available. Populated once during app startup (see ``app/main.py`` lifespan) and
read from anywhere — including LangGraph tool code that runs outside any request
scope (Phase 2+). Also mirrored onto ``app.state.runtime`` for convenience.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class RuntimeState:
    """Mutable flags describing the current degraded/healthy status of the app."""

    docker_available: bool = False
    degraded_mode: bool = False
    degraded_reasons: list[str] = field(default_factory=list)

    def mark_degraded(self, reason: str) -> None:
        self.degraded_mode = True
        if reason and reason not in self.degraded_reasons:
            self.degraded_reasons.append(reason)

    def snapshot(self) -> dict[str, object]:
        return {
            "docker_available": self.docker_available,
            "degraded_mode": self.degraded_mode,
            "degraded_reasons": list(self.degraded_reasons),
        }


# Module-level singleton. Import and mutate this; do not create new instances.
runtime = RuntimeState()
