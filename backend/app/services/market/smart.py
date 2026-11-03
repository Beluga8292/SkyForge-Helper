"""Bounded post-valuation evidence; no snapshot reads or NBT work."""

import math


def evidence(row, age_ms, stale, fee_pct=None, listing_fee=None):
    valid = bool(
        row.get("confidence") != "insufficient"
        and row.get("match_key")
        and row.get("item_id")
        and row.get("count")
        and row.get("sample_size", 0) >= 5
    )
    reference, price = row.get("reference_price"), row.get("listing_price")
    valid = valid and all(isinstance(x, (int, float)) and math.isfinite(x) and x > 0 for x in [reference, price])
    net = None
    fee_known = (
        all(
            isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) for x in [fee_pct, listing_fee]
        )
        and 0 <= fee_pct <= 100
        and 0 <= listing_fee <= 1e12
    )
    if valid and fee_known:
        net = reference * (1 - fee_pct / 100) - price - listing_fee
    confidence = row.get("confidence", "insufficient")
    extreme = valid and reference > price * 5
    if extreme:
        confidence = "low"
    if stale or age_ms > 120000:
        confidence = "low" if valid else "insufficient"
    risk = None
    if valid and not stale and age_ms <= 120000 and confidence in ["high", "medium", "low"]:
        risk = min(
            100,
            max(
                0,
                {"high": 15, "medium": 35, "low": 65}[confidence]
                + min(20, age_ms / 120000 * 20)
                + max(0, 10 - row["sample_size"])
                + (20 if extreme else 0),
            ),
        )
    return {"confidence": confidence, "net": net, "roi": net / price * 100 if net is not None else None, "risk": risk}
