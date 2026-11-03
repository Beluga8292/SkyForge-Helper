from __future__ import annotations

from typing import Any

from app.cache.service import CacheService
from app.clients.hypixel import HypixelClient
from app.core.errors import UpstreamInvalidResponseError
from app.core.rate_limit import PRIORITY_LOW
from app.schemas.api import (
    CollectionsResponse,
    CollectionsUpstream,
    ItemsResponse,
    ItemsUpstream,
    SkillsResponse,
    SkillsUpstream,
)
from app.services.bazaar import meta_from_cache


class ResourceService:
    def __init__(self, *, client: HypixelClient, cache: CacheService, ttl: int, stale_ttl: int) -> None:
        self.client = client
        self.cache = cache
        self.ttl = ttl
        self.stale_ttl = stale_ttl

    async def _fetch(self, path: str) -> dict[str, Any]:
        return await self.client.get(path, priority=PRIORITY_LOW)

    async def items(self, *, force: bool = False) -> ItemsResponse:
        result = await self.cache.get_or_fetch(
            "resources:items",
            ttl=self.ttl,
            stale_ttl=self.stale_ttl,
            fetcher=lambda: self._fetch("/resources/skyblock/items"),
            force=force,
        )
        payload = ItemsUpstream.model_validate(result.value)
        if not payload.items:
            raise UpstreamInvalidResponseError("Items resource is empty")
        return ItemsResponse(
            lastUpdated=payload.lastUpdated,
            items=payload.items,
            meta=meta_from_cache(result),
        )

    async def skills(self, *, force: bool = False) -> SkillsResponse:
        result = await self.cache.get_or_fetch(
            "resources:skills",
            ttl=self.ttl,
            stale_ttl=self.stale_ttl,
            fetcher=lambda: self._fetch("/resources/skyblock/skills"),
            force=force,
        )
        payload = SkillsUpstream.model_validate(result.value)
        if not payload.skills:
            raise UpstreamInvalidResponseError("Skills resource is empty")
        return SkillsResponse(
            lastUpdated=payload.lastUpdated,
            version=payload.version,
            skills=payload.skills,
            meta=meta_from_cache(result),
        )

    async def collections(self, *, force: bool = False) -> CollectionsResponse:
        result = await self.cache.get_or_fetch(
            "resources:collections",
            ttl=self.ttl,
            stale_ttl=self.stale_ttl,
            fetcher=lambda: self._fetch("/resources/skyblock/collections"),
            force=force,
        )
        payload = CollectionsUpstream.model_validate(result.value)
        return CollectionsResponse(
            lastUpdated=payload.lastUpdated,
            version=payload.version,
            collections=payload.collections,
            meta=meta_from_cache(result),
        )
