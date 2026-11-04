from __future__ import annotations

import pytest

from app.container import Container
from app.core.errors import UpstreamInvalidResponseError
from app.services import auctions as auctions_module


async def build_container(settings, upstream) -> Container:
    return await Container.create(settings, transport=upstream.transport())


async def test_auction_snapshot_is_consistent(settings, upstream, monkeypatch) -> None:
    async def no_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(auctions_module.asyncio, "sleep", no_sleep)
    container = await build_container(settings, upstream)
    try:
        response = await container.auctions.list_auctions(page=0, page_size=50)
        assert response.total_auctions == 4
        assert response.meta.snapshot_id
        snapshot_ids = {auction.uuid.split("-")[1] for auction in response.auctions}
        assert snapshot_ids == {str(upstream.auction_last_updated)}
        # Only one page is returned to the client even though two pages exist upstream.
        page = await container.auctions.list_auctions(page=0, page_size=1)
        assert len(page.auctions) == 1
        assert page.total_pages == 4
        second = await container.auctions.list_auctions(page=1, page_size=1)
        assert second.auctions[0].uuid != page.auctions[0].uuid
    finally:
        await container.close()


async def test_inconsistent_auction_pages_are_rejected(settings, upstream, monkeypatch) -> None:
    async def no_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(auctions_module.asyncio, "sleep", no_sleep)
    upstream.fail("/v2/skyblock/auctions", "inconsistent")
    container = await build_container(settings, upstream)
    try:
        with pytest.raises(UpstreamInvalidResponseError):
            await container.auctions.list_auctions()
    finally:
        await container.close()


async def test_failed_refresh_keeps_previous_snapshot(settings, upstream, monkeypatch) -> None:
    async def no_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(auctions_module.asyncio, "sleep", no_sleep)
    container = await build_container(settings, upstream)
    try:
        first = await container.auctions.list_auctions()
        first_id = first.meta.snapshot_id
        upstream.fail("/v2/skyblock/auctions", "inconsistent")
        stale = await container.auctions.get_snapshot(force=True)
        assert stale.status == "stale"
        assert stale.value["snapshot_id"] == first_id
        assert stale.revalidate_error == "upstream_error"
        # Subsequent user requests still see the complete old snapshot.
        still_served = await container.auctions.list_auctions()
        assert still_served.meta.snapshot_id == first_id
        assert len(still_served.auctions) == 4
    finally:
        await container.close()


async def test_new_snapshot_atomically_replaces_old(settings, upstream, monkeypatch) -> None:
    async def no_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(auctions_module.asyncio, "sleep", no_sleep)
    container = await build_container(settings, upstream)
    try:
        first = await container.auctions.get_snapshot()
        old_id = first.value["snapshot_id"]
        upstream.auction_last_updated = 1_800_000_000_000
        refreshed = await container.auctions.get_snapshot(force=True)
        assert refreshed.value["snapshot_id"] != old_id
        assert all(str(upstream.auction_last_updated) in auction["uuid"] for auction in refreshed.value["auctions"])
    finally:
        await container.close()


async def test_auction_filters_and_sorting(settings, upstream, monkeypatch) -> None:
    async def no_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(auctions_module.asyncio, "sleep", no_sleep)
    container = await build_container(settings, upstream)
    try:
        response = await container.auctions.list_auctions(search="Item 3", bin_only=True)
        assert response.filtered_total == 1
        assert response.auctions[0].item_name == "Item 3"
        sorted_response = await container.auctions.list_auctions(sort="price_desc")
        prices = [auction.starting_bid for auction in sorted_response.auctions]
        assert prices == sorted(prices, reverse=True)
    finally:
        await container.close()


async def test_listing_pagination_excludes_expired_and_claimed_snapshot_rows(settings, upstream) -> None:
    container = await build_container(settings, upstream)
    try:
        snapshot = await container.auctions.get_snapshot()
        snapshot.value["auctions"][0]["end"] = 1
        snapshot.value["auctions"][1]["claimed"] = True
        response = await container.auctions.list_auctions(page_size=1)
        assert response.filtered_total == 2
        assert response.total_pages == 2
        assert len(response.auctions) == 1
    finally:
        await container.close()


