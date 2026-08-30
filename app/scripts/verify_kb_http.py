"""Section C — /api/v1/kb/* HTTP checks against a running server.

    Terminal 1:  cd app && ../.venv/Scripts/python.exe -m uvicorn main:app --workers 1 --port 8000
    Terminal 2:  cd app && ../.venv/Scripts/python.exe -m scripts.make_fixtures
                 cd app && ../.venv/Scripts/python.exe -m scripts.verify_kb_http

Uses httpx (already a dependency) — no curl/jq needed. Prints PASS/FAIL per
check; exits non-zero on any failure. Pass --base to point elsewhere.
"""

from __future__ import annotations

import sys
from pathlib import Path

import httpx

BASE = "http://127.0.0.1:8000/api/v1"
if "--base" in sys.argv:
    BASE = sys.argv[sys.argv.index("--base") + 1]

FIX = Path(__file__).resolve().parent / "fixtures"
TXT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

_PASS = 0
_FAIL = 0


def check(name: str, fn) -> None:
    global _PASS, _FAIL
    try:
        fn()
        _PASS += 1
        print(f"PASS  {name}")
    except Exception as exc:  # noqa: BLE001
        _FAIL += 1
        print(f"FAIL  {name}: {type(exc).__name__}: {exc}")


state: dict[str, str] = {}


def _post(path: str, filename: str, mime: str, category: str) -> httpx.Response:
    with open(FIX / filename, "rb") as fh:
        return httpx.post(
            f"{BASE}{path}",
            files={"file": (filename, fh, mime)},
            data={"category": category},
            timeout=30,
        )


def c_txt():
    r = _post("/kb/documents", "sample_sop.txt", "text/plain", "Safety")
    assert r.status_code == 200, (r.status_code, r.text)
    body = r.json()
    assert body["chunks"] > 0 and body["warning"] is None, body
    state["txt_id"] = body["id"]


def c_pdf():
    r = _post("/kb/documents", "sample_sop.pdf", "application/pdf", "Ops")
    assert r.status_code == 200, (r.status_code, r.text)
    body = r.json()
    assert body["chunks"] >= 1, body
    state["pdf_id"] = body["id"]


def c_png():
    r = _post("/kb/documents", "sample.png", "image/png", "Scans")
    assert r.status_code == 200, (r.status_code, r.text)
    body = r.json()
    assert body["chunks"] == 0 and body["warning"] and "OCR" in body["warning"], body
    state["png_id"] = body["id"]


def c_bad_type():
    r = _post("/kb/documents", "bad.bin", "application/octet-stream", "X")
    assert r.status_code == 400, (r.status_code, r.text)
    assert r.json()["detail"] == "Validation error: unsupported file type", r.text


def c_oversize():
    big = FIX / "_big.tmp"
    big.write_bytes(b"0" * 11_000_000)
    try:
        with open(big, "rb") as fh:
            r = httpx.post(
                f"{BASE}/kb/documents",
                files={"file": ("_big.tmp", fh, "text/plain")},
                data={"category": "X"},
                timeout=30,
            )
        assert r.status_code == 400, (r.status_code, r.text)
        assert r.json()["detail"] == "Validation error: file exceeds 10 MB limit", r.text
    finally:
        big.unlink(missing_ok=True)


def c_missing_category():
    with open(FIX / "sample_sop.txt", "rb") as fh:
        r = httpx.post(
            f"{BASE}/kb/documents",
            files={"file": ("sample_sop.txt", fh, "text/plain")},
            timeout=30,
        )
    assert r.status_code == 422, (r.status_code, r.text)


def c_list():
    r = httpx.get(f"{BASE}/kb/documents", timeout=30)
    assert r.status_code == 200, r.text
    ids = {d["id"] for d in r.json()["documents"]}
    for key in ("txt_id", "pdf_id", "png_id"):
        assert state[key] in ids, f"{key} {state[key]} not in {ids}"
    by_id = {d["id"]: d for d in r.json()["documents"]}
    assert by_id[state["txt_id"]]["chunks"] > 0
    assert by_id[state["png_id"]]["chunks"] == 0


def c_delete():
    r = httpx.delete(f"{BASE}/kb/documents/{state['txt_id']}", timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["deleted_chunks"] > 0, r.text
    r2 = httpx.get(f"{BASE}/kb/documents", timeout=30)
    assert state["txt_id"] not in {d["id"] for d in r2.json()["documents"]}


def c_delete_unknown():
    r = httpx.delete(f"{BASE}/kb/documents/does-not-exist", timeout=30)
    assert r.status_code == 404, (r.status_code, r.text)


def c_openapi():
    r = httpx.get("http://127.0.0.1:8000/openapi.json", timeout=30)
    paths = r.json()["paths"]
    assert "/api/v1/kb/documents" in paths
    assert "/api/v1/kb/documents/{doc_id}" in paths


def c_phase1_regression():
    for path in ("/", "/health"):
        assert httpx.get(f"http://127.0.0.1:8000{path}", timeout=30).status_code == 200
    for path in ("/system/telemetry", "/system/models"):
        assert httpx.get(f"{BASE}{path}", timeout=30).status_code == 200


def main() -> int:
    try:
        httpx.get("http://127.0.0.1:8000/health", timeout=5)
    except Exception:
        print("FAIL  server not reachable on :8000 — start uvicorn first.")
        return 2

    check("POST .txt indexes chunks", c_txt)
    check("POST .pdf indexes chunks", c_pdf)
    check("POST .png stored, 0 chunks, OCR warning", c_png)
    check("POST unsupported type -> 400 contract string", c_bad_type)
    check("POST >10MB -> 400 contract string", c_oversize)
    check("POST without category -> 422", c_missing_category)
    check("GET lists all uploaded docs with chunk counts", c_list)
    check("DELETE removes doc; GET no longer lists it", c_delete)
    check("DELETE unknown id -> 404", c_delete_unknown)
    check("openapi.json exposes /kb paths", c_openapi)
    check("Phase 1 endpoints still 200", c_phase1_regression)

    print(f"\n{'=' * 40}\nPASS={_PASS}  FAIL={_FAIL}")
    print(f"kept doc ids (for restart-persistence check): pdf={state.get('pdf_id')} png={state.get('png_id')}")
    return 1 if _FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
