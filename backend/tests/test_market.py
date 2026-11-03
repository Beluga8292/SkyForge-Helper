from __future__ import annotations

import base64
import copy
import gzip
import io
import time
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import httpx
import nbtlib
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.cache.service import CacheResult
from app.container import Container
from app.main import create_app
from app.schemas.market import FlipRequest
from app.services.market.auctions import identity, value_snapshot
from app.services.market.flip_engine import calculate
from app.services.market.history import analyse
from tests.conftest import BAZAAR_PAYLOAD


def product():
    p = copy.deepcopy(BAZAAR_PAYLOAD["products"]["ENCHANTED_DIAMOND"])
    p["buy_summary"][0]["amount"] = 100000
    p["sell_summary"][0]["amount"] = 100000
    p["quick_status"]["buyMovingWeek"] = 1_000_000
    p["quick_status"]["sellMovingWeek"] = 1_000_000
    return p


def test_order_profit_and_correct_sides():
    r = calculate("X", product(), FlipRequest(quantity=64))
    assert r.buy_price == 100 and r.sell_price == 120
    assert r.fees == 1.5 and r.net_per_item == 18.5
    assert r.net_profit == 1184 and r.roi == 18.5
    assert r.break_even == pytest.approx(100 / 0.9875)
    assert r.net_per_stack == r.net_profit


def test_unprofitable_order():
    p = product()
    p["buy_summary"][0]["pricePerUnit"] = 100.5
    r = calculate("X", p, FlipRequest())
    assert r.net_profit < 0 and r.scores.overall == 0
    assert "unprofitable" in r.risks


def test_instant_negative_and_vwap():
    r = calculate("X", product(), FlipRequest(mode="instant", quantity=10))
    assert r.buy_price == 120 and r.sell_price == 100
    assert r.net_per_item == -21.25
    p = product()
    p["buy_summary"] = [{"pricePerUnit": 120, "amount": 5}, {"pricePerUnit": 140, "amount": 5}]
    r = calculate("X", p, FlipRequest(mode="instant", quantity=10))
    assert r.buy_price == 130 and r.price_impact_pct > 0


@pytest.mark.parametrize("value", [0, -1, float("nan"), float("inf"), None])
def test_invalid_prices_are_not_invented(value):
    p = product()
    p["buy_summary"][0]["pricePerUnit"] = value
    r = calculate("X", p, FlipRequest())
    assert r.sell_price is None and r.net_profit is None and r.scores.overall == 0


def test_missing_book_and_zero_volume_penalty():
    p = product()
    p["buy_summary"] = []
    r = calculate("X", p, FlipRequest())
    assert r.net_profit is None
    p = product()
    p["quick_status"]["buyMovingWeek"] = 0
    low = calculate("X", p, FlipRequest())
    high = calculate("X", product(), FlipRequest())
    assert low.scores.overall == 0 < high.scores.overall
    assert low.weekly_activity == 0


@pytest.mark.parametrize("quantity", [0, 1_000_001, -1, float("nan")])
def test_quantity_is_bounded(quantity):
    with pytest.raises(ValidationError):
        FlipRequest(quantity=quantity)


def test_large_position_and_score_explanation():
    r = calculate("X", product(), FlipRequest(quantity=1_000_000), age_ms=300000)
    assert r.position_cost == 100_000_000
    assert "large_position" in r.risks and "stale" in r.risks
    assert all(0 <= getattr(r.scores, k) <= 100 for k in ("profit", "risk", "liquidity", "overall"))
    assert sum(r.scores.explanation[k] for k in ("profit_weight", "liquidity_weight", "risk_weight")) == 1


def historical(count=25, jump=False):
    base = datetime(2026, 1, 1, tzinfo=UTC)
    return [
        {
            "ts": base + timedelta(minutes=5 * i),
            "buy_price": 150 if jump and i == count - 1 else 100,
            "sell_price": 90,
            "buy_volume": 10000,
            "sell_volume": 10000,
        }
        for i in range(count)
    ]


def test_history_missing_small_and_constant():
    assert analyse([])["average"] is None
    assert not analyse(historical(3, True))["signals"]
    result = analyse(historical())
    assert result["sufficient"] and result["volatility_pct"] == 0
    assert result["z_score"] is None and not result["signals"]


