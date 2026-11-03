from __future__ import annotations

import json
import time
from typing import Any

import httpx
import pytest

from app.core.config import Settings

BAZAAR_PAYLOAD: dict[str, Any] = {
    "success": True,
    "lastUpdated": 1_700_000_000_000,
    "products": {
        "ENCHANTED_DIAMOND": {
            "product_id": "ENCHANTED_DIAMOND",
            "sell_summary": [{"amount": 10, "pricePerUnit": 100.0, "orders": 5}],
            "buy_summary": [{"amount": 20, "pricePerUnit": 120.0, "orders": 7}],
            "quick_status": {
                "productId": "ENCHANTED_DIAMOND",
                "buyPrice": 120.0,
                "sellPrice": 100.0,
                "buyVolume": 5000,
                "sellVolume": 4000,
                "buyMovingWeek": 9000,
                "sellMovingWeek": 8000,
                "buyOrders": 80,
                "sellOrders": 70,
            },
        },
        "HYPERION": {
            "product_id": "HYPERION",
            "sell_summary": [],
            "buy_summary": [],
            "quick_status": {
                "productId": "HYPERION",
                "buyPrice": 900_000_000.0,
                "sellPrice": 850_000_000.0,
                "buyVolume": 12,
                "sellVolume": 10,
                "buyMovingWeek": 30,
                "sellMovingWeek": 25,
                "buyOrders": 4,
                "sellOrders": 3,
            },
        },
    },
}


def auction_payload(*, page: int, last_updated: int, total_pages: int = 2) -> dict[str, Any]:
    auctions = []
    per_page = 2
    for index in range(per_page):
        number = page * per_page + index
        auctions.append(
            {
                "uuid": f"auction-{last_updated}-{number}",
                "item_name": f"Item {number}",
                "tier": "LEGENDARY",
                "category": "misc",
                "starting_bid": 1000 + number,
                "highest_bid_amount": 0,
                "bin": True,
                "end": int(time.time() * 1000) + 3_600_000 + number,
                "start": 1_699_000_000_000 + number,
                "auctioneer": "player",
                "profile_id": "abc",
                "item_lore": None,
                "bids": [],
            }
        )
    return {
        "success": True,
        "page": page,
        "totalPages": total_pages,
        "totalAuctions": total_pages * per_page,
        "lastUpdated": last_updated,
        "auctions": auctions,
    }


class MockUpstream:
    """Deterministic httpx transport with mutable behaviour for failure tests."""

    def __init__(self) -> None:
        self.mode: dict[str, str] = {}
        self.requests: list[str] = []
        self.auction_last_updated = 1_700_000_000_000
        self.auction_total_pages = 2
        self.include_key_check = True
        self.fetched_keys: list[str | None] = []

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.handle)

    def fail(self, path: str, mode: str) -> None:
        self.mode[path] = mode

    async def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request.url.path)
        path = request.url.path
        mode = self.mode.get(path)

        if path == "/v2/skyblock/bazaar":
            if mode == "timeout":
                raise httpx.ConnectTimeout("simulated timeout", request=request)
            if mode == "500":
                return httpx.Response(500, json={"success": False, "cause": "boom"})
            if mode == "malformed":
                return httpx.Response(200, content=b"{not json", headers={"content-type": "application/json"})
            return httpx.Response(200, json=BAZAAR_PAYLOAD)

        if path == "/v2/skyblock/auctions":
            if mode == "inconsistent":
                page = int(request.url.params.get("page", "0"))
                return httpx.Response(
                    200,
                    json=auction_payload(
                        page=page,
                        last_updated=self.auction_last_updated + (0 if page == 0 else 1),
                        total_pages=self.auction_total_pages,
                    ),
                )
            page = int(request.url.params.get("page", "0"))
            return httpx.Response(
                200,
                json=auction_payload(
                    page=page,
                    last_updated=self.auction_last_updated,
                    total_pages=self.auction_total_pages,
                ),
            )

        if path == "/v2/resources/skyblock/items":
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "lastUpdated": 1_700_000_000_000,
                    "items": [{"id": "ENCHANTED_DIAMOND", "name": "Enchanted Diamond"}],
                },
            )
        if path == "/v2/resources/skyblock/skills":
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "lastUpdated": 1_700_000_000_000,
                    "version": "1",
                    "skills": {"FARMING": {"name": "Farming"}},
                },
            )
        if path == "/v2/resources/skyblock/collections":
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "lastUpdated": 1_700_000_000_000,
                    "version": "1",
                    "collections": {"FARMING": {"name": "Farming"}},
                },
            )

        if path in {"/v2/player", "/v2/skyblock/profiles"}:
            key = request.headers.get("API-Key")
            self.fetched_keys.append(key)
            if mode == "timeout":
                raise httpx.ConnectTimeout("simulated timeout", request=request)
            if mode == "403":
                return httpx.Response(403, json={"success": False, "cause": "Forbidden"})
            if mode == "429":
                return httpx.Response(429, headers={"Retry-After": "1"}, json={"success": False})
            if mode == "500":
                return httpx.Response(500, json={"success": False})
            if mode == "malformed":
                return httpx.Response(200, content=b"<html>oops</html>")
            if not key:
                return httpx.Response(403, json={"success": False, "cause": "Missing key"})
            if path == "/v2/player":
                return httpx.Response(
                    200,
                    json={
                        "success": True,
                        "player": {"uuid": "abc123", "displayname": "Tester"},
                    },
                )
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "profiles": [
                        {
                            "profile_id": "p1",
                            "cute_name": "Apple",
                            "selected": True,
                            "members": {"abc123": {"last_save": 1}},
                        }
                    ],
                },
            )

        return httpx.Response(404, json={"success": False, "cause": "Not found"})


@pytest.fixture
def upstream() -> MockUpstream:
    return MockUpstream()


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'test.db'}",
        auto_create_tables=True,
        redis_url="",
        hypixel_api_key="test-key",
        upstream_max_retries=0,
        upstream_rate_limit_per_minute=120,
        backend_rate_limit_per_minute=1000,
        log_level="WARNING",
    )


@pytest.fixture
def no_key_settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'test.db'}",
        auto_create_tables=True,
        redis_url="",
        hypixel_api_key=None,
        upstream_max_retries=0,
        backend_rate_limit_per_minute=1000,
        log_level="WARNING",
    )


def dump(value: Any) -> str:
    return json.dumps(value, sort_keys=True, default=str)
