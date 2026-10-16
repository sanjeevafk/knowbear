"""Tests for extension page-context support and the /api/followup endpoint."""

import pytest

import routers.query as query_module
import services.inference as inference_module
from services.model_provider import ModelUnavailable
from token_rate_limit import TokenRateLimitExceeded

FOCUS_MARKER = "Exact selected passage the reader highlighted"
SURROUNDING_MARKER = "Surrounding passage the reader was looking at"


@pytest.fixture
def capture_generate(monkeypatch):
    calls = []

    async def fake_generate_explanation(topic, level, *args, **kwargs):
        calls.append({"topic": topic, "level": level, **kwargs})
        return "generated"

    monkeypatch.setattr(query_module, "generate_explanation", fake_generate_explanation)
    return calls


@pytest.fixture
def capture_prompts(monkeypatch):
    prompts = []

    async def fake_call_model(model, prompt, **_kwargs):
        prompts.append({"model": model, "prompt": prompt})
        return "generated"

    monkeypatch.setattr(inference_module, "call_model", fake_call_model)
    return prompts


CONTEXT_FIELDS = {
    "selected_text": "Agents break down complex tasks.",
    "surrounding_text": "Unlike copilots, agents break down complex tasks and use tools.",
    "page_title": "The Agent Era",
    "page_url": "https://example.com/agents",
}


def test_multiline_topic_is_normalized(app_client, capture_generate):
    resp = app_client.post("/api/query", json={"topic": "line one\nline two\ttabbed", "levels": ["eli5"]})
    assert resp.status_code == 200
    assert resp.json()["topic"] == "line one line two tabbed"


def test_curly_quotes_accepted_and_emoji_rejected(app_client, capture_generate):
    ok = app_client.post("/api/query", json={"topic": "“Smart” quotes – dashes…", "levels": ["eli5"]})
    assert ok.status_code == 200
    bad = app_client.post("/api/query", json={"topic": "rocket 🚀 science", "levels": ["eli5"]})
    assert bad.status_code == 400


def test_topic_over_limit_is_422(app_client, capture_generate):
    resp = app_client.post("/api/query", json={"topic": "a" * 2001, "levels": ["eli5"]})
    assert resp.status_code == 422


def test_context_fields_are_forwarded(app_client, capture_generate):
    resp = app_client.post("/api/query", json={"topic": "AI agents", "levels": ["eli12"], **CONTEXT_FIELDS})
    assert resp.status_code == 200
    ctx = capture_generate[0]["context"]
    assert ctx["selected_text"] == CONTEXT_FIELDS["selected_text"]
    assert ctx["surrounding_text"] == CONTEXT_FIELDS["surrounding_text"]
    assert ctx["page_title"] == "The Agent Era"


def test_context_appears_in_prompt_before_output_rules(app_client, capture_prompts):
    resp = app_client.post("/api/query", json={"topic": "AI agents", "levels": ["eli5"], **CONTEXT_FIELDS})
    assert resp.status_code == 200
    prompt = capture_prompts[0]["prompt"]
    assert FOCUS_MARKER in prompt and SURROUNDING_MARKER in prompt
    # Output-format rules stay last, after the untrusted page content.
    assert prompt.index(SURROUNDING_MARKER) < prompt.rindex("Output in plain text only")


def test_no_context_prompt_has_no_focus_markers(app_client, capture_prompts):
    resp = app_client.post("/api/query", json={"topic": "AI agents", "levels": ["eli5"]})
    assert resp.status_code == 200
    prompt = capture_prompts[0]["prompt"]
    assert FOCUS_MARKER not in prompt
    assert SURROUNDING_MARKER not in prompt
    assert "Page title:" not in prompt


def test_no_context_stream_prompt_has_no_focus_markers(app_client, monkeypatch):
    prompts = []

    class CapturingProvider:
        async def route_inference_stream(self, prompt, **_kwargs):
            prompts.append(prompt)
            yield "ok"

    import services.model_provider as model_provider_module

    monkeypatch.setattr(
        model_provider_module.ModelProvider, "get_instance", classmethod(lambda cls: CapturingProvider())
    )
    resp = app_client.post("/api/query/stream", json={"topic": "AI agents", "levels": ["eli5"]})
    assert resp.status_code == 200
    assert prompts and FOCUS_MARKER not in prompts[0]


