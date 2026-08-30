"""Request/response models for the Local Knowledge Base endpoints (5_Api_Spec.md §2)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class KBDocument(BaseModel):
    """One indexed document in the knowledge base."""

    id: str = Field(..., description="Server-assigned document id (uuid4).")
    filename: str = Field(..., examples=["welding_sop.pdf"])
    chunks: int = Field(..., ge=0, description="Number of embedded chunks stored.")


class KBDocumentList(BaseModel):
    """GET /api/v1/kb/documents."""

    documents: list[KBDocument]


class KBUploadResponse(BaseModel):
    """POST /api/v1/kb/documents."""

    id: str
    filename: str
    category: str
    chunks: int = Field(..., ge=0)
    warning: str | None = Field(
        None,
        description="Set when the file was stored but produced no embeddings "
        "(e.g. an image awaiting OCR).",
    )


class KBDeleteResponse(BaseModel):
    """DELETE /api/v1/kb/documents/{doc_id}."""

    id: str
    deleted_chunks: int = Field(..., ge=0)
