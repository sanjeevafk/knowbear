"""Model provider abstraction (Groq text + OpenRouter vision via httpx)."""

import base64
import json
import os
import re
import time

import httpx

from config import get_settings
from logging_config import logger
from token_rate_limit import TokenRateLimitExceeded, consume_tokens, estimate_tokens

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
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


class _StreamCotFilter:
    """Incrementally strips <think>...</think> and Thought:...\\n\\n blocks from streamed chunks."""

    _OPEN_TAGS = ("<think>", "Thought:")

    def __init__(self) -> None:
        self._buf = ""
        self._mode: str | None = None

    def feed(self, chunk: str) -> str:
        if not chunk:
            return ""
        self._buf += chunk
        out: list[str] = []

        while self._buf:
            if self._mode == "think":
                end_idx = self._buf.find("</think>")
                if end_idx != -1:
                    self._buf = self._buf[end_idx + len("</think>"):]
                    self._mode = None
                    continue
                keep = len("</think>") - 1
                if len(self._buf) > keep:
                    self._buf = self._buf[-keep:]
                break

            if self._mode == "thought":
                end_idx = self._buf.find("\n\n")
                if end_idx != -1:
                    self._buf = self._buf[end_idx + 2:]
                    self._mode = None
                    continue
                keep = 1
                if len(self._buf) > keep:
                    self._buf = self._buf[-keep:]
                break

            candidates: list[tuple[int, str, int]] = []
            think_idx = self._buf.find("<think>")
            if think_idx != -1:
                candidates.append((think_idx, "think", len("<think>")))

            search_from = 0
            while True:
                thought_idx = self._buf.find("Thought:", search_from)
                if thought_idx == -1:
                    break
                if thought_idx == 0 or self._buf[thought_idx - 1] == "\n":
                    candidates.append((thought_idx, "thought", len("Thought:")))
                    break
                search_from = thought_idx + 1

            if candidates:
                idx, mode, tag_len = min(candidates, key=lambda x: x[0])
                if idx > 0:
                    out.append(self._buf[:idx])
                self._buf = self._buf[idx + tag_len:]
                self._mode = mode
                continue

            hold = 0
            for tag in self._OPEN_TAGS:
                max_k = min(len(self._buf), len(tag) - 1)
                for k in range(max_k, 0, -1):
                    if self._buf.endswith(tag[:k]):
                        hold = max(hold, k)
                        break
            if hold:
                if len(self._buf) > hold:
                    out.append(self._buf[:-hold])
                    self._buf = self._buf[-hold:]
                break

            out.append(self._buf)
            self._buf = ""

        return "".join(out)

    def flush(self) -> str:
        if self._mode is not None:
            self._buf = ""
            return ""
        rem = self._buf
        self._buf = ""
        return rem


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