def test_context_cache_isolation(app_client, capture_generate):
    body = {"topic": "AI agents", "levels": ["eli12"]}
    app_client.post("/api/query", json=body)
    app_client.post("/api/query", json={**body, **CONTEXT_FIELDS})
    assert len(capture_generate) == 2  # distinct keys with and without context
    app_client.post("/api/query", json={**body, **CONTEXT_FIELDS})
    assert len(capture_generate) == 2  # repeat with context is a cache hit


def test_no_context_cache_key_unchanged():
    assert query_module._cache_key("Cats", "eli5") == "query_cache:cats::eli5"
    suffix = query_module._context_cache_suffix(None)
    assert query_module._cache_key("Cats", "eli5", context_suffix=suffix) == "query_cache:cats::eli5"


def test_braces_topic_accepted(app_client, capture_generate):
    resp = app_client.post("/api/query", json={"topic": "dict {a: 1} literal", "levels": ["eli5"]})
    assert resp.status_code == 200


def test_placeholder_collision_topic_rendered_verbatim(app_client, capture_prompts):
    topic = "explain {question} {focus_block}"
    resp = app_client.post("/api/query", json={"topic": topic, "levels": ["eli12"], **CONTEXT_FIELDS})
    assert resp.status_code == 200
    assert topic in capture_prompts[0]["prompt"]

    fu = app_client.post("/api/followup", json={"topic": topic, "question": "and {topic}?"})
    assert fu.status_code == 200
    followup_prompt = capture_prompts[-1]["prompt"]
    assert topic in followup_prompt
    assert '"and {topic}?"' in followup_prompt


def test_image_only_rewrites_topic(app_client, capture_generate):
    resp = app_client.post("/api/query", json={"image": "data:image/png;base64,AAAA", "levels": ["eli5"]})
    assert resp.status_code == 200
    assert resp.json()["topic"] == "Explain this image or diagram"


def test_vision_unavailable_is_content_level_200(app_client, monkeypatch):
    async def fake_generate_explanation(*_args, **_kwargs):
        raise ModelUnavailable("OpenRouter is not configured for visual tasks.")

    monkeypatch.setattr(query_module, "generate_explanation", fake_generate_explanation)
    resp = app_client.post("/api/query", json={"image": "data:image/png;base64,AAAA", "levels": ["eli5"]})
    assert resp.status_code == 200
    assert resp.json()["explanations"]["eli5"].startswith("Vision unavailable:")


def test_text_model_unavailable_is_not_labeled_vision(app_client, monkeypatch):
    async def fake_generate_explanation(*_args, **_kwargs):
        raise ModelUnavailable("No providers available")

    monkeypatch.setattr(query_module, "generate_explanation", fake_generate_explanation)
    resp = app_client.post("/api/query", json={"topic": "Cats", "levels": ["eli5"]})
    assert resp.status_code == 200
    assert resp.json()["explanations"]["eli5"].startswith("Error generating eli5:")


def test_followup_happy_path_renders_history(app_client, capture_prompts):
    resp = app_client.post(
        "/api/followup",
        json={
            "topic": "AI agents",
            "question": "What is tool use?",
            "level": "eli15",
            **CONTEXT_FIELDS,
            "history": [{"question": "What is an agent?", "answer": "A program that acts."}],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"topic": "AI agents", "level": "eli15", "question": "What is tool use?", "answer": "generated"}
    prompt = capture_prompts[0]["prompt"]
    assert "Previous Q/A:" in prompt
    assert "Q: What is an agent?" in prompt
    assert FOCUS_MARKER in prompt
    assert capture_prompts[0]["model"] == "openai/gpt-oss-20b"


def test_followup_blank_question_is_400(app_client, capture_prompts):
    resp = app_client.post("/api/followup", json={"topic": "AI agents", "question": "   "})
    assert resp.status_code == 400


def test_followup_unknown_level_defaults_to_eli12(app_client, capture_prompts):
    resp = app_client.post("/api/followup", json={"topic": "AI agents", "question": "Why?", "level": "phd"})
    assert resp.status_code == 200
    assert resp.json()["level"] == "eli12"


def test_followup_rate_limited(app_client, monkeypatch):
    async def fake_generate_followup(*_args, **_kwargs):
        raise TokenRateLimitExceeded(
            message="Slow down",
            retry_after_seconds=42,
            retry_at_utc="2026-01-01T00:00:00Z",
        )

    monkeypatch.setattr(query_module, "generate_followup", fake_generate_followup)
    resp = app_client.post("/api/followup", json={"topic": "AI agents", "question": "Why?"})
    assert resp.status_code == 429
    assert resp.json()["detail"]["retry_after_seconds"] == 42
