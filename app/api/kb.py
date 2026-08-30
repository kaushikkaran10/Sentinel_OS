"""Local Knowledge Base (RAG) endpoints — 5_Api_Spec.md §2.

    POST   /api/v1/kb/documents          upload + chunk + embed
    GET    /api/v1/kb/documents          list indexed documents
    DELETE /api/v1/kb/documents/{doc_id} drop a document's vectors

Upload constraints come from 8_Decisions_2.md §6 (10 MB max, MIME allowlist).
Blocking work (text extraction, embedding) runs in a worker thread so the event
loop stays free (3_Architecture.md concurrency rule).
"""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from core.config import ALLOWED_MIME_TYPES, UPLOADS_DIR, settings
from core.logging import get_logger
from schemas.errors import ErrorResponse
from schemas.kb import KBDeleteResponse, KBDocument, KBDocumentList, KBUploadResponse
from services.rag import vector_db
from services.rag.ingest import MIME_JPG, MIME_PNG, extract_text

logger = get_logger("sentinel.api.kb")

router = APIRouter(prefix="/kb", tags=["kb"])

_400 = {400: {"model": ErrorResponse, "description": "Validation error"}}
_404 = {404: {"model": ErrorResponse, "description": "Document not found"}}
_503 = {503: {"model": ErrorResponse, "description": "Dependency unavailable"}}


def _bad_request(reason: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Validation error: {reason}")


@router.post(
    "/documents",
    response_model=KBUploadResponse,
    responses={**_400, **_503},
    summary="Add a document to the local knowledge base",
)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(...),
) -> KBUploadResponse:
    content = await file.read()

    if len(content) > settings.MAX_UPLOAD_BYTES:
        raise _bad_request("file exceeds 10 MB limit")

    mime = file.content_type or "application/octet-stream"
    if mime not in ALLOWED_MIME_TYPES:
        raise _bad_request("unsupported file type")

    doc_id = str(uuid.uuid4())
    safe_name = Path(file.filename or "upload").name
    stored_path = UPLOADS_DIR / f"{doc_id}_{safe_name}"
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    stored_path.write_bytes(content)

    text = await run_in_threadpool(extract_text, stored_path, mime)

    try:
        chunks = await run_in_threadpool(
            vector_db.add_document, doc_id, safe_name, category, text
        )
    except vector_db.EmbeddingModelUnavailable as exc:
        logger.error("Embedding model unavailable: %s", exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dependency failure: embedding model unavailable",
        ) from exc

    warning: str | None = None
    if chunks == 0:
        if mime in (MIME_PNG, MIME_JPG):
            warning = "No text extracted (image requires OCR); stored but not indexed."
        else:
            warning = "No text extracted; stored but not indexed."
        logger.info("Stored %s with 0 chunks (%s)", safe_name, mime)

    return KBUploadResponse(
        id=doc_id, filename=safe_name, category=category, chunks=chunks, warning=warning
    )


@router.get(
    "/documents",
    response_model=KBDocumentList,
    responses=_503,
    summary="List indexed knowledge-base documents",
)
async def list_documents() -> KBDocumentList:
    docs = await run_in_threadpool(vector_db.list_documents)
    return KBDocumentList(documents=[KBDocument(**d) for d in docs])


@router.delete(
    "/documents/{doc_id}",
    response_model=KBDeleteResponse,
    responses={**_404, **_503},
    summary="Remove a document's vectors from the knowledge base",
)
async def delete_document(doc_id: str) -> KBDeleteResponse:
    deleted = await run_in_threadpool(vector_db.delete_document, doc_id)
    if deleted is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Validation error: document not found"
        )
    return KBDeleteResponse(id=doc_id, deleted_chunks=deleted)
