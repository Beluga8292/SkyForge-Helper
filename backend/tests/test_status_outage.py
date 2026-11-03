from __future__ import annotations

import asyncio
import socket
import time
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas.api import StatusResponse

UUID = "0123456789abcdef0123456789abcdef"


def test_real_refused_postgres_does_not_break_independent_endpoints(settings, upstream):
    # Real asyncpg connection refusal; synthetic Hypixel, no user database touched.
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    settings.database_url = f"postgresql+asyncpg://fixture:fixture@127.0.0.1:{port}/unavailable"
    settings.auto_create_tables = False
    app = create_app(settings, upstream_transport=upstream.transport())
    with TestClient(app) as client:
        start = time.monotonic()
        response = client.get("/api/v1/status")
        assert time.monotonic() - start < 2
        assert response.status_code == 200
        status = StatusResponse.model_validate(response.json())
        assert status.status == "degraded"
        assert status.services["database"].status == "unavailable"
        assert status.history["snapshots"] is None
        assert status.services["hypixel_api"].status == "ok"
        for route in ("health", "bazaar", "auctions?page_size=2", f"players/{UUID}", f"players/{UUID}/profiles"):
            assert client.get(f"/api/v1/{route}").status_code == 200


def test_status_recovers_without_restart(settings, upstream):
    app = create_app(settings, upstream_transport=upstream.transport())
    with TestClient(app) as client:
        database = app.state.container.database
        original = database.ping
        database.ping = AsyncMock(return_value=False)
        history = app.state.container.history
        stats = history.stats
        history.stats = AsyncMock(side_effect=AssertionError("Do not query unavailable DB"))
        down = client.get("/api/v1/status")
        assert down.status_code == 200
        assert down.json()["services"]["database"]["status"] == "unavailable"
        history.stats.assert_not_awaited()
        database.ping = original
        history.stats = stats
        recovered = client.get("/api/v1/status")
        assert recovered.status_code == 200
        assert recovered.json()["services"]["database"]["status"] == "ok"
        assert recovered.json()["history"]["snapshots"] == 0


@pytest.mark.parametrize("operation", ["ping", "stats"])
def test_status_bounds_hung_database_operations(settings, upstream, operation):
    settings.database_status_timeout_seconds = 0.05
    app = create_app(settings, upstream_transport=upstream.transport())

    async def hang():
        await asyncio.Event().wait()

    with TestClient(app) as client:
        target = app.state.container.database if operation == "ping" else app.state.container.history
        setattr(target, operation, hang)
        start = time.monotonic()
        response = client.get("/api/v1/status")
        assert time.monotonic() - start < 0.5
        assert response.status_code == 200
        assert response.json()["services"]["database"]["status"] == "unavailable"
        assert client.get("/api/v1/health").status_code == 200


def test_connection_drops_between_ping_and_statistics(settings, upstream):
    app = create_app(settings, upstream_transport=upstream.transport())
    with TestClient(app) as client:
        app.state.container.history.stats = AsyncMock(side_effect=ConnectionRefusedError())
        response = client.get("/api/v1/status")
        assert response.status_code == 200
        assert response.json()["services"]["database"]["status"] == "unavailable"
