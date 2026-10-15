"""Pinned topics endpoint."""

from fastapi import APIRouter, Response
from pydantic import BaseModel, Field
from .schemas import ErrorResponse

router = APIRouter(tags=["pinned"])


class PinnedTopic(BaseModel):
    """Schema representing a curated starter topic."""

    id: str = Field(
        ...,
        description="Unique identifier/slug for the pinned topic",
        json_schema_extra={"example": "tcp-ip"}
    )
    title: str = Field(
        ...,
        description="User-facing title of the topic",
        json_schema_extra={"example": "TCP/IP Layers"}
    )
    description: str = Field(
        ...,
        description="Brief summary explaining what the topic covers",
        json_schema_extra={"example": "Protocols and responsibilities by layer."}
    )


PINNED_TOPICS = [
    {"id": "tcp-ip", "title": "TCP/IP Layers", "description": "Protocols and responsibilities by layer."},
    {"id": "osi", "title": "OSI Model", "description": "A clean reference for network fundamentals."},
    {"id": "climate-change", "title": "Climate Change", "description": "Causes, impacts, and practical responses."},
    {"id": "rag", "title": "How LLM RAG Works", "description": "Retrieval + generation in practice."},
]


@router.get(
    "/pinned",
    response_model=list[PinnedTopic],
    summary="Get Curated Pinned Topics",
    description=(
        "Retrieves a curated list of educational starter topics. "
        "The response includes cache-control headers enabling client-side and CDN caching."
    ),
    responses={
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def get_pinned(response: Response = Response()) -> list[PinnedTopic]:
    """Return curated pinned topics."""
    response.headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=604800"
    return PINNED_TOPICS

