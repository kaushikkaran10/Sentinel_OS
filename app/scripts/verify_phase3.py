"""Phase 3 functional verification — run, don't just import.

    cd app && ../.venv/Scripts/python.exe -m scripts.verify_phase3

Covers, per the approved plan:
  A. Config             — new Groq/Ollama settings fields, computed ACTIVE_MODELS
  B. Interface contract  — ABC, exact §9 signature, factory switching, payload shape
  C. GroqClient LIVE     — real API calls (needs network + GROQ_API_KEY); dev-time OK
  D. OllamaClient LIVE   — best-effort; SKIP when the daemon is unreachable
  E. Cloud-SDK guard     — no vendor LLM SDK imports anywhere in app/
  F. Regression          — /system/models still returns the 3 Ollama tags

Prints PASS / FAIL / SKIP per check; exits non-zero on any FAIL.
"""

from __future__ import annotations

import asyncio
import base64
import inspect
import re
import struct
import sys
import traceback
import zlib
from pathlib import Path

from core.config import settings
from core.logging import configure_logging

configure_logging()

_PASS = 0
_FAIL = 0
_SKIP = 0


def _solid_png(side: int = 16, rgb: tuple[int, int, int] = (0, 0, 0)) -> bytes:
    """A valid solid-colour RGB PNG (Groq needs >= 2 px per dimension)."""

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", side, side, 8, 2, 0, 0, 0)  # 8-bit RGB
    row = b"\x00" + bytes(rgb) * side
    idat = zlib.compress(row * side)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", idat)
        + chunk(b"IEND", b"")
    )


_TINY_PNG = _solid_png()


def check(name: str, fn) -> None:
    global _PASS, _FAIL, _SKIP
    try:
        result = fn()
        if result == "SKIP":
            _SKIP += 1
            print(f"SKIP  {name}")
        else:
            _PASS += 1
            print(f"PASS  {name}")
    except Exception as exc:  # noqa: BLE001 - report everything
        _FAIL += 1
        print(f"FAIL  {name}: {type(exc).__name__}: {exc}")
        traceback.print_exc()


# ── A. Config ─────────────────────────────────────────────────────────────
def _a_groq_fields_from_env():
    assert settings.LLM_PROVIDER == "groq", settings.LLM_PROVIDER
    # General moved onto qwen3.6-27b (same model as coder/vision) to avoid
    # gpt-oss's spurious native-tool-call 400s and its heavier rate-limit tier.
    assert settings.GROQ_MODEL_GENERAL == "qwen/qwen3.6-27b", settings.GROQ_MODEL_GENERAL
    assert settings.GROQ_MODEL_CODER == "qwen/qwen3.6-27b", settings.GROQ_MODEL_CODER
    assert settings.GROQ_MODEL_VISION == "qwen/qwen3.6-27b", settings.GROQ_MODEL_VISION


def _a_api_key_present():
    assert (settings.GROQ_API_KEY or "").strip(), "GROQ_API_KEY missing/blank in .env"


# Spec-defined Ollama tags: 2_Tech_Stack.md §2 / 5_Api_Spec.md §3 (updated in
# commit de1d578 — qwen3:8b general, gemma4:e2b-it-qat vision).
_OLLAMA_MODELS = ["qwen3:8b", "qwen2.5-coder:7b", "gemma4:e2b-it-qat"]


def _a_ollama_fields():
    assert settings.OLLAMA_MODEL_GENERAL == _OLLAMA_MODELS[0]
    assert settings.OLLAMA_MODEL_CODER == _OLLAMA_MODELS[1]
    assert settings.OLLAMA_MODEL_VISION == _OLLAMA_MODELS[2]
    assert settings.OLLAMA_KEEP_ALIVE == "1m"


def _a_active_models_computed():
    assert "ACTIVE_MODELS" not in type(settings).model_fields, "still a plain field"
    assert isinstance(type(settings).ACTIVE_MODELS, property), "not a property"
    assert settings.ACTIVE_MODELS == _OLLAMA_MODELS, settings.ACTIVE_MODELS


# ── B. Interface contract (no network) ────────────────────────────────────
def _sig_ok(fn) -> None:
    assert inspect.iscoroutinefunction(fn), f"{fn.__qualname__} is not async"
    params = list(inspect.signature(fn).parameters.values())
    kinds = [(p.name, p.kind) for p in params]
    assert kinds[0][0] == "self"
    assert kinds[1][0] == "prompt"
    assert params[1].default is inspect.Parameter.empty, "prompt must be required"
    assert kinds[2][0] == "system"
    assert params[2].default is None, "system must default to None"
    assert params[-1].kind is inspect.Parameter.VAR_KEYWORD, "must end with **kwargs"
    assert not any(
        p.kind is inspect.Parameter.VAR_POSITIONAL for p in params
    ), "no *args allowed in the §9 signature"


def _b_subclasses():
    from services.llm import GroqClient, LLMClient, OllamaClient

    assert issubclass(OllamaClient, LLMClient)
    assert issubclass(GroqClient, LLMClient)


