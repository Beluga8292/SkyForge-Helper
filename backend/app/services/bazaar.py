from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from app.cache.service import CacheResult, CacheService
from app.clients.hypixel import HypixelClient
from app.core.errors import UpstreamInvalidResponseError
from app.core.rate_limit import PRIORITY_MEDIUM
from app.repositories.bazaar_history import BazaarHistoryRepository
from app.schemas.api import (
    BazaarProductResponse,
    BazaarResponse,
    BazaarUpstream,
    HistoryPoint,
    HistoryRange,
    HistoryResponse,
    Meta,
)


def meta_from_cache(result: CacheResult, *, snapshot_id: str | None = None) -> Meta:
    fetched = datetime.fromtimestamp(result.fetched_at, tz=UTC)
    source = (
        "upstream" if result.status in {"miss", "revalidated"} else ("cache" if result.source == "redis" else "memory")
    )
    return Meta(
        fetched_at=fetched,
        fetched_at_ms=int(result.fetched_at * 1000),
        cache_age_ms=result.cache_age_ms,
        stale=result.stale,
        source=source,  # type: ignore[arg-type]
        snapshot_id=snapshot_id,
        revalidate_error=result.revalidate_error,
    )


class BazaarService:
    def __init__(
        self,
        *,
        client: HypixelClient,
        cache: CacheService,
        history: BazaarHistoryRepository,
        ttl: int,
        stale_ttl: int,
    ) -> None:
        self.client = client
        self.cache = cache
        self.history = history
        self.ttl = ttl
        self.stale_ttl = stale_ttl

    async def _fetch(self) -> dict[str, Any]:
        payload = await self.client.get("/skyblock/bazaar", priority=PRIORITY_MEDIUM)
        validated = BazaarUpstream.model_validate(payload)
        if not validated.products:
            raise UpstreamInvalidResponseError("Bazaar response contains no products")
        missing_status = [
            product_id for product_id, product in validated.products.items() if product.quick_status is None
        ]
        if len(missing_status) > max(10, len(validated.products) // 100):
            raise UpstreamInvalidResponseError("Bazaar response has products without quick_status")
        return validated.model_dump()

    async def get_bazaar(self, *, force: bool = False) -> BazaarResponse:
        result = await self.cache.get_or_fetch(
            "bazaar",
            ttl=self.ttl,
            stale_ttl=self.stale_ttl,
            fetcher=self._fetch,
            force=force,
        )
        payload = BazaarUpstream.model_validate(result.value)
        return BazaarResponse(
            success=True,
            lastUpdated=payload.lastUpdated,
            products=payload.products,
            meta=meta_from_cache(result),
        )

    async def get_product(self, product_id: str, *, force: bool = False) -> BazaarProductResponse:
        bazaar = await self.get_bazaar(force=force)
        product = bazaar.products.get(product_id)
        if product is None:
            from app.core.errors import UpstreamNotFoundError

            raise UpstreamNotFoundError(f"Unknown Bazaar product: {product_id}")
        return BazaarProductResponse(product=product, meta=bazaar.meta)

    async def get_history(self, product_id: str, range_value: HistoryRange) -> HistoryResponse:
        windows = {
            HistoryRange.HOUR: (timedelta(hours=1), "1m", False),
            HistoryRange.DAY: (timedelta(hours=24), "5m", False),
            HistoryRange.WEEK: (timedelta(days=7), "30m", False),
            HistoryRange.MONTH: (timedelta(days=30), "1h", True),
        }
        window, interval, hourly = windows[range_value]
        since = datetime.now(UTC) - window
        rows = await self.history.history(
            product_id,
            since=since,
            hourly=hourly,
            limit=5000,
        )
        points = [
            HistoryPoint(
                ts=row["ts"],
                buy_price=row["buy_price"],
                sell_price=row["sell_price"],
                buy_volume=row["buy_volume"],
                sell_volume=row["sell_volume"],
            )
            for row in rows
        ]
        note = None
        if not points:
            note = "No server-side history is available for this range yet."
        return HistoryResponse(
            product_id=product_id,
            range=range_value,
            interval=interval,
            points=points,
            meta=Meta(
                fetched_at=datetime.now(UTC),
                fetched_at_ms=int(datetime.now(UTC).timestamp() * 1000),
                cache_age_ms=0,
                stale=False,
                source="database",
            ),
            note=note,
        )
