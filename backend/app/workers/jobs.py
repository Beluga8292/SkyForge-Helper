from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import signal
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.container import Container
from app.repositories.bazaar_history import retention_cutoffs

logger = logging.getLogger(__name__)


@contextlib.asynccontextmanager
async def distributed_lock(container: Container, name: str, ttl: int = 300) -> AsyncIterator[bool]:
    token = uuid.uuid4().hex
    acquired = container.redis is None
    if container.redis:
        acquired = await container.redis.try_lock(f"job:{name}", token, ttl)
    try:
        yield acquired
    finally:
        if acquired and container.redis:
            await container.redis.release_lock(f"job:{name}", token)


class JobRunner:
    def __init__(self, container: Container) -> None:
        self.container = container
        self._stop = asyncio.Event()
        self._tasks: list[asyncio.Task[None]] = []
        self._last_run: dict[str, float] = {}

    async def run(self) -> None:
        settings = self.container.settings
        logger.info("Worker started")
        self._tasks = [
            asyncio.create_task(
                self._periodic("market_statistics", 300, self._refresh_market_statistics, initial_delay=10),
                name="market-statistics",
            ),
            asyncio.create_task(
                self._periodic("bazaar_refresh", 20, self._refresh_bazaar, initial_delay=0),
                name="bazaar-refresh",
            ),
            asyncio.create_task(
                self._periodic(
                    "bazaar_history", settings.history_interval_seconds, self._persist_history, initial_delay=5
                ),
                name="bazaar-history",
            ),
            asyncio.create_task(
                self._periodic(
                    "auction_refresh", settings.auction_refresh_seconds, self._refresh_auctions, initial_delay=2
                ),
                name="auction-refresh",
            ),
            asyncio.create_task(
                self._periodic(
                    "history_aggregate", settings.aggregate_interval_seconds, self._aggregate, initial_delay=60
                ),
                name="history-aggregate",
            ),
            asyncio.create_task(
                self._periodic(
                    "retention_cleanup", settings.cleanup_interval_seconds, self._cleanup, initial_delay=120
                ),
                name="retention-cleanup",
            ),
        ]
        try:
            while not self._stop.is_set():
                await asyncio.to_thread(Path(os.getenv("WORKER_HEARTBEAT_PATH", ".worker-heartbeat")).touch)
                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=15)
                except TimeoutError:
                    pass
        finally:
            for task in self._tasks:
                task.cancel()
            await asyncio.gather(*self._tasks, return_exceptions=True)
        logger.info("Worker stopped")

    def stop(self) -> None:
        self._stop.set()

    async def _periodic(
        self,
        name: str,
        interval: int,
        func: Callable[[], Awaitable[None]],
        *,
        initial_delay: float = 0,
    ) -> None:
        if initial_delay:
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=initial_delay)
                return
            except TimeoutError:
                pass
        while not self._stop.is_set():
            started = time.monotonic()
            try:
                async with distributed_lock(self.container, name) as acquired:
                    if acquired:
                        try:
                            async with asyncio.timeout(240):
                                await func()
                            self._last_run[name] = time.time()
                        except asyncio.CancelledError:
                            raise
                        except Exception as exc:
                            self.container.metrics.incr(f"job_{name}_errors")
                            logger.warning("Job failed name=%s error=%s", name, type(exc).__name__)
                    else:
                        logger.info("Job skipped (lock held) name=%s", name)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.container.metrics.incr(f"job_{name}_errors")
                logger.warning("Job lock failed name=%s error=%s", name, type(exc).__name__)
            elapsed = time.monotonic() - started
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=max(1.0, interval - elapsed))
            except TimeoutError:
                continue

    async def _refresh_market_statistics(self) -> None:
        await self.container.market.history_statistics()

    async def _refresh_bazaar(self) -> None:
        response = await self.container.bazaar.get_bazaar(force=True)
        self.container.metrics.incr("job_bazaar_refresh_ok")
        logger.info("Bazaar cache refreshed products=%s", len(response.products))

    async def _refresh_auctions(self) -> None:
        result = await self.container.auctions.get_snapshot(force=True)
        self.container.metrics.incr("job_auction_refresh_ok")
        logger.info(
            "Auction snapshot refreshed id=%s auctions=%s",
            result.value.get("snapshot_id"),
            result.value.get("total_auctions"),
        )

    async def _persist_history(self) -> None:
        started = datetime.now(UTC)
        response = await self.container.bazaar.get_bazaar(force=False)
        snapshot_id = f"bz-{response.lastUpdated}"
        products = {product_id: product.model_dump() for product_id, product in response.products.items()}
        try:
            stored = await self.container.history.record_snapshot(
                snapshot_id=snapshot_id,
                fetched_at=datetime.now(UTC),
                products=products,
                upstream_last_updated=response.lastUpdated,
            )
            await self.container.history.record_job(
                "bazaar_history",
                status="success",
                started_at=started,
                finished_at=datetime.now(UTC),
                items=len(products) if stored else 0,
            )
            if stored:
                self.container.metrics.incr("history_snapshots_stored")
            else:
                self.container.metrics.incr("history_snapshots_duplicate")
        except Exception as exc:
            await self.container.history.record_job(
                "bazaar_history",
                status="failed",
                started_at=started,
                finished_at=datetime.now(UTC),
                error=type(exc).__name__,
            )
            raise

    async def _aggregate(self) -> None:
        result = await self.container.history.aggregate_hourly(since=datetime.now(UTC) - timedelta(hours=3))
        self.container.metrics.incr("history_hourly_rows", result)
        logger.info("Hourly aggregation complete rows=%s", result)

    async def _cleanup(self) -> None:
        raw_before, hourly_before = retention_cutoffs(
            self.container.settings.history_raw_retention_hours,
            self.container.settings.history_hourly_retention_days,
        )
        removed = await self.container.history.cleanup(raw_before=raw_before, hourly_before=hourly_before)
        self.container.metrics.incr("history_cleanup_points", removed.get("points", 0))
        logger.info("Retention cleanup removed=%s", removed)


async def run_worker() -> None:
    from app.core.config import get_settings
    from app.core.logging import configure_logging

    settings = get_settings()
    configure_logging(settings.log_level)
    container = await Container.create(settings)
    runner = JobRunner(container)
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        with contextlib.suppress(NotImplementedError):
            loop.add_signal_handler(sig, runner.stop)
    try:
        await runner.run()
    finally:
        await container.close()
