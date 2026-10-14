"""Inference service."""

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from prompts import PROMPTS
from logging_config import logger
from services.search import search_service



async def close_client():
    """No-op as ModelProvider manages its own clients."""
    pass


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError)),
    reraise=True
)
async def call_model(model: str, prompt: str, max_tokens: int = 1024, **kwargs) -> str:
    """Call API with given model and prompt."""
    from services.model_provider import ModelProvider
    
    provider = ModelProvider.get_instance()
    
    task = kwargs.get("task", "general")
    if model in ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "deep_dive"]:
         task = "coding"
            
    try:
        result = await provider.route_inference(
            prompt=prompt, 
            task=task,
            model=model,
            **kwargs
        )

        return result["content"]
    except Exception as e:
         logger.error("inference_failed", error=str(e), model=model)
         raise e



async def generate_explanation(topic: str, level: str, model: str = "openai/gpt-oss-20b", **kwargs) -> str:
    """Generate explanation for topic at given level."""
    template = PROMPTS.get(level)
    if not template:
        raise ValueError(f"Unknown level: {level}")

    prompt = template.format(topic=topic)
    retrieval = kwargs.get("retrieval", "auto")
    context = await search_service.get_search_context(topic, retrieval=retrieval)

    if context and context != "No external context found.":
        context_block = context[:1500]
        prompt += (
            "\n\nExternal context (web retrieval):\n"
            f"{context_block}\n\n"
            "Use this context only when relevant and do not invent sources."
        )

    return await call_model(model, prompt, **kwargs)


async def generate_stream_explanation(topic: str, level: str, **kwargs):
    """Stream explanation for topic at given level."""
    from services.model_provider import ModelProvider

    template = PROMPTS.get(level)
    if not template:
        raise ValueError(f"Unknown level: {level}")
    prompt = template.format(topic=topic)

    retrieval = kwargs.get("retrieval", "auto")
    context = await search_service.get_search_context(topic, retrieval=retrieval)
    if context and context != "No external context found.":
        context_block = context[:1500]
        prompt += (
            "\n\nExternal context (web retrieval):\n"
            f"{context_block}\n\n"
            "Use this context only when relevant and do not invent sources."
        )
    
    provider = ModelProvider.get_instance()
    async for chunk in provider.route_inference_stream(prompt, **kwargs):
        yield chunk

    # Append random quote if this is a regeneration
    if kwargs.get("regenerate"):
        quote = await search_service.get_regeneration_quote()
        yield f"\n\n{quote}"
