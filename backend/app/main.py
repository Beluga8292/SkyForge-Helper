from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.container import Container
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.logging import configure_logging, request_id_var
from app.core.metrics import Metrics
from app.core.middleware import SecurityMiddleware

logger = logging.getLogger(__name__)
VERSION = "0.2.0"


def _error(request_id: str, code: str, message: str, **extra: object) -> dict[str, object]:
    body: dict[str, object] = {"code": code, "message": message, "request_id": request_id}
    body.update({key: value for key, value in extra.items() if value is not None})
    return {"error": body}


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    if getattr(app.state, "container", None) is None:
        settings: Settings = app.state.settings
        app.state.container = await Container.create(settings, transport=getattr(app.state, "upstream_transport", None))
        logger.info(
            "Backend started environment=%s key_configured=%s",
            settings.environment,
            settings.hypixel_key_configured,
        )
    runner = None
    worker_task = None
    if app.state.settings.run_local_worker:
        from app.workers.jobs import JobRunner

        runner = JobRunner(app.state.container)
        worker_task = asyncio.create_task(runner.run(), name="explicit-local-worker")
    try:
        yield
    finally:
        if runner is not None and worker_task is not None:
            runner.stop()
            try:
                await asyncio.wait_for(worker_task, timeout=5)
            except (TimeoutError, asyncio.CancelledError):
                worker_task.cancel()
                await asyncio.gather(worker_task, return_exceptions=True)
        container: Container | None = getattr(app.state, "container", None)
        if container is not None and getattr(app.state, "owns_container", True):
            await container.close()


def create_app(
    settings: Settings | None = None,
    *,
    container: Container | None = None,
    upstream_transport: object | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    app = FastAPI(
        title="SkyBlock Companion API",
        version=VERSION,
        description=(
            "Versioned backend proxy for SkyBlock Companion. Upstream calls are "
            "allowlisted, cached, rate limited and validated. This API is not an "
            "open proxy."
        ),
        docs_url="/docs",
        redoc_url=None,
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.container = container
    app.state.upstream_transport = upstream_transport
    app.state.owns_container = True

    app.add_middleware(
        SecurityMiddleware,
        max_body_bytes=settings.max_request_body_bytes,
        trusted_proxies=set(settings.trusted_proxy_ips),
        is_production=settings.is_production,
        metrics=Metrics(),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["Accept", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset", "Retry-After"],
        max_age=600,
    )

    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        headers: dict[str, str] = {}
        if exc.retry_after is not None:
            headers["Retry-After"] = str(exc.retry_after)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {**exc.public_body(), "request_id": request_id_var.get()}},
            headers=headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"location": ".".join(str(part) for part in error["loc"]), "message": error["msg"]}
            for error in exc.errors()[:10]
        ]
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Request parameters failed validation",
                    "request_id": request_id_var.get(),
                    "details": {"issues": details},
                }
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": "not_found" if exc.status_code == 404 else "http_error",
                    "message": "Resource not found" if exc.status_code == 404 else "Request failed",
                    "request_id": request_id_var.get(),
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error path=%s type=%s", request.url.path, type(exc).__name__)
        message = "Internal server error"
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": message,
                    "request_id": request_id_var.get(),
                }
            },
        )

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
