from __future__ import annotations

import asyncio
import itertools
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

from app.cache.redis import RedisCache
from app.core.errors import QueueOverflowError, UpstreamBudgetUnavailableError, UpstreamRateLimitedError
from app.core.metrics import Metrics

logger = logging.getLogger(__name__)

PRIORITY_HIGH = 0
PRIORITY_MEDIUM = 1
PRIORITY_LOW = 2


@dataclass(order=True)
class _Waiter:
    priority: int
    sequence: int
    future: asyncio.Future[None] = field(compare=False)


class _LocalTokenBucket:
    def __init__(self, capacity: int, period_seconds: int) -> None:
        self.capacity = capacity
        self.period_seconds = period_seconds
        self.requests: deque[float] = deque()
        self.lock = asyncio.Lock()

    async def take(self) -> tuple[bool, int]:
        async with self.lock:
            now = time.monotonic()
            while self.requests and self.requests[0] <= now - self.period_seconds:
                self.requests.popleft()
            if len(self.requests) < self.capacity:
                self.requests.append(now)
                return True, 0
            return False, max(1, int((self.requests[0] + self.period_seconds - now) * 1000))

    @property
    def remaining(self) -> int:
        return max(0, self.capacity - len(self.requests))


class UpstreamRateLimiter:
    """Priority-aware, bounded queue in front of every Hypixel request.

    The token budget is shared through Redis when available so API and worker
    processes cannot independently consume the entire Hypixel quota.
    """

    def __init__(
        self,
        *,
        limit_per_minute: int = 110,
        queue_size: int = 200,
        redis: RedisCache | None = None,
        metrics: Metrics | None = None,
        name: str = "hypixel",
    ) -> None:
        self.limit = limit_per_minute
        self.queue: asyncio.PriorityQueue[_Waiter] = asyncio.PriorityQueue(maxsize=queue_size)
        self.redis = redis
        self.metrics = metrics or Metrics()
        self.name = name
        self._local = _LocalTokenBucket(limit_per_minute, 60)
        self._sequence = itertools.count()
        self._cooldown_until = 0.0
        self._dispatcher: asyncio.Task[None] | None = None
        self._closed = False
        self._lock = asyncio.Lock()
        self._redis_available = redis is not None
        self.last_remaining: int | None = None
        self.last_limit: int | None = None

    def start(self) -> None:
        if self._dispatcher is None or self._dispatcher.done():
            self._dispatcher = asyncio.create_task(self._dispatch(), name=f"{self.name}-rate-dispatcher")

    async def acquire(self, priority: int = PRIORITY_MEDIUM, timeout_seconds: float = 30.0) -> None:
        if self._closed:
            raise UpstreamRateLimitedError("Upstream limiter is closed", retry_after=5)
        self.start()
        if self.queue.full():
            self.metrics.incr("upstream_queue_rejected")
            raise QueueOverflowError("Upstream request queue is full")
        future: asyncio.Future[None] = asyncio.get_running_loop().create_future()
        item = _Waiter(priority, next(self._sequence), future)
        try:
            self.queue.put_nowait(item)
        except asyncio.QueueFull as exc:
            raise QueueOverflowError("Upstream request queue is full") from exc
        try:
            await asyncio.wait_for(future, timeout=timeout_seconds)
        except TimeoutError as exc:
            future.cancel()
            self.metrics.incr("upstream_queue_timeout")
            raise UpstreamRateLimitedError("Timed out waiting for upstream budget", retry_after=5) from exc
        except asyncio.CancelledError:
            future.cancel()
            raise

    async def _take_token(self) -> tuple[bool, int]:
        if self.redis:
            try:
                allowed, wait_ms, remaining = await asyncio.wait_for(
                    self.redis.try_take_token(self.name, self.limit, 60), timeout=0.5
                )
                self._redis_available = True
                self.last_remaining = remaining
                self.last_limit = self.limit
                return allowed, wait_ms
            except Exception as exc:
                if self._redis_available:
                    logger.warning("Shared upstream budget unavailable error=%s; failing closed", type(exc).__name__)
                self._redis_available = False
                # Never spend independent per-process budgets after a shared-store outage.
                return False, 1000
        allowed, wait_ms = await self._local.take()
        self.last_remaining = self._local.remaining
        self.last_limit = self.limit
        return allowed, wait_ms

    @property
    def redis_available(self) -> bool:
        return self._redis_available

    async def _dispatch(self) -> None:
        while not self._closed:
            waiter = await self.queue.get()
            try:
                while True:
                    if waiter.future.done():
                        break
                    now = time.monotonic()
                    if now < self._cooldown_until:
                        await asyncio.sleep(min(1.0, self._cooldown_until - now))
                        continue
                    allowed, wait_ms = await self._take_token()
                    if allowed:
                        self.metrics.incr("upstream_rate_tokens")
                        if not waiter.future.done():
                            waiter.future.set_result(None)
                        break
                    if self.redis is not None and not self.redis_available:
                        raise UpstreamBudgetUnavailableError(
                            "Shared upstream rate-limit store is unavailable; request not sent", retry_after=5
                        )
                    self.metrics.incr("upstream_rate_waits")
                    # Reconsider queued priorities while waiting for the next budget slot.
                    if not self.queue.empty() and self.queue._queue[0].priority < waiter.priority:
                        next_waiter = self.queue.get_nowait()
                        self.queue.task_done()
                        self.queue.put_nowait(waiter)
                        waiter = next_waiter
                    await asyncio.sleep(min(1.0, max(0.01, wait_ms / 1000)))
            except asyncio.CancelledError:
                if not waiter.future.done():
                    waiter.future.cancel()
                raise
            except UpstreamBudgetUnavailableError as exc:
                if not waiter.future.done():
                    waiter.future.set_exception(exc)
            except Exception:
                logger.exception("Rate limiter dispatcher error")
                if not waiter.future.done():
                    waiter.future.set_exception(UpstreamRateLimitedError("Upstream budget unavailable"))
            finally:
                self.queue.task_done()

    async def share_cooldown(self, seconds: float) -> None:
        self.cooldown(seconds)
        if self.redis:
            try:
                await self.redis.set_cooldown(self.name, seconds)
            except Exception:
                self._redis_available = False

    def cooldown(self, seconds: float) -> None:
        self._cooldown_until = max(self._cooldown_until, time.monotonic() + max(0.0, seconds))
        self.metrics.incr("upstream_cooldowns")

    def note_headers(self, limit: str | None, remaining: str | None) -> None:
        try:
            if limit is not None:
                self.last_limit = int(limit)
            if remaining is not None:
                self.last_remaining = int(remaining)
        except ValueError:
            return

    def budget(self) -> dict[str, Any]:
        now = time.monotonic()
        return {
            "limit_per_minute": self.limit,
            "remaining": self.last_remaining if self.last_remaining is not None else self._local.remaining,
            "queue_depth": self.queue.qsize(),
            "queue_capacity": self.queue.maxsize,
            "cooldown_seconds": max(0, round(self._cooldown_until - now, 1)),
            "redis_shared": self.redis_available,
        }

    async def close(self) -> None:
        self._closed = True
        if self._dispatcher:
            self._dispatcher.cancel()
            await asyncio.gather(self._dispatcher, return_exceptions=True)
        while not self.queue.empty():
            waiter = self.queue.get_nowait()
            if not waiter.future.done():
                waiter.future.cancel()


