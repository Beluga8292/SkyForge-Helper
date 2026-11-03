from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query

from app.api.deps import get_container
from app.container import Container
from app.schemas.api import HistoryRange
from app.schemas.market import (
    Analytics,
    AuctionPage,
    FlipPage,
    FlipRequest,
    MarketOverview,
    MarketStatus,
    SignalsResponse,
    ValuationResponse,
)

router = APIRouter(prefix="/market", tags=["market"])
ProductId = Annotated[str, Path(min_length=1, max_length=96, pattern=r"^[A-Za-z0-9_:.-]+$")]


@router.get("/bazaar/flips", response_model=FlipPage)
async def flips(
    mode: Literal["order", "instant"] = "order",
    quantity: int = Query(64, ge=1, le=1_000_000),
    tax_pct: float = Query(1.25, ge=0, le=10, allow_inf_nan=False),
    page: int = Query(0, ge=0, le=10000),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query("", max_length=100),
    sort: Literal["score", "profit", "roi", "cost", "liquidity"] = "score",
    descending: bool = True,
    min_profit: float = Query(-1e15, ge=-1e15, le=1e15, allow_inf_nan=False),
    min_roi: float = Query(-100, ge=-100, le=1e9, allow_inf_nan=False),
    max_cost: float = Query(1e15, ge=0, le=1e15, allow_inf_nan=False),
    min_liquidity: float = Query(0, ge=0, le=100, allow_inf_nan=False),
    max_spread: float = Query(1e9, ge=0, le=1e9, allow_inf_nan=False),
    min_activity: float = Query(0, ge=0, le=1e18, allow_inf_nan=False),
    exclude_loss: bool = True,
    exclude_illiquid: bool = False,
    container: Container = Depends(get_container),
) -> FlipPage:
    return await container.market.flips(
        FlipRequest(mode=mode, quantity=quantity, tax_pct=tax_pct),
        page=page,
        page_size=page_size,
        search=search,
        sort=sort,
        descending=descending,
        min_profit=min_profit,
        min_roi=min_roi,
        max_cost=max_cost,
        min_liquidity=min_liquidity,
        max_spread=max_spread,
        min_activity=min_activity,
        exclude_loss=exclude_loss,
        exclude_illiquid=exclude_illiquid,
    )


@router.get("/bazaar/{product_id}/analytics", response_model=Analytics)
async def analytics(
    product_id: ProductId,
    range: HistoryRange = HistoryRange.DAY,
    mode: Literal["order", "instant"] = "order",
    quantity: int = Query(64, ge=1, le=1_000_000),
    tax_pct: float = Query(1.25, ge=0, le=10, allow_inf_nan=False),
    container: Container = Depends(get_container),
) -> Analytics:
    return await container.market.analytics(
        product_id.upper(), range, FlipRequest(mode=mode, quantity=quantity, tax_pct=tax_pct)
    )


@router.get("/bazaar/{product_id}/signals", response_model=SignalsResponse)
async def signals(
    product_id: ProductId, range: HistoryRange = HistoryRange.DAY, container: Container = Depends(get_container)
):
    response = await container.market.analytics(product_id.upper(), range, FlipRequest())
    return {
        "signals": response.signals,
        "sufficient": response.sufficient,
        "samples": response.samples,
        "meta": response.meta,
    }


@router.get("/auctions/opportunities", response_model=AuctionPage)
async def auctions(
    page: int = Query(0, ge=0, le=10000),
    page_size: int = Query(50, ge=1, le=100),
    search: str = Query("", max_length=100),
    min_discount: float = Query(0, ge=-100, le=100, allow_inf_nan=False),
    max_cost: float = Query(1e15, ge=0, le=1e15, allow_inf_nan=False),
    min_confidence: Literal["high", "medium", "low", "insufficient"] = "low",
    rarity: str | None = Query(None, max_length=30, pattern=r"^[A-Z_]+$"),
    min_remaining: int = Query(60, ge=0, le=86400),
    new_only: bool = False,
    sort: Literal["discount", "price", "newest", "reference"] = "discount",
    descending: bool = True,
    fee_pct: float | None = Query(None, ge=0, le=100, allow_inf_nan=False),
    listing_fee: float | None = Query(None, ge=0, le=1e12, allow_inf_nan=False),
    min_profit: float | None = Query(None, ge=-1e15, le=1e15, allow_inf_nan=False),
    min_roi: float | None = Query(None, ge=-100, le=1e9, allow_inf_nan=False),
    max_risk: float | None = Query(None, ge=0, le=100, allow_inf_nan=False),
    max_age_seconds: int | None = Query(None, ge=0, le=86400),
    container: Container = Depends(get_container),
) -> AuctionPage:
    return await container.market.auctions(
        page=page,
        page_size=page_size,
        search=search,
        min_discount=min_discount,
        max_cost=max_cost,
        min_confidence=min_confidence,
        rarity=rarity,
        min_remaining=min_remaining,
        new_only=new_only,
        sort=sort,
        descending=descending,
        fee_pct=fee_pct,
        listing_fee=listing_fee,
        min_profit=min_profit,
        min_roi=min_roi,
        max_risk=max_risk,
        max_age_seconds=max_age_seconds,
    )


@router.get("/auctions/{auction_id}/valuation", response_model=ValuationResponse)
async def valuation(
    auction_id: Annotated[str, Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")],
    container: Container = Depends(get_container),
):
    return await container.market.valuation(auction_id)


@router.get("/overview", response_model=MarketOverview)
async def overview(
    tax_pct: float = Query(1.25, ge=0, le=10, allow_inf_nan=False), container: Container = Depends(get_container)
):
    return await container.market.overview(FlipRequest(tax_pct=tax_pct))


@router.get("/status", response_model=MarketStatus)
async def status(container: Container = Depends(get_container)):
    bazaar, _ = await container.cache.get("bazaar")
    return {
        "algorithm": "market-v1",
        "auction_algorithm": "auction-v1",
        "bazaar_ready": bazaar is not None,
        "auctions": await container.auctions.snapshot_info(),
        "history": await container.history.stats(),
        "automated_trading": False,
    }
