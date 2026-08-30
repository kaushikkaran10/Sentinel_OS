"""Offline vector store — persistent ChromaDB + local SentenceTransformers.

Implements 6_Vector_Store_&_Data.md:

* Embedded ``PersistentClient`` at ``data/chroma_db`` — never the HTTP/server mode.
* ``all-MiniLM-L6-v2`` loaded from ``data/models/`` with ``trust_remote_code=False``
  and HuggingFace offline env vars forced, so no HTTP call can happen at runtime.
* 500-token chunks with 50-token overlap; HTML/XML stripped, whitespace normalized.

Also provides ``query_local_knowledge(query) -> str`` — the RAG tool from
4_Agent_Logic_&_Tools.md §3.

Everything here is blocking (model inference, sqlite writes). The API layer wraps
calls in ``run_in_threadpool``; the Phase 4 agent will do the same.
"""

from __future__ import annotations

import json
import os
import threading

# ── Air-gap enforcement: must be set before the libraries import ─────────────
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
# ChromaDB ships opt-out PostHog telemetry that phones home on first use — a
# hard air-gap violation (and it blocks startup when the network is down).
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

import chromadb  # noqa: E402
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings  # noqa: E402
from chromadb.config import Settings as ChromaSettings  # noqa: E402

from core.config import (  # noqa: E402
    CHROMA_COLLECTION,
    CHROMA_DIR,
    CHUNK_OVERLAP_TOKENS,
    CHUNK_SIZE_TOKENS,
    EMBEDDING_MODEL_DIR,
    EMBEDDING_MODEL_NAME,
    RAG_TOP_K,
)
from core.logging import get_logger  # noqa: E402
from services.rag.ingest import preprocess  # noqa: E402

logger = get_logger("sentinel.rag.vector_db")


class EmbeddingModelUnavailable(RuntimeError):
    """The local embedding weights are missing. Surfaces as a 503 at the API."""


# ── Document manifest ──────────────────────────────────────────────────────
#   ChromaDB only holds *chunks*, so a stored-but-unindexed file (e.g. an image
#   awaiting OCR — chunks == 0) would be invisible to GET /kb/documents. This
#   small JSON manifest is the authoritative list of accepted documents; the
#   Chroma collection remains the authoritative vector index. It lives with the
#   vector store and survives restarts.
_REGISTRY_PATH = CHROMA_DIR / "kb_registry.json"


def _load_registry() -> dict[str, dict]:
    try:
        return json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_registry(reg: dict[str, dict]) -> None:
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _REGISTRY_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(reg, indent=2, sort_keys=True), encoding="utf-8")
    tmp.replace(_REGISTRY_PATH)


# ── Lazy singletons ─────────────────────────────────────────────────────────
#   RLock, not Lock: _get_collection() holds it while calling _get_client().
_lock = threading.RLock()
_model = None            # SentenceTransformer
_client = None           # chromadb.PersistentClient
_collection = None       # chromadb Collection


def _get_model():
    """Load ``all-MiniLM-L6-v2`` once, from local disk only."""
    global _model
    if _model is not None:
        return _model
    with _lock:
        if _model is None:
            if not (EMBEDDING_MODEL_DIR / "config.json").exists():
                raise EmbeddingModelUnavailable(
                    f"Embedding model not found at {EMBEDDING_MODEL_DIR}. "
                    "Run:  python -m services.rag.fetch_model"
                )
            from sentence_transformers import SentenceTransformer

            logger.info("Loading embedding model %s (offline)", EMBEDDING_MODEL_NAME)
            _model = SentenceTransformer(
                str(EMBEDDING_MODEL_DIR),
                device="cpu",
                trust_remote_code=False,  # 6_Vector_Store_&_Data.md §2
            )
    return _model


