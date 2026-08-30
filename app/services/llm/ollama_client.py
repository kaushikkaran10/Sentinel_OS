"""Ollama client — the local, air-gapped LLM daemon (production path).

Talks to the native REST API on ``OLLAMA_BASE_URL`` (default port 11434) with
``POST /api/generate``, ``stream=false`` (the interface returns a complete
``str``), and ``keep_alive`` from settings so a model stays warm for
back-to-back calls in one task without being pinned in RAM (8_Decisions_2.md §4).
"""

from __future__ import annotations

import base64
from pathlib import Path

import httpx

from core.config import settings
from core.logging import get_logger
from services.llm.client import ImageInput, LLMBackendError, LLMClient, Role

logger = get_logger("sentinel.llm.ollama")

_ROLE_FIELD = {
    "general": "OLLAMA_MODEL_GENERAL",
    "coder": "OLLAMA_MODEL_CODER",
    "vision": "OLLAMA_MODEL_VISION",
}


def _b64(path: str | Path) -> str:
    """Raw base64 of a file — Ollama wants bare strings, no ``data:`` prefix."""
    return base64.b64encode(Path(path).read_bytes()).decode("ascii")


class OllamaClient(LLMClient):
    provider_name = "ollama"

    def _model_for(self, role: Role) -> str:
        return getattr(settings, _ROLE_FIELD[role])

    def _build_payload(
        self,
        prompt: str,
        system: str | None = None,
        role: Role = "general",
        images: ImageInput | None = None,
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> dict:
        """Pure request-body builder — no I/O. Unit-tested for shape."""
        payload: dict = {
            "model": self._model_for(role),
            "prompt": prompt,
            "stream": False,
            "keep_alive": settings.OLLAMA_KEEP_ALIVE,
        }
        if system:
            payload["system"] = system
        if images:
            payload["images"] = [_b64(p) for p in images]

        options: dict = {}
        if temperature is not None:
            options["temperature"] = temperature
        if max_tokens is not None:
            options["num_predict"] = max_tokens
        if options:
            payload["options"] = options
        return payload

    async def generate(self, prompt: str, system: str | None = None, **kwargs) -> str:
        role: Role = kwargs.pop("role", "general")
        images: ImageInput | None = kwargs.pop("images", None)
        payload = self._build_payload(
            prompt,
            system,
            role,
            images,
            temperature=kwargs.pop("temperature", None),
            max_tokens=kwargs.pop("max_tokens", None),
        )
        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"
        try:
            async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT_S) as client:
                resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as exc:
            raise LLMBackendError(
                "ollama", f"HTTP {exc.response.status_code} from {url}"
            ) from exc
        except httpx.HTTPError as exc:
            raise LLMBackendError("ollama", f"unreachable at {url} ({exc})") from exc
        except ValueError as exc:  # non-JSON body
            raise LLMBackendError("ollama", f"non-JSON response from {url}") from exc

        text = data.get("response")
        if not isinstance(text, str):
            raise LLMBackendError("ollama", "response payload missing 'response' string")
        return text.strip()