async def test_reader_never_builds_or_refreshes_snapshot(settings, upstream):
    from app.core.errors import UpstreamUnavailableError

    container = await Container.create(settings, transport=upstream.transport())
    try:
        container.auctions.builder = False
        with pytest.raises(UpstreamUnavailableError):
            await container.auctions.get_snapshot(force=True)
        assert not upstream.requests
        container.auctions.builder = True
        built = await container.auctions.get_snapshot()
        container.auctions.builder = False
        before = len(upstream.requests)
        read = await container.auctions.get_snapshot(force=True)
        assert read.value["snapshot_id"] == built.value["snapshot_id"]
        assert len(upstream.requests) == before
    finally:
        await container.close()


def large_pages():
    import time

    rows = []
    now = int(time.time() * 1000)
    for i in range(1205):
        rows.append(
            {
                "uuid": f"listing-{i:05}",
                "item_name": "Ancient Necron\u2019s Chestplate" if i >= 1200 else f"Common Item {i}",
                "category": "armor" if i >= 1200 else "misc",
                "tier": "LEGENDARY" if i >= 1200 else "COMMON",
                "bin": i != 1204,
                "starting_bid": 1205 - i if i >= 1200 else 10000 + i,
                "highest_bid_amount": 2000000 if i == 1204 else 0,
                "start": now + i,
                "end": now + 3600000 + i,
                "claimed": i == 1,
            }
        )
    rows[0]["end"] = 1
    return rows


async def test_global_search_filters_sort_and_paging_beyond_1000(settings, upstream, monkeypatch):
    c = await build_container(settings, upstream)
    rows = large_pages()
    calls = []

    async def fetch(page, priority=None):
        calls.append(page)
        return {
            "page": page,
            "totalPages": 3,
            "totalAuctions": len(rows),
            "lastUpdated": 1800000000000,
            "auctions": rows[page * 500 : (page + 1) * 500],
        }

    monkeypatch.setattr(c.auctions, "_fetch_page", fetch)
    try:
        match = await c.auctions.list_auctions(search="  necron's    CHESTPLATE ", page_size=2, sort="price_asc")
        assert match.filtered_total == 5 and match.total_pages == 3
        assert match.categories == ["armor", "misc"]
        monkeypatch.setattr(auctions_module, "search_key", lambda _: pytest.fail("NBT indexing during a user search"))
        assert [r.uuid for r in match.auctions] == ["listing-01203", "listing-01202"]
        second = await c.auctions.list_auctions(search="necrons chestplate", page=1, page_size=2, sort="price_asc")
        assert [r.uuid for r in second.auctions] == ["listing-01201", "listing-01200"]
        assert second.meta.snapshot_id == match.meta.snapshot_id
        assert match.snapshot_complete is True and match.snapshot_pages == 3 and match.total_auctions == 1205
        bin_page = await c.auctions.list_auctions(
            search="necron",
            auction_type="bin",
            rarity="legendary",
            category="armor",
            min_price=3,
            max_price=4,
            sort="price_desc",
        )
        assert bin_page.filtered_total == 2 and [r.starting_bid for r in bin_page.auctions] == [4, 3]
        bidding = await c.auctions.list_auctions(auction_type="auction", min_price=1000000)
        assert bidding.filtered_total == 1 and bidding.auctions[0].uuid == "listing-01204"
        first = await c.auctions.list_auctions(sort="price_asc", page_size=1)
        assert first.auctions[0].uuid == "listing-01203" and first.filtered_total == 1203
        newest = await c.auctions.list_auctions(sort="newest", page_size=1)
        assert newest.auctions[0].uuid == "listing-01204"
        assert "_search_text" not in first.auctions[0].model_dump()
        assert set(calls) == {0, 1, 2} and len(calls) == 3  # no upstream calls for any search
        assert (await c.auctions.list_auctions(ending_within=60)).filtered_total == 0
    finally:
        await c.close()


