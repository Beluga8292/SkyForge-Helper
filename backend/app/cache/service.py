from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any
from weakref import WeakValueDictionary

from app.cache.base import CacheEntry
from app.cache.memory import InMemoryCache
from app.cache.redis import RedisCache
from app.core.errors import UpstreamUnavailableError

logger = logging.getLogger(__name__)

# A complete public AH snapshot contains tens of thousands of NBT payloads.
# Keep its one well-known cache entry bounded separately from ordinary responses.
AUCTION_SNAPSHOT_MAX_BYTES = 256 * 1024 * 1024
AUCTION_SNAPSHOT_KEY = "auctions:snapshot"
# Reading the serialized snapshot from Redis is a multi-megabyte transfer and
# must not share the sub-second budget used for small cached responses.
AUCTION_SNAPSHOT_TIMEOUT = 30.0


def serialized_size(value: Any) -> int:
    return sum(
        len(part.encode("utf-8"))
        for part in json.JSONEncoder(ensure_ascii=False, separators=(",", ":")).iterencode(value)
    )


class ResilientCache:
    """Redis-first cache with a process-local fallback.

    Redis outages must not take the public API down. Writes and reads fall back
    to memory, and /status reports the degraded mode so operators are not misled.
    """

    # The API re-reads and parses ~100 MB per snapshot generation. Starting that
    # work shortly before the local copy expires keeps it off the request path.
    SNAPSHOT_PRELOAD_SECONDS = 20.0

    def __init__(
        self,
        redis: RedisCache | None,
        memory: InMemoryCache | None = None,
        *,
        preload_snapshot: bool = True,
    ) -> None:
        self.redis = redis
        self.memory = memory or InMemoryCache()
        self.redis_available = redis is not None
        self.last_error: str | None = None
        self._snapshot_lock = asyncio.Lock()
        self.preload_snapshot = preload_snapshot
        self._snapshot_task: asyncio.Task[None] | None = None

    async def _try_redis(
        self, operation: Callable[[], Awaitable[Any]], *, budget_seconds: float = 0.75
    ) -> tuple[bool, Any]:
        if not self.redis:
            return False, None
        try:
            value = await asyncio.wait_for(operation(), timeout=budget_seconds)
            if not self.redis_available:
                logger.info("Redis cache recovered")
            self.redis_available = True
            self.last_error = None
            return True, value
        except Exception as exc:
            if self.redis_available:
                logger.warning("Redis unavailable, using memory fallback error=%s", type(exc).__name__)
            self.redis_available = False
            self.last_error = type(exc).__name__
            return False, None

    async def get(self, key: str) -> tuple[CacheEntry | None, str]:
        if key == AUCTION_SNAPSHOT_KEY:
            async with self._snapshot_lock:
                return await self._get_snapshot_entry(key)
        ok, entry = await self._try_redis(lambda: self.redis.get(key))  # type: ignore[union-attr]
        if ok and entry is not None:
            return entry, "redis"
        fallback = await self.memory.get(key)
        return fallback, "memory" if fallback else "miss"

    async def _get_snapshot_entry(self, key: str) -> tuple[CacheEntry | None, str]:
        # Keep one process-local copy so normal page requests do not parse a
        # ~100 MB JSON document on every hit. Redis is consulted as soon as
        # the local copy stops being fresh, which picks up worker updates.
        local = await self.memory.get(key)
        if local and local.is_fresh:
            if self.preload_snapshot and local.stored_at + local.ttl - time.time() <= self.SNAPSHOT_PRELOAD_SECONDS:
                self._schedule_snapshot_preload(key, local)
            return local, "memory"
        ok, entry = await self._try_redis(
            lambda: self.redis.get(key),  # type: ignore[union-attr]
            budget_seconds=AUCTION_SNAPSHOT_TIMEOUT,
        )
        if ok and entry is not None:
            await self.memory.set(key, entry)
            return entry, "redis"
        return local, "memory" if local else "miss"

    def _schedule_snapshot_preload(self, key: str, entry: CacheEntry) -> None:
        if self.redis is None:
            return
        task = self._snapshot_task
        if task is not None and not task.done():
            return
        self._snapshot_task = asyncio.create_task(self._preload_snapshot(key, entry))

    async def _preload_snapshot(self, key: str, entry: CacheEntry) -> None:
        """Poll the small pointer and load the next generation in the background."""
        if self.redis is None:
            return
        current = (entry.metadata or {}).get("gen")
        deadline = entry.stored_at + entry.ttl
        while time.time() < deadline:
            try:
                meta = await asyncio.wait_for(self.redis.get_snapshot_meta(key), timeout=1.0)
            except Exception as exc:
                logger.debug("Snapshot preload pointer unavailable error=%s", type(exc).__name__)
                meta = None
            if meta and meta.get("gen") and meta.get("gen") != current:
                try:
                    fresh = await asyncio.wait_for(self.redis.get(key), timeout=AUCTION_SNAPSHOT_TIMEOUT)
                except Exception as exc:
                    logger.debug("Snapshot preload failed error=%s", type(exc).__name__)
                    return
                if fresh is not None:
                    await self.memory.set(key, fresh)
                return
            if deadline - time.time() < 2.0:
                return
            await asyncio.sleep(2.0)

    async def snapshot_meta(self, key: str = AUCTION_SNAPSHOT_KEY) -> dict | None:
        """Cheap metadata lookup for /status and cache-age reporting."""
        if self.redis:
            try:
                meta = await asyncio.wait_for(self.redis.get_snapshot_meta(key), timeout=0.75)
                if meta:
                    return meta
            except Exception as exc:
                logger.debug("Snapshot metadata unavailable error=%s", type(exc).__name__)
        local = await self.memory.get(key)
        if local is None:
            return None
        return {
            "snapshot_id": local.value.get("snapshot_id"),
            "total_auctions": local.value.get("total_auctions"),
            "last_updated": local.value.get("last_updated"),
            "total_pages": local.value.get("total_pages"),
            "fetched_at": local.fetched_at,
            "stored_at": local.stored_at,
            "ttl": local.ttl,
            "stale_ttl": local.stale_ttl,
            "metadata": local.metadata,
            "backend": "memory",
        }

    async def set(self, key: str, entry: CacheEntry) -> str:
        # The snapshot payload is bounded by the fetch pipeline and serialized
        # once by RedisCache. Re-measuring ~100 MB here cost ~2 s per refresh.
        if key == AUCTION_SNAPSHOT_KEY:
            await self.memory.set(key, entry)
        else:
            size = await asyncio.to_thread(serialized_size, entry.value)
            if size <= 64 * 1024 * 1024:
                await self.memory.set(key, entry)
        ok, _ = await self._try_redis(
            lambda: self.redis.set(key, entry),  # type: ignore[union-attr]
            budget_seconds=AUCTION_SNAPSHOT_TIMEOUT if key == AUCTION_SNAPSHOT_KEY else 1.5,
        )
        return "redis" if ok else "memory"

    async def delete(self, key: str) -> None:
        await self.memory.delete(key)
        await self._try_redis(
            lambda: self.redis.delete(key),  # type: ignore[union-attr]
            budget_seconds=AUCTION_SNAPSHOT_TIMEOUT if key == AUCTION_SNAPSHOT_KEY else 0.75,
        )

    async def ping(self) -> bool:
        if not self.redis:
            return False

        async def probe() -> bool:
            if not await self.redis.ping():
                raise ConnectionError("Redis ping failed")
            return True

        ok, value = await self._try_redis(probe)
        return ok and bool(value)

    async def close(self) -> None:
        if self._snapshot_task is not None and not self._snapshot_task.done():
            self._snapshot_task.cancel()
            await asyncio.gather(self._snapshot_task, return_exceptions=True)
        await self.memory.close()
        if self.redis:
            await self.redis.close()

    def info(self) -> dict[str, Any]:
        return {
            "backend": "redis" if self.redis_available else "memory-fallback",
            "redis_available": self.redis_available,
            "last_error": self.last_error,
            "memory_entries": self.memory.size,
        }


