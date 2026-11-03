from __future__ import annotations

import asyncio

from app.container import Container
from app.workers.jobs import JobRunner


async def test_worker_stops_gracefully(settings, upstream) -> None:
    container = await Container.create(settings, transport=upstream.transport())
    runner = JobRunner(container)
    task = asyncio.create_task(runner.run())
    await asyncio.sleep(0.3)
    runner.stop()
    await asyncio.wait_for(task, timeout=5)
    assert all(job.done() for job in runner._tasks)
    await container.close()
    assert container.limiter._closed is True


async def test_container_close_is_idempotent_on_http_clients(settings, upstream) -> None:
    container = await Container.create(settings, transport=upstream.transport())
    await container.limiter.close()
    await container.client.close()
    await container.mojang_client.close()
    assert await container.database.ping() is True
    await container.close()


async def test_application_shutdown_closes_container(settings, upstream) -> None:
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app(settings, upstream_transport=upstream.transport())
    with TestClient(app) as client:
        assert client.get("/api/v1/health").status_code == 200
        container = app.state.container
    assert container.limiter._closed is True