class BackendRateLimiter:
    """Per-client public API limiter.

    This limits abuse of our own service. It is intentionally separate from the
    Hypixel upstream budget and is not authentication.
    """

    def __init__(
        self,
        *,
        limit_per_minute: int = 120,
        redis: RedisCache | None = None,
        metrics: Metrics | None = None,
    ) -> None:
        self.limit = limit_per_minute
        self.redis = redis
        self.metrics = metrics or Metrics()
        self._windows: dict[str, tuple[int, int]] = {}
        self._lock = asyncio.Lock()

    async def check(self, key: str) -> tuple[bool, int, int]:
        if self.redis:
            try:
                allowed, remaining, reset = await asyncio.wait_for(
                    self.redis.increment_window(f"backend:{key}", 60, self.limit), timeout=0.3
                )
                return allowed, remaining, reset
            except Exception as exc:
                logger.debug("Redis backend limiter unavailable error=%s", type(exc).__name__)
        now = int(time.time())
        window = now // 60
        async with self._lock:
            stored_window, count = self._windows.get(key, (window, 0))
            if stored_window != window:
                stored_window, count = window, 0
            count += 1
            self._windows[key] = (stored_window, count)
            # Opportunistic cleanup.
            if len(self._windows) > 5000:
                self._windows = {k: v for k, v in self._windows.items() if v[0] == window}
        reset = (window + 1) * 60 - now
        allowed = count <= self.limit
        remaining = max(0, self.limit - count)
        if not allowed:
            self.metrics.incr("backend_rate_limited")
        return allowed, remaining, reset
