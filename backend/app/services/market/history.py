from __future__ import annotations

import math
import statistics
from datetime import UTC, datetime

from app.schemas.market import Signal


def analyse(points: list[dict], *, max_gap_seconds: float = 1800) -> dict:
    clean = []
    for row in points:
        ts = row["ts"]
        ts = datetime.fromisoformat(ts.replace("Z", "+00:00")) if isinstance(ts, str) else ts
        ts = ts.replace(tzinfo=UTC) if ts.tzinfo is None else ts
        buy, sell = row.get("buy_price"), row.get("sell_price")
        if all(isinstance(v, int | float) and math.isfinite(v) and v > 0 for v in (buy, sell)):
            clean.append({**row, "ts": ts.isoformat(), "time": ts.timestamp(), "spread_pct": (buy - sell) / sell * 100})
    clean.sort(key=lambda p: p["time"])
    seen = set()
    clean = [p for p in clean if not (p["time"] in seen or seen.add(p["time"]))]
    prices = [p["buy_price"] for p in clean]
    times = [p["time"] for p in clean]
    observed = times[-1] - times[0] if len(times) > 1 else 0
    sufficient = len(prices) >= 12 and observed >= 3600
    returns = [
        math.log(prices[i] / prices[i - 1]) * 100
        for i in range(1, len(prices))
        if 0 < times[i] - times[i - 1] <= max_gap_seconds
    ]
    vol = statistics.pstdev(returns) if sufficient and len(returns) >= 10 else None
    baseline = prices[-25:-1]
    avg = statistics.mean(baseline) if len(baseline) >= 11 else None
    std = statistics.pstdev(baseline) if avg is not None else None
    z = (prices[-1] - avg) / std if sufficient and std and std > avg * 0.000001 else None
    signals = []
    period = times[-1] - times[max(0, len(times) - 25)] if times else 0
    if sufficient and len(returns) >= 10 and times[-1] - times[-2] <= max_gap_seconds:
        change = (prices[-1] / prices[-2] - 1) * 100
        if abs(change) >= 10 and (z is None or abs(z) >= 3):
            signals.append(
                Signal(
                    kind="price_change",
                    value=change,
                    threshold=10,
                    period_seconds=period,
                    samples=len(baseline) + 1,
                    updated_at=clean[-1]["ts"],
                    sufficient=True,
                )
            )
        old_spreads = [p["spread_pct"] for p in clean[-25:-1]]
        prior_spread = statistics.mean(old_spreads)
        spread = clean[-1]["spread_pct"]
        if spread > prior_spread * 2 and spread - prior_spread > 10:
            signals.append(
                Signal(
                    kind="spread_expansion",
                    value=spread,
                    threshold=prior_spread * 2,
                    period_seconds=period,
                    samples=len(old_spreads) + 1,
                    updated_at=clean[-1]["ts"],
                    sufficient=True,
                )
            )
        old_volume = [p.get("buy_volume", 0) + p.get("sell_volume", 0) for p in clean[-25:-1]]
        prior_volume = statistics.mean(old_volume)
        current = clean[-1].get("buy_volume", 0) + clean[-1].get("sell_volume", 0)
        if prior_volume > 0 and current / prior_volume < 0.5:
            signals.append(
                Signal(
                    kind="depth_drop",
                    value=(current / prior_volume - 1) * 100,
                    threshold=-50,
                    period_seconds=period,
                    samples=len(old_volume) + 1,
                    updated_at=clean[-1]["ts"],
                    sufficient=True,
                )
            )
    output = []
    for i, p in enumerate(clean):
        if i and p["time"] - clean[i - 1]["time"] > max_gap_seconds:
            output.append(
                {
                    "ts": datetime.fromtimestamp(clean[i - 1]["time"] + 1, UTC).isoformat(),
                    "buy_price": None,
                    "sell_price": None,
                    "spread_pct": None,
                }
            )
        output.append({k: v for k, v in p.items() if k != "time"})
    return {
        "points": output,
        "samples": len(clean),
        "sufficient": sufficient,
        "observed_seconds": observed,
        "minimum": min(prices) if prices else None,
        "maximum": max(prices) if prices else None,
        "average": statistics.mean(prices) if prices else None,
        "volatility_pct": vol,
        "rolling_std": std if sufficient else None,
        "z_score": z,
        "change_pct": (prices[-1] / prices[0] - 1) * 100 if len(prices) >= 2 else None,
        "signals": signals,
    }
