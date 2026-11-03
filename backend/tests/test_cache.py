from __future__ import annotations

import time

import pytest

from app.cache.base import CacheEntry
from app.cache.memory import InMemoryCache
from app.cache.redis import RedisCache
from app.cache.service import CacheService, ResilientCache


def entry(value: dict, *, age: float, ttl: float = 10, stale_ttl: float = 60) -> CacheEntry:
    now = time.time()
    return CacheEntry(
        value=value,
        fetched_at=now - age,
        stored_at=now - age,
        ttl=ttl,
        stale_ttl=stale_ttl,
    )


async def test_cache_hit_does_not_call_fetcher() -> None:
    memory = InMemoryCache()
    service = CacheService(ResilientCache(None, memory))
    calls = 0

    async def fetcher() -> dict:
        nonlocal calls
        calls += 1
        return {"value": calls}

    first = await service.get_or_fetch("key", ttl=60, stale_ttl=60, fetcher=fetcher)
    second = await service.get_or_fetch("key", ttl=60, stale_ttl=60, fetcher=fetcher)
    assert first.status == "miss"
    assert second.status == "hit"
    assert second.value == {"value": 1}
    assert calls == 1


async def test_cache_miss_calls_fetcher_and_stores_value() -> None:
    memory = InMemoryCache()
    service = CacheService(ResilientCache(None, memory))

    async def fetcher() -> dict:
        return {"hello": "world"}

    result = await service.get_or_fetch("miss-key", ttl=60, stale_ttl=60, fetcher=fetcher)
    assert result.status == "miss"
    assert result.value == {"hello": "world"}
    stored = await memory.get("miss-key")
    assert stored is not None
    assert stored.value == {"hello": "world"}


async def test_expired_cache_beyond_stale_window_is_refetched() -> None:
    memory = InMemoryCache()
    await memory.set("old", entry({"old": True}, age=500, ttl=10, stale_ttl=30))
    service = CacheService(ResilientCache(None, memory))

    async def fetcher() -> dict:
        return {"fresh": True}

    result = await service.get_or_fetch("old", ttl=10, stale_ttl=30, fetcher=fetcher)
    assert result.status == "miss"
    assert result.value == {"fresh": True}


async def test_stale_fallback_on_upstream_error() -> None:
    memory = InMemoryCache()
    await memory.set("stale", entry({"cached": True}, age=20, ttl=10, stale_ttl=60))
    service = CacheService(ResilientCache(None, memory), swr_enabled=False)

    async def failing() -> dict:
        raise RuntimeError("upstream down")

    result = await service.get_or_fetch("stale", ttl=10, stale_ttl=60, fetcher=failing)
    assert result.status == "stale"
    assert result.stale is True
    assert result.value == {"cached": True}
    assert result.revalidate_error == "upstream_error"


async def test_redis_unavailable_falls_back_to_memory() -> None:
    redis = RedisCache("redis://127.0.0.1:1/0", socket_timeout=0.1)
    resilient = ResilientCache(redis, InMemoryCache())
    service = CacheService(resilient)

    async def fetcher() -> dict:
        return {"fallback": True}

    result = await service.get_or_fetch("redis-down", ttl=60, stale_ttl=60, fetcher=fetcher)
    assert result.value == {"fallback": True}
    assert result.source == "memory"
    assert resilient.info()["backend"] == "memory-fallback"
    assert await service.cache.get("redis-down") is not None
    await redis.close()


async def test_stale_while_revalidate_serves_stale_then_refreshes() -> None:
    memory = InMemoryCache()
    await memory.set("swr", entry({"version": 1}, age=20, ttl=10, stale_ttl=60))
    service = CacheService(ResilientCache(None, memory), swr_enabled=True)

    async def fetcher() -> dict:
        return {"version": 2}

    result = await service.get_or_fetch("swr", ttl=10, stale_ttl=60, fetcher=fetcher)
    assert result.status == "stale"
    assert result.value == {"version": 1}
    # Allow the background revalidation task to finish.
    for _ in range(50):
        cached = await memory.get("swr")
        if cached and cached.value == {"version": 2}:
            break
        import asyncio

        await asyncio.sleep(0.01)
    cached = await memory.get("swr")
    assert cached is not None
    assert cached.value == {"version": 2}
    await service.close()


@pytest.mark.parametrize("ttl,stale", [(10, 20)])
async def test_cache_entry_expiry_properties(ttl: int, stale: int) -> None:
    fresh = entry({"a": 1}, age=1, ttl=ttl, stale_ttl=stale)
    stale_entry = entry({"a": 1}, age=ttl + 5, ttl=ttl, stale_ttl=stale)
    dead = entry({"a": 1}, age=ttl + stale + 5, ttl=ttl, stale_ttl=stale)
    assert fresh.is_fresh and fresh.is_usable
    assert not stale_entry.is_fresh and stale_entry.is_usable
    assert not dead.is_usable


