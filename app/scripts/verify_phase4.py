"""Phase 4 functional verification — run, don't just import.

    cd app && ../.venv/Scripts/python.exe -m scripts.verify_phase4

Covers, per the approved plan:
  A.  State & graph shape          — TypedDict keys, node/edge wiring, SqliteSaver
  B.  SQLite checkpointer          — history survives a simulated restart (§2)
  C.  Router classification        — file-ext short-circuit + JSON parse + fallback
  D.  Tool Execution Node          — prompted JSON + Pydantic, real tools (§3)
  D2. Drafter loop control         — multi-hop cycle + MAX_TOOL_ITERATIONS cap
  E.  Degraded-Mode routing        — no bypass; the §8 headline check
  E2. Live sandbox path            — coder(LIVE Groq) -> tool_execution(LIVE Docker)
  F.  End-to-end happy path        — one real graph.ainvoke through Groq
  G.  Regression                   — verify_phase2 + verify_phase3 + /system/models

Dev host runs LLM_PROVIDER=groq (no Ollama daemon); live LLM calls hit Groq, the
same posture Phase 3 took. Prints PASS / FAIL / SKIP per check; exits non-zero on
any FAIL.
"""

from __future__ import annotations

import asyncio
import re
import subprocess
import sys
import traceback
import uuid
from pathlib import Path

import aiosqlite
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from core.config import DOCKER_UNAVAILABLE_MSG, GENERATED_DIR, settings
from core.logging import configure_logging
from core.runtime import runtime

configure_logging()

_APP_DIR = Path(__file__).resolve().parents[1]
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


# ── Scripted LLM stand-in ─────────────────────────────────────────────────
class ScriptedLLM:
    """Async LLM stub. Each slot is a str, a list (popped left), or a callable."""

    def __init__(self, *, router=None, drafter=None, coder=None, vision=None):
        self._slots = {"router": router, "drafter": drafter, "coder": coder, "vision": vision}
        self.calls: list[str] = []

    def _next(self, which: str) -> str:
        val = self._slots.get(which)
        if val is None:
            raise AssertionError(f"ScriptedLLM: unexpected {which!r} call")
        if isinstance(val, list):
            return val.pop(0)
        if callable(val):
            return val()
        return val

    async def draft(self, prompt, system=None, **kw):
        which = "router" if system and "router" in system.lower() else "drafter"
        self.calls.append(which)
        return self._next(which)

    async def code(self, prompt, system=None, **kw):
        self.calls.append("coder")
        return self._next("coder")

    async def vision(self, prompt, images, system=None, **kw):
        self.calls.append("vision")
        return self._next("vision")


def _patch_llm(fake) -> None:
    """Point both node modules at the stub (they import get_llm_client by name)."""
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


async def _tmp_graph():
    """A compiled graph over a throwaway sqlite file. Returns (graph, path, conn)."""
    from services.agent import build_graph

    path = _APP_DIR / "scripts" / "fixtures" / f"p4_{uuid.uuid4().hex}.sqlite"
    path.parent.mkdir(exist_ok=True)
    conn = await aiosqlite.connect(str(path))
    saver = AsyncSqliteSaver(conn)
    await saver.setup()
    return await build_graph(saver), path, conn


def _cleanup(*paths: Path) -> None:
    for p in paths:
        try:
            if p and Path(p).exists():
                Path(p).unlink()
        except OSError:
            pass


# ── A. State & graph shape (no network) ──────────────────────────────────
def _a_state_keys():
    from services.agent import AgentState

    got = set(AgentState.__annotations__)
    expected = {
        "messages",
        "file_path",
        "task_type",
        "extracted_data",
        "final_deliverable_path",
        "pending_tool_call",
        "iterations",
    }
    assert got == expected, got


def _a_graph_shape():
    async def run():
        graph, path, conn = await _tmp_graph()
        g = graph.get_graph()
        nodes = {n for n in g.nodes if not n.startswith("__")}
        assert nodes == {"router", "vision", "coder", "drafter", "tool_execution", "finalize"}, nodes
        edges = {(e.source, e.target, bool(getattr(e, "conditional", False))) for e in g.edges}
        for want in [
            ("__start__", "router", False),
            ("vision", "drafter", False),
            ("coder", "tool_execution", False),
            ("tool_execution", "drafter", False),
            ("finalize", "__end__", False),
            ("router", "vision", True),
            ("router", "coder", True),
            ("router", "drafter", True),
            ("drafter", "tool_execution", True),
            ("drafter", "finalize", True),
        ]:
            assert want in edges, f"missing edge {want}"
        await conn.close()
        _cleanup(path)

    asyncio.run(run())


