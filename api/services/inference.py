"""Inference service."""

import random
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from prompts import FAST_MODEL, PROMPTS, build_explanation_prompt, build_followup_prompt
from logging_config import logger

REGENERATION_QUOTES = [
    {"author": "Marie Curie", "content": "Nothing in life is to be feared, it is only to be understood. Now is the time to understand more."},
    {"author": "Richard Feynman", "content": "The first principle is that you must not fool yourself and you are the easiest person to fool."},
    {"author": "Leonardo da Vinci", "content": "Learning never exhausts the mind."},
    {"author": "Srinivasa Ramanujan", "content": "An equation for me has no meaning unless it expresses a thought of God."},
    {"author": "Ada Lovelace", "content": "That brain of mine is something more than merely mortal; as time will show."},
    {"author": "Hypatia", "content": "Reserve your right to think, for even to think wrongly is better than not to think at all."},
    {"author": "Nikola Tesla", "content": "The present is theirs; the future, for which I really worked, is mine."},
    {"author": "Rosalind Franklin", "content": "Science and everyday life cannot and should not be separated."},
    {"author": "Isaac Newton", "content": "If I have seen further it is by standing on the shoulders of Giants."},
    {"author": "Grace Hopper", "content": "The most dangerous phrase in the language is, 'We've always done it this way.'"}
]


def get_regeneration_quote() -> str:
    """Return a formatted quote for regenerated explanations."""
    quote = random.choice(REGENERATION_QUOTES)
    return f"---\n*\"{quote['content']}\"* — {quote['author']}"


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
    try:
        result = await provider.route_inference(
            prompt=prompt,
            model=model,
            **kwargs
        )
        return result["content"]
    except Exception as e:
        logger.error("inference_failed", error=str(e), model=model)
        raise e


async def generate_explanation(
    topic: str,
    level: str,
    model: str = "openai/gpt-oss-20b",
    context: dict | None = None,
    **kwargs,
) -> str:
    """Generate explanation for topic at given level."""
    if level not in PROMPTS:
        raise ValueError(f"Unknown level: {level}")

    prompt = build_explanation_prompt(topic, level, context)
    return await call_model(model, prompt, **kwargs)


async def generate_stream_explanation(topic: str, level: str, context: dict | None = None, **kwargs):
    """Stream explanation for topic at given level."""
    from services.model_provider import ModelProvider

    if level not in PROMPTS:
        raise ValueError(f"Unknown level: {level}")
    prompt = build_explanation_prompt(topic, level, context)

    provider = ModelProvider.get_instance()
    async for chunk in provider.route_inference_stream(prompt, **kwargs):
        yield chunk

    # Append random quote if this is a regeneration (except for meme level)
    if kwargs.get("regenerate") and level != "meme":
        yield f"\n\n{get_regeneration_quote()}"


async def generate_followup(
    topic: str,
    level: str,
    question: str,
    context: dict | None = None,
    history: list[dict] | None = None,
    **kwargs,
) -> str:
    """Answer a follow-up question about a topic using the fast model."""
    prompt = build_followup_prompt(topic, level, question, context, history)
    return await call_model(FAST_MODEL, prompt, **kwargs)