async def _post_openai_chat(url: str, headers: dict[str, str], payload: dict, timeout: float, label: str) -> tuple[str, str | None]:
    """Post to an OpenAI-compatible chat completions endpoint and return (cleaned_content, model)."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, headers=headers, json=payload)
    if resp.status_code >= 400:
        raise ModelError(f"{label} HTTP {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        raise ModelError(f"{label} returned no choices")
    content = _clean_cot((choices[0].get("message") or {}).get("content") or "")
    return content, data.get("model")


async def _stream_openai_filtered(url: str, headers: dict[str, str], payload: dict, timeout: float):
    """Stream OpenAI-compatible SSE deltas through _StreamCotFilter, yielding (chunk, finish_reason)."""
    cot_filter = _StreamCotFilter()
    last_finish_reason = None
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code >= 400:
                body = (await resp.aread()).decode("utf-8", errors="replace")
                raise ModelError(f"HTTP {resp.status_code}: {body[:200]}")
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
                choice = choices[0]
                if choice.get("finish_reason"):
                    last_finish_reason = choice["finish_reason"]
                content = (choice.get("delta") or {}).get("content") or ""
                if content:
                    filtered = cot_filter.feed(content)
                    if filtered:
                        yield filtered, last_finish_reason
    tail = cot_filter.flush()
    if tail:
        yield tail, last_finish_reason
    elif last_finish_reason:
        yield "", last_finish_reason


class ModelError(Exception):
    """Base model error."""


class ModelUnavailable(ModelError):
    """Raised when a model is not configured or fails."""


class ModelProvider:
    """Singleton for managing model clients."""

    _instance = None

    def __init__(self):
        self.settings = get_settings()
        self.groq_api_key = getattr(self.settings, "groq_api_key", "") or ""
        self.groq_client = bool(self.groq_api_key) or None
        base_url = os.getenv("GROQ_BASE_URL", "").strip().rstrip("/")
        if base_url:
            self.groq_url = base_url if base_url.endswith("/chat/completions") else f"{base_url}/openai/v1/chat/completions"
        else:
            self.groq_url = GROQ_CHAT_URL

        self.openrouter_api_key = getattr(self.settings, "openrouter_api_key", "") or ""
        self.openrouter_configured = bool(self.openrouter_api_key)

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

    def _openrouter_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "HTTP-Referer": "https://knowbear.sanjeevkumar.me",
            "X-Title": "KnowBear",
        }

    def _groq_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.groq_api_key}"}

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
        content, model_used = await _post_openai_chat(
            OPENROUTER_API_URL, self._openrouter_headers(), payload, timeout=25.0, label="OpenRouter vision"
        )
        model_used = model_used or self._openrouter_vision_models()[0]
        logger.info("openrouter_vision_completed", model=model_used, latency_ms=int((time.perf_counter() - started) * 1000))
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
        async for chunk, _ in _stream_openai_filtered(OPENROUTER_API_URL, self._openrouter_headers(), payload, timeout=25.0):
            if chunk:
                yield chunk
        logger.info("stream_openrouter_vision_completed", latency_ms=int((time.perf_counter() - started) * 1000))

    async def route_inference(self, prompt: str, image_data=None, **kwargs) -> dict:
        """Route text requests to Groq and vision requests to OpenRouter."""
        client_ip = kwargs.get("client_ip", "unknown")
        await consume_tokens(client_ip, estimate_tokens(prompt))

        if image_data:
            if not self.openrouter_configured:
                raise ModelUnavailable("OpenRouter is not configured for visual tasks.")
            try:
                res = await self._call_openrouter_vision(prompt, image_data, temperature=kwargs.get("temperature", 0.7))
                await consume_tokens(client_ip, estimate_tokens(res["content"] or ""))
                return res
            except TokenRateLimitExceeded:
                raise
            except Exception as e:
                logger.error("openrouter_vision_failed", error=str(e))
                raise ModelError(f"OpenRouter vision failed: {e}")

        if not self.groq_client:
            raise ModelUnavailable("Groq is not configured.")

        target_model = kwargs.get("model") or "openai/gpt-oss-20b"
        mode = kwargs.get("mode") or "standard"
        payload = {
            "messages": [{"role": "user", "content": prompt}],
            "model": target_model,
            "max_tokens": 2400,
            "temperature": kwargs.get("temperature", 0.7),
        }
        try:
            started = time.perf_counter()
            content, _ = await _post_openai_chat(self.groq_url, self._groq_headers(), payload, timeout=15.0, label="Groq")
            await consume_tokens(client_ip, estimate_tokens(content))
            logger.info("inference_completed", mode=mode, model=target_model, latency_ms=int((time.perf_counter() - started) * 1000))
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
                async for chunk in self._stream_openrouter_vision(prompt, image_data, temperature=kwargs.get("temperature", 0.7)):
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

        if not self.groq_client:
            raise ModelUnavailable("Groq is not configured.")

        target_model = kwargs.get("model") or "openai/gpt-oss-20b"
        mode = kwargs.get("mode") or "standard"
        payload = {
            "messages": [{"role": "user", "content": prompt}],
            "model": target_model,
            "max_tokens": 2400,
            "temperature": kwargs.get("temperature", 0.7),
            "stream": True,
        }
        try:
            started = time.perf_counter()
            finish_reason = None
            billable_tokens = 0
            async for chunk, fr in _stream_openai_filtered(self.groq_url, self._groq_headers(), payload, timeout=15.0):
                if fr:
                    finish_reason = fr
                if chunk:
                    billable_tokens += estimate_tokens(chunk)
                    yield chunk

            if billable_tokens > 0:
                await consume_tokens(client_ip, billable_tokens)
            logger.info("stream_inference_completed", mode=mode, model=target_model, latency_ms=int((time.perf_counter() - started) * 1000))

            if finish_reason == "length":
                logger.warning("stream_truncated", mode=mode, model=target_model)
                yield "\n\n__TRUNCATED__"
        except TokenRateLimitExceeded:
            raise
        except Exception as e:
            logger.warning("groq_streaming_failed", error=str(e))
            raise ModelUnavailable("Streaming provider unavailable")
