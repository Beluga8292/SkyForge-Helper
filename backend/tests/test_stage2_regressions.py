from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock

import httpx
import pytest

from app.cache.base import CacheEntry
from app.cache.service import CacheService, ResilientCache
from app.container import Container
from app.core.errors import UpstreamInvalidResponseError, UpstreamRateLimitedError
from app.core.logging import redact_secrets
from app.core.rate_limit import BackendRateLimiter, UpstreamRateLimiter, _LocalTokenBucket
from app.main import create_app
from app.workers.jobs import JobRunner, distributed_lock


async def test_shared_budget_fails_closed_and_recovers() -> None:
    redis = AsyncMock()
    redis.try_take_token.side_effect = [ConnectionError(), (True, 0, 9)]
    limiter = UpstreamRateLimiter(redis=redis)
    assert await limiter._take_token() == (False, 1000)
    assert not limiter.redis_available
    assert limiter._local.remaining == 110
    assert await limiter._take_token() == (True, 0)
    assert limiter.redis_available
    await limiter.close()


async def test_rolling_budget_does_not_refill_inside_window(monkeypatch) -> None:
    clock = [100.0]
    monkeypatch.setattr("app.core.rate_limit.time.monotonic", lambda: clock[0])
    bucket = _LocalTokenBucket(2, 60)
    assert (await bucket.take())[0]
    assert (await bucket.take())[0]
    clock[0] = 159.9
    assert not (await bucket.take())[0]
    clock[0] = 160.0
    assert (await bucket.take())[0]


async def test_concurrent_budget_and_cancellation() -> None:
    limiter = UpstreamRateLimiter(limit_per_minute=3)
    results = await asyncio.gather(*(limiter.acquire(timeout_seconds=0.04) for _ in range(12)), return_exceptions=True)
    assert sum(result is None for result in results) == 3
    assert sum(isinstance(result, UpstreamRateLimitedError) for result in results) == 9
    await limiter.close()
    assert not limiter._dispatcher or limiter._dispatcher.done()
    with pytest.raises(UpstreamRateLimitedError):
        await limiter.acquire()


async def test_backend_shared_limit_is_per_client_and_reports_remaining() -> None:
    redis = AsyncMock()
    redis.increment_window.return_value = (True, 37, 50)
    limiter = BackendRateLimiter(redis=redis)
    assert await limiter.check("one") == (True, 37, 50)
    await limiter.check("two")
    assert redis.increment_window.call_args_list[0].args[0] != redis.increment_window.call_args_list[1].args[0]


async def test_cooldown_is_shared() -> None:
    redis = AsyncMock()
    limiter = UpstreamRateLimiter(redis=redis)
    await limiter.share_cooldown(8)
    redis.set_cooldown.assert_awaited_once_with("hypixel", 8)
    assert limiter.budget()["cooldown_seconds"] > 7
    await limiter.close()


async def test_incomplete_99_percent_snapshot_is_never_published(settings, upstream, monkeypatch) -> None:
    container = await Container.create(settings, transport=upstream.transport())
    original = container.auctions._fetch_page

    async def incomplete(page, priority=1):
        payload = await original(page, priority)
        payload["totalAuctions"] = 400  # 396 unique entries would formerly pass at 99%.
        payload["auctions"] = [{**payload["auctions"][0], "uuid": f"{page}-{i}"} for i in range(198)]
        return payload

    async def no_sleep(_):
        pass

    monkeypatch.setattr(container.auctions, "_fetch_page", incomplete)
    monkeypatch.setattr("app.services.auctions.asyncio.sleep", no_sleep)
    try:
        with pytest.raises(UpstreamInvalidResponseError):
            await container.auctions.get_snapshot()
        assert (await container.cache.get("auctions:snapshot"))[0] is None
    finally:
        await container.close()


async def test_failed_forced_refresh_marks_fresh_previous_snapshot_stale(settings, upstream, monkeypatch) -> None:
    container = await Container.create(settings, transport=upstream.transport())

    async def fail():
        raise UpstreamInvalidResponseError("version changed")

    try:
        first = await container.auctions.get_snapshot()
        monkeypatch.setattr(container.auctions, "_fetch_all", fail)
        result = await container.auctions.get_snapshot(force=True)
        assert result.stale and result.value == first.value
        assert (await container.auctions.list_auctions()).meta.stale
    finally:
        await container.close()


