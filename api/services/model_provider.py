"""Model provider abstraction (Groq text + OpenRouter vision)."""

import base64
import json
import os
import re
import time

import httpx
from groq import AsyncGroq

from config import get_settings
from logging_config import logger
from token_rate_limit import TokenRateLimitExceeded, consume_tokens, estimate_tokens

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_VISION_MODELS = [
    "dots-studio/dots-3-note-preview:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "nvidia/nemotron-3.5-super-vl:free",
]


def _clean_cot(text: str) -> str:
    """Strip chain-of-thought tags/headers from model output."""
    cleaned = re.sub(r"<think>.*?</think>", "", text or "", flags=re.DOTALL)
    cleaned = re.sub(r"Thought:.*?\n\n", "", cleaned, flags=re.DOTALL)
    return cleaned.replace("<think>", "").replace("</think>", "").strip()


def _prepare_image_data_url(image_data: str | bytes) -> str | None:
    """Normalize bytes, raw base64, or data URL into a valid data:image/...;base64,... URL."""
    if isinstance(image_data, bytes):
        return f"data:image/png;base64,{base64.b64encode(image_data).decode('ascii')}"
    if isinstance(image_data, str) and image_data.strip():
        s = image_data.strip()
        if "," in s and s.startswith("data:"):
            header, b64_str = s.split(",", 1)
            mime = header.split(";")[0].replace("data:", "").strip() or "image/png"
        else:
            mime = "image/png"
            b64_str = s
        try:
            base64.b64decode(b64_str)
            return f"data:{mime};base64,{b64_str.strip()}"
        except Exception as e:
            logger.warning("invalid_image_base64", error=str(e))
            return None
    return None


class ModelError(Exception):
    """Base model error."""
    pass


class ModelUnavailable(ModelError):
    """Raised when a model is not configured or fails."""
    pass