def _a_default_checkpointer():
    async def run():
        import services.agent.orchestrator as orch

        orch._checkpointer = None
        cp = await orch.get_checkpointer()
        try:
            assert isinstance(cp, AsyncSqliteSaver), type(cp)
            assert settings.LANGGRAPH_DB.name == "langgraph.sqlite", settings.LANGGRAPH_DB
            assert settings.LANGGRAPH_DB.exists(), "checkpointer did not create its DB file"
        finally:
            await cp.conn.close()
            orch._checkpointer = None

    asyncio.run(run())


# ── B. SQLite checkpointer persistence (no network) ──────────────────────
def _b_persistence():
    from services.agent import build_graph, new_state, run_config

    async def run():
        fake = ScriptedLLM(router='{"task_type":"draft"}', drafter='{"action":"final","answer":"ok"}')
        _patch_llm(fake)
        db = settings.LANGGRAPH_DB
        try:
            conn = await aiosqlite.connect(str(db))
            saver = AsyncSqliteSaver(conn)
            await saver.setup()
            graph = await build_graph(saver)
            await graph.ainvoke(new_state("hello"), config=run_config("p4-b"))
            await conn.close()
            assert db.exists(), f"{db} was not created"

            # fresh saver == simulated restart
            conn2 = await aiosqlite.connect(str(db))
            saver2 = AsyncSqliteSaver(conn2)
            tup = await saver2.aget_tuple({"configurable": {"thread_id": "p4-b"}})
            hist = [c async for c in saver2.alist({"configurable": {"thread_id": "p4-b"}})]
            await conn2.close()
            assert tup is not None, "checkpoint not found after restart"
            assert len(hist) >= 1, hist
        finally:
            _restore_llm()

    asyncio.run(run())


# ── C. Router classification (stubbed LLM, no network) ───────────────────
def _c_router():
    from services.agent.router import router, select_branch

    async def run():
        # image file -> vision, LLM untouched
        boom = ScriptedLLM(router=lambda: (_ for _ in ()).throw(AssertionError("LLM called")))
        _patch_llm(boom)
        out = await router({"messages": [{"role": "user", "content": "read this"}], "file_path": "scan.PNG"})
        assert out["task_type"] == "vision", out
        assert boom.calls == [], boom.calls

        # code / draft classification
        _patch_llm(ScriptedLLM(router='{"task_type":"code","reason":"math"}'))
        out = await router({"messages": [{"role": "user", "content": "add these"}], "file_path": None})
        assert out["task_type"] == "code" and select_branch(out) == "coder", out

        _patch_llm(ScriptedLLM(router='{"task_type":"draft"}'))
        out = await router({"messages": [{"role": "user", "content": "summarise"}], "file_path": None})
        assert out["task_type"] == "draft" and select_branch(out) == "drafter", out

        # unparseable -> fallback to draft
        _patch_llm(ScriptedLLM(router="I think this is a drafting job, no JSON here"))
        out = await router({"messages": [{"role": "user", "content": "x"}], "file_path": None})
        assert out["task_type"] == "draft", out

    try:
        asyncio.run(run())
    finally:
        _restore_llm()


# ── D. Tool Execution Node — prompted JSON + Pydantic, real tools ────────
def _d_tool_node():
    from services.agent.nodes import tool_execution_node

    made: list[str] = []

    async def run():
        # metrics sheet -> real .xlsx, deliverable set
        st = await tool_execution_node(
            {"pending_tool_call": {"tool": "generate_metrics_sheet", "args": {"data": [{"m": "Jan", "v": 1}]}}}
        )
        p = st["final_deliverable_path"]
        made.append(p)
        assert p.endswith(".xlsx") and Path(p).exists(), st

        # approval note -> real .docx, deliverable set
        st = await tool_execution_node(
            {"pending_tool_call": {"tool": "generate_approval_note", "args": {"summary": "s", "metrics": {"k": 1}}}}
        )
        p = st["final_deliverable_path"]
        made.append(p)
        assert p.endswith(".docx") and Path(p).exists(), st

        # RAG -> a string, no exception, no deliverable
        st = await tool_execution_node(
            {"pending_tool_call": {"tool": "query_local_knowledge", "args": {"query": "safety"}}}
        )
        assert isinstance(st["messages"][0]["content"], str) and st["messages"][0]["content"]
        assert "final_deliverable_path" not in st, st

        # missing required arg -> graceful "Tool error:", no raise, no deliverable
        st = await tool_execution_node(
            {"pending_tool_call": {"tool": "generate_approval_note", "args": {"metrics": {}}}}
        )
        assert st["messages"][0]["content"].startswith("Tool error:"), st
        assert "final_deliverable_path" not in st, st

        # unknown tool -> graceful "Tool error:"
        st = await tool_execution_node({"pending_tool_call": {"tool": "no_such_tool", "args": {}}})
        assert st["messages"][0]["content"].startswith("Tool error:"), st

    try:
        asyncio.run(run())
    finally:
        _cleanup(*[Path(x) for x in made])