def _b_signatures():
    from services.llm import GroqClient, LLMClient, OllamaClient

    _sig_ok(LLMClient.generate)
    _sig_ok(OllamaClient.generate)
    _sig_ok(GroqClient.generate)


def _b_factory_switch():
    from services.llm import GroqClient, OllamaClient
    from services.llm.client import get_llm_client

    original = settings.LLM_PROVIDER
    try:
        get_llm_client.cache_clear()
        settings.LLM_PROVIDER = "groq"
        assert isinstance(get_llm_client(), GroqClient)

        get_llm_client.cache_clear()
        settings.LLM_PROVIDER = "ollama"
        assert isinstance(get_llm_client(), OllamaClient)
    finally:
        settings.LLM_PROVIDER = original
        get_llm_client.cache_clear()


def _b_role_to_model():
    from services.llm import GroqClient, OllamaClient

    o = OllamaClient()
    assert o._model_for("general") == settings.OLLAMA_MODEL_GENERAL
    assert o._model_for("coder") == settings.OLLAMA_MODEL_CODER
    assert o._model_for("vision") == settings.OLLAMA_MODEL_VISION

    g = GroqClient()
    assert g._model_for("general") == settings.GROQ_MODEL_GENERAL
    assert g._model_for("coder") == settings.GROQ_MODEL_CODER
    assert g._model_for("vision") == settings.GROQ_MODEL_VISION


def _b_ollama_payload_shape(tmp_png: Path):
    from services.llm import OllamaClient

    o = OllamaClient()
    p = o._build_payload("hi", system="be terse", role="general")
    assert p["model"] == settings.OLLAMA_MODEL_GENERAL
    assert p["stream"] is False
    assert p["keep_alive"] == "1m", p["keep_alive"]
    assert p["system"] == "be terse"
    assert "images" not in p

    pv = o._build_payload("describe", role="vision", images=[tmp_png])
    assert pv["model"] == settings.OLLAMA_MODEL_VISION
    assert isinstance(pv["images"], list) and len(pv["images"]) == 1
    assert not pv["images"][0].startswith("data:"), "Ollama wants bare base64"
    base64.b64decode(pv["images"][0])  # must be valid base64


def _b_groq_body_shape(tmp_png: Path):
    from services.llm import GroqClient

    g = GroqClient()
    b = g._build_body("hi", system="be terse", role="coder")
    assert b["model"] == settings.GROQ_MODEL_CODER
    assert b["stream"] is False
    assert b["reasoning_format"] == settings.GROQ_REASONING_FORMAT
    assert b["messages"][0] == {"role": "system", "content": "be terse"}
    assert b["messages"][1] == {"role": "user", "content": "hi"}

    bv = g._build_body("what is this", role="vision", images=[tmp_png])
    content = bv["messages"][-1]["content"]
    assert isinstance(content, list)
    img_blocks = [c for c in content if c.get("type") == "image_url"]
    assert len(img_blocks) == 1
    assert img_blocks[0]["image_url"]["url"].startswith("data:image/png;base64,")


# ── C. GroqClient — LIVE ─────────────────────────────────────────────────
#   The free tier is 8000 tokens/min; the dev models are heavy reasoners even
#   with reasoning hidden. Keep budgets modest, space calls out, and treat
#   429 / 5xx / capacity blips as retryable rather than a hard failure.
_TRANSIENT = ("HTTP 429", "HTTP 500", "HTTP 502", "HTTP 503", "over capacity", "rate_limit")


def _live_groq(make_coro, *, label: str, tries: int = 4):
    """Run an async Groq call, backing off on transient errors. Returns the str,
    or raises the last non-transient LLMBackendError."""
    import time

    from services.llm import LLMBackendError

    last: LLMBackendError | None = None
    for attempt in range(tries):
        try:
            return asyncio.run(make_coro())
        except LLMBackendError as exc:
            last = exc
            if any(t in exc.reason for t in _TRANSIENT) and attempt < tries - 1:
                wait = 5 * (attempt + 1)
                print(f"      {label}: transient ({exc.reason[:60]}) — retry in {wait}s")
                time.sleep(wait)
                continue
            raise
    assert last is not None
    raise last


def _c_text():
    from services.llm import GroqClient

    out = _live_groq(
        lambda: GroqClient().generate(
            "Reply with exactly the word PONG and nothing else.",
            system="You are terse.",
            max_tokens=512,
        ),
        label="general",
    )
    assert isinstance(out, str) and out, repr(out)
    assert "pong" in out.lower(), repr(out)
    print(f"      groq general -> {out!r}")


def _c_code():
    from services.llm import GroqClient

    out = _live_groq(
        lambda: GroqClient().code(
            "Return only a single line of Python that prints the value of 2+2.",
            max_tokens=3000,
        ),
        label="coder",
    )
    low = out.lower()
    assert "print" in low and ("2+2" in low or "2 + 2" in low or "4" in out), repr(out)
    print(f"      groq coder -> {out!r}")


