from __future__ import annotations

import json
import time
import uuid
from typing import Any

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import request_id_var
from app.core.metrics import Metrics
from app.core.rate_limit import BackendRateLimiter

_REQUEST_ID_HEADER = "x-request-id"
_ALLOWED_ID_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.")


def _valid_request_id(value: str | None) -> str:
    if value and 8 <= len(value) <= 64 and set(value) <= _ALLOWED_ID_CHARS:
        return value
    return uuid.uuid4().hex


def _client_ip(scope: Scope, trusted_proxies: set[str]) -> str:
    client = scope.get("client")
    peer = client[0] if client else "unknown"
    if peer in trusted_proxies:
        headers = dict(scope.get("headers") or [])
        forwarded = headers.get(b"x-forwarded-for")
        if forwarded:
            return forwarded.decode("latin-1").split(",")[0].strip()
    return peer


def _json_response(
    status: int, body: dict[str, Any], extra_headers: dict[str, str] | None = None
) -> tuple[bytes, list[tuple[bytes, bytes]]]:
    payload = json.dumps(body, separators=(",", ":")).encode("utf-8")
    headers = [
        (b"content-type", b"application/json; charset=utf-8"),
        (b"content-length", str(len(payload)).encode()),
    ]
    for name, value in (extra_headers or {}).items():
        headers.append((name.lower().encode(), value.encode()))
    return payload, headers


class SecurityMiddleware:
    """Request ID, body limit, public rate limit and security headers."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        limiter: BackendRateLimiter | None = None,
        metrics: Metrics | None = None,
        max_body_bytes: int,
        trusted_proxies: set[str],
        is_production: bool,
    ) -> None:
        self.app = app
        self.limiter = limiter
        self.metrics = metrics or Metrics()
        self.max_body_bytes = max_body_bytes
        self.trusted_proxies = trusted_proxies
        self.is_production = is_production

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        request_id = _valid_request_id(headers.get(_REQUEST_ID_HEADER.encode(), b"").decode("latin-1") or None)
        token = request_id_var.set(request_id)
        path = scope.get("path", "")
        started = time.perf_counter()

        try:
            app_state = getattr(scope.get("app"), "state", None)
            container = getattr(app_state, "container", None)
            limiter = self.limiter or (getattr(container, "backend_limiter", None) if container else None)
            metrics = (getattr(container, "metrics", None) if container else None) or self.metrics
            content_length = headers.get(b"content-length")
            if content_length:
                try:
                    length = int(content_length)
                except ValueError:
                    length = 0
                if length > self.max_body_bytes:
                    metrics.incr("http_body_too_large")
                    payload, response_headers = _json_response(
                        413,
                        {
                            "error": {
                                "code": "payload_too_large",
                                "message": "Request body exceeds the configured limit",
                                "request_id": request_id,
                            }
                        },
                        {"X-Request-ID": request_id},
                    )
                    await send({"type": "http.response.start", "status": 413, "headers": response_headers})
                    await send({"type": "http.response.body", "body": payload})
                    return

            prefix = getattr(getattr(container, "settings", None), "api_prefix", "/api/v1")
            if path not in {f"{prefix}/health", f"{prefix}/status"} and limiter is not None:
                ip = _client_ip(scope, self.trusted_proxies)
                allowed, remaining, reset = await limiter.check(ip)
                if not allowed:
                    metrics.incr("backend_rate_limited")
                    payload, response_headers = _json_response(
                        429,
                        {
                            "error": {
                                "code": "backend_rate_limited",
                                "message": "Too many requests to this API. Retry later.",
                                "request_id": request_id,
                                "retry_after_seconds": reset,
                            }
                        },
                        {
                            "X-Request-ID": request_id,
                            "Retry-After": str(reset),
                            "RateLimit-Limit": str(limiter.limit),
                            "RateLimit-Remaining": "0",
                            "RateLimit-Reset": str(reset),
                        },
                    )
                    await send({"type": "http.response.start", "status": 429, "headers": response_headers})
                    await send({"type": "http.response.body", "body": payload})
                    return
            else:
                remaining = limiter.limit if limiter else 0
                reset = 60

            async def send_wrapper(message: Message) -> None:
                if message["type"] == "http.response.start":
                    message.setdefault("headers", [])
                    message["headers"].extend(
                        [
                            (b"x-request-id", request_id.encode()),
                            (b"x-content-type-options", b"nosniff"),
                            (b"x-frame-options", b"DENY"),
                            (b"referrer-policy", b"no-referrer"),
                            (b"permissions-policy", b"geolocation=(), microphone=(), camera=()"),
                            (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"),
                            (b"cache-control", b"no-store"),
                            (b"ratelimit-limit", str(limiter.limit if limiter else 0).encode()),
                            (b"ratelimit-remaining", str(remaining).encode()),
                            (b"ratelimit-reset", str(reset).encode()),
                        ]
                    )
                    if self.is_production:
                        message["headers"].append(
                            (b"strict-transport-security", b"max-age=31536000; includeSubDomains")
                        )
                await send(message)

            await self.app(scope, receive, send_wrapper)
        finally:
            elapsed = (time.perf_counter() - started) * 1000
            metrics.observe("http_latency_ms", elapsed)
            metrics.incr("http_requests")
            request_id_var.reset(token)