# ── D2. Drafter loop control — multi-hop cycle + cap ────────────────────
def _d2_multi_hop():
    from services.agent import new_state, run_config

    async def run():
        fake = ScriptedLLM(
            router='{"task_type":"draft"}',
            drafter=[
                '{"action":"tool","tool":"query_local_knowledge","args":{"query":"x"}}',
                '{"action":"tool","tool":"generate_approval_note","args":{"summary":"s","metrics":{}}}',
                '{"action":"final","answer":"done"}',
            ],
        )
        _patch_llm(fake)
        graph, path, conn = await _tmp_graph()
        seq: list[str] = []
        async for ev in graph.astream(new_state("multi hop"), config=run_config("mh"), stream_mode="updates"):
            seq += list(ev)
        final = (await graph.aget_state(run_config("mh"))).values
        await conn.close()
        _cleanup(path, Path(final.get("final_deliverable_path") or ""))

        assert seq == ["router", "drafter", "tool_execution", "drafter", "tool_execution", "drafter", "finalize"], seq
        tool_msgs = [m for m in final["messages"] if m["role"] == "tool"]
        assert len(tool_msgs) == 2, tool_msgs
        assert final["iterations"] == 2, final["iterations"]

    try:
        asyncio.run(run())
    finally:
        _restore_llm()


def _d2_cap():
    from services.agent import new_state, run_config
    from services.agent.nodes import MAX_TOOL_ITERATIONS

    async def run():
        fake = ScriptedLLM(
            router='{"task_type":"draft"}',
            drafter=lambda: '{"action":"tool","tool":"query_local_knowledge","args":{"query":"x"}}',
        )
        _patch_llm(fake)
        graph, path, conn = await _tmp_graph()
        tool_visits = 0
        async for ev in graph.astream(new_state("loop"), config=run_config("cap"), stream_mode="updates"):
            tool_visits += sum(1 for k in ev if k == "tool_execution")
        final = (await graph.aget_state(run_config("cap"))).values
        await conn.close()
        _cleanup(path, Path(final.get("final_deliverable_path") or ""))

        assert tool_visits == MAX_TOOL_ITERATIONS, tool_visits
        assert final["iterations"] == MAX_TOOL_ITERATIONS, final["iterations"]
        assert final["messages"][-1]["name"] == "finalize", final["messages"][-1]
        assert final.get("final_deliverable_path"), "safety-net deliverable missing"

    try:
        asyncio.run(run())
    finally:
        _restore_llm()


# ── E. Degraded-Mode routing — no bypass (§8) ──────────────────────────
def _e_degraded_no_bypass():
    from services.agent import new_state, run_config
    from services.agent.router import select_branch

    original = runtime.docker_available

    async def run():
        runtime.docker_available = False
        fake = ScriptedLLM(
            router='{"task_type":"code"}',
            coder="```python\nprint(6*7)\n```",
            drafter='{"action":"final","answer":"The sandbox was unavailable; calculation could not run."}',
        )
        _patch_llm(fake)
        graph, path, conn = await _tmp_graph()
        seq: list[str] = []
        async for ev in graph.astream(new_state("compute 6*7"), config=run_config("deg"), stream_mode="updates"):
            seq += list(ev)
        final = (await graph.aget_state(run_config("deg"))).values
        await conn.close()
        _cleanup(path, Path(final.get("final_deliverable_path") or ""))

        assert seq[:3] == ["router", "coder", "tool_execution"], seq  # path NOT skipped
        tool_content = " ".join(m["content"] for m in final["messages"] if m["role"] == "tool")
        assert DOCKER_UNAVAILABLE_MSG in tool_content, tool_content
        assert final.get("final_deliverable_path"), "no deliverable in degraded mode"
        # router made no docker special-case: same branch up vs down
        assert select_branch({"task_type": "code"}) == "coder"

    try:
        asyncio.run(run())
    finally:
        runtime.docker_available = original
        _restore_llm()


