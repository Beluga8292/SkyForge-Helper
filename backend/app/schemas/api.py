from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LooseModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class Meta(StrictModel):
    fetched_at: datetime
    fetched_at_ms: int
    cache_age_ms: int
    stale: bool = False
    source: Literal["upstream", "cache", "memory", "database", "demo"]
    snapshot_id: str | None = None
    revalidate_error: str | None = None


class ErrorBody(StrictModel):
    code: str
    message: str
    request_id: str | None = None
    retry_after_seconds: int | None = None
    details: dict[str, Any] | None = None


class ErrorResponse(StrictModel):
    error: ErrorBody


class BazaarOrder(LooseModel):
    amount: float = 0
    pricePerUnit: float = 0
    orders: int = 0


class BazaarQuickStatus(LooseModel):
    productId: str
    buyPrice: float
    sellPrice: float
    buyVolume: float = 0
    sellVolume: float = 0
    buyMovingWeek: float = 0
    sellMovingWeek: float = 0
    buyOrders: int = 0
    sellOrders: int = 0


class BazaarProduct(LooseModel):
    product_id: str
    sell_summary: list[BazaarOrder] = Field(default_factory=list)
    buy_summary: list[BazaarOrder] = Field(default_factory=list)
    quick_status: BazaarQuickStatus | None = None


class BazaarUpstream(LooseModel):
    success: bool = True
    lastUpdated: int
    products: dict[str, BazaarProduct]


class BazaarResponse(StrictModel):
    success: bool = True
    lastUpdated: int
    products: dict[str, BazaarProduct]
    meta: Meta


class BazaarProductResponse(StrictModel):
    success: bool = True
    product: BazaarProduct
    meta: Meta


class HistoryRange(StrEnum):
    HOUR = "1h"
    DAY = "24h"
    WEEK = "7d"
    MONTH = "30d"


class HistoryPoint(StrictModel):
    ts: datetime
    buy_price: float
    sell_price: float
    buy_volume: float
    sell_volume: float


class HistoryResponse(StrictModel):
    success: bool = True
    product_id: str
    range: HistoryRange
    interval: str
    points: list[HistoryPoint]
    meta: Meta
    note: str | None = None


class AuctionItem(LooseModel):
    uuid: str
    item_name: str | None = None
    tier: str | None = None
    category: str | None = None
    starting_bid: float | None = None
    highest_bid_amount: float | None = None
    bin: bool = False
    end: int | None = None
    start: int | None = None
    auctioneer: str | None = None
    profile_id: str | None = None
    item_lore: str | None = None
    bids: list[dict[str, Any]] = Field(default_factory=list)


class AuctionsUpstream(LooseModel):
    success: bool = True
    page: int = 0
    totalPages: int = 1
    totalAuctions: int = 0
    lastUpdated: int | None = None
    auctions: list[AuctionItem]


class AuctionsResponse(StrictModel):
    success: bool = True
    page: int
    page_size: int
    total_pages: int
    total_auctions: int
    filtered_total: int
    search_version: int = 1
    snapshot_complete: bool | None = None
    snapshot_pages: int = 0
    expected_auctions: int | None = None
    identity_indexed: int = 0
    categories: list[str] = Field(default_factory=list)
    sort: str
    lastUpdated: int | None
    auctions: list[AuctionItem]
    meta: Meta


class AuctionResponse(StrictModel):
    success: bool = True
    auction: AuctionItem
    meta: Meta


class ProfileMember(LooseModel):
    player_id: str | None = None
    last_save: int | None = None
    first_join: int | None = None


class SkyBlockProfile(LooseModel):
    profile_id: str
    cute_name: str | None = None
    game_mode: str | None = None
    selected: bool | None = None
    members: dict[str, ProfileMember]
    banking: dict[str, Any] | None = None


class ProfilesUpstream(LooseModel):
    success: bool = True
    profiles: list[SkyBlockProfile] | None


class ProfilesResponse(StrictModel):
    success: bool = True
    profiles: list[SkyBlockProfile]
    meta: Meta


class ProfileResponse(StrictModel):
    success: bool = True
    profile: SkyBlockProfile
    meta: Meta


class HypixelPlayer(LooseModel):
    uuid: str | None = None
    displayname: str | None = None


class PlayerUpstream(LooseModel):
    success: bool = True
    player: HypixelPlayer | None


class PlayerResponse(StrictModel):
    success: bool = True
    player: HypixelPlayer | None
    meta: Meta


class MojangProfile(StrictModel):
    id: str
    name: str


class ItemsUpstream(LooseModel):
    success: bool = True
    lastUpdated: int | None = None
    items: list[dict[str, Any]]


class SkillsUpstream(LooseModel):
    success: bool = True
    lastUpdated: int | None = None
    version: str | None = None
    skills: dict[str, dict[str, Any]]


class CollectionsUpstream(LooseModel):
    success: bool = True
    lastUpdated: int | None = None
    version: str | None = None
    collections: dict[str, Any]


class ItemsResponse(StrictModel):
    success: bool = True
    lastUpdated: int | None
    items: list[dict[str, Any]]
    meta: Meta


class SkillsResponse(StrictModel):
    success: bool = True
    lastUpdated: int | None
    version: str | None
    skills: dict[str, dict[str, Any]]
    meta: Meta


class CollectionsResponse(StrictModel):
    success: bool = True
    lastUpdated: int | None
    version: str | None
    collections: dict[str, Any]
    meta: Meta


class ServiceState(StrictModel):
    status: Literal["ok", "degraded", "unavailable", "not_configured"]
    detail: str | None = None


class StatusResponse(StrictModel):
    status: Literal["ok", "degraded"]
    version: str
    environment: str
    request_id: str | None
    services: dict[str, ServiceState]
    cache: dict[str, Any]
    rate_limit: dict[str, Any]
    history: dict[str, Any]
    metrics: dict[str, Any]
    config: dict[str, Any]


class HealthResponse(StrictModel):
    status: Literal["ok"]
    version: str
