"""Pure analytics. Hypixel buy_summary = asks; sell_summary = bids.

quick_status prices are weighted top-2% estimates, not executable quotes.
"""

from __future__ import annotations

import math
from typing import Any

from app.schemas.market import Flip, FlipRequest, Scores


def number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return float(value) if math.isfinite(value) and 0 <= value <= 1e18 else None


def book(raw: Any, *, bids: bool) -> list[tuple[float, float]]:
    if not isinstance(raw, list):
        return []
    rows = []
    for level in raw[:30]:
        if not isinstance(level, dict):
            continue
        price, amount = number(level.get("pricePerUnit")), number(level.get("amount"))
        if price is not None and amount is not None and price > 0 and amount > 0:
            rows.append((price, amount))
    return sorted(rows, reverse=bids)


def vwap(levels: list[tuple[float, float]], quantity: int) -> float | None:
    left, total = float(quantity), 0.0
    for price, amount in levels:
        take = min(left, amount)
        total += take * price
        left -= take
        if left <= 0:
            return total / quantity
    return None


def calculate(
    product_id: str,
    product: dict,
    request: FlipRequest,
    *,
    age_ms: int = 0,
    name: str | None = None,
    volatility_pct: float | None = None,
) -> Flip:
    bids = book(product.get("sell_summary"), bids=True)
    asks = book(product.get("buy_summary"), bids=False)
    quick = product.get("quick_status") or {}
    bid_depth = sum(x[1] for x in bids) if bids else None
    ask_depth = sum(x[1] for x in asks) if asks else None
    risks = []
    buy = bids[0][0] if bids else None
    sell = asks[0][0] if asks else None
    spread = (sell - buy) / buy * 100 if buy and sell else None
    impact = None
    if request.mode == "instant":
        buy, sell = vwap(asks, request.quantity), vwap(bids, request.quantity)
        if buy and sell:
            impact = max(0, ((buy / asks[0][0] - 1) + (1 - sell / bids[0][0])) * 100)
    else:
        risks.append("unfilled_orders")
    if buy is None or sell is None:
        risks.append("insufficient_depth")
    weekly_buy, weekly_sell = number(quick.get("buyMovingWeek")), number(quick.get("sellMovingWeek"))
    activity = min(weekly_buy, weekly_sell) if weekly_buy is not None and weekly_sell is not None else None
    depth = min(bid_depth, ask_depth) if bid_depth is not None and ask_depth is not None else None
    share = request.quantity / depth if depth else None
    imbalance = (bid_depth - ask_depth) / (bid_depth + ask_depth) if bid_depth and ask_depth else None
    gross = sell - buy if buy and sell else None
    fee = sell * request.tax_pct / 100 if sell else None
    net = gross - fee if gross is not None and fee is not None else None
    roi = net / buy * 100 if buy and net is not None else None
    if activity is None or activity < 10_000 or depth is None or depth < request.quantity * 10:
        risks.append("low_liquidity")
    if share is None or share > 0.1:
        risks.append("large_position")
    if age_ms > 120_000:
        risks.append("stale")
    if spread is not None and spread > 50:
        risks.append("wide_spread")
    if net is not None and net <= 0:
        risks.append("unprofitable")
    if volatility_pct is None:
        risks.append("unknown_volatility")

    def clamp(v: float) -> float:
        return max(0.0, min(100.0, v))

    profit = clamp((roi or 0) * 5)
    activity_score = clamp(math.log10(1 + (activity or 0)) / 6 * 100)
    depth_score = clamp((depth or 0) / (request.quantity * 100) * 100)
    liquidity = min(activity_score, depth_score)
    risk = clamp(
        15
        + min(40, max(0, spread or 0))
        + min(30, (share or 1) * 100)
        + min(30, age_ms / 120_000 * 30)
        + (15 if volatility_pct is None else min(30, volatility_pct * 3))
    )
    overall = clamp((0.4 * profit + 0.35 * liquidity + 0.25 * (100 - risk)) * liquidity / 100)
    if net is None or net <= 0:
        overall = 0
    stack_net = net * 64 if net is not None else None
    if request.mode == "instant":
        stack_buy, stack_sell = vwap(asks, 64), vwap(bids, 64)
        stack_net = (stack_sell * (1 - request.tax_pct / 100) - stack_buy) * 64 if stack_buy and stack_sell else None
    return Flip(
        product_id=product_id,
        name=name or product_id,
        mode=request.mode,
        quantity=request.quantity,
        buy_price=buy,
        sell_price=sell,
        gross_margin=gross,
        fees=fee,
        tax_pct=request.tax_pct,
        net_per_item=net,
        net_per_stack=stack_net,
        net_profit=net * request.quantity if net is not None else None,
        roi=roi,
        position_cost=buy * request.quantity if buy else None,
        break_even=buy / (1 - request.tax_pct / 100) if buy else None,
        bid_depth=bid_depth,
        ask_depth=ask_depth,
        buy_volume=number(quick.get("buyVolume")),
        sell_volume=number(quick.get("sellVolume")),
        buy_orders=number(quick.get("buyOrders")),
        sell_orders=number(quick.get("sellOrders")),
        weekly_activity=activity,
        imbalance=imbalance,
        spread_pct=spread,
        position_share=share,
        price_impact_pct=impact,
        age_ms=age_ms,
        risks=risks,
        scores=Scores(
            profit=profit,
            liquidity=liquidity,
            risk=risk,
            overall=overall,
            explanation={
                "profit_weight": 0.4,
                "liquidity_weight": 0.35,
                "risk_weight": 0.25,
                "activity": activity_score,
                "depth": depth_score,
                "volatility_pct": volatility_pct,
            },
        ),
    )