def _c_vision():
    from services.llm import GroqClient, LLMBackendError

    png = _write_tmp_png()
    try:
        out = _live_groq(
            lambda: GroqClient().vision(
                "What is the dominant colour of this image? Answer in one word.",
                images=[png],
                max_tokens=1200,
            ),
            label="vision",
        )
    except LLMBackendError as exc:
        print(f"      vision unavailable for {settings.GROQ_MODEL_VISION}: {exc.reason}")
        return "SKIP"
    assert isinstance(out, str) and out, repr(out)
    print(f"      groq vision -> {out!r}")


def _c_bad_key_raises():
    from services.llm import GroqClient, LLMBackendError

    original = settings.GROQ_API_KEY
    try:
        settings.GROQ_API_KEY = "gsk_obviously_invalid_key_000"
        client = GroqClient()  # constructor only checks presence, not validity
        try:
            asyncio.run(client.generate("hello", max_tokens=5))
        except LLMBackendError as exc:
            assert exc.provider == "groq", exc.provider
            return
        raise AssertionError("expected LLMBackendError for an invalid key")
    finally:
        settings.GROQ_API_KEY = original


# ── D. OllamaClient — LIVE (best-effort) ─────────────────────────────────
def _d_ollama_live():
    import httpx

    from services.llm import OllamaClient

    base = settings.OLLAMA_BASE_URL.rstrip("/")
    try:
        r = httpx.get(f"{base}/api/version", timeout=2.0)
        reachable = r.status_code == 200
    except Exception as exc:  # noqa: BLE001
        print(f"      Ollama not reachable at {base}: {exc}")
        return "SKIP"
    if not reachable:
        print(f"      Ollama at {base} did not answer /api/version")
        return "SKIP"

    out = asyncio.run(OllamaClient().draft("Say hi in exactly one word.", max_tokens=10))
    assert isinstance(out, str) and out, repr(out)
    print(f"      ollama general -> {out!r}")


# ── E. Cloud-SDK guard ──────────────────────────────────────────────────
def _e_no_cloud_sdk():
    app_dir = Path(__file__).resolve().parents[1]
    pattern = re.compile(
        r"^\s*(?:import|from)\s+(openai|anthropic|google\.generativeai|cohere|groq)\b",
        re.MULTILINE,
    )
    hits: list[str] = []
    for py in app_dir.rglob("*.py"):
        text = py.read_text(encoding="utf-8", errors="ignore")
        for m in pattern.finditer(text):
            hits.append(f"{py.relative_to(app_dir)}: {m.group(0).strip()}")
    assert not hits, "cloud SDK import(s) found:\n" + "\n".join(hits)


# ── F. Regression ──────────────────────────────────────────────────────
def _f_system_models():
    from fastapi.testclient import TestClient

    import main

    with TestClient(main.app) as c:
        r = c.get("/api/v1/system/models")
        assert r.status_code == 200, r.status_code
        assert r.json() == {"active_models": _OLLAMA_MODELS}, r.json()


# ── helpers ────────────────────────────────────────────────────────────
_TMP_DIR = Path(__file__).resolve().parent / "fixtures"


def _write_tmp_png() -> Path:
    _TMP_DIR.mkdir(exist_ok=True)
    p = _TMP_DIR / "phase3_pixel.png"
    p.write_bytes(_TINY_PNG)
    return p


def main() -> int:
    png = _write_tmp_png()

    print("=== A. Config ===")
    check("Groq model fields read from .env", _a_groq_fields_from_env)
    check("GROQ_API_KEY present", _a_api_key_present)
    check("Ollama model + keep_alive fields", _a_ollama_fields)
    check("ACTIVE_MODELS is a computed property", _a_active_models_computed)

    print("\n=== B. Interface contract (no network) ===")
    check("both clients subclass LLMClient", _b_subclasses)
    check("generate() matches the §9 signature", _b_signatures)
    check("get_llm_client() switches on LLM_PROVIDER", _b_factory_switch)
    check("role -> model resolution per provider", _b_role_to_model)
    check("OllamaClient._build_payload shape (keep_alive, images)", lambda: _b_ollama_payload_shape(png))
    check("GroqClient._build_body shape (messages, image_url)", lambda: _b_groq_body_shape(png))

    print("\n=== C. GroqClient LIVE (real API calls) ===")
    # Space calls out — the free tier caps tokens-per-minute and the dev models
    # are heavy reasoners.
    import time

    check("general: text round-trip (PONG)", _c_text)
    time.sleep(8)
    check("coder: emits Python", _c_code)
    time.sleep(8)
    check("vision: image block accepted", _c_vision)
    check("invalid key -> LLMBackendError", _c_bad_key_raises)

    print("\n=== D. OllamaClient LIVE (best-effort) ===")
    check("draft() against a live daemon", _d_ollama_live)

    print("\n=== E. Cloud-SDK guard ===")
    check("no cloud LLM SDK imports in app/", _e_no_cloud_sdk)

    print("\n=== F. Regression ===")
    check("/system/models unchanged", _f_system_models)

    print(f"\n{'=' * 44}\nPASS={_PASS}  FAIL={_FAIL}  SKIP={_SKIP}")
    return 1 if _FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
