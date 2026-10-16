from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import config as config_module
import main as main_app
import routers.query as query_module
import services.model_provider as model_provider_module


class DummyProvider:
    openrouter_configured = False

    async def initialize(self):
        return None

    async def close(self):
        return None

    async def route_inference(self, *args, **_kwargs):
        return {"provider": "dummy", "model": "dummy", "content": "ok"}

    async def route_inference_stream(self, _prompt, **_kwargs):
        yield "ok"


@pytest.fixture(scope="session")
def test_settings():
    return SimpleNamespace(
        environment="test",
        groq_api_key="",
        openrouter_api_key="",
        token_rate_limit_enabled=True,
        token_rate_limit_per_ip_hour=12000,
    )


@pytest.fixture(autouse=True)
def patch_settings(monkeypatch, test_settings):
    monkeypatch.setattr(config_module, "get_settings", lambda: test_settings)
    monkeypatch.setattr(main_app, "get_settings", lambda: test_settings)
    monkeypatch.setattr(model_provider_module, "get_settings", lambda: test_settings)
    return test_settings


@pytest.fixture
def app_client(monkeypatch):
    monkeypatch.setattr(
        model_provider_module.ModelProvider,
        "get_instance",
        classmethod(lambda cls: DummyProvider()),
    )
    main_app.app.dependency_overrides = {}
    with TestClient(main_app.app) as client:
        yield client
    main_app.app.dependency_overrides = {}


@pytest.fixture(autouse=True)
def clear_query_cache():
    query_module._response_cache.clear()