class ModelProvider:
    """Singleton for managing model clients."""

    _instance = None

    def __init__(self):
        self.settings = get_settings()
        self.groq_client = None
        self.openrouter_api_key = getattr(self.settings, "openrouter_api_key", "") or ""
        self.openrouter_configured = bool(self.openrouter_api_key)

        if self.settings.groq_api_key:
            try:
                base_url = os.getenv("GROQ_BASE_URL")
                if base_url and "/openai/v1" in base_url:
                    base_url = base_url.replace("/openai/v1", "").rstrip("/")
                groq_kwargs = {"api_key": self.settings.groq_api_key}
                if base_url:
                    groq_kwargs["base_url"] = base_url
                self.groq_client = AsyncGroq(**groq_kwargs)
            except Exception as e:
                logger.error("groq_init_failed", error=str(e))

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _openrouter_vision_models(self) -> list[str]:
        override = os.getenv("OPENROUTER_VISION_MODEL", "").strip()
        if override:
            return [override, *[m for m in OPENROUTER_VISION_MODELS if m != override]]
        return list(OPENROUTER_VISION_MODELS)

    async def _call_openrouter_vision(self, prompt: str, image_data, temperature: float = 0.7) -> dict:
        data_url = _prepare_image_data_url(image_data)
        if not data_url:
            raise ModelError("Invalid image data")
        started = time.perf_counter()
        payload = {
            "models": self._openrouter_vision_models(),
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            "max_tokens": 1800,
            "temperature": temperature,
        }
        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "HTTP-Referer": "https://knowbear.sanjeevkumar.me",
            "X-Title": "KnowBear",
        }
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(OPENROUTER_API_URL, headers=headers, json=payload)
        if resp.status_code >= 400:
            raise ModelError(f"OpenRouter vision HTTP {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        choices = data.get("choices") or []
        if not choices:
            raise ModelError(f"OpenRouter vision returned no choices: {data}")
        content = _clean_cot(choices[0].get("message", {}).get("content") or "")
        model_used = data.get("model") or self._openrouter_vision_models()[0]
        logger.info(
            "openrouter_vision_completed",
            model=model_used,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
        return {"provider": "openrouter", "model": model_used, "content": content}

    async def _stream_openrouter_vision(self, prompt: str, image_data, temperature: float = 0.7):
        data_url = _prepare_image_data_url(image_data)
        if not data_url:
            raise ModelError("Invalid image data")
        started = time.perf_counter()
        payload = {
            "models": self._openrouter_vision_models(),
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            "max_tokens": 1800,
            "temperature": temperature,
            "stream": True,
        }
        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "HTTP-Referer": "https://knowbear.sanjeevkumar.me",
            "X-Title": "KnowBear",
        }
        is_thinking = False
        async with httpx.AsyncClient(timeout=25.0) as client:
            async with client.stream("POST", OPENROUTER_API_URL, headers=headers, json=payload) as resp:
                if resp.status_code >= 400:
                    body = (await resp.aread()).decode("utf-8", errors="replace")
                    raise ModelError(f"OpenRouter vision stream HTTP {resp.status_code}: {body[:200]}")
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if not raw or raw == "[DONE]":
                        continue
                    try:
                        event = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    choices = event.get("choices") or []
                    if not choices:
                        continue
                    content = (choices[0].get("delta") or {}).get("content") or ""
                    if not content:
                        continue
                    if "<think>" in content:
                        is_thinking = True
                        content = content.split("<think>")[0]
                    if "</think>" in content:
                        is_thinking = False
                        content = content.split("</think>")[-1]
                    if not is_thinking and content:
                        yield content
        logger.info("stream_openrouter_vision_completed", latency_ms=int((time.perf_counter() - started) * 1000))

    async def route_inference(self, prompt: str, image_data=None, **kwargs) -> dict:
        """Route text requests to Groq and vision requests to OpenRouter."""
        client_ip = kwargs.get("client_ip", "unknown")
        await consume_tokens(client_ip, estimate_tokens(prompt))

        if image_data:
            if not self.openrouter_configured:
                raise ModelUnavailable("OpenRouter is not configured for visual tasks.")
            try:
                res = await self._call_openrouter_vision(
                    prompt,
                    image_data,
                    temperature=kwargs.get("temperature", 0.7),
                )
                await consume_tokens(client_ip, estimate_tokens(res["content"] or ""))
                return res
            except TokenRateLimitExceeded:
                raise
            except Exception as e:
                logger.error("openrouter_vision_failed", error=str(e))
                raise ModelError(f"OpenRouter vision failed: {e}")

        target_model = kwargs.get("model") or "openai/gpt-oss-20b"
        max_tokens = 2400

        if not self.groq_client:
            raise ModelUnavailable("Groq is not configured.")

        mode = kwargs.get("mode") or "standard"
        request_timeout = 15.0
        try:
            started = time.perf_counter()
            completion = await self.groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=target_model,
                max_tokens=max_tokens,
                temperature=kwargs.get("temperature", 0.7),
                timeout=request_timeout,
            )

            content = _clean_cot(completion.choices[0].message.content)
            await consume_tokens(client_ip, estimate_tokens(content))
            logger.info(
                "inference_completed",
                mode=mode or "default",
                model=target_model,
                latency_ms=int((time.perf_counter() - started) * 1000),
            )
            return {"provider": "groq", "model": target_model, "content": content}
        except TokenRateLimitExceeded:
            raise
        except Exception as e:
            logger.error("groq_generation_failed", model=target_model, error=str(e))
            raise ModelUnavailable(f"Groq generation failed: {e}")

    async def route_inference_stream(self, prompt: str, **kwargs):
        """Stream inference results for real-time UI."""
        client_ip = kwargs.get("client_ip", "unknown")
        await consume_tokens(client_ip, estimate_tokens(prompt))

        image_data = kwargs.get("image_data")
        if image_data:
            if not self.openrouter_configured:
                raise ModelUnavailable("OpenRouter is not configured for visual tasks.")
            try:
                billable_tokens = 0
                async for chunk in self._stream_openrouter_vision(
                    prompt,
                    image_data,
                    temperature=kwargs.get("temperature", 0.7),
                ):
                    billable_tokens += estimate_tokens(chunk)
                    yield chunk
                if billable_tokens > 0:
                    await consume_tokens(client_ip, billable_tokens)
                return
            except TokenRateLimitExceeded:
                raise
            except Exception as e:
                logger.error("openrouter_vision_stream_failed", error=str(e))
                raise ModelError(f"OpenRouter vision streaming failed: {e}")

        target_model = "openai/gpt-oss-20b"
        max_tokens = 2400

        if not self.groq_client:
            raise ModelUnavailable("Groq is not configured.")

        mode = kwargs.get("mode") or "standard"
        request_timeout = 15.0
        try:
            started = time.perf_counter()
            stream = await self.groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=target_model,
                max_tokens=max_tokens,
                temperature=kwargs.get("temperature", 0.7),
                stream=True,
                timeout=request_timeout,
            )

            is_thinking = False
            finish_reason = None
            billable_tokens = 0
            async for chunk in stream:
                content = chunk.choices[0].delta.content

                if chunk.choices[0].finish_reason:
                    finish_reason = chunk.choices[0].finish_reason

                if not content:
                    continue

                if "<think>" in content:
                    is_thinking = True
                    content = content.split("<think>")[0]

                if "Thought:" in content:
                    is_thinking = True
                    content = content.split("Thought:")[0]

                if "</think>" in content:
                    is_thinking = False
                    content = content.split("</think>")[-1]

                if not is_thinking and content:
                    billable_tokens += estimate_tokens(content)
                    yield content

            if billable_tokens > 0:
                await consume_tokens(client_ip, billable_tokens)
            logger.info(
                "stream_inference_completed",
                mode=mode or "default",
                model=target_model,
                latency_ms=int((time.perf_counter() - started) * 1000),
            )

            if finish_reason == "length":
                logger.warning("stream_truncated", mode=mode, model=target_model)
                yield "\n\n__TRUNCATED__"

        except TokenRateLimitExceeded:
            raise
        except Exception as e:
            logger.warning("groq_streaming_failed", error=str(e))
            raise ModelUnavailable("Streaming provider unavailable")