def test_history_volatility_signals_and_gaps():
    points = historical(jump=True)
    result = analyse(points)
    assert result["volatility_pct"] > 0
    assert {"price_change", "spread_expansion"} <= {s.kind for s in result["signals"]}
    assert all(s.samples >= 12 and s.sufficient and s.updated_at for s in result["signals"])
    points[-1]["ts"] += timedelta(days=1)
    result = analyse(points)
    assert any(p["buy_price"] is None for p in result["points"])
    assert not result["signals"]


def blob(item_id="SWORD", count=1, **extra):
    nbt = nbtlib.File(
        {
            "i": nbtlib.List[nbtlib.Compound](
                [
                    nbtlib.Compound(
                        {
                            "Count": nbtlib.Byte(count),
                            "Damage": nbtlib.Short(0),
                            "tag": nbtlib.Compound(
                                {
                                    "ExtraAttributes": nbtlib.Compound(
                                        {"id": nbtlib.String(item_id), **{k: nbtlib.Int(v) for k, v in extra.items()}}
                                    )
                                }
                            ),
                        }
                    )
                ]
            )
        }
    )
    out = io.BytesIO()
    nbt.write(out)
    return base64.b64encode(gzip.compress(out.getvalue())).decode()


def listings(n=12):
    now = int(time.time() * 1000)
    encoded = blob()
    return [
        {
            "uuid": f"a{i}",
            "item_name": "Sword",
            "tier": "LEGENDARY",
            "bin": True,
            "starting_bid": 50 if i == 0 else 100,
            "item_bytes": encoded,
            "end": now + 3600000,
            "start": now - 1000,
            "auctioneer": f"s{i}",
        }
        for i in range(n)
    ]


def test_auction_robust_reference_excludes_target():
    lots = listings()
    lots[-1]["starting_bid"] = 1000000
    r = value_snapshot(lots, int(time.time() * 1000))[0]
    assert r["reference_price"] == 100 and r["discount_pct"] == 50
    assert r["net_upside"] is None and r["confidence"] == "medium"
    assert lots[0]["uuid"] not in r["comparable_ids"]


@pytest.mark.parametrize(
    "change",
    [
        {"tier": "MYTHIC"},
        {"item_bytes": blob(upgrade_level=5)},
        {"item_bytes": blob(count=64)},
        {"item_bytes": blob("OTHER")},
    ],
)
def test_auction_matching_separates_rarity_count_attributes(change):
    lots = listings()
    lots[0].update(change)
    assert value_snapshot(lots, int(time.time() * 1000))[0]["reference_price"] is None


def test_insufficient_no_nbt_and_single_seller():
    assert value_snapshot(listings(3), int(time.time() * 1000))[0]["confidence"] == "insufficient"
    lots = listings()
    lots[0]["item_bytes"] = "bad"
    assert value_snapshot(lots, int(time.time() * 1000))[0]["reference_price"] is None
    lots = listings()
    for lot in lots:
        lot["auctioneer"] = "same"
    assert all(r["reference_price"] is None for r in value_snapshot(lots, int(time.time() * 1000)))
    assert identity({"item_bytes": "x" * 300000}) is None


def test_auction_expiration_and_non_bin():
    lots = listings()
    lots[0]["end"] = 1
    lots[1]["bin"] = False
    assert {r["auction_id"] for r in value_snapshot(lots, int(time.time() * 1000))} == {f"a{i}" for i in range(2, 12)}


async def test_auction_cached_by_snapshot(settings, upstream, monkeypatch):
    from app.services.market import service

    c = await Container.create(settings, transport=upstream.transport())
    now = time.time()
    result = CacheResult(
        value={"snapshot_id": "one", "auctions": listings()},
        status="hit",
        fetched_at=now,
        stored_at=now,
        cache_age_ms=0,
        stale=False,
        source="memory",
    )
    c.auctions.get_snapshot = AsyncMock(return_value=result)
    original = service.value_snapshot
    calls = []

    def track(*args):
        calls.append(1)
        return original(*args)

    monkeypatch.setattr(service, "value_snapshot", track)
    try:
        one = await c.market.auctions(min_discount=10)
        two = await c.market.auctions(min_discount=20)
        assert one.items[0].reference_price == two.items[0].reference_price == 100
        assert len(calls) == 1
    finally:
        await c.close()