class _LocalEF(EmbeddingFunction[Documents]):
    """Chroma embedding function backed by the local SentenceTransformer.

    Passing this explicitly to ``get_or_create_collection`` guarantees Chroma's
    bundled ONNX MiniLM (which would download on first use) is never constructed.
    """

    def __init__(self) -> None:  # noqa: D401 - satisfies the 1.x protocol
        pass

    def __call__(self, input: Documents) -> Embeddings:
        vectors = _get_model().encode(
            list(input),
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return vectors.tolist()

    @staticmethod
    def name() -> str:
        return "sentinel-local-minilm"

    def get_config(self) -> dict:
        return {"model": EMBEDDING_MODEL_NAME}

    @staticmethod
    def build_from_config(config: dict) -> "_LocalEF":
        return _LocalEF()

    def default_space(self) -> str:
        return "cosine"


def _get_client():
    global _client
    if _client is None:
        with _lock:
            if _client is None:
                CHROMA_DIR.mkdir(parents=True, exist_ok=True)
                # PersistentClient == embedded mode (6_Vector_Store_&_Data.md §1).
                _client = chromadb.PersistentClient(
                    path=str(CHROMA_DIR),
                    settings=ChromaSettings(anonymized_telemetry=False),
                )
    return _client


def _get_collection():
    global _collection
    if _collection is None:
        with _lock:
            if _collection is None:
                _collection = _get_client().get_or_create_collection(
                    name=CHROMA_COLLECTION,
                    embedding_function=_LocalEF(),
                )
    return _collection


# ── Chunking (6_Vector_Store_&_Data.md §3) ──────────────────────────────────
def chunk_text(text: str) -> list[str]:
    """Split into ~500-token windows overlapping by 50 tokens.

    Note: all-MiniLM-L6-v2 truncates input to 256 tokens at encode time, so the
    embedding of a full 500-token chunk is driven by its first ~256 tokens. The
    chunk text is still stored and returned in full. Spec §3 fixes 500/50; this
    truncation is a documented model limitation, not a config choice.
    """
    clean = preprocess(text)
    if not clean:
        return []

    tokenizer = _get_model().tokenizer
    ids = tokenizer.encode(clean, add_special_tokens=False)
    if len(ids) <= CHUNK_SIZE_TOKENS:
        return [clean]

    step = CHUNK_SIZE_TOKENS - CHUNK_OVERLAP_TOKENS
    chunks: list[str] = []
    for start in range(0, len(ids), step):
        window = ids[start : start + CHUNK_SIZE_TOKENS]
        if not window:
            break
        chunks.append(tokenizer.decode(window, skip_special_tokens=True).strip())
        if start + CHUNK_SIZE_TOKENS >= len(ids):
            break
    return [c for c in chunks if c]


# ── Document CRUD ──────────────────────────────────────────────────────────
def add_document(doc_id: str, filename: str, category: str, text: str) -> int:
    """Chunk, embed and store a document; record it in the manifest.

    Returns the number of chunks indexed. Zero is valid — the file is still
    registered (e.g. an image awaiting OCR) so it stays listable and deletable.
    """
    chunks = chunk_text(text)
    if chunks:
        _get_collection().upsert(
            ids=[f"{doc_id}:{i}" for i in range(len(chunks))],
            documents=chunks,
            metadatas=[
                {
                    "doc_id": doc_id,
                    "filename": filename,
                    "category": category,
                    "chunk_index": i,
                }
                for i in range(len(chunks))
            ],
        )
        logger.info("Indexed %s chunk(s) for %s (%s)", len(chunks), filename, doc_id)
    else:
        logger.info("Registered %s (%s) with no indexable text", filename, doc_id)

    with _lock:
        reg = _load_registry()
        reg[doc_id] = {"filename": filename, "category": category, "chunks": len(chunks)}
        _save_registry(reg)
    return len(chunks)


def list_documents() -> list[dict]:
    """Every accepted document — ``{id, filename, chunks}`` (5_Api_Spec §2)."""
    reg = _load_registry()
    return [
        {"id": did, "filename": meta.get("filename", ""), "chunks": meta.get("chunks", 0)}
        for did, meta in reg.items()
    ]


def delete_document(doc_id: str) -> int | None:
    """Remove a document's chunks and manifest entry.

    Returns the number of chunks removed, or ``None`` if ``doc_id`` is unknown
    (so the API can answer 404). A registered image returns ``0``.
    """
    with _lock:
        reg = _load_registry()
        known = doc_id in reg
        if known:
            reg.pop(doc_id, None)
            _save_registry(reg)

    collection = _get_collection()
    existing = collection.get(where={"doc_id": doc_id}, include=[])
    count = len(existing.get("ids") or [])
    if count:
        collection.delete(where={"doc_id": doc_id})
        logger.info("Deleted %s chunk(s) for doc %s", count, doc_id)

    if not known and count == 0:
        return None
    return count


def collection_count() -> int:
    return _get_collection().count()


# ── RAG tool (4_Agent_Logic_&_Tools.md §3) ─────────────────────────────────
def query_local_knowledge(query: str) -> str:
    """Return the top-k most relevant SOP chunks as a single formatted string."""
    collection = _get_collection()
    if collection.count() == 0:
        return "No relevant knowledge found in the local knowledge base."

    res = collection.query(query_texts=[query], n_results=RAG_TOP_K)
    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    if not docs:
        return "No relevant knowledge found in the local knowledge base."

    blocks = []
    for doc, meta in zip(docs, metas):
        source = (meta or {}).get("filename", "unknown")
        blocks.append(f"[source: {source}]\n{doc.strip()}")
    return "\n\n---\n\n".join(blocks)


if __name__ == "__main__":  # pragma: no cover - dev helpers
    import sys

    cmd = sys.argv[1] if len(sys.argv) > 1 else "count"
    if cmd == "count":
        print("chunks in collection:", collection_count())
        print("documents:", list_documents())
    elif cmd == "reset":
        _get_client().delete_collection(CHROMA_COLLECTION)
        print("collection dropped:", CHROMA_COLLECTION)
    else:
        print(f"unknown command: {cmd!r} (use: count | reset)")
