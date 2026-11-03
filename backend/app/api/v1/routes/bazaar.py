from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_container
from app.container import Container
from app.core.errors import InvalidRequestError
from app.schemas.api import BazaarProductResponse, BazaarResponse, HistoryRange, HistoryResponse

router = APIRouter(prefix="/bazaar", tags=["bazaar"])


@router.get("", response_model=BazaarResponse, summary="Current Bazaar prices")
async def get_bazaar(container: Container = Depends(get_container)) -> BazaarResponse:
    return await container.bazaar.get_bazaar()


@router.get(
    "/{product_id}/history",
    response_model=HistoryResponse,
    summary="Server-side price history for a Bazaar product",
)
async def get_bazaar_history(
    product_id: str,
    range: HistoryRange = Query(default=HistoryRange.DAY, alias="range"),
    container: Container = Depends(get_container),
) -> HistoryResponse:
    if not product_id or len(product_id) > 96:
        raise InvalidRequestError("Invalid Bazaar product id", status_code=422)
    return await container.bazaar.get_history(product_id.upper(), range)


@router.get("/{product_id}", response_model=BazaarProductResponse, summary="One Bazaar product")
async def get_bazaar_product(
    product_id: str,
    container: Container = Depends(get_container),
) -> BazaarProductResponse:
    if not product_id or len(product_id) > 96:
        raise InvalidRequestError("Invalid Bazaar product id", status_code=422)
    return await container.bazaar.get_product(product_id.upper())
