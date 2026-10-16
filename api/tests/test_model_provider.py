import pytest

from services.model_provider import ModelProvider, ModelUnavailable


@pytest.mark.asyncio
async def test_route_inference_fallback(monkeypatch):
    provider = ModelProvider()
    provider.groq_client = None

    async def fake_fallback(_prompt, **kwargs):
        return {"provider": "fallback", "model": "x", "content": "fallback"}

    monkeypatch.setattr(provider, "_fallback_to_gemini", fake_fallback)
    result = await provider.route_inference("prompt")
    assert result["content"] == "fallback"


@pytest.mark.asyncio
async def test_route_inference_stream_fallback(monkeypatch):
    provider = ModelProvider()
    provider.groq_client = None

    async def fake_fallback(_prompt, **kwargs):
        return {"provider": "fallback", "model": "x", "content": "fallback"}

    monkeypatch.setattr(provider, "_fallback_to_gemini", fake_fallback)
    chunks = []
    async for chunk in provider.route_inference_stream("prompt"):
        chunks.append(chunk)

    assert "fallback" in "".join(chunks)


@pytest.mark.asyncio
async def test_fallback_to_gemini_raises_when_unconfigured():
    provider = ModelProvider()
    provider.gemini_configured = False
    with pytest.raises(ModelUnavailable):
        await provider._fallback_to_gemini("prompt")


@pytest.mark.asyncio
async def test_openrouter_vision_primary(monkeypatch):
    provider = ModelProvider()
    provider.openrouter_configured = True
    provider.gemini_configured = False

    async def fake_openrouter_vision(prompt, image_data, **_kwargs):
        return {"provider": "openrouter", "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "content": "vision ok"}

    monkeypatch.setattr(provider, "_call_openrouter_vision", fake_openrouter_vision)
    result = await provider.route_inference("describe", image_data="data:image/png;base64,AAAA")
    assert result["provider"] == "openrouter"
    assert result["content"] == "vision ok"

