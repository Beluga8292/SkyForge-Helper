from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_container
from app.container import Container
from app.schemas.api import MojangProfile, PlayerResponse, ProfileResponse, ProfilesResponse

router = APIRouter(tags=["players"])


@router.get("/players/{uuid}", response_model=PlayerResponse, summary="Hypixel player information")
async def get_player(uuid: str, container: Container = Depends(get_container)) -> PlayerResponse:
    return await container.players.get_player(uuid)


@router.get(
    "/players/{uuid}/profiles",
    response_model=ProfilesResponse,
    summary="SkyBlock profiles for a player",
)
async def get_profiles(uuid: str, container: Container = Depends(get_container)) -> ProfilesResponse:
    return await container.players.get_profiles(uuid)


@router.get(
    "/profiles/{profile_id}",
    response_model=ProfileResponse,
    summary="SkyBlock profile details",
)
async def get_profile(profile_id: str, container: Container = Depends(get_container)) -> ProfileResponse:
    return await container.players.get_profile(profile_id)


@router.get(
    "/mojang/{name}",
    response_model=MojangProfile,
    summary="Resolve a Minecraft name to a UUID through Mojang",
)
async def resolve_mojang(name: str, container: Container = Depends(get_container)) -> MojangProfile:
    profile, _ = await container.mojang.resolve(name)
    return profile
