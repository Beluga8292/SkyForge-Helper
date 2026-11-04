from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from datetime import UTC, datetime
from typing import Any

from app.cache.service import CacheResult, CacheService
from app.clients.hypixel import HypixelClient
from app.core.errors import UpstreamInvalidResponseError, UpstreamNotFoundError, UpstreamUnavailableError
from app.core.rate_limit import PRIORITY_LOW, PRIORITY_MEDIUM
from app.schemas.api import AuctionItem, AuctionResponse, AuctionsResponse, Meta
from app.services.auction_search import normalize, query_tokens, search_key

logger = logging.getLogger(__name__)


class AuctionSnapshotService:
    """Builds and publishes consistent Auction House snapshots.

    Page requests are served from one immutable snapshot. A new snapshot is
    published only after every page was fetched with the same `lastUpdated`
    value, so users never see a page assembled from two upstream snapshots.
    """

    def __init__(
        self,
        *,
        client: HypixelClient,
        cache: CacheService,
        ttl: int,
        stale_ttl: int,
        concurrency: int = 4,
        max_pages: int = 100,
        max_page_size: int = 100,
        builder: bool = True,
    ) -> None:
        self.client = client
        self.cache = cache
        self.ttl = ttl
        self.stale_ttl = stale_ttl
        self.concurrency = concurrency
        self.max_pages = max_pages
        self.max_page_size = max_page_size
        self.builder = builder
        self._refresh_lock = asyncio.Lock()
        self._last_attempt = 0.0
        self._last_error: str | None = None
        self._search_keys: dict[str, tuple[str, bool]] = {}

    def index_search(self, items: list[dict[str, Any]]) -> int:
        """Worker-only, incremental metadata index; API readers never decode blobs."""
        current = {}
        for item in items:
            key = self._search_keys.get(item["uuid"])
            if key is None:
                key = search_key(item)
            current[item["uuid"]] = key
            item["_search_text"] = key[0]
        self._search_keys = current
        return sum(key[1] for key in current.values())

    async def _fetch_page(self, page: int, priority: int = PRIORITY_MEDIUM) -> dict[str, Any]:
        payload = await self.client.get("/skyblock/auctions", params={"page": page}, priority=priority)
        # Validating 42k auctions through pydantic cost ~6.4 s per refresh.
        # Structural checks below plus page consistency checks protect the
        # snapshot; response models still validate the rows that are returned.
        if not isinstance(payload, dict) or not isinstance(payload.get("auctions"), list):
            raise UpstreamInvalidResponseError("Malformed Auction House page")
        return payload

    async def _fetch_all(self) -> dict[str, Any]:
        if not self.builder:
            raise UpstreamUnavailableError("Auction snapshot is built by the worker and is not ready yet")
        async with self._refresh_lock:
            self._last_attempt = time.monotonic()
            last_error: Exception | None = None
            for attempt in range(3):
                pages: dict[int, dict[str, Any]] = {}
                auctions: dict[str, dict[str, Any]] = {}
                try:
                    first = await self._fetch_page(0)
                    total_pages = int(first.get("totalPages") or 0)
                    if total_pages < 1 or total_pages > self.max_pages:
                        raise UpstreamInvalidResponseError(f"Unexpected Auction House page count: {total_pages}")
                    expected_last = first.get("lastUpdated")
                    expected_total = int(first.get("totalAuctions") or 0)
                    pages[0] = first

                    semaphore = asyncio.Semaphore(self.concurrency)

                    async def load(
                        page: int, sem: asyncio.Semaphore = semaphore, target: dict[int, dict[str, Any]] = pages
                    ) -> None:
                        async with sem:
                            target[page] = await self._fetch_page(page, priority=PRIORITY_LOW)

                    if total_pages > 1:
                        async with asyncio.TaskGroup() as group:
                            for page in range(1, total_pages):
                                group.create_task(load(page))

                    for _page_number, page in pages.items():
                        if int(page.get("totalPages") or 0) != total_pages:
                            raise UpstreamInvalidResponseError("Auction snapshot changed totalPages during download")
                        if expected_last is not None and page.get("lastUpdated") != expected_last:
                            raise UpstreamInvalidResponseError("Auction snapshot changed lastUpdated during download")
                        if int(page.get("totalAuctions") or 0) != expected_total:
                            raise UpstreamInvalidResponseError("Auction snapshot changed totalAuctions during download")

                    for page_number in range(total_pages):
                        page = pages[page_number]
                        if int(page.get("page", page_number)) != page_number:
                            raise UpstreamInvalidResponseError("Auction page number mismatch")
                        for raw in page.get("auctions", []):
                            if not isinstance(raw, dict) or not isinstance(raw.get("uuid"), str):
                                raise UpstreamInvalidResponseError("Malformed auction row")
                            auctions[raw["uuid"]] = raw

                    if expected_last is None or len(auctions) != expected_total:
                        raise UpstreamInvalidResponseError(
                            f"Incomplete auction snapshot: {len(auctions)}/{expected_total}"
                        )

                    items = list(auctions.values())
                    pages.clear()
                    identity_indexed = await asyncio.to_thread(self.index_search, items)
                    fingerprint = ",".join(sorted(auctions)[:100])
                    digest = hashlib.sha256(f"{expected_last}:{expected_total}:{fingerprint}".encode()).hexdigest()[:16]
                    snapshot_id = f"{expected_last or 'unknown'}-{digest}"
                    logger.info(
                        "Fetched complete auction snapshot id=%s pages=%s auctions=%s",
                        snapshot_id,
                        total_pages,
                        len(items),
                    )
                    self._last_error = None
                    return {
                        "complete": True,
                        "expected_total": expected_total,
                        "search_index_version": 1,
                        "identity_indexed": identity_indexed,
                        "snapshot_id": snapshot_id,
                        "fetched_at": time.time(),
                        "last_updated": expected_last,
                        "total_pages": total_pages,
                        "total_auctions": len(items),
                        "auctions": items,
                    }
                except Exception as exc:
                    # Failed generations must not overlap the next full download.
                    # TaskGroup tracebacks and load() defaults can retain these maps.
                    pages.clear()
                    auctions.clear()
                    logger.warning(
                        "Auction snapshot attempt failed attempt=%s error=%s reason=%s",
                        attempt + 1,
                        type(exc).__name__,
                        str(exc)
                        if str(exc).startswith(("Auction snapshot changed", "Incomplete auction snapshot"))
                        else "upstream",
                    )
                    last_error = exc
                    self._last_error = type(exc).__name__
                    if attempt < 2:
                        await asyncio.sleep(1.0 + attempt)
                        continue
                    raise
            raise UpstreamInvalidResponseError("Could not build a consistent auction snapshot") from last_error

    async def get_snapshot(self, *, force: bool = False) -> CacheResult:
        if not self.builder:
            entry, backend = await self.cache.cache.get("auctions:snapshot")
            if entry and entry.is_usable:
                return self.cache._result(entry, "hit" if entry.is_fresh else "stale", backend)
            raise UpstreamUnavailableError("Auction snapshot is built by the worker and is not ready yet")
        return await self.cache.get_or_fetch(
            "auctions:snapshot",
            ttl=self.ttl,
            stale_ttl=self.stale_ttl,
            fetcher=self._fetch_all,
            force=force,
            allow_swr=True,
        )

    async def list_auctions(
        self,
        *,
        page: int = 0,
        page_size: int = 50,
        bin_only: bool = False,
        search: str | None = None,
        sort: str = "ending_soon",
        auction_type: str = "all",
        rarity: str | None = None,
        category: str | None = None,
        min_price: float | None = None,
        max_price: float | None = None,
        ending_within: int | None = None,
        force: bool = False,
    ) -> AuctionsResponse:
        if page < 0:
            page = 0
        page_size = max(1, min(page_size, self.max_page_size))
        result = await self.get_snapshot(force=force)
        raw_items = result.value.get("auctions", [])
        items = raw_items

        now_ms = int(time.time() * 1000)
        items = [item for item in items if item.get("end") and item["end"] > now_ms and not item.get("claimed", False)]

        def price(item):
            # Auctions show current bid, never claim it is an instant-buy offer.
            return max(item.get("highest_bid_amount") or 0, item.get("starting_bid") or 0)

        if bin_only or auction_type == "bin":
            items = [item for item in items if item.get("bin")]
        elif auction_type == "auction":
            items = [item for item in items if not item.get("bin")]
        if rarity:
            items = [item for item in items if (item.get("tier") or "").casefold() == rarity.casefold()]
        if category:
            items = [item for item in items if (item.get("category") or "").casefold() == category.casefold()]
        if min_price is not None:
            items = [item for item in items if price(item) >= min_price]
        if max_price is not None:
            items = [item for item in items if price(item) <= max_price]
        if ending_within is not None:
            items = [item for item in items if item["end"] <= now_ms + ending_within * 1000]
        if search and (tokens := query_tokens(search)):

            def matches(item):
                text = item.get("_search_text") or normalize((item.get("item_name") or "") + " " + item["uuid"])
                return all(token in text for token in tokens)

            items = [item for item in items if matches(item)]

        # UUID is the deterministic tie-breaker for stable paging within a generation.
        items.sort(key=lambda item: item["uuid"])
        if sort == "price_asc":
            items.sort(key=price)
        elif sort == "price_desc":
            items.sort(key=price, reverse=True)
        elif sort == "newest":
            items.sort(key=lambda item: item.get("start") or 0, reverse=True)
        else:
            items.sort(key=lambda item: item.get("end") or 2**63)

        total = len(items)
        start = page * page_size
        window = [
            AuctionItem.model_validate({k: v for k, v in item.items() if not k.startswith("_")})
            for item in items[start : start + page_size]
        ]
        total_pages = max(1, (total + page_size - 1) // page_size)
        fetched = datetime.fromtimestamp(result.fetched_at, tz=UTC)
        return AuctionsResponse(
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            total_auctions=int(result.value.get("total_auctions") or total),
            filtered_total=total,
            search_version=1,
            snapshot_complete=result.value.get("complete"),
            snapshot_pages=result.value.get("total_pages", 0),
            expected_auctions=result.value.get("expected_total"),
            identity_indexed=result.value.get("identity_indexed", 0),
            categories=sorted({item["category"] for item in raw_items if item.get("category")}),
            sort=sort,
            lastUpdated=result.value.get("last_updated"),
            auctions=window,
            meta=Meta(
                fetched_at=fetched,
                fetched_at_ms=int(result.fetched_at * 1000),
                cache_age_ms=result.cache_age_ms,
                stale=result.stale,
                source="upstream"
                if result.status in {"miss", "revalidated"}
                else ("cache" if result.source == "redis" else "memory"),
                snapshot_id=result.value.get("snapshot_id"),
                revalidate_error=result.revalidate_error,
            ),
        )

    async def get_auction(self, auction_id: str, *, force: bool = False) -> AuctionResponse:
        result = await self.get_snapshot(force=force)
        for raw in result.value.get("auctions", []):
            if raw.get("uuid") == auction_id:
                fetched = datetime.fromtimestamp(result.fetched_at, tz=UTC)
                return AuctionResponse(
                    auction=AuctionItem.model_validate({k: v for k, v in raw.items() if not k.startswith("_")}),
                    meta=Meta(
                        fetched_at=fetched,
                        fetched_at_ms=int(result.fetched_at * 1000),
                        cache_age_ms=result.cache_age_ms,
                        stale=result.stale,
                        source="cache" if result.source == "redis" else "memory",
                        snapshot_id=result.value.get("snapshot_id"),
                    ),
                )
        raise UpstreamNotFoundError("Auction not found in the current snapshot")

    async def snapshot_info(self) -> dict[str, Any]:
        # /status must stay cheap while the worker publishes a fresh snapshot.
        meta = await self.cache.cache.snapshot_meta()
        if meta and meta.get("snapshot_id"):
            stored_at = float(meta.get("stored_at") or 0)
            ttl = float(meta.get("ttl") or 0)
            return {
                "ready": True,
                "backend": meta.get("backend", "redis"),
                "snapshot_id": meta.get("snapshot_id"),
                "total_auctions": meta.get("total_auctions"),
                "fetched_at": datetime.fromtimestamp(float(meta["fetched_at"]), tz=UTC).isoformat(),
                "stale": time.time() > stored_at + ttl or bool((meta.get("metadata") or {}).get("revalidate_error")),
                "last_error": self._last_error,
            }
        entry, backend = await self.cache.cache.get("auctions:snapshot")
        if not entry:
            return {"ready": False, "backend": backend}
        return {
            "ready": True,
            "backend": backend,
            "snapshot_id": entry.value.get("snapshot_id"),
            "total_auctions": entry.value.get("total_auctions"),
            "fetched_at": datetime.fromtimestamp(entry.fetched_at, tz=UTC).isoformat(),
            "stale": not entry.is_fresh or bool(entry.metadata.get("revalidate_error")),
            "last_error": self._last_error,
        }
