"""Direct generation logic using GPT-OSS 20B."""

import asyncio
from prompts import FAST_MODEL
from services.inference import generate_explanation


async def ensemble_generate(
    topic: str,
    level: str,
    mode: str | None = None,
    client_ip: str = "unknown",
    image_data: str | None = None,
) -> str:
    """Generate explanation directly using standard GPT-OSS 20B model (or Gemini for vision)."""
    try:
        return await generate_explanation(
            topic,
            level,
            FAST_MODEL,
            is_pro=False,
            client_ip=client_ip,
            image_data=image_data,
        )
    except Exception as e:
        raise RuntimeError(f"Generation failed: {e}")


async def judge_responses(topic: str, responses: list[str], client_ip: str = "unknown") -> str:
    """Pick response (first response in single-model setup)."""
    return responses[0] if responses else ""


async def generate_all_levels(topic: str, levels: list[str]) -> dict[str, str]:
    """Generate explanations for all levels in parallel."""
    tasks = {lvl: ensemble_generate(topic, lvl) for lvl in levels}
    results = {}
    for lvl, task in tasks.items():
        try:
            results[lvl] = await task
        except Exception as e:
            results[lvl] = f"Error: {str(e)}"
    return results
