import pytest

import services.ensemble as ensemble_module


@pytest.mark.asyncio
async def test_ensemble_generate(monkeypatch):
    async def fake_generate_explanation(_topic, _level, _model, **_kwargs):
        return "explanation content"

    monkeypatch.setattr(ensemble_module, "generate_explanation", fake_generate_explanation)
    result = await ensemble_module.ensemble_generate("topic", "eli5")
    assert result == "explanation content"


@pytest.mark.asyncio
async def test_ensemble_generate_failure(monkeypatch):
    async def fake_generate_explanation(_topic, _level, _model, **_kwargs):
        raise RuntimeError("fail")

    monkeypatch.setattr(ensemble_module, "generate_explanation", fake_generate_explanation)

    with pytest.raises(RuntimeError):
        await ensemble_module.ensemble_generate("topic", "eli5")

