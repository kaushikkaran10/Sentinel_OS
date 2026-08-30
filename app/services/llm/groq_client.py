"""Groq client — cloud fallback for LOCAL DEV ONLY (8_Decisions_2.md §9).

Exists so the stack is usable on a machine that can't hold 7B/8B models in RAM.
It makes outbound cloud calls and therefore **must never** run in the deployed
or offline path (CLAUDE.md hard constraints).

Implemented over raw ``httpx`` against Groq's OpenAI-compatible REST endpoint —
no ``groq`` / ``openai`` SDK is imported, so the no-cloud-SDK guard stays green.
"""

from __future__ import annotations

import base64
from pathlib import Path

import httpx

from core.config import settings
from core.logging import get_logger
from services.llm.client import ImageInput, LLMBackendError, LLMClient, Role

logger = get_logger("sentinel.llm.groq")

_ROLE_FIELD = {
    "general": "GROQ_MODEL_GENERAL",
    "coder": "GROQ_MODEL_CODER",
    "vision": "GROQ_MODEL_VISION",
}

_MIME_BY_SUFFIX = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def _data_uri(path: str | Path) -> str:
    p = Path(path)
    mime = _MIME_BY_SUFFIX.get(p.suffix.lower(), "application/octet-stream")
    b64 = base64.b64encode(p.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


class GroqClient(LLMClient):
    provider_name = "groq"

    def __init__(self) -> None:
        logger.warning(
            "GroqClient active — DEV ONLY. Cloud inference calls will be made; "
            "never deploy this path (CLAUDE.md hard constraints)."
        )
        key = (settings.GROQ_API_KEY or "").strip()
        if not key:
            raise LLMBackendError(
                "groq", "GROQ_API_KEY not set (required when LLM_PROVIDER=groq)"
            )
        self._api_key = key

    def _model_for(self, role: Role) -> str:
        return getattr(settings, _ROLE_FIELD[role])

    def _build_body(
        self,
        prompt: str,
        system: str | None = None,
        role: Role = "general",
        images: ImageInput | None = None,
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> dict:
        """Pure OpenAI-chat request-body builder — no I/O. Unit-tested for shape."""
        if images:
            user_content: object = [
                {"type": "text", "text": prompt},
                *(
                    {"type": "image_url", "image_url": {"url": _data_uri(p)}}
                    for p in images
                ),
            ]
        else:
            user_content = prompt

        messages: list[dict] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": user_content})

        body: dict = {
            "model": self._model_for(role),
            "messages": messages,
            "stream": False,
        }
        reasoning_fmt = (settings.GROQ_REASONING_FORMAT or "").strip()
        if reasoning_fmt:
            # Groq strips reasoning-model chain-of-thought server-side so the
            # returned content is a clean answer. Accepted by the configured
            # gpt-oss / qwen3 dev models.
            body["reasoning_format"] = reasoning_fmt
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        return body

    async def generate(self, prompt: str, system: str | None = None, **kwargs) -> str:
        role: Role = kwargs.pop("role", "general")
        images: ImageInput | None = kwargs.pop("images", None)
        body = self._build_body(
            prompt,
            system,
            role,
            images,
            temperature=kwargs.pop("temperature", None),
            max_tokens=kwargs.pop("max_tokens", None),
        )
        url = f"{settings.GROQ_BASE_URL.rstrip('/')}/chat/completions"
        headers = {"Authorization": f"Bearer {self._api_key}"}
        try:
            async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT_S) as client:
                resp = await client.post(url, json=body, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as exc:
            detail = _error_detail(exc.response)
            raise LLMBackendError(
                "groq", f"HTTP {exc.response.status_code}: {detail}"
            ) from exc
        except httpx.HTTPError as exc:
            raise LLMBackendError("groq", f"request failed ({exc})") from exc
        except ValueError as exc:
            raise LLMBackendError("groq", "non-JSON response") from exc

        try:
            text = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMBackendError("groq", "unexpected response shape") from exc
        if not isinstance(text, str):
            raise LLMBackendError("groq", "message content was not a string")
        return text.strip()


def _error_detail(resp: httpx.Response) -> str:
    """Best-effort extraction of Groq's error message for the exception text."""
    try:
        payload = resp.json()
    except ValueError:
        return resp.text[:200]
    if isinstance(payload, dict):
        err = payload.get("error")
        if isinstance(err, dict) and isinstance(err.get("message"), str):
            return err["message"]
    return str(payload)[:200]
