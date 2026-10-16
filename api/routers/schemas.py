"""Shared API schemas for OpenAPI documentation."""

from pydantic import BaseModel, Field

class ErrorResponse(BaseModel):
    """Standard error response model."""
    error: str = Field(
        ..., 
        description="Error category or summary of the failure", 
        json_schema_extra={"example": "Service Unavailable"}
    )
    detail: str = Field(
        ..., 
        description="Detailed context explaining the failure", 
        json_schema_extra={"example": "OpenRouter generation failed: timeout"}
    )
    request_id: str | None = Field(
        None, 
        description="Unique request trace identifier for debugging", 
        json_schema_extra={"example": "5a27e360-163f-4dfa-8a5e-3ea23ef8cf4c"}
    )

class RateLimitDetail(BaseModel):
    """Detailed parameters for rate limit violations."""
    message: str = Field(
        ..., 
        description="Explanation of the token rate limit threshold", 
        json_schema_extra={"example": "Token budget exceeded for this IP. Limit: 12000 tokens/hour."}
    )
    retry_after_seconds: int = Field(
        ..., 
        description="Cool-down duration in seconds required before retrying the query", 
        json_schema_extra={"example": 3540}
    )
    retry_at_utc: str = Field(
        ..., 
        description="UTC Timestamp in ISO 8601 format indicating when queries can resume", 
        json_schema_extra={"example": "2026-07-13T22:08:52Z"}
    )

class RateLimitResponse(BaseModel):
    """Rate limit error response model."""
    error: str = Field(
        "Token rate limit exceeded", 
        description="Rate limit category explanation", 
        json_schema_extra={"example": "Token rate limit exceeded"}
    )
    detail: RateLimitDetail = Field(
        ..., 
        description="Structured rate limit details containing cooldown timers"
    )
    request_id: str | None = Field(
        None, 
        description="Unique request trace identifier for debugging", 
        json_schema_extra={"example": "5a27e360-163f-4dfa-8a5e-3ea23ef8cf4c"}
    )
