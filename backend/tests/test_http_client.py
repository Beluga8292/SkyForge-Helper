from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import MockUpstream

UUID = "0123456789abcdef0123456789abcdef"


def client(settings, upstream: MockUpstream, *, key: bool = True) -> TestClient:
    app = create_app(settings, upstream_transport=upstream.transport())
    return TestClient(app)


@pytest.mark.parametrize(
    ("mode", "status", "code"),
    [
        ("403", 502, "upstream_forbidden"),
        ("429", 503, "upstream_rate_limited"),
        ("500", 503, "upstream_unavailable"),
        ("timeout", 504, "upstream_timeout"),
        ("malformed", 502, "upstream_invalid_response"),
    ],
)
def test_player_upstream_errors(settings, upstream, mode, status, code) -> None:
    upstream.fail("/v2/player", mode)
    with client(settings, upstream) as test_client:
        response = test_client.get(f"/api/v1/players/{UUID}")
    assert response.status_code == status
    body = response.json()
    assert body["error"]["code"] == code
    assert body["error"]["request_id"]
    assert response.headers["x-request-id"] == body["error"]["request_id"]
    if mode == "429":
        assert int(response.headers["Retry-After"]) >= 1


def test_missing_api_key_reports_misconfiguration(no_key_settings, upstream) -> None:
    with client(no_key_settings, upstream) as test_client:
        response = test_client.get(f"/api/v1/players/{UUID}")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "hypixel_key_missing"
    assert not upstream.requests


def test_api_key_is_sent_only_to_upstream(settings, upstream) -> None:
    with client(settings, upstream) as test_client:
        response = test_client.get(f"/api/v1/players/{UUID}")
        status = test_client.get("/api/v1/status")
    assert response.status_code == 200
    assert response.json()["player"]["displayname"] == "Tester"
    assert upstream.fetched_keys == ["test-key"]
    assert "test-key" not in status.text
    assert "test-key" not in str(status.json())


def test_bazaar_upstream_500_returns_503(settings, upstream) -> None:
    upstream.fail("/v2/skyblock/bazaar", "500")
    with client(settings, upstream) as test_client:
        response = test_client.get("/api/v1/bazaar")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "upstream_unavailable"


def test_bazaar_malformed_json_returns_502(settings, upstream) -> None:
    upstream.fail("/v2/skyblock/bazaar", "malformed")
    with client(settings, upstream) as test_client:
        response = test_client.get("/api/v1/bazaar")
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "upstream_invalid_response"


def test_bazaar_timeout_returns_504(settings, upstream) -> None:
    upstream.fail("/v2/skyblock/bazaar", "timeout")
    with client(settings, upstream) as test_client:
        response = test_client.get("/api/v1/bazaar")
    assert response.status_code == 504
    assert response.json()["error"]["code"] == "upstream_timeout"


def test_retry_is_bounded(settings, upstream) -> None:
    upstream.fail("/v2/skyblock/bazaar", "500")
    app = create_app(settings, upstream_transport=upstream.transport())
    with TestClient(app) as test_client:
        test_client.get("/api/v1/bazaar")
    # max_retries=0 -> exactly one upstream attempt.
    assert upstream.requests.count("/v2/skyblock/bazaar") == 1