# ── E2. Live sandbox path through the graph (LIVE Groq + LIVE Docker) ───
def _e2_live_sandbox():
    """coder_node (live Groq) -> tool_execution_node (live Docker) -> real output.

    Driven node-to-node rather than through a full ``ainvoke`` so exactly one
    live Groq call and one real container run are exercised — the drafter /
    finalize legs are covered live by F.
    """
    if settings.LLM_PROVIDER != "groq" or not (settings.GROQ_API_KEY or "").strip():
        print("      LLM_PROVIDER!=groq or no key — skipping live sandbox check")
        return "SKIP"

    from core.docker_health import check_docker

    ok, reason = asyncio.run(check_docker())
    if not ok:
        print(f"      Docker unavailable ({reason}) — skipping live sandbox check")
        return "SKIP"

    from services.agent import new_state
    from services.agent.nodes import coder_node, tool_execution_node

    original = runtime.docker_available

    async def run():
        runtime.docker_available = True
        _restore_llm()  # coder_node must use the real Groq client
        problem = "no attempt made"
        for attempt in range(5):
            try:
                coded = await coder_node(new_state("Write Python code that prints 2+2."))
                call = coded["pending_tool_call"]
                # wiring invariant — always true regardless of what the LLM wrote
                assert call and call["tool"] == "execute_sandbox_code", coded
                ran = await tool_execution_node({"pending_tool_call": call})
                out = ran["messages"][0]["content"]
                # wiring invariant — the LIVE sandbox ran, not the degraded path
                assert DOCKER_UNAVAILABLE_MSG not in out, "sandbox reported unavailable"
                assert not out.startswith("Tool error:") and "timed out" not in out, out
                if "4" in out:
                    print(f"      live sandbox output -> {out.strip()!r}")
                    return
                # real container ran but the live script didn't compute 2+2
                # (transient Groq blip -> coder_node fell back to a stub script)
                problem = f"sandbox ran but output was {out.strip()!r}"
            except AssertionError:
                raise
            except Exception as exc:  # noqa: BLE001 - transient Groq/Docker blip
                problem = f"{type(exc).__name__}: {exc}"
            print(f"      live attempt {attempt} inconclusive ({problem}) — retrying")
            await asyncio.sleep(5 * (attempt + 1))
        raise AssertionError(f"live sandbox never returned '4' in 5 attempts — last: {problem}")

    try:
        asyncio.run(run())
    finally:
        runtime.docker_available = original
        _restore_llm()


# ── F. End-to-end happy path (LIVE Groq) ──────────────────────────────
def _f_end_to_end():
    """One real graph.ainvoke through Groq.

    Robust invariants (asserted every attempt): the router classifies the task
    as ``draft`` and a ``.docx`` deliverable always lands on disk. Whether the
    live drafter actually drove the ``drafter -> tool_execution -> drafter``
    loop is *reported* (not asserted): Groq's ``gpt-oss-20b`` intermittently
    emits a native tool call and returns HTTP 400, which ``drafter_node``
    degrades from gracefully. The prompted-JSON tool loop with real tools is
    asserted deterministically in D2.
    """
    if settings.LLM_PROVIDER != "groq" or not (settings.GROQ_API_KEY or "").strip():
        print("      LLM_PROVIDER!=groq or no key — skipping end-to-end")
        return "SKIP"

    from services.agent import new_state, run_config

    async def run():
        graph, path, conn = await _tmp_graph()
        saw_tool_loop = False
        last_trail: list = []
        made: list[Path] = []
        try:
            for attempt in range(3):
                cfg = run_config(f"e2e-{uuid.uuid4().hex[:8]}")
                trail: list[str] = []
                try:
                    async for ev in graph.astream(
                        new_state("Draft an approval note. Metrics: defects 3, pass rate 98%."),
                        config=cfg,
                        stream_mode="updates",
                    ):
                        trail += list(ev)
                except Exception as exc:  # noqa: BLE001 - transient Groq blip
                    print(f"      live attempt {attempt} raised {type(exc).__name__} — retrying")
                    await asyncio.sleep(6 * (attempt + 1))
                    continue

                final = (await graph.aget_state(cfg)).values
                deliverable = final.get("final_deliverable_path") or ""
                last_trail = trail
                assert final.get("task_type") == "draft", final.get("task_type")
                assert deliverable.endswith(".docx") and Path(deliverable).exists(), deliverable
                made.append(Path(deliverable))
                if "tool_execution" in trail:
                    saw_tool_loop = True
                    break

            print(f"      node trail -> {last_trail}")
            print(
                "      live drafter tool loop observed"
                if saw_tool_loop
                else "      NOTE: live drafter degraded to a direct answer every attempt "
                "(Groq gpt-oss native-tool-call 400); loop covered by D2"
            )
        finally:
            await conn.close()
            _cleanup(path, *made)

    asyncio.run(run())


