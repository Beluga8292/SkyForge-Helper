from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_container
from app.container import Container
from app.core.errors import InvalidRequestError
from app.schemas.api import AuctionResponse, AuctionsResponse

router = APIRouter(prefix="/auctions", tags=["auctions"])

SortOrder = Literal["ending_soon", "price_asc", "price_desc", "newest"]


@router.get("", response_model=AuctionsResponse, summary="Paged view of the current auction snapshot")
async def list_auctions(
    page: int = Query(default=0, ge=0, le=10000),
    page_size: int = Query(default=50, ge=1, le=100),
    bin_only: bool = Query(default=False),
    search: str | None = Query(default=None, max_length=64),
    sort: SortOrder = Query(default="ending_soon"),
    container: Container = Depends(get_container),
) -> AuctionsResponse:
    return await container.auctions.list_auctions(
        page=page,
        page_size=page_size,
        bin_only=bin_only,
        search=search,
        sort=sort,
    )


@router.get("/{auction_id}", response_model=AuctionResponse, summary="One auction from the snapshot")
async def get_auction(
    auction_id: str,
    container: Container = Depends(get_container),
) -> AuctionResponse:
    if not 8 <= len(auction_id) <= 64:
        raise InvalidRequestError("Invalid auction id", status_code=422)
    return await container.auctions.get_auction(auction_id)