async def test_large_auction_snapshot_survives_memory_fallback_without_refetch() -> None:
    # Live 43k-lot snapshots exceed the ordinary 64 MiB response budget.
    memory = InMemoryCache()
    service = CacheService(ResilientCache(None, memory))
    payload = {"auctions": [{"item_bytes": "x" * (65 * 1024 * 1024)}]}
    calls = 0

    async def fetcher() -> dict:
        nonlocal calls
        calls += 1
        return payload

    first = await service.get_or_fetch("auctions:snapshot", ttl=60, stale_ttl=60, fetcher=fetcher)
    second = await service.get_or_fetch("auctions:snapshot", ttl=60, stale_ttl=60, fetcher=fetcher)
    assert first.status == "miss" and second.status == "hit"
    assert second.value is payload and calls == 1
    with pytest.raises(ValueError, match="exceeds limit"):
        await service.get_or_fetch("ordinary", ttl=60, stale_ttl=60, fetcher=fetcher)
    await service.close()


async def test_redis_large_snapshot_is_chunked_and_ordinary_limit_is_kept(monkeypatch) -> None:
    from unittest.mock import AsyncMock

    redis = RedisCache("redis://127.0.0.1:1", max_payload_bytes=1024)
    fake = AsyncMock()
    fake.get.return_value = None

    async def no_keys(**_kwargs):
        return
        yield  # pragma: no cover

    fake.scan_iter = no_keys
    monkeypatch.setattr(redis, "_client", fake)
    value = entry({"fixture": "x" * 2048}, age=0)
    await redis.set("auctions:snapshot", value)
    # One chunk plus the small pointer; a single 100 MB SET blocked Redis.
    assert fake.set.await_count == 2
    assert "chunk" in fake.set.await_args_list[0].args[0]
    with pytest.raises(ValueError, match="payload exceeds"):
        await redis.set("ordinary", value)
    assert fake.set.await_count == 2
    await redis.close()


async def test_snapshot_meta_reads_pointer_without_payload(monkeypatch) -> None:
    import json
    from unittest.mock import AsyncMock

    redis = RedisCache("redis://127.0.0.1:1")
    fake = AsyncMock()
    fake.get.return_value = json.dumps(
        {
            "v": 2,
            "gen": "abc",
            "chunks": 4,
            "fetched_at": 10.0,
            "stored_at": 10.0,
            "ttl": 120,
            "stale_ttl": 3600,
            "meta": {"snapshot_id": "s-1", "total_auctions": 42000},
        }
    )
    monkeypatch.setattr(redis, "_client", fake)
    meta = await redis.get_snapshot_meta()
    assert meta is not None
    assert meta["snapshot_id"] == "s-1"
    assert meta["chunks"] == 4
    assert fake.get.await_count == 1
    await redis.close()


async def test_failed_redis_ping_does_not_report_recovery():
    from unittest.mock import AsyncMock

    redis = AsyncMock()
    redis.ping.side_effect = [False, True]
    cache = ResilientCache(redis)
    assert await cache.ping() is False
    assert cache.redis_available is False
    assert cache.info()["backend"] == "memory-fallback"
    assert await cache.ping() is True
    assert cache.redis_available is True
    assert cache.last_error is None


def test_snapshot_roundtrip_and_legacy_compatibility(monkeypatch):
    import base64
    import json
    import zlib

    from app.cache import redis as module

    value = {"value": {"auctions": [{"uuid": "one", "item_name": "Кирка", "item_bytes": "abc" * 1000}]}}
    encoded = module.encode_snapshot(value)
    assert module.decode_payload(encoded) == value
    assert module.decode_payload(json.dumps(value)) == value

    # Entries written before the chunked/plain-JSON format must stay readable.
    legacy = b"z1:" + base64.b64encode(zlib.compress(encoded.encode(), level=1))
    assert module.decode_payload(legacy.decode()) == value

    monkeypatch.setattr(module, "SNAPSHOT_LIMIT", 50)
    with pytest.raises(ValueError):
        module.decode_payload(encoded)
    with pytest.raises(ValueError):
        module.encode_snapshot(value)


async def test_snapshot_preload_loads_new_generation_outside_request_path() -> None:
    from unittest.mock import AsyncMock

    memory = InMemoryCache()
    cache = ResilientCache(None, memory)
    redis = AsyncMock()
    redis.get_snapshot_meta = AsyncMock(return_value={"gen": "new"})
    refreshed = entry({"value": 2}, age=0)
    redis.get = AsyncMock(return_value=refreshed)
    cache.redis = redis
    stale = entry({"value": 1}, age=0, ttl=45, stale_ttl=60)
    stale.metadata = {"gen": "old"}
    await cache._preload_snapshot("auctions:snapshot", stale)
    loaded = await memory.get("auctions:snapshot")
    assert loaded is not None and loaded.value == {"value": 2}
    await cache.close()
