from __future__ import annotations

import asyncio
import logging
import random
import re
import time
from typing import Any

import httpx
from pydantic import ValidationError

from app.core.errors import (
    MissingApiKeyError,
    UpstreamAuthError,
    UpstreamForbiddenError,
    UpstreamInvalidResponseError,
    UpstreamNotFoundError,
    UpstreamRateLimitedError,
    UpstreamTimeoutError,
    UpstreamUnavailableError,
)
from app.core.metrics import Metrics
from app.core.rate_limit import PRIORITY_MEDIUM, UpstreamRateLimiter
from app.schemas.api import (
    AuctionsUpstream,
    BazaarUpstream,
    CollectionsUpstream,
    ItemsUpstream,
    PlayerUpstream,
    ProfilesUpstream,
    SkillsUpstream,
)

logger = logging.getLogger(__name__)

_ALLOWED_PATH = re.compile(
    r"^/(player|skyblock/(bazaar|auctions|auction|profiles|profile|skills)|"
    r"resources/skyblock/(items|skills|collections))$"
)
_UUID = re.compile(r"^[0-9a-fA-F-]{32,36}$")
_PROFILE_ID = re.compile(r"^[0-9a-fA-F-]{32,36}$")


def _backoff(attempt: int) -> float:
    base = min(8.0, 0.35 * (2**attempt))
    return base + random.uniform(0, base * 0.25)  # noqa: S311 - retry jitter, not security


class HypixelClient:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str | None,
        timeout_seconds: float = 15.0,
        connect_timeout_seconds: float = 5.0,
        max_retries: int = 2,
        max_response_bytes: int = 64 * 1024 * 1024,
        limiter: UpstreamRateLimiter,
        metrics: Metrics,
        transport: httpx.AsyncBaseTransport | None = None,
        user_agent: str = "SkyBlockCompanionBackend/0.2",
    ) -> None:
        self.api_key = api_key.strip() if api_key else None
        self.max_retries = max(0, max_retries)
        self.max_response_bytes = max_response_bytes
        self.limiter = limiter
        self.metrics = metrics
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(timeout_seconds, connect=connect_timeout_seconds),
            limits=httpx.Limits(max_connections=40, max_keepalive_connections=20, keepalive_expiry=30),
            headers={
                "Accept": "application/json",
                "User-Agent": user_agent,
            },
            transport=transport,
            follow_redirects=False,
        )

    @property
    def key_configured(self) -> bool:
        return bool(self.api_key)

    async def close(self) -> None:
        await self._client.aclose()

    async def get(
        self,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        authenticated: bool = False,
        priority: int = PRIORITY_MEDIUM,
    ) -> dict[str, Any]:
        if not _ALLOWED_PATH.match(path):
            raise UpstreamInvalidResponseError("Upstream path is not allowlisted")
        if authenticated and not self.api_key:
            raise MissingApiKeyError()

        attempt = 0
        while True:
            await self.limiter.acquire(priority=priority, timeout_seconds=30.0)
            headers = {}
            if authenticated and self.api_key:
                headers["API-Key"] = self.api_key
            started = time.perf_counter()
            try:
                response = await self._client.get(path, params=params, headers=headers)
            except httpx.TimeoutException as exc:
                self.metrics.incr("upstream_timeouts")
                if attempt < self.max_retries:
                    attempt += 1
                    await asyncio.sleep(_backoff(attempt))
                    continue
                raise UpstreamTimeoutError("Hypixel API request timed out") from exc
            except httpx.HTTPError as exc:
                self.metrics.incr("upstream_transport_errors")
                if attempt < self.max_retries:
                    attempt += 1
                    await asyncio.sleep(_backoff(attempt))
                    continue
                raise UpstreamUnavailableError("Hypixel API is unreachable") from exc
            finally:
                elapsed = (time.perf_counter() - started) * 1000
                self.metrics.observe("upstream_latency_ms", elapsed)

            self.limiter.note_headers(
                response.headers.get("RateLimit-Limit"), response.headers.get("RateLimit-Remaining")
            )
            self.metrics.incr("upstream_requests")
            self.metrics.incr(f"upstream_status_{response.status_code}")

            if response.status_code == 429:
                retry_after = self._retry_after(response)
                await self.limiter.share_cooldown(retry_after)
                self.metrics.incr("upstream_429")
                if attempt < self.max_retries and retry_after <= 15:
                    attempt += 1
                    await asyncio.sleep(retry_after)
                    continue
                raise UpstreamRateLimitedError("Hypixel API rate limit reached", retry_after=max(1, int(retry_after)))

            if response.status_code in (401, 403):
                logger.warning("Hypixel rejected the server key status=%s", response.status_code)
                if response.status_code == 401:
                    raise UpstreamAuthError("Hypixel rejected the configured API key")
                raise UpstreamForbiddenError("Hypixel denied access to this endpoint")

            if response.status_code == 404:
                raise UpstreamNotFoundError("Hypixel resource not found")

            if response.status_code == 400:
                raise UpstreamInvalidResponseError("Hypixel rejected the request parameters", status_code=400)

            if response.status_code == 422:
                raise UpstreamInvalidResponseError("Hypixel could not validate the request", status_code=422)

            if response.status_code >= 500:
                if attempt < self.max_retries:
                    attempt += 1
                    await asyncio.sleep(_backoff(attempt))
                    continue
                raise UpstreamUnavailableError(f"Hypixel API returned HTTP {response.status_code}", status_code=503)

            if response.status_code != 200:
                raise UpstreamInvalidResponseError(f"Unexpected Hypixel response status {response.status_code}")

            content_length = response.headers.get("content-length")
            if content_length and content_length.isdigit() and int(content_length) > self.max_response_bytes:
                raise UpstreamInvalidResponseError("Hypixel response is too large")
            if len(response.content) > self.max_response_bytes:
                raise UpstreamInvalidResponseError("Hypixel response is too large")

            try:
                payload = response.json()
            except ValueError as exc:
                raise UpstreamInvalidResponseError("Hypixel returned malformed JSON") from exc
            if not isinstance(payload, dict):
                raise UpstreamInvalidResponseError("Hypixel returned an unexpected payload")
            if payload.get("success") is False:
                cause = str(payload.get("cause") or "Hypixel rejected the request")
                lowered = cause.lower()
                if "key" in lowered or "auth" in lowered:
                    raise UpstreamAuthError("Hypixel rejected the configured API key")
                if "rate" in lowered or "limit" in lowered:
                    await self.limiter.share_cooldown(10)
                    raise UpstreamRateLimitedError("Hypixel API rate limit reached", retry_after=10)
                raise UpstreamInvalidResponseError("Hypixel rejected the request")
            schemas = {
                "/skyblock/bazaar": BazaarUpstream,
                "/skyblock/auctions": AuctionsUpstream,
                "/player": PlayerUpstream,
                "/skyblock/profiles": ProfilesUpstream,
                "/resources/skyblock/items": ItemsUpstream,
                "/resources/skyblock/skills": SkillsUpstream,
                "/resources/skyblock/collections": CollectionsUpstream,
            }
            schema = schemas.get(path)
            try:
                if payload.get("success") is not True:
                    raise UpstreamInvalidResponseError("Hypixel response has no success marker")
                if schema:
                    schema.model_validate(payload)
                for field in ("products", "items", "skills", "collections"):
                    if field in payload and not payload[field]:
                        raise UpstreamInvalidResponseError("Hypixel returned an empty resource")
            except ValidationError as exc:
                raise UpstreamInvalidResponseError("Hypixel response failed schema validation") from exc
            return payload

    @staticmethod
    def _retry_after(response: httpx.Response) -> float:
        value = response.headers.get("Retry-After")
        if value:
            try:
                return max(0.0, float(value))
            except ValueError:
                pass
        reset = response.headers.get("RateLimit-Reset")
        if reset:
            try:
                return max(0.0, float(reset))
            except ValueError:
                pass
        return 5.0


