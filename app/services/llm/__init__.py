"""LLM provider layer (Phase 3).

A single interface — :class:`LLMClient` — with two implementations:
:class:`OllamaClient` (local, air-gapped, production) and :class:`GroqClient`
(cloud, DEV ONLY). Pick one with ``LLM_PROVIDER`` in ``.env`` and call
:func:`get_llm_client`.
"""

from services.llm.client import (
    ROLES,
    ImageInput,
    LLMBackendError,
    LLMClient,
    Role,
    get_llm_client,
)
from services.llm.groq_client import GroqClient
from services.llm.ollama_client import OllamaClient

__all__ = [
    "LLMClient",
    "OllamaClient",
    "GroqClient",
    "get_llm_client",
    "LLMBackendError",
    "Role",
    "ROLES",
    "ImageInput",
]
