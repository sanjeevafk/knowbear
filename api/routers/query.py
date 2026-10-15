"""Query endpoints for generating explanations."""

import asyncio
import hashlib
import json
import time

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator
from .schemas import ErrorResponse, RateLimitResponse

from collections.abc import AsyncIterator, Iterator
from typing import cast

from logging_config import logger
from services.ensemble import ensemble_generate
from services.inference import generate_stream_explanation
from services.upstash_redis import get_upstash_redis_client
from token_rate_limit import TokenRateLimitExceeded
from utils import LEVELS, sanitize_topic

router = APIRouter(tags=["query"])

ALL_LEVELS = LEVELS
MAX_LEVELS_PER_QUERY = 4
RESPONSE_CACHE_TTL_SECONDS = 300
_response_cache: dict[str, tuple[float, str]] = {}


class QueryRequest(BaseModel):
    topic: str = Field(
        default="", 
        max_length=2000,
        description="The educational topic, system, or protocol to search and explain.",
        json_schema_extra={"example": "TCP/IP Layers"}
    )
    image: str | None = Field(
        default=None,
        description="Base64 data URL or raw base64 string of screenshot or diagram image.",
        json_schema_extra={"example": "data:image/png;base64,iVBORw0..."}
    )
    levels: list[str] = Field(
        default=ALL_LEVELS,
        description="The target explanation depth levels.",
        json_schema_extra={"example": ["eli5", "eli12"]}
    )
    mode: str | None = Field(
        default=None,
        description="Optional generation mode parameter (legacy).",
        json_schema_extra={"example": "standard"}
    )
    retrieval: str | None = Field(
        default=None, 
        description="Legacy web retrieval parameter (deprecated, ignored).",
        json_schema_extra={"example": "auto"}
    )
    temperature: float = Field(
        0.7,
        ge=0.0,
        le=1.5,
        description="Sampling temperature for creativity control.",
        json_schema_extra={"example": 0.7}
    )
    regenerate: bool = Field(
        False,
        description="Forces new search and generation bypassing cached data.",
        json_schema_extra={"example": False}
    )

    @model_validator(mode="after")
    def validate_topic_or_image(self):
        topic_clean = (self.topic or "").strip()
        if not topic_clean and not self.image:
            raise ValueError("Either a topic or an image must be provided.")
        if not topic_clean and self.image:
            self.topic = "Explain this image or diagram"
        return self



class QueryResponse(BaseModel):
    topic: str = Field(
        ...,
        description="Sanitized input topic.",
        json_schema_extra={"example": "TCP/IP Layers"}
    )
    explanations: dict[str, str] = Field(
        ...,
        description="Map of explanation levels to generated markdown content.",
        json_schema_extra={
            "example": {
                "eli5": "Think of the internet like a post office...",
                "eli12": "TCP/IP layers organize protocol responsibilities..."
            }
        }
    )


def _normalize_mode(mode: str | None) -> str:
    return "standard"


def _normalize_levels(levels: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for level in levels:
        if level not in ALL_LEVELS or level in seen:
            continue
        seen.add(level)
        normalized.append(level)
        if len(normalized) >= MAX_LEVELS_PER_QUERY:
            break
    return normalized


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _cache_key(topic: str, level: str, mode: str | None = None, image: str | None = None) -> str:
    if image:
        img_hash = hashlib.sha256(image.encode()).hexdigest()[:12]
        return f"query_cache:{topic.lower()}::{img_hash}::{level}"
    return f"query_cache:{topic.lower()}::{level}"


async def _cache_get(key: str) -> str | None:
    hit = _response_cache.get(key)
    if hit:
        expires_at, value = hit
        if expires_at > time.time():
            return value
        _response_cache.pop(key, None)

    redis = get_upstash_redis_client()
    if redis.configured:
        remote = await redis.get(key)
        if remote:
            _response_cache[key] = (time.time() + RESPONSE_CACHE_TTL_SECONDS, remote)
            return remote
    return None


async def _cache_set(key: str, value: str) -> None:
    redis = get_upstash_redis_client()
    if redis.configured:
        await redis.setex(key, RESPONSE_CACHE_TTL_SECONDS, value)

    _response_cache[key] = (time.time() + RESPONSE_CACHE_TTL_SECONDS, value)


async def _stream_chunks(stream: AsyncIterator[str] | Iterator[str]):
    if isinstance(stream, AsyncIterator):
        async for chunk in stream:
            yield chunk
        return

    for chunk in cast(Iterator[str], stream):
        yield chunk
        await asyncio.sleep(0)


@router.post(
    "/query",
    response_model=QueryResponse,
    summary="Batch Generate Explanations",
    description="Synchronously generates explanations for a topic across all requested levels.",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid parameters or topic validation failure"},
        429: {"model": RateLimitResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error during LLM generation"}
    }
)
async def query_topic(req: QueryRequest, request: Request) -> QueryResponse:
    """Generate explanations for a topic."""
    req.mode = _normalize_mode(req.mode)
    client_ip = _get_client_ip(request)

    try:
        topic = sanitize_topic(req.topic)
    except ValueError as e:
        logger.warning(
            "query_topic_invalid",
            reason=str(e),
            topic_sample=(req.topic[:80] if isinstance(req.topic, str) else "<non-string>"),
        )
        raise HTTPException(400, str(e)) from e

    levels = _normalize_levels(req.levels)
    if not levels:
        levels = ["eli5"]
    if len(req.levels) > len(levels):
        logger.info("query_levels_normalized", requested=req.levels, normalized=levels)

    explanations: dict[str, str] = {}
    logger.info("query_start_generation", topic=topic, levels=levels, mode=req.mode)
    tasks: dict[str, asyncio.Task[str]] = {}
    for level in levels:
        key = _cache_key(topic, level, req.mode, req.image)
        if not req.regenerate:
            cached = await _cache_get(key)
            if cached:
                explanations[level] = cached
                continue
        tasks[level] = asyncio.create_task(
            ensemble_generate(topic, level, req.mode, client_ip=client_ip, image_data=req.image)
        )

    results = await asyncio.gather(*tasks.values(), return_exceptions=True) if tasks else []
    for level, result in zip(tasks.keys(), results):
        if isinstance(result, str):
            explanations[level] = result
            if not req.regenerate:
                await _cache_set(_cache_key(topic, level, req.mode, req.image), result)
        elif isinstance(result, TokenRateLimitExceeded):
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Token rate limit exceeded",
                    "message": result.message,
                    "retry_after_seconds": result.retry_after_seconds,
                    "retry_at_utc": result.retry_at_utc,
                },
            ) from result
        else:
            error_msg = str(result) if result else "Unknown error"
            explanations[level] = f"Error generating {level}: {error_msg}"
            logger.error("query_generation_failed", level=level, error=error_msg)

    return QueryResponse(topic=topic, explanations=explanations)


