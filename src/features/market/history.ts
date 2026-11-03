import type { Analytics, MarketMeta } from "./models";
import type { HistoryPoint } from "@/data/types";
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
const std = (x: number[]) => Math.sqrt(mean(x.map((v) => (v - mean(x)) ** 2)));
export function analyseHistory(
  points: HistoryPoint[],
  meta: MarketMeta,
  id: string,
  range: string,
): Analytics {
  const seen = new Set<number>();
  const valid = points
    .filter(
      (p) =>
        [p.buy_price, p.sell_price].every((v) => Number.isFinite(v) && v > 0) &&
        Number.isFinite(Date.parse(p.ts)),
    )
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
    .filter((p) => {
      const t = Date.parse(p.ts);
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });
  const prices = valid.map((p) => p.buy_price),
    times = valid.map((p) => Date.parse(p.ts) / 1000),
    gap = range === "30d" ? 7200 : 1800;
  const observed = times.length > 1 ? times.at(-1)! - times[0]! : 0,
    sufficient = prices.length >= 12 && observed >= 3600;
  const returns = prices
    .slice(1)
    .flatMap((v, i) =>
      times[i + 1]! - times[i]! <= gap ? [Math.log(v / prices[i]!) * 100] : [],
    );
  const base = prices.slice(-25, -1),
    average = base.length >= 11 ? mean(base) : null,
    deviation = average !== null ? std(base) : null;
  const z =
    sufficient && deviation && average && deviation > average * 0.000001
      ? (prices.at(-1)! - average) / deviation
      : null;
  const result: Analytics = {
    product_id: id,
    range,
    points: [],
    samples: valid.length,
    sufficient,
    observed_seconds: observed,
    minimum: prices.length ? Math.min(...prices) : null,
    maximum: prices.length ? Math.max(...prices) : null,
    average: prices.length ? mean(prices) : null,
    volatility_pct: sufficient && returns.length >= 10 ? std(returns) : null,
    change_pct:
      prices.length >= 2 ? (prices.at(-1)! / prices[0]! - 1) * 100 : null,
    rolling_std: sufficient ? deviation : null,
    z_score: z,
    signals: [],
    flip: null,
    meta,
  };
  valid.forEach((p, i) => {
    if (i && times[i]! - times[i - 1]! > gap)
      result.points.push({
        ts: new Date(times[i - 1]! * 1000 + 1000).toISOString(),
        buy_price: null,
        sell_price: null,
        spread_pct: null,
      });
    result.points.push({
      ...p,
      spread_pct: ((p.buy_price - p.sell_price) / p.sell_price) * 100,
    });
  });
  if (
    sufficient &&
    returns.length >= 10 &&
    times.at(-1)! - times.at(-2)! <= gap
  ) {
    const change = (prices.at(-1)! / prices.at(-2)! - 1) * 100,
      period = times.at(-1)! - times[Math.max(0, times.length - 25)]!,
      updated = valid.at(-1)!.ts;
    const add = (kind: string, value: number, threshold: number) =>
      result.signals.push({
        kind,
        value,
        threshold,
        period_seconds: period,
        samples: base.length + 1,
        updated_at: updated,
        sufficient: true,
      });
    if (Math.abs(change) >= 10 && (z === null || Math.abs(z) >= 3))
      add("price_change", change, 10);
    const spreads = valid
        .slice(-25, -1)
        .map((p) => ((p.buy_price - p.sell_price) / p.sell_price) * 100),
      prior = mean(spreads),
      last = valid.at(-1)!,
      spread = ((last.buy_price - last.sell_price) / last.sell_price) * 100;
    if (spread > prior * 2 && spread - prior > 10)
      add("spread_expansion", spread, prior * 2);
    const volumes = valid
        .slice(-25, -1)
        .map((p) => p.buy_volume + p.sell_volume),
      volume = mean(volumes),
      current = last.buy_volume + last.sell_volume;
    if (volume > 0 && current / volume < 0.5)
      add("depth_drop", (current / volume - 1) * 100, -50);
  }
  return result;
}
