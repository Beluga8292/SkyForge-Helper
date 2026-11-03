import type { Analytics, Flip, MarketMeta } from "./models";
export type SmartReason =
  | "invalid_quote"
  | "crossed_book"
  | "stale"
  | "history_unknown"
  | "liquidity_unknown"
  | "large_position"
  | "position_unknown"
  | "price_jump"
  | "unstable_spread"
  | "unfilled_orders";
export interface BazaarEvidence {
  gross: number | null;
  fees: number | null;
  net: number | null;
  roi: number | null;
  ageMs: number | null;
  risk: number | null;
  rating: number | null;
  confidence: "limited" | "estimated";
  reasons: SmartReason[];
  fillTimeSeconds: null;
  positiveSpreadFraction: number | null;
  spreadDeviation: number | null;
  valid: boolean;
}
const finite = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
const positive = (x: unknown): x is number => finite(x) && x > 0;
const bounded = (x: number) => Math.min(100, Math.max(0, x));
const near = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-8;
/** Evidence on existing provider rows only; never fetches history per result. */
export function assessBazaar(
  row: Flip,
  meta: MarketMeta,
  history?: Analytics,
  now = Date.now(),
): BazaarEvidence {
  const reasons: SmartReason[] = [];
  const timestamps = [
    row.age_ms,
    meta.cache_age_ms,
    finite(meta.fetched_at_ms) ? Math.max(0, now - meta.fetched_at_ms) : NaN,
  ];
  const ageMs = timestamps.every((x) => finite(x) && x >= 0)
    ? Math.max(...timestamps)
    : null;
  if (meta.stale || ageMs === null || ageMs > 120000) reasons.push("stale");
  const quoted =
    positive(row.buy_price) &&
    positive(row.sell_price) &&
    Number.isSafeInteger(row.quantity) &&
    row.quantity >= 1 &&
    row.quantity <= 1e6 &&
    finite(row.tax_pct) &&
    row.tax_pct >= 0 &&
    row.tax_pct <= 10;
  const gross = quoted
    ? (row.sell_price! - row.buy_price!) * row.quantity
    : null;
  const fees = quoted
    ? (row.sell_price! * row.quantity * row.tax_pct) / 100
    : null;
  const net = gross !== null && fees !== null ? gross - fees : null;
  const cost = quoted ? row.buy_price! * row.quantity : null;
  const roi = cost && net !== null ? (net / cost) * 100 : null;
  const consistent =
    net !== null &&
    finite(row.net_profit) &&
    near(net, row.net_profit) &&
    finite(row.fees) &&
    near(fees!, row.fees * row.quantity) &&
    finite(row.position_cost) &&
    near(cost!, row.position_cost) &&
    [gross, fees, net, roi, cost].every(finite);
  if (!consistent) reasons.push("invalid_quote");
  // An inverted order book must not turn instant round-trips into spurious profit.
  if (finite(row.spread_pct) && row.spread_pct < 0)
    reasons.push("crossed_book");
  if (row.mode === "order") reasons.push("unfilled_orders");
  const depthKnown =
    finite(row.bid_depth) &&
    row.bid_depth >= 0 &&
    finite(row.ask_depth) &&
    row.ask_depth >= 0;
  const liquidityKnown =
    depthKnown &&
    finite(row.scores.liquidity) &&
    row.scores.liquidity >= 0 &&
    row.scores.liquidity <= 100 &&
    finite(row.weekly_activity) &&
    row.weekly_activity >= 0;
  if (!liquidityKnown) reasons.push("liquidity_unknown");
  if (!finite(row.position_share) || row.position_share < 0)
    reasons.push("position_unknown");
  else if (row.position_share > 0.1) reasons.push("large_position");
  const cachedVol = row.scores.explanation.volatility_pct;
  const currentHistory =
    history?.product_id === row.product_id &&
    history.sufficient &&
    !history.meta.stale &&
    finite(history.meta.fetched_at_ms) &&
    now - history.meta.fetched_at_ms <= 120000;
  const points = currentHistory
    ? history.points.filter(
        (p) =>
          positive(p.buy_price) &&
          positive(p.sell_price) &&
          Number.isFinite(Date.parse(p.ts)) &&
          Date.parse(p.ts) <= now,
      )
    : [];
  const unique = [
    ...new Map(points.map((p) => [Date.parse(p.ts), p])).values(),
  ].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const duration =
    unique.length > 1
      ? Date.parse(unique.at(-1)!.ts) - Date.parse(unique[0]!.ts)
      : 0;
  const sufficient =
    unique.length >= 12 &&
    duration >= 3600000 &&
    now - Date.parse(unique.at(-1)!.ts) <= 120000;
  const vol =
    sufficient &&
    finite(history!.volatility_pct) &&
    history!.volatility_pct! >= 0
      ? history!.volatility_pct
      : finite(cachedVol) && cachedVol >= 0
        ? cachedVol
        : null;
  if (!sufficient) reasons.push("history_unknown");
  const spreads = sufficient
    ? unique.map((p) => ((p.buy_price! - p.sell_price!) / p.sell_price!) * 100)
    : [];
  const average = spreads.length
    ? spreads.reduce((a, b) => a + b, 0) / spreads.length
    : null;
  const spreadDeviation =
    average === null
      ? null
      : Math.sqrt(
          spreads.reduce((sum, s) => sum + (s - average) ** 2, 0) /
            spreads.length,
        );
  const positiveSpreadFraction = spreads.length
    ? unique.filter(
        (p) => p.buy_price! * (1 - row.tax_pct / 100) > p.sell_price!,
      ).length / unique.length
    : null;
  if (positiveSpreadFraction !== null && positiveSpreadFraction < 0.8)
    reasons.push("unstable_spread");
  if (
    currentHistory &&
    history!.signals.some(
      (s) =>
        s.sufficient && ["price_change", "spread_expansion"].includes(s.kind),
    )
  )
    reasons.push("price_jump");
  const valid = consistent && !reasons.includes("crossed_book");
  const risk =
    valid &&
    liquidityKnown &&
    vol !== null &&
    ageMs !== null &&
    finite(row.position_share) &&
    row.position_share >= 0 &&
    finite(row.spread_pct)
      ? bounded(
          15 +
            Math.min(30, Math.abs(row.spread_pct ?? 0)) +
            Math.min(30, (row.position_share ?? 1) * 100) +
            Math.min(30, (ageMs / 120000) * 30) +
            Math.min(30, vol * 3) +
            (reasons.includes("price_jump") ? 20 : 0) +
            (reasons.includes("unstable_spread") ? 20 : 0),
        )
      : null;
  const rating =
    valid && risk !== null && !reasons.includes("stale")
      ? bounded(
          ((0.4 * bounded((roi ?? 0) * 5) +
            0.35 * bounded(row.scores.liquidity) +
            0.25 * (100 - risk)) *
            bounded(row.scores.liquidity)) /
            100,
        )
      : null;
  return {
    gross: valid ? gross : null,
    fees: valid ? fees : null,
    net: valid ? net : null,
    roi: valid ? roi : null,
    ageMs,
    risk,
    rating: valid && net !== null && net <= 0 ? 0 : rating,
    confidence:
      sufficient &&
      valid &&
      !reasons.includes("stale") &&
      liquidityKnown &&
      risk !== null
        ? "estimated"
        : "limited",
    reasons,
    fillTimeSeconds: null,
    positiveSpreadFraction,
    spreadDeviation,
    valid,
  };
}
export interface SmartPageFilter {
  maxRisk: number | null;
  maxAgeSeconds: number | null;
  sort: "provider" | "risk" | "freshness";
}
/** Scope is deliberately the returned page, never advertised as a global ranking. */
export function selectBazaarPage(
  rows: Flip[],
  meta: MarketMeta,
  filter: SmartPageFilter,
  now = Date.now(),
): Flip[] {
  return rows
    .map((row) => ({ row, e: assessBazaar(row, meta, undefined, now) }))
    .filter(
      ({ e }) =>
        e.valid &&
        (filter.maxRisk === null ||
          (e.risk !== null && e.risk <= filter.maxRisk)) &&
        (filter.maxAgeSeconds === null ||
          (!meta.stale &&
            e.ageMs !== null &&
            e.ageMs <= filter.maxAgeSeconds * 1000)),
    )
    .sort((a, b) =>
      filter.sort === "risk"
        ? (a.e.risk ?? 101) - (b.e.risk ?? 101)
        : filter.sort === "freshness"
          ? (a.e.ageMs ?? Number.MAX_VALUE) - (b.e.ageMs ?? Number.MAX_VALUE)
          : 0,
    )
    .map((x) => x.row);
}