def test_market_endpoints_validation_pagination_and_history(settings, upstream):
    with TestClient(create_app(settings, upstream_transport=upstream.transport())) as client:
        r = client.get("/api/v1/market/bazaar/flips", params={"quantity": 1, "page_size": 1})
        assert r.status_code == 200 and len(r.json()["items"]) == 1
        assert r.json()["snapshot_id"].startswith("bz-")
        assert client.get("/api/v1/market/bazaar/flips?quantity=1000001").status_code == 422
        assert client.get("/api/v1/market/bazaar/flips?tax_pct=NaN").status_code == 422
        assert client.get("/api/v1/market/bazaar/flips?sort=evil").status_code == 422
        stats = client.get("/api/v1/market/bazaar/ENCHANTED_DIAMOND/analytics")
        assert stats.status_code == 200 and stats.json()["samples"] == 0
        assert client.get("/api/v1/market/bazaar/UNKNOWN/analytics").status_code == 404
        assert client.get("/api/v1/market/bazaar/ENCHANTED_DIAMOND/signals").json()["signals"] == []
        overview = client.get("/api/v1/market/overview")
        assert overview.status_code == 200 and not overview.json()["largest_changes"]
        assert client.get("/api/v1/market/status").json()["automated_trading"] is False
    assert upstream.requests.count("/v2/skyblock/bazaar") == 1


def test_backend_disconnected_does_not_invent_flips(settings):
    def offline(request):
        raise httpx.ConnectError("offline", request=request)

    with TestClient(create_app(settings, upstream_transport=httpx.MockTransport(offline))) as client:
        r = client.get("/api/v1/market/bazaar/flips")
        assert r.status_code == 503 and "items" not in r.json()


def test_explicit_local_worker_shares_container_and_stops(settings, upstream):
    app = create_app(settings.model_copy(update={"run_local_worker": True}), upstream_transport=upstream.transport())
    with TestClient(app) as client:
        assert client.get("/api/v1/health").status_code == 200
        container = app.state.container
    assert container.limiter._closed


async def test_expired_comparables_invalidate_valuation_without_new_snapshot(settings, upstream):
    c = await Container.create(settings, transport=upstream.transport())
    now = time.time()
    lots = listings(7)
    for r in lots[1:]:
        r["end"] = int(now * 1000) + 100
    snapshot = CacheResult(
        value={"snapshot_id": "same", "auctions": lots},
        status="hit",
        fetched_at=now,
        stored_at=now,
        cache_age_ms=0,
        stale=False,
        source="memory",
    )
    try:
        first = await c.market._auction_values(snapshot, int(now * 1000))
        assert first[0]["reference_price"] == 100
        # Rows are reused inside a short bucket; a recompute on every request
        # kept a CPU core busy while the soonest listing was always about to end.
        reused = await c.market._auction_values(snapshot, int(now * 1000) + 200)
        assert reused[0]["reference_price"] == 100
        second = await c.market._auction_values(snapshot, int(now * 1000) + 21_000)
        assert second[0]["reference_price"] is None
    finally:
        await c.close()


async def test_cancellation_reuses_inflight_auction_build(settings, upstream, monkeypatch):
    import asyncio

    c = await Container.create(settings, transport=upstream.transport())
    now = time.time()
    snapshot = CacheResult(
        value={"snapshot_id": "shared", "auctions": listings()},
        status="hit",
        fetched_at=now,
        stored_at=now,
        cache_age_ms=0,
        stale=False,
        source="memory",
    )
    original = c.market._prepare_identities
    calls = []

    def slow(rows, cache=None):
        calls.append(1)
        time.sleep(0.05)
        return original(rows, cache)

    monkeypatch.setattr(c.market, "_prepare_identities", slow)
    try:
        task = asyncio.create_task(c.market._auction_values(snapshot, int(now * 1000)))
        await asyncio.sleep(0.01)
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        result = await c.market._auction_values(snapshot, int(now * 1000))
        assert result and len(calls) == 1
    finally:
        await c.close()


