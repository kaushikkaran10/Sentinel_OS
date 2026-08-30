"""Generate small, dependency-free fixtures for the Phase 2 KB-endpoint checks.

    cd app && ../.venv/Scripts/python.exe -m scripts.make_fixtures

Writes into ``app/scripts/fixtures/``:
    sample_sop.txt   plain-text SOP
    sample_sop.pdf   minimal valid 1-page PDF with extractable text
    sample.png       1x1 PNG
    bad.bin          tiny application/octet-stream payload
"""

from __future__ import annotations

import base64
from pathlib import Path

FIX = Path(__file__).resolve().parent / "fixtures"

PDF_TEXT = "SAFETY SOP: Always wear cut-resistant gloves and a face visor near the press."
TXT_BODY = (
    "LOCKOUT / TAGOUT SOP\n"
    "1. Notify the area supervisor before isolating any equipment.\n"
    "2. Apply your personal lock and tag to the energy-isolation point.\n"
    "3. Verify zero energy state with a calibrated meter before work begins.\n"
    "4. Only the person who applied a lock may remove it.\n"
)

# 1x1 transparent PNG
_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _minimal_pdf(text: str) -> bytes:
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    stream = b"BT /F1 14 Tf 72 720 Td (" + text.encode("latin-1") + b") Tj ET"
    objs.append(b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream))

    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n%s\nendobj\n" % (i, body)

    xref_pos = len(out)
    out += b"xref\n0 %d\n" % (len(objs) + 1)
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF" % (
        len(objs) + 1,
        xref_pos,
    )
    return bytes(out)


def main() -> None:
    FIX.mkdir(parents=True, exist_ok=True)
    (FIX / "sample_sop.txt").write_text(TXT_BODY, encoding="utf-8")
    (FIX / "sample_sop.pdf").write_bytes(_minimal_pdf(PDF_TEXT))
    (FIX / "sample.png").write_bytes(base64.b64decode(_PNG_B64))
    (FIX / "bad.bin").write_bytes(b"\x00\x01\x02not a real document\x03\x04")
    for p in sorted(FIX.iterdir()):
        print(f"{p.name:16} {p.stat().st_size:>8} bytes")


if __name__ == "__main__":
    main()