async def test_search_index_reuses_uuid_and_prunes_old_generation(settings, upstream, monkeypatch):
    c = await build_container(settings, upstream)
    calls = []
    original = auctions_module.search_key

    def counted(row):
        calls.append(row["uuid"])
        return original(row)

    monkeypatch.setattr(auctions_module, "search_key", counted)
    try:
        await c.auctions.get_snapshot()
        assert len(calls) == 4
        await c.auctions.get_snapshot(force=True)
        assert len(calls) == 4
        upstream.auction_last_updated += 1
        await c.auctions.get_snapshot(force=True)
        assert len(calls) == 8 and len(c.auctions._search_keys) == 4
        assert all(str(upstream.auction_last_updated) in key for key in c.auctions._search_keys)
    finally:
        await c.close()


def test_worker_search_identity_and_keywords_not_display_price():
    import base64
    import gzip
    import io

    import nbtlib

    from app.services.auction_search import query_tokens, search_key

    extra = nbtlib.Compound(
        {
            "id": nbtlib.String("ASPECT_OF_THE_VOID"),
            "uuid": nbtlib.String("11111111-2222-3333-4444-555555555555"),
            "enchantments": nbtlib.Compound({"ultimate_wise": nbtlib.Short(5)}),
            "ability_scroll": nbtlib.List[nbtlib.String](["WITHER_SHIELD_SCROLL"]),
        }
    )
    doc = nbtlib.File(
        {"i": nbtlib.List[nbtlib.Compound]([nbtlib.Compound({"tag": nbtlib.Compound({"ExtraAttributes": extra})})])}
    )
    out = io.BytesIO()
    doc.write(out)
    raw = {
        "uuid": "f" * 32,
        "item_name": "§6Heroic Aspect of the Void ✪",
        "item_bytes": base64.b64encode(gzip.compress(out.getvalue())).decode(),
    }
    key, identified = search_key(raw)
    assert identified
    for q in [
        "AOTV",
        "ASPECT_OF_THE_VOID",
        "ultimate wise",
        "Wither Shield",
        "11111111222233334444555555555555",
        "f" * 32,
    ]:
        assert all(t in key for t in query_tokens(q))
    raw["item_bytes"] = "bad"
    key, identified = search_key(raw)
    assert not identified and "aspect" in key


def test_auction_http_filter_validation_and_capability(settings, upstream):
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app(settings, upstream_transport=upstream.transport())) as client:
        for query in [
            "min_price=NaN",
            "max_price=inf",
            "min_price=5&max_price=2",
            "auction_type=unknown",
            "ending_within=-1",
        ]:
            assert client.get("/api/v1/auctions?" + query).status_code == 422
        r = client.get("/api/v1/auctions?auction_type=bin&category=misc&sort=newest&page_size=1").json()
        assert r["search_version"] == 1 and r["snapshot_complete"] is True and r["categories"] == ["misc"]
        assert len(r["auctions"]) == 1 and r["filtered_total"] == 4


async def test_missing_page_rows_never_replace_full_snapshot(settings, upstream, monkeypatch):
    async def no_sleep(_):
        pass

    monkeypatch.setattr(auctions_module.asyncio, "sleep", no_sleep)
    c = await build_container(settings, upstream)
    try:
        original = await c.auctions.get_snapshot()
        fetch = c.auctions._fetch_page

        async def missing(page, priority=None):
            d = await fetch(page, priority)
            if page == 1:
                d["auctions"] = d["auctions"][:-1]
            return d

        monkeypatch.setattr(c.auctions, "_fetch_page", missing)
        kept = await c.auctions.get_snapshot(force=True)
        assert (
            kept.stale and kept.value["snapshot_id"] == original.value["snapshot_id"] and kept.value["complete"] is True
        )
        assert len(kept.value["auctions"]) == 4
    finally:
        await c.close()
