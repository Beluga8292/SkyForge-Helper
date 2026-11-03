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
