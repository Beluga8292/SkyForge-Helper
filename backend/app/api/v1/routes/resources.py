from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_container
from app.container import Container
from app.schemas.api import CollectionsResponse, ItemsResponse, SkillsResponse

router = APIRouter(prefix="/resources", tags=["resources"])


@router.get("/items", response_model=ItemsResponse, summary="SkyBlock item metadata")
async def get_items(container: Container = Depends(get_container)) -> ItemsResponse:
    return await container.resources.items()


@router.get("/skills", response_model=SkillsResponse, summary="SkyBlock skill XP tables")
async def get_skills(container: Container = Depends(get_container)) -> SkillsResponse:
    return await container.resources.skills()


@router.get(
    "/collections",
    response_model=CollectionsResponse,
    summary="SkyBlock collection metadata",
)
async def get_collections(container: Container = Depends(get_container)) -> CollectionsResponse:
    return await container.resources.collections()
