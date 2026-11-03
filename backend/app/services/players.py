from __future__ import annotations

import re
from typing import Any

from pydantic import ValidationError

from app.cache.service import CacheService
from app.clients.hypixel import HypixelClient, MojangClient
from app.core.errors import InvalidRequestError, UpstreamInvalidResponseError, UpstreamNotFoundError
from app.core.rate_limit import PRIORITY_HIGH
from app.schemas.api import (
    Meta,
    MojangProfile,
    PlayerResponse,
    PlayerUpstream,
    ProfileResponse,
    ProfilesResponse,
    ProfilesUpstream,
    SkyBlockProfile,
)
from app.services.bazaar import meta_from_cache

_UUID = re.compile(r"^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
_PROFILE = re.compile(
    r"^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def normalize_uuid(value: str) -> str:
    return value.replace("-", "").lower()


class PlayerService:
    def __init__(
        self,
        *,
        client: HypixelClient,
        cache: CacheService,
        player_ttl: int,
        profiles_ttl: int,
        stale_ttl: int,
    ) -> None:
        self.client = client
        self.cache = cache
        self.player_ttl = player_ttl
        self.profiles_ttl = profiles_ttl
        self.stale_ttl = stale_ttl

    async def get_player(self, uuid: str, *, force: bool = False) -> PlayerResponse:
        if not _UUID.match(uuid):
            raise InvalidRequestError("Invalid player UUID")
        normalized = normalize_uuid(uuid)

        async def fetch() -> dict[str, Any]:
            payload = await self.client.get(
                "/player", params={"uuid": normalized}, authenticated=True, priority=PRIORITY_HIGH
            )
            return PlayerUpstream.model_validate(payload).model_dump()

        result = await self.cache.get_or_fetch(
            f"player:{normalized}",
            ttl=self.player_ttl,
            stale_ttl=self.stale_ttl,
            fetcher=fetch,
            force=force,
        )
        payload = PlayerUpstream.model_validate(result.value)
        return PlayerResponse(
            success=True,
            player=payload.player,
            meta=meta_from_cache(result),
        )

    async def get_profiles(self, uuid: str, *, force: bool = False) -> ProfilesResponse:
        if not _UUID.match(uuid):
            raise InvalidRequestError("Invalid player UUID")
        normalized = normalize_uuid(uuid)

        async def fetch() -> dict[str, Any]:
            payload = await self.client.get(
                "/skyblock/profiles",
                params={"uuid": normalized},
                authenticated=True,
                priority=PRIORITY_HIGH,
            )
            validated = ProfilesUpstream.model_validate(payload)
            return {
                "success": True,
                "profiles": [profile.model_dump() for profile in (validated.profiles or [])],
            }

        result = await self.cache.get_or_fetch(
            f"profiles:{normalized}",
            ttl=self.profiles_ttl,
            stale_ttl=self.stale_ttl,
            fetcher=fetch,
            force=force,
        )
        payload = ProfilesUpstream.model_validate(result.value)
        return ProfilesResponse(
            success=True,
            profiles=payload.profiles or [],
            meta=meta_from_cache(result),
        )

    async def get_profile(self, profile_id: str, *, force: bool = False) -> ProfileResponse:
        if not _PROFILE.match(profile_id):
            raise InvalidRequestError("Invalid SkyBlock profile id")
        normalized = normalize_uuid(profile_id)

        async def fetch() -> dict[str, Any]:
            payload = await self.client.get(
                "/skyblock/profile",
                params={"profile": normalized},
                authenticated=True,
                priority=PRIORITY_HIGH,
            )
            profile = payload.get("profile")
            if not profile:
                raise UpstreamNotFoundError("SkyBlock profile not found")
            try:
                validated = SkyBlockProfile.model_validate(profile)
            except ValidationError as exc:
                raise UpstreamInvalidResponseError("Hypixel profile failed schema validation") from exc
            return {"success": True, "profile": validated.model_dump()}

        result = await self.cache.get_or_fetch(
            f"profile:{normalized}",
            ttl=self.profiles_ttl,
            stale_ttl=self.stale_ttl,
            fetcher=fetch,
            force=force,
        )
        return ProfileResponse(
            profile=SkyBlockProfile.model_validate(result.value["profile"]),
            meta=meta_from_cache(result),
        )


class MojangService:
    def __init__(self, *, client: MojangClient, cache: CacheService) -> None:
        self.client = client
        self.cache = cache

    async def resolve(self, name: str, *, force: bool = False) -> tuple[MojangProfile, Meta]:
        key = f"mojang:{name.casefold()}"
        result = await self.cache.get_or_fetch(
            key,
            ttl=24 * 60 * 60,
            stale_ttl=7 * 24 * 60 * 60,
            fetcher=lambda: self.client.resolve_name(name),
            force=force,
        )
        return MojangProfile.model_validate(result.value), meta_from_cache(result)
