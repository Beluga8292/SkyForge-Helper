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
    auction_type: Literal["all", "bin", "auction"] = Query(default="all"),
    rarity: str | None = Query(default=None, max_length=24),
    category: str | None = Query(default=None, max_length=32),
    min_price: float | None = Query(default=None, ge=0, le=1e15, allow_inf_nan=False),
    max_price: float | None = Query(default=None, ge=0, le=1e15, allow_inf_nan=False),
    ending_within: int | None = Query(default=None, ge=1, le=604800),
    container: Container = Depends(get_container),
) -> AuctionsResponse:
    if min_price is not None and max_price is not None and min_price > max_price:
        raise InvalidRequestError("Minimum price exceeds maximum price", status_code=422)
    return await container.auctions.list_auctions(
        page=page,
        page_size=page_size,
        bin_only=bin_only,
        search=search,
        sort=sort,
        auction_type=auction_type,
        rarity=rarity,
        category=category,
        min_price=min_price,
        max_price=max_price,
        ending_within=ending_within,
    )


@router.get("/{auction_id}", response_model=AuctionResponse, summary="One auction from the snapshot")
async def get_auction(
    auction_id: str,
    container: Container = Depends(get_container),
) -> AuctionResponse:
    if not 8 <= len(auction_id) <= 64:
        raise InvalidRequestError("Invalid auction id", status_code=422)
    return await container.auctions.get_auction(auction_id)
