from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path

from app.api.deps import get_container
from app.container import Container
from app.schemas.profile_analysis import Analysis
from app.services.intelligence.normalize import RULES
from app.services.intelligence.service import IntelligenceService

router = APIRouter(prefix="/intelligence", tags=["intelligence"])
UUID = Annotated[
    str,
    Path(pattern=r"^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"),
]


@router.get("/status")
async def status(container: Container = Depends(get_container)):
    return {
        "schema_version": "1",
        "rules_version": RULES["version"],
        "profile_key_configured": bool(container.settings.hypixel_api_key),
        "mode": "on_demand",
        "sources": RULES["sources"],
        "limitations": ["no_profile_polling", "partial_accessory_catalogue", "partial_networth"],
    }


@router.get("/players/{uuid}/profiles/{profile_id}/{section}", response_model=Analysis)
async def analysis(
    uuid: UUID,
    profile_id: UUID,
    section: Literal["overview", "recommendations", "accessories", "dungeons", "slayers", "pets", "networth"],
    market: bool = False,
    container: Container = Depends(get_container),
):
    # Every section uses one versioned domain document, preventing independent raw snapshots.
    return await IntelligenceService(container).overview(
        uuid.replace("-", "").lower(), profile_id.replace("-", "").lower(), market
    )
