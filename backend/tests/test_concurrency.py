from __future__ import annotations

import asyncio

from app.cache.memory import InMemoryCache
from app.cache.service import CacheService, ResilientCache


async def test_concurrent_identical_requests_use_single_flight() -> None:
    service = CacheService(ResilientCache(None, InMemoryCache()))
    calls = 0

    async def fetcher() -> dict:
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.05)
        return {"payload": "shared"}

    results = await asyncio.gather(
        *(service.get_or_fetch("same-key", ttl=60, stale_ttl=60, fetcher=fetcher) for _ in range(20))
    )
    assert calls == 1
    assert all(result.value == {"payload": "shared"} for result in results)
    assert [result.status for result in results].count("miss") == 1
    assert [result.status for result in results].count("hit") == 19
    await service.close()


async def test_concurrent_different_keys_are_not_serialized() -> None:
    service = CacheService(ResilientCache(None, InMemoryCache()))
    started: list[str] = []

    async def fetcher(name: str) -> dict:
        started.append(name)
        await asyncio.sleep(0.02)
        return {"name": name}

    await asyncio.gather(
        *(
            service.get_or_fetch(f"key-{index}", ttl=60, stale_ttl=60, fetcher=lambda i=index: fetcher(str(i)))
            for index in range(5)
        )
    )
    assert sorted(started) == ["0", "1", "2", "3", "4"]
    await service.close()