class MojangClient:
    def __init__(
        self,
        *,
        base_url: str,
        timeout_seconds: float = 10.0,
        limiter: UpstreamRateLimiter,
        metrics: Metrics,
        transport: httpx.AsyncBaseTransport | None = None,
        user_agent: str = "SkyBlockCompanionBackend/0.2",
    ) -> None:
        self.limiter = limiter
        self.metrics = metrics
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout_seconds,
            headers={"Accept": "application/json", "User-Agent": user_agent},
            transport=transport,
            follow_redirects=False,
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def resolve_name(self, name: str) -> dict[str, Any]:
        if not re.match(r"^[A-Za-z0-9_]{3,16}$", name):
            raise UpstreamInvalidResponseError("Invalid Minecraft name", status_code=422)
        await self.limiter.acquire(priority=PRIORITY_MEDIUM, timeout_seconds=15.0)
        try:
            response = await self._client.get(f"/users/profiles/minecraft/{name}")
        except httpx.TimeoutException as exc:
            raise UpstreamTimeoutError("Mojang API request timed out") from exc
        except httpx.HTTPError as exc:
            raise UpstreamUnavailableError("Mojang API is unreachable") from exc
        if response.status_code == 404:
            raise UpstreamNotFoundError("Minecraft player not found")
        if response.status_code == 429:
            retry_after = HypixelClient._retry_after(response)
            await self.limiter.share_cooldown(retry_after)
            raise UpstreamRateLimitedError("Mojang rate limit reached", retry_after=int(retry_after))
        if response.status_code >= 500:
            raise UpstreamUnavailableError("Mojang API is temporarily unavailable")
        if response.status_code != 200:
            raise UpstreamInvalidResponseError("Unexpected Mojang response")
        try:
            payload = response.json()
        except ValueError as exc:
            raise UpstreamInvalidResponseError("Mojang returned malformed JSON") from exc
        if (
            not isinstance(payload, dict)
            or not re.fullmatch(r"[0-9a-fA-F]{32}", str(payload.get("id", "")))
            or not re.fullmatch(r"[A-Za-z0-9_]{3,16}", str(payload.get("name", "")))
        ):
            raise UpstreamInvalidResponseError("Mojang returned an invalid profile")
        return payload