def test_prepare_identities_reuses_nbt_decodes_for_persistent_listings(monkeypatch):
    from app.services.market import service as module

    calls = []

    def fake_identity(raw):
        calls.append(raw["uuid"])
        return ("key", "ITEM", 1, {})

    monkeypatch.setattr(module, "identity", fake_identity)
    rows = [
        {"uuid": "a", "bin": True},
        {"uuid": "b", "bin": True},
        {"uuid": "c", "bin": False},
    ]
    first, limited = module.MarketService._prepare_identities(rows)
    second, limited_again = module.MarketService._prepare_identities(rows, first)
    assert not limited and not limited_again
    assert calls == ["a", "b"]
    assert set(second) == {"a", "b"}


async def test_smart_auction_filters_before_pagination(settings, upstream):
    c = await Container.create(settings, transport=upstream.transport())
    now = time.time()
    snapshot = CacheResult(
        value={"snapshot_id": "smart", "auctions": listings()},
        status="hit",
        fetched_at=now,
        stored_at=now,
        cache_age_ms=0,
        stale=False,
        source="memory",
    )
    c.auctions.get_snapshot = AsyncMock(return_value=snapshot)
    try:
        page = await c.market.auctions(page_size=1, min_profit=40, min_roi=50, fee_pct=2, listing_fee=1)
        assert page.smart_filters_applied and page.total == 1 and len(page.items) == 1
        assert page.items[0].net_upside == 47
        assert not (await c.market.auctions(page=1, page_size=1, min_profit=40, fee_pct=2, listing_fee=1)).items
        assert (await c.market.auctions(min_profit=0)).total == 0  # fees are unknown
        assert (await c.market.auctions(max_risk=0)).total == 0
        snapshot.stale = True
        assert (await c.market.auctions(max_age_seconds=120)).total == 0
        assert (await c.market.auctions(max_risk=100)).total == 0
    finally:
        await c.close()


def test_smart_auction_parameter_bounds(settings, upstream):
    with TestClient(create_app(settings, upstream_transport=upstream.transport())) as client:
        for query in ["min_profit=NaN", "min_roi=-101", "max_risk=101", "max_age_seconds=-1", "page_size=101"]:
            assert client.get("/api/v1/market/auctions/opportunities?" + query).status_code == 422


def test_pet_identity_ignores_only_instance_uuid():
    from app.services.market.auctions import identity_from_item
    import json

    pet = {"type": "SHEEP", "tier": "LEGENDARY", "exp": 10000, "uuid": "one"}

    def key(p):
        return identity_from_item(
            {"Count": 1, "Damage": 0, "tag": {"ExtraAttributes": {"id": "PET", "petInfo": json.dumps(p)}}}, "LEGENDARY"
        )

    assert key(pet)[0] == key({**pet, "uuid": "two"})[0]
    for patch in [
        {"exp": 10001},
        {"skin": "BLUE"},
        {"candyUsed": 1},
        {"heldItem": "TEXTBOOK"},
        {"unknown_modifier": 1},
    ]:
        assert key(pet)[0] != key({**pet, **patch})[0]
    assert key({"type": "SHEEP"}) is None


def test_smart_global_filters_http_contract(settings, upstream):
    app = create_app(settings, upstream_transport=upstream.transport())
    with TestClient(app) as client:
        now = time.time()
        app.state.container.auctions.get_snapshot = AsyncMock(
            return_value=CacheResult(
                value={"snapshot_id": "smart-http", "auctions": listings()},
                status="hit",
                fetched_at=now,
                stored_at=now,
                cache_age_ms=0,
                stale=False,
                source="memory",
            )
        )
        response = client.get(
            "/api/v1/market/auctions/opportunities",
            params={"page_size": 1, "min_profit": 40, "fee_pct": 2, "listing_fee": 1},
        )
        assert response.status_code == 200
        assert response.json()["smart_filters_applied"] is True
        assert response.json()["total"] == 1
        assert len(response.json()["items"]) == 1


def test_legacy_color_and_count_are_critical_identity_fields():
    from app.services.market.auctions import identity_from_item

    def item(color, count=1):
        return {"Count": count, "tag": {"display": {"color": color}, "ExtraAttributes": {"id": "ARMOR"}}}

    assert identity_from_item(item(0), "EPIC")[0] != identity_from_item(item(0xFFFFFF), "EPIC")[0]
    assert identity_from_item(item(0, 1.5), "EPIC") is None
