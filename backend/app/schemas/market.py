from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.api import Meta


class MarketModel(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)


class FlipRequest(MarketModel):
    mode: Literal["order", "instant"] = "order"
    quantity: int = Field(default=64, ge=1, le=1_000_000)
    tax_pct: float = Field(default=1.25, ge=0, le=10)


class Scores(MarketModel):
    profit: float
    liquidity: float
    risk: float
    overall: float
    explanation: dict[str, float | None]


class Flip(MarketModel):
    product_id: str
    name: str
    mode: Literal["order", "instant"]
    quantity: int
    buy_price: float | None
    sell_price: float | None
    gross_margin: float | None
    fees: float | None
    tax_pct: float
    net_per_item: float | None
    net_per_stack: float | None
    net_profit: float | None
    roi: float | None
    position_cost: float | None
    break_even: float | None
    bid_depth: float | None
    ask_depth: float | None
    buy_volume: float | None
    sell_volume: float | None
    buy_orders: float | None
    sell_orders: float | None
    weekly_activity: float | None
    imbalance: float | None
    spread_pct: float | None
    position_share: float | None
    price_impact_pct: float | None
    age_ms: int
    risks: list[str]
    scores: Scores


class FlipPage(MarketModel):
    items: list[Flip]
    total: int
    page: int
    page_size: int
    snapshot_id: str
    algorithm: str = "market-v1"
    meta: Meta


class Signal(MarketModel):
    kind: str
    value: float
    threshold: float
    period_seconds: float
    samples: int
    updated_at: str
    sufficient: bool


class Analytics(MarketModel):
    product_id: str
    range: str
    points: list[dict[str, float | str | None]]
    samples: int
    sufficient: bool
    observed_seconds: float
    minimum: float | None
    maximum: float | None
    average: float | None
    volatility_pct: float | None
    change_pct: float | None
    rolling_std: float | None
    z_score: float | None
    signals: list[Signal]
    flip: Flip | None
    meta: Meta


class Valuation(MarketModel):
    auction_id: str
    item_id: str | None
    name: str
    rarity: str | None
    count: int | None
    listing_price: float
    reference_price: float | None
    difference: float | None
    discount_pct: float | None
    net_upside: float | None
    confidence: Literal["high", "medium", "low", "insufficient"]
    sample_size: int
    comparable_ids: list[str]
    match_key: str | None
    modifiers: dict[str, str]
    end: int
    start: int
    reason: str


class AuctionPage(MarketModel):
    smart_filters_applied: bool = False
    items: list[Valuation]
    total: int
    page: int
    page_size: int
    snapshot_id: str
    algorithm: str = "auction-v1"
    partial: bool = False
    analysis_limited: bool = False
    meta: Meta


class SignalsResponse(MarketModel):
    signals: list[Signal]
    sufficient: bool
    samples: int
    meta: Meta


class ValuationResponse(MarketModel):
    valuation: Valuation
    snapshot_id: str
    meta: Meta


class PriceChange(MarketModel):
    product_id: str
    change_pct: float
    ts: str


class MarketSignal(Signal):
    product_id: str


class MarketOverview(MarketModel):
    bazaar: FlipPage
    largest_changes: list[PriceChange]
    signals: list[MarketSignal]
    history_available: bool
    meta: Meta


class MarketStatus(MarketModel):
    algorithm: str
    auction_algorithm: str
    bazaar_ready: bool
    auctions: dict
    history: dict
    automated_trading: bool