@dataclass(slots=True)
class CacheResult:
    value: dict[str, Any]
    status: str  # hit | miss | stale | revalidated
    fetched_at: float
    stored_at: float
    cache_age_ms: int
    stale: bool
    source: str
    revalidate_error: str | None = None

    @property
    def age_ms(self) -> int:
        return max(0, int((time.time() - self.fetched_at) * 1000))


class CacheService:
    def __init__(
        self,
        cache: ResilientCache,
        *,
        max_payload_bytes: int = 64 * 1024 * 1024,
        swr_enabled: bool = True,
    ) -> None:
        self.cache = cache
        self.max_payload_bytes = max_payload_bytes
        self.swr_enabled = swr_enabled
        self._locks: WeakValueDictionary[str, asyncio.Lock] = WeakValueDictionary()
        self._closed = False
        self.max_background_tasks = 128
        self._locks_guard = asyncio.Lock()
        self._pending: set[str] = set()
        self._tasks: set[asyncio.Task[Any]] = set()

    async def _lock(self, key: str) -> asyncio.Lock:
        async with self._locks_guard:
            lock = self._locks.get(key)
            if lock is None:
                lock = asyncio.Lock()
                self._locks[key] = lock
            return lock

    async def get_or_fetch(
        self,
        key: str,
        *,
        ttl: float,
        stale_ttl: float,
        fetcher: Callable[[], Awaitable[dict[str, Any]]],
        force: bool = False,
        allow_swr: bool | None = None,
    ) -> CacheResult:
        if self._closed:
            raise RuntimeError("Cache service is closed")
        entry, backend = await self.cache.get(key)
        if entry and entry.is_fresh and not force:
            return self._result(entry, "hit", backend)

        use_swr = self.swr_enabled if allow_swr is None else allow_swr
        if entry and entry.is_usable and use_swr and not force:
            self._schedule_revalidate(key, ttl, stale_ttl, fetcher)
            return self._result(entry, "stale", backend)

        lock = await self._lock(key)
        async with lock:
            # Double-check after waiting on the in-process lock.
            entry, backend = await self.cache.get(key)
            if entry and entry.is_fresh and not force:
                return self._result(entry, "hit", backend)

            distributed_token = uuid.uuid4().hex
            distributed = False
            if self.cache.redis and self.cache.redis_available:
                distributed = await self.cache.redis.try_lock(f"cache:{key}", distributed_token, 300)
                if not distributed:
                    # Another process is fetching. Wait briefly for it to publish.
                    for _ in range(20):
                        await asyncio.sleep(0.1)
                        waited, waited_backend = await self.cache.get(key)
                        if waited and waited.is_fresh:
                            return self._result(waited, "hit", waited_backend)
                    if entry and entry.is_usable:
                        return self._result(entry, "stale", backend)
                    raise UpstreamUnavailableError("Cache refresh is already in progress")

            try:
                value = await fetcher()
                if key != AUCTION_SNAPSHOT_KEY:
                    encoded_size = await asyncio.to_thread(serialized_size, value)
                    if encoded_size > self.max_payload_bytes:
                        raise ValueError(f"cache payload exceeds limit: {encoded_size} bytes")
                now = time.time()
                new_entry = CacheEntry(
                    value=value,
                    fetched_at=now,
                    stored_at=now,
                    ttl=ttl,
                    stale_ttl=stale_ttl,
                )
                if distributed and self.cache.redis:
                    if not await self.cache.redis.owns_lock(f"cache:{key}", distributed_token):
                        raise UpstreamUnavailableError("Cache refresh lease expired")
                backend_used = await self.cache.set(key, new_entry)
                return self._result(new_entry, "miss", backend_used)
            except Exception:
                if entry and entry.is_usable:
                    logger.warning("Upstream failed; serving stale cache key=%s", key)
                    entry.metadata["revalidate_error"] = "upstream_error"
                    await self.cache.set(key, entry)
                    result = self._result(entry, "stale", backend)
                    result.stale = True
                    result.revalidate_error = "upstream_error"
                    return result
                raise
            finally:
                if distributed and self.cache.redis:
                    await self.cache.redis.release_lock(f"cache:{key}", distributed_token)

    def _result(self, entry: CacheEntry, status: str, backend: str) -> CacheResult:
        return CacheResult(
            value=entry.value,
            status=status,
            fetched_at=entry.fetched_at,
            stored_at=entry.stored_at,
            cache_age_ms=max(0, int((time.time() - entry.fetched_at) * 1000)),
            stale=not entry.is_fresh or bool(entry.metadata.get("revalidate_error")),
            source=backend,
            revalidate_error=entry.metadata.get("revalidate_error"),
        )

    def _schedule_revalidate(
        self,
        key: str,
        ttl: float,
        stale_ttl: float,
        fetcher: Callable[[], Awaitable[dict[str, Any]]],
    ) -> None:
        if self._closed or key in self._pending or len(self._tasks) >= self.max_background_tasks:
            return
        self._pending.add(key)
        task = asyncio.create_task(self._revalidate(key, ttl, stale_ttl, fetcher))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _revalidate(
        self,
        key: str,
        ttl: float,
        stale_ttl: float,
        fetcher: Callable[[], Awaitable[dict[str, Any]]],
    ) -> None:
        try:
            await self.get_or_fetch(
                key,
                ttl=ttl,
                stale_ttl=stale_ttl,
                fetcher=fetcher,
                force=True,
                allow_swr=False,
            )
        except Exception as exc:
            logger.warning("Stale-while-revalidate failed key=%s error=%s", key, type(exc).__name__)
        finally:
            self._pending.discard(key)

    async def invalidate(self, key: str) -> None:
        await self.cache.delete(key)

    async def close(self) -> None:
        self._closed = True
        for task in list(self._tasks):
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        await self.cache.close()
