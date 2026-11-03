from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends

from app.api.deps import get_container
from app.container import Container
from app.core.logging import request_id_var
from app.schemas.api import HealthResponse, ServiceState, StatusResponse

router = APIRouter(tags=["system"])
VERSION = "0.2.0"
logger = logging.getLogger(__name__)


STATUS_DB_TTL_SECONDS = 5.0


async def database_status(container: Container) -> tuple[bool, dict]:
    # One deadline includes connection acquisition, ping and history queries.
    unavailable = {"snapshots": None, "raw_points": None, "hourly_points": None, "latest_snapshot": None}
    now = asyncio.get_running_loop().time()
    cached = container.status_db_cache
    if cached and now - cached[0] < STATUS_DB_TTL_SECONDS:
        return cached[1], cached[2]
    async with container.status_db_lock:
        cached = container.status_db_cache
        if cached and asyncio.get_running_loop().time() - cached[0] < STATUS_DB_TTL_SECONDS:
            return cached[1], cached[2]
        try:
            async with asyncio.timeout(container.settings.database_status_timeout_seconds):
                if not await container.database.ping():
                    result = False, unavailable
                else:
                    result = True, await container.history.stats()
        except Exception as exc:
            logger.warning("Database status unavailable error=%s", type(exc).__name__)
            result = False, unavailable
        # Only healthy summaries are cached: recovery must be visible at once.
        if result[0]:
            container.status_db_cache = (asyncio.get_running_loop().time(), *result)
        return result


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def health() -> HealthResponse:
    return HealthResponse(status="ok", version=VERSION)


@router.get("/status", response_model=StatusResponse, summary="Service and dependency status")
async def status(container: Container = Depends(get_container)) -> StatusResponse:
    settings = container.settings
    redis_ok = await container.cache.ping() if container.cache.redis else False
    database_ok, history = await database_status(container)
    snapshot = await container.auctions.snapshot_info()
    queue = {
        **container.limiter.budget(),
        "available": redis_ok and container.limiter.redis_available if container.redis else True,
        "shared_store_required": container.redis is not None,
    }
    cache_info = container.cache.info()

    bazaar_entry, bazaar_backend = await container.cache.get("bazaar")
    now = datetime.now().timestamp()
    bazaar_cache = {
        "ready": bazaar_entry is not None,
        "backend": bazaar_backend,
        "fetched_at": (datetime.fromtimestamp(bazaar_entry.fetched_at, tz=UTC).isoformat() if bazaar_entry else None),
        "stored_at": (datetime.fromtimestamp(bazaar_entry.stored_at, tz=UTC).isoformat() if bazaar_entry else None),
        "age_ms": int(max(0.0, now - bazaar_entry.fetched_at) * 1000) if bazaar_entry else None,
        "stale": (not bazaar_entry.is_fresh) if bazaar_entry else False,
    }
    bazaar_state = (
        ServiceState(
            status="ok" if bazaar_entry and bazaar_entry.is_fresh else "degraded",
            detail=(
                f"{bazaar_backend}; age={int(datetime.now().timestamp() - bazaar_entry.stored_at)}s"
                if bazaar_entry
                else "not warmed"
            ),
        )
        if bazaar_entry
        else ServiceState(status="unavailable", detail="not warmed")
    )

    services = {
        "hypixel_api": ServiceState(
            status="ok" if settings.hypixel_key_configured else "not_configured",
            detail=None if settings.hypixel_key_configured else "server API key is missing",
        ),
        "redis": ServiceState(
            status="ok" if redis_ok else "degraded",
            detail=(
                None
                if redis_ok
                else "memory cache fallback active; shared upstream budget unavailable"
                if container.redis
                else "not configured; single-process memory cache and budget"
            ),
        ),
        "database": ServiceState(
            status="ok" if database_ok else "unavailable",
            detail=None if database_ok else "price history unavailable",
        ),
        "bazaar_cache": bazaar_state,
        "auction_snapshot": ServiceState(
            status="ok" if snapshot.get("ready") and not snapshot.get("stale") else "degraded",
            detail=str(snapshot.get("snapshot_id")) if snapshot.get("ready") else "not built",
        ),
    }
    degraded = any(state.status in {"degraded", "unavailable", "not_configured"} for state in services.values())
    return StatusResponse(
        status="degraded" if degraded else "ok",
        version=VERSION,
        environment=settings.environment,
        request_id=request_id_var.get(),
        services=services,
        cache={**cache_info, "bazaar": bazaar_cache, "ttls": settings.public_summary()["cache_ttls"]},
        rate_limit=queue,
        history=history,
        metrics=container.metrics.snapshot(),
        config=settings.public_summary(),
    )
