import pytest

from services.model_provider import ModelProvider, ModelUnavailable


@pytest.mark.asyncio
async def test_route_inference_raises_when_groq_unconfigured():
    provider = ModelProvider()
    provider.groq_client = None
    with pytest.raises(ModelUnavailable):
        await provider.route_inference("prompt")


@pytest.mark.asyncio
async def test_route_inference_stream_raises_when_groq_unconfigured():
    provider = ModelProvider()
    provider.groq_client = None
    with pytest.raises(ModelUnavailable):
        async for _ in provider.route_inference_stream("prompt"):
            pass


@pytest.mark.asyncio
async def test_openrouter_vision_raises_when_unconfigured():
    provider = ModelProvider()
    provider.openrouter_configured = False
    with pytest.raises(ModelUnavailable):
        await provider.route_inference("describe", image_data="data:image/png;base64,AAAA")


@pytest.mark.asyncio
async def test_openrouter_vision_primary(monkeypatch):
    provider = ModelProvider()
    provider.openrouter_configured = True

    async def fake_openrouter_vision(prompt, image_data, **_kwargs):
        return {"provider": "openrouter", "model": "dots-studio/dots-3-note-preview:free", "content": "vision ok"}

    monkeypatch.setattr(provider, "_call_openrouter_vision", fake_openrouter_vision)
    result = await provider.route_inference("describe", image_data="data:image/png;base64,AAAA")
    assert result["provider"] == "openrouter"
    assert result["content"] == "vision ok"