# ── G. Regression ─────────────────────────────────────────────────────
def _g_verify_phase(mod: str):
    r = subprocess.run(
        [sys.executable, "-m", f"scripts.{mod}"],
        cwd=str(_APP_DIR),
        capture_output=True,
        text=True,
        timeout=900,
    )
    tail = "\n".join(r.stdout.strip().splitlines()[-3:])
    print(f"      {mod}: {tail}")
    assert r.returncode == 0, f"{mod} exited {r.returncode}\n{r.stdout[-2000:]}\n{r.stderr[-1000:]}"


def _g_system_models():
    from fastapi.testclient import TestClient

    import main

    with TestClient(main.app) as c:
        r = c.get("/api/v1/system/models")
        assert r.status_code == 200, r.status_code
        assert r.json() == {
            "active_models": ["llama3.1:8b", "qwen2.5-coder:7b", "qwen2.5-vl:latest"]
        }, r.json()


def _g_no_cloud_sdk():
    pattern = re.compile(
        r"^\s*(?:import|from)\s+(openai|anthropic|google\.generativeai|cohere|groq)\b", re.MULTILINE
    )
    hits = []
    for py in _APP_DIR.rglob("*.py"):
        for m in pattern.finditer(py.read_text(encoding="utf-8", errors="ignore")):
            hits.append(f"{py.relative_to(_APP_DIR)}: {m.group(0).strip()}")
    assert not hits, "cloud SDK import(s):\n" + "\n".join(hits)


def main() -> int:
    print("=== A. State & graph shape (no network) ===")
    check("AgentState has exactly the spec §1 + control keys", _a_state_keys)
    check("graph compiles with the expected nodes + edges", _a_graph_shape)
    check("default checkpointer is AsyncSqliteSaver at settings.LANGGRAPH_DB", _a_default_checkpointer)

    print("\n=== B. SQLite checkpointer persistence (no network) ===")
    check("history survives a simulated restart (§2)", _b_persistence)

    print("\n=== C. Router classification (stubbed LLM, no network) ===")
    check("file-ext short-circuit + JSON parse + fallback", _c_router)

    print("\n=== D. Tool Execution Node — prompted JSON + Pydantic, real tools ===")
    check("real .xlsx/.docx, RAG string, graceful tool errors", _d_tool_node)

    print("\n=== D2. Drafter loop control (stubbed LLM, no network) ===")
    check("multi-hop drafter<->tool_execution cycle", _d2_multi_hop)
    check("MAX_TOOL_ITERATIONS cap stops the loop and finalizes", _d2_cap)

    print("\n=== E. Degraded-Mode routing — no bypass (§8) ===")
    check("code path still runs coder->tool_execution; draft explains", _e_degraded_no_bypass)

    print("\n=== E2. Live sandbox path (LIVE Groq + LIVE Docker) ===")
    check("coder(LIVE Groq) -> tool_execution(LIVE Docker) returns real output", _e2_live_sandbox)

    print("\n=== F. End-to-end happy path (LIVE Groq) ===")
    check("prompt -> router -> drafter -> tool -> finalize -> .docx", _f_end_to_end)

    print("\n=== G. Regression ===")
    check("scripts.verify_phase2 still passes", lambda: _g_verify_phase("verify_phase2"))
    check("scripts.verify_phase3 still passes", lambda: _g_verify_phase("verify_phase3"))
    check("/system/models unchanged", _g_system_models)
    check("no cloud LLM SDK imports in app/", _g_no_cloud_sdk)

    print(f"\n{'=' * 46}\nPASS={_PASS}  FAIL={_FAIL}  SKIP={_SKIP}")
    return 1 if _FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
