from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from app.core.errors import UpstreamNotFoundError
from app.schemas.api import HistoryRange
from app.schemas.market import Analytics, AuctionPage, FlipPage, FlipRequest, Valuation
from app.services.bazaar import meta_from_cache
from app.services.market.auctions import identity, value_snapshot
from app.services.market.flip_engine import calculate
from app.services.market.history import analyse
from app.services.market.smart import evidence

if TYPE_CHECKING:
    from app.container import Container


class MarketService:
    def __init__(self, container: Container) -> None:
        self.container = container
        self._auction_lock = asyncio.Lock()
        self._auction_key: str | None = None
        self._auction_rows: list[dict] = []
        self._auction_identities: dict = {}
        # NBT identity is immutable for an auction uuid, but the snapshot is
        # republished every minute. Reuse decodes for listings that persist.
        self._identity_cache: dict[str, tuple | None] = {}
        self._auction_valid_until = 0
        self._auction_task: asyncio.Task | None = None
        self._analysis_limited = False
        self._closed = False
        self._flip_cache: OrderedDict[tuple, list] = OrderedDict()
        self._flip_lock = asyncio.Lock()

    @staticmethod
    def _prepare_identities(auctions: list[dict], cache: dict[str, tuple | None] | None = None) -> tuple[dict, bool]:
        started = time.monotonic()
        previous = cache or {}
        identities = {}
        limited = False
        for i, raw in enumerate(auctions):
            if i >= 50000 or time.monotonic() - started > 15:
                limited = True
                break
            if not raw.get("bin"):
                continue
            uuid = raw.get("uuid")
            if not uuid:
                continue
            if uuid in previous:
                identities[uuid] = previous[uuid]
            else:
                identities[uuid] = identity(raw)
        return identities, limited

    async def _build_auction_values(self, snapshot, now: int) -> list[dict]:
        key = snapshot.value["snapshot_id"]
        auctions = snapshot.value["auctions"]
        identities, self._analysis_limited = await asyncio.to_thread(
            self._prepare_identities, auctions, self._identity_cache
        )
        self._identity_cache = identities
        rows = await asyncio.to_thread(value_snapshot, auctions, now, identities)
        self._auction_identities = identities
        self._auction_rows = rows
        self._auction_key = key
        # Rebuilding ~39k valuations on every request (the soonest `end` is
        # always a second away) kept a core busy continuously. The bucket is
        # shorter than the snapshot refresh interval, so comparables can only
        # lag by a fraction of one publication cycle.
        self._auction_valid_until = now + 20_000
        return rows

    async def _auction_values(self, snapshot, now: int) -> list[dict]:
        key = snapshot.value["snapshot_id"]
        while True:
            async with self._auction_lock:
                if self._closed:
                    raise RuntimeError("Market service is closed")
                if key == self._auction_key and now < self._auction_valid_until:
                    return self._auction_rows
                if self._auction_task is None or self._auction_task.done():
                    self._auction_task = asyncio.create_task(self._build_auction_values(snapshot, now))
                task = self._auction_task
            # Cancelling an HTTP request must not start another concurrent CPU-heavy build.
            await asyncio.shield(task)

    async def close(self) -> None:
        self._closed = True
        if self._auction_task:
            await asyncio.gather(self._auction_task, return_exceptions=True)

    @staticmethod
    def bazaar_meta(response):
        age = max(response.meta.cache_age_ms, int(time.time() * 1000) - response.lastUpdated)
        return response.meta.model_copy(
            update={
                "fetched_at": datetime.fromtimestamp(response.lastUpdated / 1000, UTC),
                "fetched_at_ms": response.lastUpdated,
                "cache_age_ms": age,
                "stale": response.meta.stale or age > 120000,
            }
        )

    async def flips(
        self,
        request: FlipRequest,
        *,
        page: int = 0,
        page_size: int = 50,
        search: str = "",
        sort: str = "score",
        descending: bool = True,
        min_profit: float = 0,
        min_roi: float = 0,
        max_cost: float = 1e15,
        min_liquidity: float = 0,
        max_spread: float = 1e9,
        min_activity: float = 0,
        exclude_loss: bool = True,
        exclude_illiquid: bool = False,
    ) -> FlipPage:
        response = await self.container.bazaar.get_bazaar()
        age = max(response.meta.cache_age_ms, int(time.time() * 1000) - response.lastUpdated)
        # Only use already-cached item resources; no extra upstream call per row or scanner request.
        resource, _ = await self.container.cache.get("resources:items")
        names = (
            {i["id"]: i.get("name", i["id"]) for i in resource.value.get("items", []) if "id" in i} if resource else {}
        )
        history, _ = await self.container.cache.get("market:statistics:v1")
        volatility = history.value.get("volatility", {}) if history and history.is_fresh else {}
        key = (
            response.lastUpdated,
            request.mode,
            request.quantity,
            request.tax_pct,
            age // 30000,
            history.stored_at if history and history.is_fresh else None,
        )
        async with self._flip_lock:
            if key not in self._flip_cache:
                self._flip_cache[key] = await asyncio.to_thread(
                    lambda: [
                        calculate(
                            pid,
                            p.model_dump(),
                            request,
                            age_ms=age,
                            name=names.get(pid),
                            volatility_pct=volatility.get(pid),
                        )
                        for pid, p in response.products.items()
                    ]
                )
                while len(self._flip_cache) > 8:
                    self._flip_cache.popitem(last=False)
            self._flip_cache.move_to_end(key)
            rows = self._flip_cache[key]
        fields = {
            "score": lambda r: r.scores.overall,
            "profit": lambda r: r.net_profit,
            "roi": lambda r: r.roi,
            "cost": lambda r: r.position_cost,
            "liquidity": lambda r: r.scores.liquidity,
        }
        filtered = [
            r
            for r in rows
            if (search.casefold() in (r.product_id + " " + r.name).casefold())
            and (r.net_profit is not None and r.net_profit >= min_profit)
            and (r.roi is not None and r.roi >= min_roi)
            and (r.position_cost is not None and r.position_cost <= max_cost)
            and r.scores.liquidity >= min_liquidity
            and r.spread_pct is not None
            and r.spread_pct <= max_spread
            and (r.weekly_activity or 0) >= min_activity
            and (not exclude_loss or (r.net_profit or 0) > 0)
            and (not exclude_illiquid or "low_liquidity" not in r.risks)
        ]
        filtered.sort(key=lambda r: r.product_id)
        filtered.sort(key=lambda r: fields[sort](r) or 0, reverse=descending)
        return FlipPage(
            items=filtered[page * page_size : (page + 1) * page_size],
            total=len(filtered),
            page=page,
            page_size=page_size,
            snapshot_id=f"bz-{response.lastUpdated}",
            meta=self.bazaar_meta(response),
        )

    async def analytics(self, product_id: str, range_value: HistoryRange, request: FlipRequest) -> Analytics:
        history = await self.container.bazaar.get_history(product_id, range_value)
        response = await self.container.bazaar.get_bazaar()
        product = response.products.get(product_id)
        if product is None:
            raise UpstreamNotFoundError("Bazaar product not found")
        stats = analyse(
            [point.model_dump() for point in history.points],
            max_gap_seconds=7200 if range_value == HistoryRange.MONTH else 1800,
        )
        flip = calculate(
            product_id,
            product.model_dump(),
            request,
            age_ms=max(response.meta.cache_age_ms, int(time.time() * 1000) - response.lastUpdated),
            volatility_pct=stats["volatility_pct"],
        )
        return Analytics(
            product_id=product_id, range=range_value.value, flip=flip, meta=self.bazaar_meta(response), **stats
        )

    async def auctions(
        self,
        *,
        page: int = 0,
        page_size: int = 50,
        search: str = "",
        min_discount: float = 0,
        max_cost: float = 1e15,
        min_confidence: str = "low",
        rarity: str | None = None,
        min_remaining: int = 60,
        new_only: bool = False,
        sort: str = "discount",
        descending: bool = True,
        fee_pct: float | None = None,
        listing_fee: float | None = None,
        min_profit: float | None = None,
        min_roi: float | None = None,
        max_risk: float | None = None,
        max_age_seconds: int | None = None,
    ) -> AuctionPage:
        snapshot = await self.container.auctions.get_snapshot()
        key = snapshot.value["snapshot_id"]
        now = int(time.time() * 1000)
        cached_rows = await self._auction_values(snapshot, now)
        ranks = {"insufficient": 0, "low": 1, "medium": 2, "high": 3}
        rows = []
        age_ms = max(snapshot.age_ms, 0)
        for raw in cached_rows:
            if raw["end"] <= now + min_remaining * 1000 or (new_only and raw["start"] < now - 15 * 60 * 1000):
                continue
            if (
                ranks[raw["confidence"]] < ranks[min_confidence]
                or raw["listing_price"] > max_cost
                or (rarity and raw["rarity"] != rarity)
                or search.casefold()
                not in (raw["name"] + " " + (raw["item_id"] or "") + " " + raw["auction_id"]).casefold()
                or (raw["discount_pct"] is None and min_confidence != "insufficient")
                or (raw["discount_pct"] or 0) < min_discount
            ):
                continue
            item = dict(raw)
            if fee_pct is not None and listing_fee is not None and item["reference_price"] is not None:
                item["net_upside"] = item["reference_price"] * (1 - fee_pct / 100) - item["listing_price"] - listing_fee
            smart = evidence(item, age_ms, snapshot.stale or self._analysis_limited, fee_pct, listing_fee)
            item["confidence"] = smart["confidence"]
            if ranks[item["confidence"]] < ranks[min_confidence]:
                continue
            if (
                (min_profit is not None and (smart["net"] is None or smart["net"] < min_profit))
                or (min_roi is not None and (smart["roi"] is None or smart["roi"] < min_roi))
                or (max_risk is not None and (smart["risk"] is None or smart["risk"] > max_risk))
                or (max_age_seconds is not None and (snapshot.stale or age_ms > max_age_seconds * 1000))
            ):
                continue
            rows.append(item)
        field = {
            "discount": "discount_pct",
            "price": "listing_price",
            "newest": "start",
            "reference": "reference_price",
        }[sort]
        rows.sort(key=lambda r: r["auction_id"])
        rows.sort(key=lambda r: r[field] or 0, reverse=descending)
        return AuctionPage(
            items=[Valuation(**r) for r in rows[page * page_size : (page + 1) * page_size]],
            total=len(rows),
            page=page,
            page_size=page_size,
            snapshot_id=key,
            analysis_limited=self._analysis_limited,
            smart_filters_applied=True,
            meta=meta_from_cache(snapshot, snapshot_id=key),
        )

    async def valuation(self, auction_id: str) -> dict:
        snapshot = await self.container.auctions.get_snapshot()
        now = int(time.time() * 1000)
        cached_rows = await self._auction_values(snapshot, now)
        row = next((r for r in cached_rows if r["auction_id"] == auction_id and r["end"] > now), None)
        if not row:
            raise UpstreamNotFoundError("Active BIN auction not found")
        return {
            "valuation": row,
            "snapshot_id": snapshot.value["snapshot_id"],
            "meta": meta_from_cache(snapshot).model_dump(mode="json"),
        }

    async def overview(self, request: FlipRequest) -> dict:
        result = await self.container.cache_service.get_or_fetch(
            f"market:overview:{request.tax_pct}", ttl=20, stale_ttl=60, fetcher=lambda: self._overview_uncached(request)
        )
        data = dict(result.value)
        if result.stale:
            data["meta"] = {**data["meta"], "stale": True}
        return data

    async def history_statistics(self) -> dict:
        result = await self.container.cache_service.get_or_fetch(
            "market:statistics:v1", ttl=300, stale_ttl=0, fetcher=self._history_statistics_uncached
        )
        return result.value

    async def _history_statistics_uncached(self) -> dict:
        # One bounded DB query for market-wide historical changes; no upstream fan-out.
        from sqlalchemy import select

        from app.models.domain import BazaarPricePoint, BazaarSnapshot

        changes = []
        signals = []
        volatility = {}
        history_available = True
        try:
            async with self.container.database.session() as session:
                snapshots = list(
                    (
                        await session.scalars(
                            select(BazaarSnapshot.snapshot_id)
                            .where(BazaarSnapshot.fetched_at >= datetime.now(UTC) - timedelta(days=1))
                            .order_by(BazaarSnapshot.fetched_at.desc())
                            .limit(25)
                        )
                    ).all()
                )
                if len(snapshots) >= 2:
                    points = (
                        (
                            await session.execute(
                                select(BazaarPricePoint).where(BazaarPricePoint.snapshot_id.in_(snapshots)).limit(60000)
                            )
                        )
                        .scalars()
                        .all()
                    )
                    indexed = {(p.snapshot_id, p.product_id): p for p in points}
                    series: dict[str, list[dict]] = {}
                    for point in points:
                        series.setdefault(point.product_id, []).append(
                            {
                                "ts": point.ts,
                                "buy_price": point.buy_price,
                                "sell_price": point.sell_price,
                                "buy_volume": point.buy_volume,
                                "sell_volume": point.sell_volume,
                            }
                        )
                    for pid, rows in series.items():
                        stats = analyse(rows)
                        volatility[pid] = stats["volatility_pct"]
                        for signal in stats["signals"]:
                            signals.append({"product_id": pid, **signal.model_dump(mode="json")})

                    for (sid, pid), point in indexed.items():
                        old = indexed.get((snapshots[1], pid))
                        if sid == snapshots[0] and old and old.buy_price > 0:
                            changes.append(
                                {
                                    "product_id": pid,
                                    "change_pct": (point.buy_price / old.buy_price - 1) * 100,
                                    "ts": point.ts.replace(tzinfo=UTC).isoformat(),
                                }
                            )
        except Exception:
            history_available = False
        changes.sort(key=lambda p: abs(p["change_pct"]), reverse=True)
        return {
            "largest_changes": changes[:10],
            "signals": signals[:10],
            "volatility": volatility,
            "history_available": history_available,
        }

    async def _overview_uncached(self, request: FlipRequest) -> dict:
        stats = await self.history_statistics()
        flips = await self.flips(request, page_size=5)
        return {
            "bazaar": flips.model_dump(mode="json"),
            "largest_changes": stats["largest_changes"],
            "signals": stats["signals"],
            "history_available": stats["history_available"],
            "meta": flips.meta.model_dump(mode="json"),
        }
