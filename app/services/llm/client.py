"""LLM provider abstraction (8_Decisions_2.md §9, 7_Implementation_Plan.md Phase 3).

One interface, two implementations:

* :class:`OllamaClient` — the local, air-gapped daemon (production).
* :class:`GroqClient`   — a cloud fallback for **local dev only** on low-RAM
  machines. It must never run in the deployed/offline path.

The provider is chosen entirely by ``LLM_PROVIDER=ollama|groq`` in ``.env`` —
switching is a config change, not a code change. Call :func:`get_llm_client`.

The mandated interface signature (§9) is::

    async def generate(self, prompt: str, system: str = None, **kwargs) -> str

Role selection ("which model for which task") rides in ``**kwargs`` as
``role="general"|"coder"|"vision"`` so the signature stays exact; the
:meth:`LLMClient.draft` / :meth:`LLMClient.code` / :meth:`LLMClient.vision`
helpers are thin wrappers that set it (Phase 3 item 4).
"""

from __future__ import annotations

import abc
from functools import lru_cache
from pathlib import Path
from typing import Literal

from core.config import settings
from core.logging import get_logger

logger = get_logger("sentinel.llm")

Role = Literal["general", "coder", "vision"]
ROLES: tuple[Role, ...] = ("general", "coder", "vision")

# What every concrete client accepts through ``**kwargs``. Anything else is
# ignored so callers can pass provider-specific extras without a TypeError.
ImageInput = list[str | Path]


class LLMBackendError(RuntimeError):
    """The LLM backend was unreachable or returned an unusable response.

    Phase 4/5 map this to the standard 503 (``Dependency failure: <dep>
    unreachable``, 8_Decisions_2.md §5); ``provider`` names the dependency.
    """

    def __init__(self, provider: str, reason: str) -> None:
        self.provider = provider
        self.reason = reason
        super().__init__(f"{provider} LLM backend error: {reason}")


class LLMClient(abc.ABC):
    """Base interface. Concrete clients implement :meth:`generate` + :meth:`_model_for`."""

    provider_name: str = "base"

    @abc.abstractmethod
    async def generate(self, prompt: str, system: str | None = None, **kwargs) -> str:
        """Return a complete (non-streamed) completion for ``prompt``.

        Recognised ``kwargs``: ``role`` (:data:`Role`, default ``"general"``),
        ``images`` (:data:`ImageInput` — local file paths, used when
        ``role="vision"``), ``temperature`` (float), ``max_tokens`` (int).
        Raises :class:`LLMBackendError` on transport/response failure.
        """

    @abc.abstractmethod
    def _model_for(self, role: Role) -> str:
        """Resolve a :data:`Role` to this provider's configured model name."""

    # ── Role helpers (Phase 3 item 4) — keep the §9 signature untouched ─────
    async def draft(self, prompt: str, system: str | None = None, **kwargs) -> str:
        """Routing / natural-language drafting (Llama 3.1 on Ollama)."""
        kwargs["role"] = "general"
        return await self.generate(prompt, system, **kwargs)

    async def code(self, prompt: str, system: str | None = None, **kwargs) -> str:
        """Code / math script generation (Qwen-Coder on Ollama)."""
        kwargs["role"] = "coder"
        return await self.generate(prompt, system, **kwargs)

    async def vision(
        self,
        prompt: str,
        images: ImageInput,
        system: str | None = None,
        **kwargs,
    ) -> str:
        """Image / scanned-PDF understanding (Qwen-VL on Ollama)."""
        kwargs["role"] = "vision"
        kwargs["images"] = images
        return await self.generate(prompt, system, **kwargs)


@lru_cache(maxsize=1)
def get_llm_client() -> LLMClient:
    """Return the singleton client for the configured ``LLM_PROVIDER``.

    One process runs one provider (single uvicorn worker, 8_Decisions_2.md §1),
    so the instance is cached. Tests can reset it via
    ``get_llm_client.cache_clear()``.
    """
    from services.llm.groq_client import GroqClient
    from services.llm.ollama_client import OllamaClient

    if settings.LLM_PROVIDER == "groq":
        logger.warning(
            "LLM_PROVIDER=groq — using the cloud GroqClient. DEV ONLY; this must "
            "never be the deployed/offline path (CLAUDE.md hard constraints)."
        )
        return GroqClient()
    return OllamaClient()