@router.post(
    "/query/stream",
    summary="Stream Explanation (SSE)",
    description=(
        "Establishes a Server-Sent Events (SSE) stream yielding real-time chunks of "
        "the explanation for the first target level (defaults to eli5)."
    ),
    responses={
        200: {
            "description": "Stream opened successfully",
            "content": {
                "text/event-stream": {
                    "schema": {
                        "type": "string",
                        "description": "Event-stream payload lines containing JSON data structure"
                    }
                }
            }
        },
        400: {"model": ErrorResponse, "description": "Invalid request parameters"},
        429: {"model": RateLimitResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def query_topic_stream(req: QueryRequest, request: Request):
    """Stream explanations for a topic."""
    req.mode = _normalize_mode(req.mode)
    client_ip = _get_client_ip(request)

    try:
        topic = sanitize_topic(req.topic)
    except ValueError as e:
        logger.warning(
            "query_stream_topic_invalid",
            reason=str(e),
            topic_sample=(req.topic[:80] if isinstance(req.topic, str) else "<non-string>"),
        )
        raise HTTPException(400, str(e)) from e

    level = req.levels[0] if req.levels and req.levels[0] in ALL_LEVELS else "eli5"
    cache_key = _cache_key(topic, level, req.mode, req.image)
    if not req.regenerate:
        cached = await _cache_get(cache_key)
        if cached:
            async def cached_event_generator():
                yield f"data: {json.dumps({'topic': topic, 'level': level})}\n\n"
                yield f"data: {json.dumps({'chunk': cached})}\n\n"
                yield "data: [DONE]\n\n"

            return StreamingResponse(cached_event_generator(), media_type="text/event-stream")

    async def event_generator():
        full_content = ""
        buffer = ""
        last_flush_time = asyncio.get_event_loop().time()

        try:
            yield f"data: {json.dumps({'topic': topic, 'level': level})}\n\n"

            token_count = 0
            chunk_count = 0
            avg_chunk_size = 0.0

            stream = generate_stream_explanation(
                topic,
                level,
                mode=req.mode,
                is_pro=False,
                temperature=req.temperature,
                regenerate=req.regenerate,
                client_ip=client_ip,
                image_data=req.image,
            )
            async for chunk in _stream_chunks(stream):
                full_content += chunk
                chunk_count += 1
                avg_chunk_size = (avg_chunk_size * (chunk_count - 1) + len(chunk)) / chunk_count

                if "__TRUNCATED__" in chunk:
                    chunk = chunk.replace("__TRUNCATED__", "")
                    if chunk:
                        buffer += chunk
                        if buffer:
                            yield f"data: {json.dumps({'chunk': buffer})}\n\n"
                            buffer = ""
                    yield f"data: {json.dumps({'warning': 'Response may be incomplete due to length limits. Try regenerating.'})}\n\n"
                    break

                buffer += chunk
                token_count += len(chunk.split())
                current_time = asyncio.get_event_loop().time()
                dynamic_timeout = 0.15 if avg_chunk_size > 10 else 0.25

                should_flush = (
                    token_count < 10
                    or buffer.endswith("\n\n")
                    or len(buffer) > 50
                    or buffer.endswith(". ")
                    or buffer.endswith("! ")
                    or buffer.endswith("? ")
                    or buffer.endswith(".\n")
                    or buffer.endswith("!\n")
                    or buffer.endswith("?\n")
                    or buffer.endswith(": ")
                    or buffer.endswith(";\n")
                    or (current_time - last_flush_time) > dynamic_timeout
                )

                if should_flush and buffer:
                    yield f"data: {json.dumps({'chunk': buffer})}\n\n"
                    buffer = ""
                    last_flush_time = current_time

            if buffer:
                yield f"data: {json.dumps({'chunk': buffer})}\n\n"

            if full_content and not req.regenerate:
                await _cache_set(cache_key, full_content)
            yield "data: [DONE]\n\n"

        except TokenRateLimitExceeded as e:
            logger.warning("streaming_token_rate_limited", error=str(e), topic=topic)
            yield f"data: {json.dumps({'error': e.message})}\n\n"
        except Exception as e:
            logger.error("streaming_failed", error=str(e), topic=topic)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