async def test_swr_tasks_are_bounded_and_cancelled() -> None:
    service = CacheService(ResilientCache(None))
    service.max_background_tasks = 2
    started = asyncio.Event()

    async def waiting():
        started.set()
        await asyncio.Event().wait()
        return {}

    for i in range(10):
        await service.cache.set(
            str(i), CacheEntry(value={}, fetched_at=time.time() - 2, stored_at=time.time() - 2, ttl=1, stale_ttl=60)
        )
        await service.get_or_fetch(str(i), ttl=1, stale_ttl=60, fetcher=waiting)
    assert len(service._tasks) == 2
    await started.wait()
    await service.close()
    assert not service._pending
    assert not service._tasks


async def test_cancelled_fetch_releases_single_flight() -> None:
    service = CacheService(ResilientCache(None))
    started = asyncio.Event()

    async def waiting():
        started.set()
        await asyncio.Event().wait()
        return {}

    task = asyncio.create_task(service.get_or_fetch("x", ttl=10, stale_ttl=20, fetcher=waiting))
    await started.wait()
    task.cancel()
    await asyncio.gather(task, return_exceptions=True)
    result = await service.get_or_fetch("x", ttl=10, stale_ttl=20, fetcher=AsyncMock(return_value={"ok": True}))
    assert result.value == {"ok": True}
    await service.close()


async def test_worker_does_not_run_without_shared_lock(settings, upstream) -> None:
    container = await Container.create(settings, transport=upstream.transport())
    redis = AsyncMock()
    redis.try_lock.return_value = False
    container.redis = redis
    try:
        async with distributed_lock(container, "test") as acquired:
            assert not acquired
        redis.release_lock.assert_not_called()
    finally:
        await container.close()


async def test_worker_survives_job_failure(settings, upstream) -> None:
    container = await Container.create(settings, transport=upstream.transport())
    runner = JobRunner(container)
    job = AsyncMock(side_effect=RuntimeError("failed job"))
    task = asyncio.create_task(runner._periodic("test", 10, job))
    await asyncio.sleep(0.02)
    runner.stop()
    await task
    assert job.await_count == 1
    await container.close()


def test_uuid_secret_is_actually_redacted() -> None:
    secret = "00000000-0000-4000-8000-000000000000"
    assert secret not in redact_secrets(f"API-Key={secret}")


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (400, "upstream_invalid_response"),
        (401, "upstream_auth"),
        (404, "not_found"),
        (422, "upstream_invalid_response"),
    ],
)
def test_additional_upstream_statuses(settings, status, code) -> None:
    from fastapi.testclient import TestClient

    transport = httpx.MockTransport(lambda _: httpx.Response(status, json={"success": False}))
    with TestClient(create_app(settings, upstream_transport=transport)) as client:
        response = client.get("/api/v1/bazaar")
        assert response.json()["error"]["code"] == code


def test_upstream_cause_cannot_echo_secret(settings) -> None:
    from fastapi.testclient import TestClient

    transport = httpx.MockTransport(lambda _: httpx.Response(200, json={"success": False, "cause": "test-key"}))
    with TestClient(create_app(settings, upstream_transport=transport)) as client:
        assert "test-key" not in client.get("/api/v1/bazaar").text


@pytest.mark.parametrize("payload", [{}, {"success": True}, {"success": True, "lastUpdated": 1, "products": []}])
def test_invalid_upstream_schema_is_502(settings, payload) -> None:
    from fastapi.testclient import TestClient

    transport = httpx.MockTransport(lambda _: httpx.Response(200, json=payload))
    with TestClient(create_app(settings, upstream_transport=transport)) as client:
        response = client.get("/api/v1/bazaar")
        assert response.status_code == 502
        assert response.json()["error"]["code"] == "upstream_invalid_response"


async def test_expired_distributed_lease_cannot_publish() -> None:
    redis = AsyncMock()
    redis.get.return_value = None
    redis.try_lock.return_value = True
    redis.owns_lock.return_value = False
    service = CacheService(ResilientCache(redis))
    with pytest.raises(Exception, match="lease expired"):
        await service.get_or_fetch("lease", ttl=30, stale_ttl=60, fetcher=AsyncMock(return_value={"new": True}))
    redis.set.assert_not_called()
    redis.release_lock.assert_awaited_once()
    await service.close()
