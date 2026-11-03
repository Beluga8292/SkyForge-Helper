from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app

UUID = "0123456789abcdef0123456789abcdef"


def make_client(settings, upstream) -> TestClient:
    return TestClient(create_app(settings, upstream_transport=upstream.transport()))


def test_health_and_status(settings, upstream) -> None:
    with make_client(settings, upstream) as client:
        health = client.get("/api/v1/health")
        status = client.get("/api/v1/status")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert status.status_code == 200
    body = status.json()
    assert body["services"]["hypixel_api"]["status"] == "ok"
    assert body["services"]["database"]["status"] == "ok"
    assert body["config"]["hypixel_key_configured"] is True
    assert "ttls" in body["cache"]
    assert "test-key" not in status.text


def test_bazaar_and_product(settings, upstream) -> None:
    with make_client(settings, upstream) as client:
        bazaar = client.get("/api/v1/bazaar")
        product = client.get("/api/v1/bazaar/enchanted_diamond")
        missing = client.get("/api/v1/bazaar/DOES_NOT_EXIST")
    assert bazaar.status_code == 200
    body = bazaar.json()
    assert body["products"]["ENCHANTED_DIAMOND"]["quick_status"]["buyPrice"] == 120.0
    assert body["meta"]["source"] == "upstream"
    assert body["meta"]["fetched_at"]
    assert body["meta"]["cache_age_ms"] >= 0
    assert body["meta"]["stale"] is False
    assert product.status_code == 200
    assert product.json()["product"]["product_id"] == "ENCHANTED_DIAMOND"
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"


def test_bazaar_history_without_data_is_empty(settings, upstream) -> None:
    with make_client(settings, upstream) as client:
        response = client.get("/api/v1/bazaar/ENCHANTED_DIAMOND/history?range=1h")
    assert response.status_code == 200
    body = response.json()
    assert body["points"] == []
    assert body["range"] == "1h"
    assert body["note"]
    assert body["meta"]["source"] == "database"


def test_auctions_pagination_and_filters(settings, upstream, monkeypatch) -> None:
    from app.services import auctions as auctions_module

    async def no_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(auctions_module.asyncio, "sleep", no_sleep)
    with make_client(settings, upstream) as client:
        page = client.get("/api/v1/auctions?page=0&page_size=2&bin_only=true&sort=price_asc")
        detail = client.get(f"/api/v1/auctions/{page.json()['auctions'][0]['uuid']}")
        missing = client.get("/api/v1/auctions/not-in-snapshot")
    assert page.status_code == 200
    body = page.json()
    assert body["page"] == 0
    assert body["page_size"] == 2
    assert body["total_auctions"] == 4
    assert body["filtered_total"] == 4
    assert len(body["auctions"]) == 2
    assert body["meta"]["snapshot_id"]
    assert detail.status_code == 200
    assert detail.json()["auction"]["uuid"] == body["auctions"][0]["uuid"]
    assert missing.status_code == 404


def test_players_and_profiles(settings, upstream) -> None:
    with make_client(settings, upstream) as client:
        player = client.get(f"/api/v1/players/{UUID}")
        profiles = client.get(f"/api/v1/players/{UUID}/profiles")
    assert player.status_code == 200
    assert player.json()["player"]["displayname"] == "Tester"
    assert profiles.status_code == 200
    assert profiles.json()["profiles"][0]["profile_id"] == "p1"


def test_resources(settings, upstream) -> None:
    with make_client(settings, upstream) as client:
        items = client.get("/api/v1/resources/items")
        skills = client.get("/api/v1/resources/skills")
        collections = client.get("/api/v1/resources/collections")
    assert items.status_code == 200
    assert items.json()["items"][0]["id"] == "ENCHANTED_DIAMOND"
    assert skills.status_code == 200
    assert skills.json()["skills"]["FARMING"]["name"] == "Farming"
    assert collections.status_code == 200
    assert "FARMING" in collections.json()["collections"]


def test_http_parameter_validation(settings, upstream) -> None:
    long_id = "A" * 200
    with make_client(settings, upstream) as client:
        cases = [
            "/api/v1/auctions?page=-1",
            "/api/v1/auctions?page_size=0",
            "/api/v1/auctions?page_size=500",
            "/api/v1/auctions?search=" + "x" * 100,
            "/api/v1/auctions?sort=drop_table",
            "/api/v1/players/not-a-uuid",
            f"/api/v1/bazaar/{long_id}",
            "/api/v1/auctions/short",
            "/api/v1/bazaar/ENCHANTED_DIAMOND/history?range=99y",
        ]
        for path in cases:
            response = client.get(path)
            assert response.status_code == 422, path
            assert response.json()["error"]["code"] == "validation_error", path


def test_unknown_route_uses_error_format(settings, upstream) -> None:
    with make_client(settings, upstream) as client:
        response = client.get("/api/v1/not-a-route")
        docs = client.get("/openapi.json")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
    assert docs.status_code == 200
    schema = docs.json()
    assert "/api/v1/bazaar" in schema["paths"]
    assert "/api/v1/bazaar/{product_id}/history" in schema["paths"]


def test_request_id_round_trip_and_security_headers(settings, upstream) -> None:
    with make_client(settings, upstream) as client:
        response = client.get("/api/v1/health", headers={"X-Request-ID": "abcdef123456"})
    assert response.headers["x-request-id"] == "abcdef123456"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["cache-control"] == "no-store"
    assert "ratelimit-limit" in response.headers
