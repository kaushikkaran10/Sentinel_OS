"""Phase 5 functional verification — run, don't just import.

    cd app && ../.venv/Scripts/python.exe -m scripts.verify_phase5

Covers, per the approved plan:
  A.  Upload endpoint contract     — shape, 10 MB / MIME gates, optional file
  B.  Task registry mechanics      — real asyncio.Task + Queue, done_callback pop
  C.  SSE frame formatting         — format_sse / chunk_tokens / translate (pure)
  D.  Stream consumption + cleanup — thought->token->deliverable->complete, 404 after
  E.  Client-disconnect            — task still runs to completion, callback pops
  F.  Download endpoint            — real .docx, traversal blocked, 404s
  G.  History endpoint             — from SQLite, survives a fresh checkpointer
  H.  Purge endpoint               — 24 h cutoff, SQLite untouched (§7)
  I.  GENUINE end-to-end + live SSE — real uvicorn subprocess, frames read live
  K.  Concurrent tasks             — two tabs accepted at once, execution serialized
  J.  Regression                   — verify_phase2/3/4 + telemetry + cloud-SDK guard

Offline checks use a scripted LLM stub (no network). The live check (I) needs
LLM_PROVIDER=groq + GROQ_API_KEY and spawns its own server; it SKIPs otherwise.
Prints PASS / FAIL / SKIP per check; exits non-zero on any FAIL.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import socket
import subprocess
import sys
import time
import traceback
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from io import BytesIO
from pathlib import Path

import httpx

from core.config import GENERATED_DIR, UPLOADS_DIR, settings
from core.logging import configure_logging

configure_logging()

_APP_DIR = Path(__file__).resolve().parents[1]
_FIXTURES = _APP_DIR / "scripts" / "fixtures"
_PASS = _FAIL = _SKIP = 0


def check(name: str, fn) -> None:
    global _PASS, _FAIL, _SKIP
    try:
        if fn() == "SKIP":
            _SKIP += 1
            print(f"SKIP  {name}")
        else:
            _PASS += 1
            print(f"PASS  {name}")
    except Exception as exc:  # noqa: BLE001 - report everything
        _FAIL += 1
        print(f"FAIL  {name}: {type(exc).__name__}: {exc}")
        traceback.print_exc()


# ── Scripted LLM stand-ins ───────────────────────────────────────────────
class ScriptedLLM:
    """Router -> draft; drafter -> a fixed final answer. No network."""

    def __init__(self, *, router='{"task_type":"draft"}', drafter='{"action":"final","answer":"done"}'):
        self._router, self._drafter = router, drafter

    async def draft(self, prompt, system=None, **kw):
        if system and "router" in system.lower():
            return self._router
        return self._drafter

    async def code(self, prompt, system=None, **kw):
        return "```python\nprint('noop')\n```"

    async def vision(self, prompt, images, system=None, **kw):
        return "[vision] scripted transcription"


class EchoLLM(ScriptedLLM):
    """Drafter echoes a ``MARKER-<x>`` token from the prompt — used to prove that
    concurrent tasks don't cross-contaminate each other's stream queue."""

    async def draft(self, prompt, system=None, **kw):
        if system and "router" in system.lower():
            return '{"task_type":"draft"}'
        m = re.search(r"MARKER-(\w+)", prompt or "")
        return json.dumps({"action": "final", "answer": f"final answer for {m.group(1) if m else '?'}"})


def _patch_llm(fake) -> None:
    import services.agent.nodes as nodes_mod
    import services.agent.router as router_mod

    nodes_mod.get_llm_client = lambda: fake
    router_mod.get_llm_client = lambda: fake


def _restore_llm() -> None:
    import services.agent.nodes as nodes_mod
    import services.agent.router as router_mod
    from services.llm.client import get_llm_client as real

    nodes_mod.get_llm_client = real
    router_mod.get_llm_client = real


@asynccontextmanager
async def _app_client():
    """An httpx client bound to the ASGI app, with the real lifespan running."""
    import main

    async with main.app.router.lifespan_context(main.app):
        transport = httpx.ASGITransport(app=main.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client


def _cleanup(*paths) -> None:
    for p in paths:
        try:
            if p and Path(p).exists():
                Path(p).unlink()
        except OSError:
            pass


def _snapshot_data_dirs() -> dict[Path, set[str]]:
    """Names currently in uploads/ + generated/, so a check can bin what it adds."""
    return {
        d: ({p.name for p in d.iterdir()} if d.exists() else set())
        for d in (UPLOADS_DIR, GENERATED_DIR)
    }


def _clean_new(snapshot: dict[Path, set[str]]) -> None:
    for d, before in snapshot.items():
        if d.exists():
            _cleanup(*(d / n for n in {p.name for p in d.iterdir()} - before))


def _parse_sse_line(line: str, cur: dict) -> dict | None:
    """Feed one line into ``cur``; return a completed frame on a blank line."""
    if line.startswith("event:"):
        cur["event"] = line[len("event:"):].strip()
    elif line.startswith("data:"):
        cur["data"] = json.loads(line[len("data:"):].strip())
    elif line == "" and cur.get("event"):
        frame = {"event": cur["event"], "data": cur.get("data", {})}
        cur.clear()
        return frame
    return None


async def _drain_stream(client: httpx.AsyncClient, task_id: str) -> list[dict]:
    """Consume an SSE stream to the ``complete`` sentinel; return (ts, event, data)."""
    frames: list[dict] = []
    cur: dict = {}
    async with client.stream("GET", f"/api/v1/workspace/stream/{task_id}") as r:
        assert r.status_code == 200, r.status_code
        async for line in r.aiter_lines():
            frame = _parse_sse_line(line, cur)
            if frame is None:
                continue
            frame["ts"] = time.monotonic()
            frames.append(frame)
            if frame["event"] == "complete":
                break
    return frames


# ── A. Upload endpoint contract ─────────────────────────────────────────
def _a_upload_contract():
    async def run():
        _patch_llm(ScriptedLLM(drafter='{"action":"final","answer":"a short drafted note"}'))
        made: list[str] = []
        snap = _snapshot_data_dirs()  # bins the stored upload + any deliverable
        try:
            async with _app_client() as c:
                # happy path
                r = await c.post(
                    "/api/v1/workspace/task",
                    data={"prompt": "summarise the SOP"},
                    files={"file": ("a.txt", b"hello world", "text/plain")},
                )
                assert r.status_code == 200, (r.status_code, r.text)
                body = r.json()
                assert set(body) == {"task_id", "status", "task_type"}, body
                assert body["status"] == "queued" and body["task_type"] == "auto_detect", body
                uuid.UUID(body["task_id"])  # raises if not a uuid
                from services.workspace import registry

                assert registry.get(body["task_id"]) is not None
                frames = await _drain_stream(c, body["task_id"])
                fid = next(f["data"]["file_id"] for f in frames if f["event"] == "deliverable")
                made.append(str(GENERATED_DIR / fid))

                # 10 MB gate
                big = b"x" * (settings.MAX_UPLOAD_BYTES + 1)
                r = await c.post(
                    "/api/v1/workspace/task",
                    data={"prompt": "x"},
                    files={"file": ("big.txt", big, "text/plain")},
                )
                assert r.status_code == 400, r.status_code
                assert r.json() == {"detail": "Validation error: file exceeds 10 MB limit"}, r.json()

                # MIME allowlist gate
                r = await c.post(
                    "/api/v1/workspace/task",
                    data={"prompt": "x"},
                    files={"file": ("x.bin", b"\x00\x01", "application/octet-stream")},
                )
                assert r.status_code == 400, r.status_code
                assert r.json() == {"detail": "Validation error: unsupported file type"}, r.json()

                # missing prompt -> 422 with the pinned list shape
                r = await c.post(
                    "/api/v1/workspace/task",
                    files={"file": ("a.txt", b"hi", "text/plain")},
                )
                assert r.status_code == 422, r.status_code
                assert isinstance(r.json()["detail"], list), r.json()

                # prompt-only (file optional) -> queued
                r = await c.post("/api/v1/workspace/task", data={"prompt": "draft with no file"})
                assert r.status_code == 200, (r.status_code, r.text)
                tid = r.json()["task_id"]
                frames = await _drain_stream(c, tid)
                fid = next(f["data"]["file_id"] for f in frames if f["event"] == "deliverable")
                made.append(str(GENERATED_DIR / fid))
        finally:
            _restore_llm()
            _cleanup(*made)
            _clean_new(snap)

    asyncio.run(run())


# ── B. Task registry mechanics ─────────────────────────────────────────
def _b_registry():
    async def run():
        _patch_llm(ScriptedLLM())
        made: list[str] = []
        try:
            async with _app_client():
                from services.workspace import registry
                from services.workspace.runner import start_task

                ts = start_task("hello registry", None)
                assert isinstance(ts.task, asyncio.Task), type(ts.task)
                assert isinstance(ts.queue, asyncio.Queue), type(ts.queue)
                assert registry.get(ts.task_id) is ts

                await asyncio.wait_for(ts.task, timeout=30)
                assert registry.get(ts.task_id) is None, "done_callback did not pop the registry"

                frames = []
                while not ts.queue.empty():
                    frames.append(ts.queue.get_nowait())
                assert frames[-1]["event"] == "complete", frames[-1]
                assert set(frames[-1]["data"]) == {"file_id"}, frames[-1]
                assert isinstance(frames[-1]["data"]["file_id"], str), frames[-1]
                made.append(str(GENERATED_DIR / frames[-1]["data"]["file_id"]))
        finally:
            _restore_llm()
            _cleanup(*made)

    asyncio.run(run())


# ── C. SSE frame formatting (pure, no app) ─────────────────────────────
def _c_formatting():
    from services.workspace.events import chunk_tokens, format_sse, translate

    assert format_sse({"event": "thought", "data": {"msg": "x"}}) == 'event: thought\ndata: {"msg": "x"}\n\n'

    text = " ".join(f"w{i}" for i in range(40))
    chunks = chunk_tokens(text)
    assert len(chunks) > 1 and "".join(chunks) == text, chunks

    tf = translate({"tool_execution": {"messages": [
        {"role": "tool", "name": "query_local_knowledge", "content": "some retrieved text"}
    ]}})
    assert len(tf) == 1 and tf[0]["event"] == "tool_call", tf
    assert tf[0]["data"]["tool"] == "query_local_knowledge" and tf[0]["data"]["ok"] is True, tf
    assert "preview" in tf[0]["data"], tf

    df = translate({"drafter": {"pending_tool_call": None, "messages": [
        {"role": "assistant", "name": "drafter", "content": "alpha beta gamma delta epsilon zeta eta"}
    ]}})
    assert df and all(f["event"] == "token" for f in df), df
    assert "".join(f["data"]["text"] for f in df) == "alpha beta gamma delta epsilon zeta eta", df

    rf = translate({"router": {"task_type": "draft", "messages": [
        {"content": "[router] draft (llm classification)"}
    ]}})
    assert len(rf) == 1 and rf[0]["event"] == "thought" and rf[0]["data"]["task_type"] == "draft", rf


# ── D. Stream consumption + finally cleanup ────────────────────────────
def _d_stream_cleanup():
    answer = " ".join(f"word{i}" for i in range(30))

    async def run():
        _patch_llm(ScriptedLLM(drafter=json.dumps({"action": "final", "answer": answer})))
        made: list[str] = []
        try:
            async with _app_client() as c:
                r = await c.post("/api/v1/workspace/task", data={"prompt": "draft it"})
                task_id = r.json()["task_id"]
                frames = await _drain_stream(c, task_id)

                events = [f["event"] for f in frames]
                assert "thought" in events and "token" in events, events
                assert events.index("thought") < events.index("token"), events
                assert events[-1] == "complete", events
                deliverable = next(f for f in frames if f["event"] == "deliverable")
                fid = deliverable["data"]["file_id"]
                assert fid.endswith(".docx") and (GENERATED_DIR / fid).exists(), fid
                made.append(str(GENERATED_DIR / fid))

                from services.workspace import registry

                assert registry.get(task_id) is None, "stream finally did not pop the registry"
                r = await c.get(f"/api/v1/workspace/stream/{task_id}")
                assert r.status_code == 404, r.status_code
                assert r.json() == {"detail": "Validation error: unknown task_id"}, r.json()

                from services.workspace.history import list_task_history

                hist_ids = {t["task_id"] for t in await list_task_history()}
                assert task_id in hist_ids, "completed task missing from history (checkpoint lost)"
                assert (GENERATED_DIR / fid).exists(), "deliverable removed by cleanup"
        finally:
            _restore_llm()
            _cleanup(*made)

    asyncio.run(run())


# ── E. Client-disconnect: task completes anyway ───────────────────────
def _e_client_disconnect():
    async def run():
        _patch_llm(ScriptedLLM(drafter='{"action":"final","answer":"finished without a listener"}'))
        made: list[str] = []
        try:
            async with _app_client():
                from services.workspace import registry
                from services.workspace.history import list_task_history
                from services.workspace.runner import start_task

                ts = start_task("nobody is listening MARKER-none", None)
                # deliberately never touch ts.queue
                await asyncio.wait_for(ts.task, timeout=30)

                assert ts.task.done() and ts.task.exception() is None, ts.task
                assert registry.get(ts.task_id) is None, "done_callback did not pop"
                assert ts.file_id and (GENERATED_DIR / ts.file_id).exists(), ts.file_id
                made.append(str(GENERATED_DIR / ts.file_id))
                assert ts.task_id in {t["task_id"] for t in await list_task_history()}
        finally:
            _restore_llm()
            _cleanup(*made)

    asyncio.run(run())


# ── F. Download endpoint ─────────────────────────────────────────────
def _f_download():
    from services.tools.file_maker import generate_approval_note

    real = generate_approval_note("verify_phase5 download check", {"defects": 3})
    fid = Path(real).name

    async def run():
        try:
            async with _app_client() as c:
                r = await c.get(f"/api/v1/workspace/download/{fid}")
                assert r.status_code == 200, r.status_code
                assert r.headers["content-type"] == (
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ), r.headers["content-type"]
                assert r.content[:4] == b"PK\x03\x04", r.content[:8]
                assert "attachment" in r.headers.get("content-disposition", ""), r.headers

                r = await c.get("/api/v1/workspace/download/..%2F..%2Fcore%2Fconfig.py")
                assert r.status_code == 404, (r.status_code, r.text)
                r = await c.get("/api/v1/workspace/download/does_not_exist.docx")
                assert r.status_code == 404, r.status_code
        finally:
            _cleanup(real)

    asyncio.run(run())


# ── G. History endpoint ─────────────────────────────────────────────
def _g_history():
    async def run():
        _patch_llm(ScriptedLLM(drafter='{"action":"final","answer":"history check note"}'))
        made: list[str] = []
        try:
            async with _app_client() as c:
                ids: dict[str, str] = {}
                for tag in ("hist-one", "hist-two"):
                    r = await c.post("/api/v1/workspace/task", data={"prompt": f"draft {tag}"})
                    tid = r.json()["task_id"]
                    ids[tag] = tid
                    frames = await _drain_stream(c, tid)
                    fid = next(f["data"]["file_id"] for f in frames if f["event"] == "deliverable")
                    made.append(str(GENERATED_DIR / fid))

                r = await c.get("/api/v1/workspace/history")
                assert r.status_code == 200, r.status_code
                tasks = r.json()["tasks"]
                by_id = {t["task_id"]: t for t in tasks}
                assert len(by_id) == len(tasks), "duplicate task_id in history"
                for tag, tid in ids.items():
                    assert tid in by_id, (tid, list(by_id)[:5])
                    assert f"draft {tag}" == by_id[tid]["prompt"], by_id[tid]
                    datetime.fromisoformat(by_id[tid]["timestamp"])  # ISO-8601 or raises
                stamps = [t["timestamp"] for t in tasks]
                assert stamps == sorted(stamps, reverse=True), "history not newest-first"

                # survives a fresh checkpointer (simulated restart)
                from services.agent.orchestrator import close_checkpointer
                from services.workspace.history import list_task_history

                await close_checkpointer()
                again = {t["task_id"] for t in await list_task_history()}
                assert ids["hist-one"] in again and ids["hist-two"] in again, "history lost after restart"
        finally:
            _restore_llm()
            _cleanup(*made)

    asyncio.run(run())


# ── H. Purge endpoint (§7) ──────────────────────────────────────────
def _h_purge():
    async def run():
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        GENERATED_DIR.mkdir(parents=True, exist_ok=True)
        old_stamp = time.time() - 25 * 3600

        old_up = UPLOADS_DIR / "p5_old_upload.txt"
        old_gen = GENERATED_DIR / "p5_old_gen.docx"
        fresh_up = UPLOADS_DIR / "p5_fresh_upload.txt"
        fresh_gen = GENERATED_DIR / "p5_fresh_gen.docx"
        for p in (old_up, old_gen, fresh_up, fresh_gen):
            p.write_bytes(b"x" * 32)
        os.utime(old_up, (old_stamp, old_stamp))
        os.utime(old_gen, (old_stamp, old_stamp))

        db_mtime_before = settings.LANGGRAPH_DB.stat().st_mtime if settings.LANGGRAPH_DB.exists() else None

        try:
            async with _app_client() as c:
                r = await c.request("DELETE", "/api/v1/system/purge")
                assert r.status_code == 200, (r.status_code, r.text)
                body = r.json()
                assert body["deleted"] >= 2 and body["freed_bytes"] > 0, body

                assert not old_up.exists() and not old_gen.exists(), "old files not purged"
                assert fresh_up.exists() and fresh_gen.exists(), "fresh files wrongly purged"

                if db_mtime_before is not None:
                    assert settings.LANGGRAPH_DB.stat().st_mtime == db_mtime_before, "checkpointer DB touched"
                assert settings.CHROMA_DIR.exists(), "chroma_db removed"

                r = await c.get("/api/v1/workspace/history")
                assert r.status_code == 200, r.status_code
        finally:
            _cleanup(old_up, old_gen, fresh_up, fresh_gen)

    asyncio.run(run())


# ── I. GENUINE end-to-end + live SSE (real uvicorn subprocess) ────────
def _i_live_e2e():
    if settings.LLM_PROVIDER != "groq" or not (settings.GROQ_API_KEY or "").strip():
        print("      LLM_PROVIDER!=groq or no key — skipping live end-to-end")
        return "SKIP"

    from docx import Document

    port = _free_port()
    fixture = _FIXTURES / "sample_sop.txt"
    if not fixture.exists():
        _FIXTURES.mkdir(parents=True, exist_ok=True)
        fixture.write_text("SOP: wear gloves and a visor near the press.\n", encoding="utf-8")

    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--workers", "1",
         "--port", str(port), "--log-level", "warning"],
        cwd=str(_APP_DIR),
    )
    base = f"http://127.0.0.1:{port}"
    made: list[str] = []
    # Snapshot so we can bin every file the live run leaves behind (the drafter's
    # tool loop can emit several intermediate .docx before the final one).
    gen_before = {p.name for p in GENERATED_DIR.iterdir()} if GENERATED_DIR.exists() else set()
    up_before = {p.name for p in UPLOADS_DIR.iterdir()} if UPLOADS_DIR.exists() else set()

    async def run():
        # wait for readiness
        async with httpx.AsyncClient() as c:
            for _ in range(60):
                if proc.poll() is not None:
                    raise AssertionError(f"uvicorn exited early ({proc.returncode})")
                try:
                    if (await c.get(f"{base}/health", timeout=2)).status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(0.5)
            else:
                raise AssertionError("server did not become ready in 30 s")

        last_err = "no attempt"
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=90) as c:
                    with fixture.open("rb") as fh:
                        r = await c.post(
                            f"{base}/api/v1/workspace/task",
                            data={"prompt": "Draft an approval note. Metrics: defects 3, pass rate 98%."},
                            files={"file": ("sample_sop.txt", fh, "text/plain")},
                        )
                    assert r.status_code == 200, (r.status_code, r.text)
                    body = r.json()
                    assert set(body) == {"task_id", "status", "task_type"}, body
                    task_id = body["task_id"]

                    timeline: list[tuple[float, str, dict]] = []
                    cur: dict = {}
                    async with c.stream("GET", f"{base}/api/v1/workspace/stream/{task_id}") as sr:
                        assert sr.status_code == 200, sr.status_code
                        assert sr.headers["content-type"].startswith("text/event-stream"), sr.headers
                        async for line in sr.aiter_lines():
                            frame = _parse_sse_line(line, cur)
                            if frame is None:
                                continue
                            timeline.append((time.monotonic(), frame["event"], frame["data"]))
                            if frame["event"] == "complete":
                                break

                    events = [e for _, e, _ in timeline]
                    assert len(timeline) >= 3, events
                    assert "thought" in events and "deliverable" in events and "complete" in events, events
                    assert events[-1] == "complete", events
                    first_ts, last_ts = timeline[0][0], timeline[-1][0]
                    complete_ts = next(t for t, e, _ in timeline if e == "complete")
                    assert last_ts - first_ts >= 0.05, f"frames not spread over time: {last_ts - first_ts:.4f}s"
                    assert complete_ts > first_ts, "sentinel arrived with the first frame"

                    fid = next(d["file_id"] for _, e, d in timeline if e == "deliverable")
                    assert fid.endswith(".docx"), fid
                    made.append(str(GENERATED_DIR / fid))

                    dr = await c.get(f"{base}/api/v1/workspace/download/{fid}")
                    assert dr.status_code == 200 and dr.content[:4] == b"PK\x03\x04", dr.status_code
                    doc = Document(BytesIO(dr.content))
                    assert any(p.text.strip() for p in doc.paragraphs), "downloaded .docx has no text"

                    hr = await c.get(f"{base}/api/v1/workspace/history")
                    hit = next((t for t in hr.json()["tasks"] if t["task_id"] == task_id), None)
                    assert hit and "approval note" in hit["prompt"].lower(), hit

                    sr2 = await c.get(f"{base}/api/v1/workspace/stream/{task_id}")
                    assert sr2.status_code == 404, sr2.status_code

                    print(f"      live SSE timeline -> {events}  (spread {last_ts - first_ts:.2f}s)")
                    return
            except AssertionError:
                raise
            except Exception as exc:  # noqa: BLE001 - transient Groq/network blip
                last_err = f"{type(exc).__name__}: {exc}"
                print(f"      live attempt {attempt} inconclusive ({last_err}) — retrying")
                await asyncio.sleep(6 * (attempt + 1))
        raise AssertionError(f"live end-to-end never succeeded in 3 attempts — last: {last_err}")

    try:
        asyncio.run(run())
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        _cleanup(*made)
        for d, before in ((GENERATED_DIR, gen_before), (UPLOADS_DIR, up_before)):
            if d.exists():
                _cleanup(*(d / n for n in {p.name for p in d.iterdir()} - before))


# ── K. Concurrent tasks — accepted together, execution serialized ─────
def _k_concurrent():
    async def run():
        _patch_llm(EchoLLM())
        made: list[str] = []
        try:
            async with _app_client() as c:
                from services.workspace import registry

                ra, rb = await asyncio.gather(
                    c.post("/api/v1/workspace/task", data={"prompt": "draft A MARKER-alpha"}),
                    c.post("/api/v1/workspace/task", data={"prompt": "draft B MARKER-beta"}),
                )
                assert ra.status_code == 200 and rb.status_code == 200, (ra.status_code, rb.status_code)
                id_a, id_b = ra.json()["task_id"], rb.json()["task_id"]
                assert id_a != id_b
                ts_a, ts_b = registry.get(id_a), registry.get(id_b)
                assert ts_a is not None and ts_b is not None and ts_a is not ts_b
                assert ts_a.queue is not ts_b.queue

                frames_a, frames_b = await asyncio.gather(
                    _drain_stream(c, id_a), _drain_stream(c, id_b)
                )

                def _summary(frames):
                    tokens = "".join(f["data"]["text"] for f in frames if f["event"] == "token")
                    fid = next(f["data"]["file_id"] for f in frames if f["event"] == "deliverable")
                    return tokens, fid

                tok_a, fid_a = _summary(frames_a)
                tok_b, fid_b = _summary(frames_b)
                made += [str(GENERATED_DIR / fid_a), str(GENERATED_DIR / fid_b)]

                assert "alpha" in tok_a and "beta" not in tok_a, tok_a
                assert "beta" in tok_b and "alpha" not in tok_b, tok_b
                assert fid_a != fid_b
                assert (GENERATED_DIR / fid_a).exists() and (GENERATED_DIR / fid_b).exists()
                assert frames_a[-1]["event"] == "complete" and frames_b[-1]["event"] == "complete"
                assert registry.get(id_a) is None and registry.get(id_b) is None

                # serialization: the two exec windows must not overlap
                for ts in (ts_a, ts_b):
                    assert ts.exec_started_at is not None and ts.exec_finished_at is not None, ts
                earlier, later = sorted((ts_a, ts_b), key=lambda t: t.exec_started_at)
                assert later.exec_started_at >= earlier.exec_finished_at, (
                    f"exec windows overlap: earlier=[{earlier.exec_started_at:.4f},{earlier.exec_finished_at:.4f}] "
                    f"later starts {later.exec_started_at:.4f}"
                )

                from services.workspace.history import list_task_history

                hist = {t["task_id"] for t in await list_task_history()}
                assert id_a in hist and id_b in hist
        finally:
            _restore_llm()
            _cleanup(*made)

    asyncio.run(run())


# ── J. Regression ───────────────────────────────────────────────────
def _j_verify_phase(mod: str):
    r = subprocess.run(
        [sys.executable, "-m", f"scripts.{mod}"],
        cwd=str(_APP_DIR), capture_output=True, text=True, timeout=1800,
    )
    tail = "\n".join(r.stdout.strip().splitlines()[-3:])
    print(f"      {mod}: {tail}")
    assert r.returncode == 0, f"{mod} exited {r.returncode}\n{r.stdout[-2000:]}\n{r.stderr[-800:]}"


def _j_system_unchanged():
    from fastapi.testclient import TestClient

    import main

    with TestClient(main.app) as c:
        assert c.get("/api/v1/system/models").json() == {
            "active_models": ["llama3.1:8b", "qwen2.5-coder:7b", "qwen2.5-vl:latest"]
        }
        t = c.get("/api/v1/system/telemetry")
        assert t.status_code == 200 and t.json()["air_gapped"] is True, t.json()


def _j_no_cloud_sdk():
    pattern = re.compile(
        r"^\s*(?:import|from)\s+(openai|anthropic|google\.generativeai|cohere|groq)\b", re.MULTILINE
    )
    hits = []
    for py in _APP_DIR.rglob("*.py"):
        for m in pattern.finditer(py.read_text(encoding="utf-8", errors="ignore")):
            hits.append(f"{py.relative_to(_APP_DIR)}: {m.group(0).strip()}")
    assert not hits, "cloud SDK import(s):\n" + "\n".join(hits)


def _j_lifespan_ok():
    from fastapi.testclient import TestClient

    import main

    with TestClient(main.app):
        pass  # enter + exit the lifespan (shutdown_all + close_checkpointer) cleanly


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def main() -> int:
    print("=== A. Upload endpoint contract (offline, stub LLM) ===")
    check("shape + 10 MB / MIME gates + optional file", _a_upload_contract)

    print("\n=== B. Task registry mechanics (offline) ===")
    check("real asyncio.Task + Queue; done_callback pops; sentinel shape", _b_registry)

    print("\n=== C. SSE frame formatting (pure) ===")
    check("format_sse / chunk_tokens / translate", _c_formatting)

    print("\n=== D. Stream consumption + finally cleanup (offline) ===")
    check("thought->token->deliverable->complete; 404 + registry pop after", _d_stream_cleanup)

    print("\n=== E. Client-disconnect: task still completes (offline) ===")
    check("no queue consumer; task finishes; callback pops; deliverable on disk", _e_client_disconnect)

    print("\n=== F. Download endpoint (offline) ===")
    check("real .docx served; traversal + unknown -> 404", _f_download)

    print("\n=== G. History endpoint (offline) ===")
    check("2 runs listed with prompt+timestamp; survives fresh checkpointer", _g_history)

    print("\n=== H. Purge endpoint — 24 h cutoff (§7) ===")
    check("old removed, fresh kept, SQLite + chroma untouched", _h_purge)

    print("\n=== I. GENUINE end-to-end + live SSE (real uvicorn subprocess) ===")
    check("upload -> live streamed frames -> downloadable .docx", _i_live_e2e)

    print("\n=== K. Concurrent tasks — accepted together, execution serialized ===")
    check("two tabs; no queue leakage; non-overlapping exec windows", _k_concurrent)

    print("\n=== J. Regression ===")
    check("scripts.verify_phase2 still passes", lambda: _j_verify_phase("verify_phase2"))
    check("scripts.verify_phase3 still passes", lambda: _j_verify_phase("verify_phase3"))
    check("scripts.verify_phase4 still passes", lambda: _j_verify_phase("verify_phase4"))
    check("/system/models + /system/telemetry unchanged", _j_system_unchanged)
    check("no cloud LLM SDK imports in app/", _j_no_cloud_sdk)
    check("app lifespan enters + exits cleanly", _j_lifespan_ok)

    print(f"\n{'=' * 46}\nPASS={_PASS}  FAIL={_FAIL}  SKIP={_SKIP}")
    return 1 if _FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
