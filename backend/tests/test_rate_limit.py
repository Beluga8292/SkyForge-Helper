from __future__ import annotations

import asyncio

import pytest

from app.core.errors import QueueOverflowError, UpstreamRateLimitedError
from app.core.rate_limit import BackendRateLimiter, UpstreamRateLimiter


async def test_backend_rate_limit_exhaustion_returns_429(settings, upstream) -> None:
    settings.backend_rate_limit_per_minute = 3
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app(settings, upstream_transport=upstream.transport())
    with TestClient(app) as test_client:
        statuses = [test_client.get("/api/v1/bazaar").status_code for _ in range(3)]
        limited = test_client.get("/api/v1/bazaar")
    assert statuses == [200, 200, 200]
    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "backend_rate_limited"
    assert int(limited.headers["Retry-After"]) >= 1
    assert limited.headers["RateLimit-Remaining"] == "0"


async def test_health_and_status_are_not_backend_rate_limited(settings, upstream) -> None:
    settings.backend_rate_limit_per_minute = 1
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app(settings, upstream_transport=upstream.transport())
    with TestClient(app) as test_client:
        for _ in range(5):
            assert test_client.get("/api/v1/health").status_code == 200
            assert test_client.get("/api/v1/status").status_code == 200


async def test_upstream_queue_overflow_is_rejected() -> None:
    limiter = UpstreamRateLimiter(limit_per_minute=10, queue_size=3)

    async def never_allowed() -> tuple[bool, int]:
        return False, 60_000

    limiter._take_token = never_allowed  # type: ignore[method-assign]
    limiter.start()
    # One waiter is held by the dispatcher, the bounded queue holds the rest.
    results = await asyncio.gather(
        *(limiter.acquire(priority=2, timeout_seconds=0.1) for _ in range(8)),
        return_exceptions=True,
    )
    assert any(isinstance(result, QueueOverflowError) for result in results)
    await limiter.close()


async def test_upstream_queue_wait_timeout_reports_rate_limit() -> None:
    limiter = UpstreamRateLimiter(limit_per_minute=10, queue_size=10)

    async def never_allowed() -> tuple[bool, int]:
        return False, 60_000

    limiter._take_token = never_allowed  # type: ignore[method-assign]
    limiter.start()
    with pytest.raises(UpstreamRateLimitedError) as error:
        await limiter.acquire(priority=2, timeout_seconds=0.1)
    assert error.value.retry_after is not None
    await limiter.close()


async def test_backend_limiter_local_fallback_counts_requests() -> None:
    limiter = BackendRateLimiter(limit_per_minute=2)
    first = await limiter.check("1.2.3.4")
    second = await limiter.check("1.2.3.4")
    third = await limiter.check("1.2.3.4")
    assert first[0] is True
    assert second[0] is True
    assert third[0] is False
    assert third[1] == 0


async def test_shared_store_outage_fails_fast_and_recovers_without_local_tokens():
    from unittest.mock import AsyncMock

    from app.core.errors import UpstreamBudgetUnavailableError

    redis = AsyncMock()
    redis.try_take_token.side_effect = [ConnectionError(), (True, 0, 9)]
    limiter = UpstreamRateLimiter(limit_per_minute=10, queue_size=10, redis=redis)
    try:
        with pytest.raises(UpstreamBudgetUnavailableError):
            await asyncio.wait_for(limiter.acquire(), timeout=1)
        assert limiter._local.remaining == 10
        await asyncio.wait_for(limiter.acquire(), timeout=1)
        assert limiter.redis_available
        assert redis.try_take_token.await_count == 2
    finally:
        await limiter.close()
