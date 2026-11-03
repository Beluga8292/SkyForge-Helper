"""Disposable QA ASGI app: all Hypixel/Mojang traffic uses synthetic MockTransport.
Never used by production imports, frontend builds or deployments.
"""

import copy
import os
import time

import httpx
from app.core.config import Settings
from app.main import create_app
from pydantic import SecretStr
from tests.conftest import BAZAAR_PAYLOAD, MockUpstream
from tests.test_intelligence import PROFILE, UUID, profile

upstream = MockUpstream()
mode = "normal"


async def handle(request):
    if request.url.path == "/v2/skyblock/bazaar":
        upstream.requests.append(request.url.path)
        if mode == "timeout":
            raise httpx.ReadTimeout("synthetic timeout", request=request)
        if mode == "429":
            return httpx.Response(
                429, headers={"Retry-After": "1"}, json={"success": False}
            )
        if mode == "malformed":
            return httpx.Response(200, json={"success": True, "products": "invalid"})
        data = copy.deepcopy(BAZAAR_PAYLOAD)
        data["lastUpdated"] = int(time.time() * 1000)
        return httpx.Response(200, json=data)
    if request.url.path == "/v2/skyblock/profile":
        upstream.requests.append(request.url.path)
        data = profile()
        if mode == "private":
            data["members"][UUID].pop("inventory", None)
        if mode == "invalid_profile":
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "profile": {"profile_id": PROFILE, "members": "invalid"},
                },
            )
        return httpx.Response(200, json={"success": True, "profile": data})
    return await upstream.handle(request)


def qa_settings():
    return Settings(
        _env_file=None,
        environment="test",
        database_url=os.environ.get(
            "DATABASE_URL",
            "sqlite+aiosqlite:///" + os.environ.get("SBC_QA_DB", "/tmp/qa.db"),
        ),
        redis_url=os.environ.get("REDIS_URL", ""),
        hypixel_api_key=SecretStr("synthetic-fixture-only"),
        auto_create_tables=not bool(os.environ.get("REDIS_URL")),
        upstream_max_retries=0,
        http_timeout_seconds=1,
        backend_rate_limit_per_minute=1000,
        cache_swr_enabled=False,
    )


def create_qa_app():
    app = create_app(qa_settings(), upstream_transport=httpx.MockTransport(handle))

    @app.post("/qa/control/{new_mode}")
    async def control(new_mode: str):
        global mode
        mode = new_mode
        cache = app.state.container.cache
        if new_mode == "rate":
            app.state.container.backend_limiter.limit = 2
        elif new_mode == "normal":
            app.state.container.backend_limiter.limit = 1000
            app.state.container.backend_limiter._windows.clear()
        await cache.delete("bazaar")
        if new_mode in {"private", "invalid_profile", "normal"}:
            await cache.delete(f"profile:{PROFILE}")
        return {"fixture": True, "mode": mode}

    @app.get("/qa/counts")
    async def counts():
        return {"fixture": True, "upstream_requests": len(upstream.requests)}

    return app
