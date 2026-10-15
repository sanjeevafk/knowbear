import pytest


@pytest.mark.asyncio
async def test_health_ok(app_client):
    resp = app_client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "x-request-id" in resp.headers


@pytest.mark.asyncio
async def test_health_in_prod(app_client, test_settings):
    old_env = test_settings.environment
    try:
        test_settings.environment = "production"
        resp = app_client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["environment"] == "production"
    finally:
        test_settings.environment = old_env


@pytest.mark.asyncio
async def test_pinned_topics_endpoint(app_client):
    resp = app_client.get("/api/pinned")
    assert resp.status_code == 200
    assert "public, max-age=86400" in resp.headers.get("Cache-Control", "")
    topics = resp.json()
    assert len(topics) > 0
    assert topics[0]["id"]
    assert topics[0]["title"]
    assert topics[0]["description"]


@pytest.mark.asyncio
async def test_request_id_is_echoed_when_provided(app_client):
    resp = app_client.get("/api/health", headers={"x-request-id": "kb-test-id"})
    assert resp.status_code == 200
    assert resp.headers.get("x-request-id") == "kb-test-id"


@pytest.mark.asyncio
async def test_keep_alive_returns_200_with_probe_payload(app_client):
    resp = app_client.get("/api/keep-alive")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "alive"
    assert "probes" in data
    assert "upstash_redis" in data["probes"]
