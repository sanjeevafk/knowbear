import pytest

import routers.query as query_module
from token_rate_limit import TokenRateLimitExceeded


@pytest.mark.asyncio
async def test_query_generates_fresh_response(app_client, monkeypatch):
    async def fake_ensemble_generate(*_args, **_kwargs):
        return "generated"

    monkeypatch.setattr(query_module, "ensemble_generate", fake_ensemble_generate)
    resp = app_client.post("/api/query", json={"topic": "Cats", "levels": ["eli5"], "mode": "fast"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["explanations"]["eli5"] == "generated"


@pytest.mark.asyncio
async def test_query_invalid_topic(app_client):
    resp = app_client.post("/api/query", json={"topic": "bad<topic>", "levels": ["eli5"], "mode": "fast"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_query_allows_common_real_world_punctuation(app_client, monkeypatch):
    async def fake_ensemble_generate(*_args, **_kwargs):
        return "generated"

    monkeypatch.setattr(query_module, "ensemble_generate", fake_ensemble_generate)
    resp = app_client.post(
        "/api/query",
        json={"topic": "C++/Rust: async & memory safety (2026)?", "levels": ["eli5"], "mode": "fast"},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_query_allows_pasted_multiline_block(app_client, monkeypatch):
    async def fake_ensemble_generate(*_args, **_kwargs):
        return "generated"

    monkeypatch.setattr(query_module, "ensemble_generate", fake_ensemble_generate)
    passage = (
        "Unlike copilot-style assistants that wait for instructions, "
        "AI agents can break down complex tasks, reason about steps, and execute them autonomously using the right tools.\n\n"
        "This shift could fundamentally change how people work, from software development to research to everyday productivity. "
        "Key concepts: {autonomy, tools, planning} — 2026."
    )
    resp = app_client.post(
        "/api/query",
        json={"topic": passage, "levels": ["eli12"], "mode": "fast"},
    )
    assert resp.status_code == 200
    assert "eli12" in resp.json()["explanations"]



@pytest.mark.asyncio
async def test_query_supports_all_levels(app_client, monkeypatch):
    async def fake_ensemble_generate(_topic, _level, *_args, **_kwargs):
        return "ok"

    monkeypatch.setattr(query_module, "ensemble_generate", fake_ensemble_generate)

    resp = app_client.post(
        "/api/query",
        json={"topic": "Space", "levels": ["eli5", "meme"], "mode": "ensemble"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert "eli5" in data["explanations"]
    assert "meme" in data["explanations"]


@pytest.mark.asyncio
async def test_query_stream_emits_done(app_client, monkeypatch):
    async def fake_stream(*_args, **_kwargs):
        yield "Hello "
        yield "World"

    monkeypatch.setattr(query_module, "generate_stream_explanation", fake_stream)

    resp = app_client.post("/api/query/stream", json={"topic": "Ocean", "levels": ["eli5"], "mode": "fast"})
    assert resp.status_code == 200
    text = resp.text
    assert "data: [DONE]" in text
    assert "chunk" in text


@pytest.mark.asyncio
async def test_query_normalizes_and_caps_levels(app_client, monkeypatch):
    async def fake_ensemble_generate(_topic, level, *_args, **_kwargs):
        return f"{level}-ok"

    monkeypatch.setattr(query_module, "ensemble_generate", fake_ensemble_generate)

    resp = app_client.post(
        "/api/query",
        json={
            "topic": "Physics",
            "levels": ["eli5", "eli5", "eli12", "eli15", "meme", "invalid"],
            "mode": "fast",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert list(data["explanations"].keys()) == ["eli5", "eli12", "eli15", "meme"]


@pytest.mark.asyncio
async def test_query_returns_429_on_token_limit(app_client, monkeypatch):
    async def fake_ensemble_generate(*_args, **_kwargs):
        raise TokenRateLimitExceeded("limit", 60, "2026-01-01T00:00:00+00:00")

    monkeypatch.setattr(query_module, "ensemble_generate", fake_ensemble_generate)
    resp = app_client.post("/api/query", json={"topic": "Limits", "levels": ["eli5"], "mode": "fast"})
    assert resp.status_code == 429
    body = resp.json()
    assert body["detail"]["error"] == "Token rate limit exceeded"


@pytest.mark.asyncio
async def test_query_uses_response_cache(app_client, monkeypatch):
    calls = {"count": 0}

    async def fake_ensemble_generate(*_args, **_kwargs):
        calls["count"] += 1
        return "cached-result"

    monkeypatch.setattr(query_module, "ensemble_generate", fake_ensemble_generate)
    payload = {"topic": "Caching", "levels": ["eli5"], "mode": "fast"}

    first = app_client.post("/api/query", json=payload)
    second = app_client.post("/api/query", json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["explanations"]["eli5"] == "cached-result"
    assert second.json()["explanations"]["eli5"] == "cached-result"
    assert calls["count"] == 1
