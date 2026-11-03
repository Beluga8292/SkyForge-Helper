"""Opt-in destructive checks ONLY for the isolated *_sbc_qa database, unique Redis prefix."""

import asyncio
import json
import os
import time
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

from app.cache.base import CacheEntry
from app.cache.redis import RedisCache
from app.cache.service import CacheService, ResilientCache
from app.models.database import Database
from app.repositories.bazaar_history import BazaarHistoryRepository
from sqlalchemy import inspect, text


async def main():
    url = os.environ.get("DATABASE_URL", "")
    if os.environ.get("SBC_QA_INFRA") != "1" or not urlparse(url).path.endswith(
        "_sbc_qa"
    ):
        print(
            json.dumps(
                {
                    "status": "NOT TESTED",
                    "reason": "requires explicit isolated *_sbc_qa database and SBC_QA_INFRA=1",
                }
            )
        )
        return
    checks = []
    database = Database(url)
    redis = RedisCache(
        os.environ["REDIS_URL"], prefix="sbc:qa:" + uuid.uuid4().hex, socket_timeout=2
    )
    try:
        async with database.engine.begin() as connection:
            assert await connection.scalar(text("SELECT 1")) == 1
            names = await connection.run_sync(lambda c: inspect(c).get_table_names())
            assert "bazaar_snapshots" in names
            indexes = await connection.run_sync(
                lambda c: inspect(c).get_indexes("bazaar_price_points")
            )
            assert indexes
        history = BazaarHistoryRepository(database)
        now = datetime.now(UTC)
        snapshot_id = "qa-" + uuid.uuid4().hex
        products = {
            "QA_ITEM": {
                "quick_status": {
                    "buyPrice": 120,
                    "sellPrice": 100,
                    "buyVolume": 20,
                    "sellVolume": 30,
                }
            }
        }
        assert await history.record_snapshot(
            snapshot_id=snapshot_id, fetched_at=now, products=products
        )
        assert not await history.record_snapshot(
            snapshot_id=snapshot_id, fetched_at=now, products=products
        )
        assert (
            len(await history.history("QA_ITEM", since=now - timedelta(seconds=1))) == 1
        )
        await history.aggregate_hourly(since=now - timedelta(hours=1))
        checks += [
            "postgres_connection",
            "schema_indexes",
            "transactions_unique_constraint",
            "history_persistence",
            "hourly_aggregation",
        ]
        assert await redis.ping()
        entry = CacheEntry(
            value={"fixture": True},
            fetched_at=time.time(),
            stored_at=time.time(),
            ttl=1,
            stale_ttl=0,
        )
        await redis.set("roundtrip", entry)
        assert (await redis.get("roundtrip")).value == entry.value
        assert await redis.try_lock("lease", "a", 1)
        assert not await redis.try_lock("lease", "b", 1)
        await redis.release_lock("lease", "wrong")
        assert await redis.owns_lock("lease", "a")
        await asyncio.sleep(1.1)
        assert await redis.get("roundtrip") is None
        assert await redis.try_lock("lease", "b", 1)
        allowed, *_ = await redis.try_take_token("budget", 1, 60)
        assert allowed
        allowed, *_ = await redis.try_take_token("budget", 1, 60)
        assert not allowed
        await redis.set_cooldown("cooldown", 1)
        allowed, wait, _ = await redis.try_take_token("cooldown", 5, 60)
        assert not allowed and wait > 0
        cache = CacheService(ResilientCache(redis))
        calls = 0

        async def fetch():
            nonlocal calls
            calls += 1
            await asyncio.sleep(0.05)
            return {"fixture": True}

        await asyncio.gather(
            *(
                cache.get_or_fetch("flight", ttl=60, stale_ttl=60, fetcher=fetch)
                for _ in range(10)
            )
        )
        assert calls == 1
        checks += [
            "redis_connection",
            "cache_roundtrip_ttl",
            "locks_lease_expiry",
            "shared_budget",
            "cooldown",
            "single_flight",
        ]
        print(
            json.dumps(
                {
                    "status": "PASS",
                    "checks": checks,
                    "restart_and_fault_injection": "requires separate compose stop/start procedures",
                }
            )
        )
    finally:
        await database.close()
        await redis.close()


asyncio.run(main())
