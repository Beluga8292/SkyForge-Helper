import type { MarketMeta, Valuation } from "./models";
export interface AuctionEvidence {
  gross: number | null;
  fees: number | null;
  net: number | null;
  roi: number | null;
  risk: number | null;
  ageMs: number | null;
  confidence: Valuation["confidence"];
  reasons: Array<
    | "listing_only"
    | "fees_unknown"
    | "stale"
    | "partial"
    | "matching_unknown"
    | "comparables_low"
    | "dispersion_unknown"
    | "liquidity_unknown"
    | "extreme_discount"
  >;
}
const positive = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;
export function assessAuction(
  row: Valuation,
  meta: MarketMeta,
  feePct?: number,
  listingFee?: number,
  partial = false,
  now = Date.now(),
): AuctionEvidence {
  const reasons: AuctionEvidence["reasons"] = [
    "listing_only",
    "liquidity_unknown",
  ];
  const ageMs =
    [meta.fetched_at_ms, meta.cache_age_ms].every(Number.isFinite) &&
    meta.cache_age_ms >= 0
      ? Math.max(meta.cache_age_ms, Math.max(0, now - meta.fetched_at_ms))
      : null;
  const stale =
    meta.stale || ageMs === null || ageMs > 120000 || row.end <= now;
  if (stale) reasons.push("stale");
  if (partial) reasons.push("partial");
  const matched = Boolean(
    row.match_key && row.item_id && row.count && row.count > 0,
  );
  if (!matched) reasons.push("matching_unknown");
  const enough = Number.isInteger(row.sample_size) && row.sample_size >= 5;
  if (!enough) reasons.push("comparables_low");
  const extreme =
    row.reference_price !== null &&
    row.listing_price > 0 &&
    row.reference_price > row.listing_price * 5;
  if (extreme) reasons.push("extreme_discount");
  const valid =
    matched &&
    enough &&
    row.confidence !== "insufficient" &&
    positive(row.reference_price) &&
    positive(row.listing_price);
  const gross = valid ? row.reference_price! - row.listing_price : null;
  const feeKnown =
    typeof feePct === "number" &&
    Number.isFinite(feePct) &&
    feePct >= 0 &&
    feePct <= 100 &&
    typeof listingFee === "number" &&
    Number.isFinite(listingFee) &&
    listingFee >= 0 &&
    listingFee <= 1e12;
  if (!feeKnown) reasons.push("fees_unknown");
  const fees =
    valid && feeKnown
      ? (row.reference_price! * feePct!) / 100 + listingFee!
      : null;
  const net = gross !== null && fees !== null ? gross - fees : null;
  const roi = net !== null ? (net / row.listing_price) * 100 : null;
  let confidence: Valuation["confidence"] = !valid
    ? "insufficient"
    : row.confidence;
  if (stale || partial || extreme) confidence = valid ? "low" : "insufficient";
  // This is valuation uncertainty, not resale liquidity/probability. Existing
  // confidence already incorporates seller count and IQR dispersion.
  const risk =
    valid && !stale && !partial && confidence !== "insufficient"
      ? Math.min(
          100,
          Math.max(
            0,
            { high: 15, medium: 35, low: 65 }[confidence] +
              Math.min(20, (ageMs! / 120000) * 20) +
              Math.max(0, 10 - row.sample_size) +
              (extreme ? 20 : 0),
          ),
        )
      : null;
  reasons.push("dispersion_unknown"); // the legacy contract exposes no numeric IQR
  return { gross, fees, net, roi, risk, ageMs, confidence, reasons };
}
export interface AuctionSmartFilters {
  min_confidence?: Valuation["confidence"];
  min_profit?: number;
  min_roi?: number;
  max_risk?: number;
  max_age_seconds?: number;
}
export function selectAuctionPage(
  rows: Valuation[],
  meta: MarketMeta,
  filters: AuctionSmartFilters,
  fees: { fee_pct?: number; listing_fee?: number },
  partial = false,
  sort: "provider" | "profit" | "roi" | "risk" = "provider",
  now = Date.now(),
): Valuation[] {
  const data = rows
    .map((row) => ({
      row,
      e: assessAuction(row, meta, fees.fee_pct, fees.listing_fee, partial, now),
    }))
    .filter(
      ({ e }) =>
        ({ insufficient: 0, low: 1, medium: 2, high: 3 })[e.confidence] >=
          { insufficient: 0, low: 1, medium: 2, high: 3 }[
            filters.min_confidence ?? "insufficient"
          ] &&
        (filters.min_profit === undefined ||
          (e.net !== null && e.net >= filters.min_profit)) &&
        (filters.min_roi === undefined ||
          (e.roi !== null && e.roi >= filters.min_roi)) &&
        (filters.max_risk === undefined ||
          (e.risk !== null && e.risk <= filters.max_risk)) &&
        (filters.max_age_seconds === undefined ||
          (!meta.stale &&
            e.ageMs !== null &&
            e.ageMs <= filters.max_age_seconds * 1000)),
    );
  if (sort !== "provider")
    data.sort((a, b) =>
      sort === "risk"
        ? (a.e.risk ?? 101) - (b.e.risk ?? 101)
        : (b.e[sort === "roi" ? "roi" : "net"] ?? -Number.MAX_VALUE) -
          (a.e[sort === "roi" ? "roi" : "net"] ?? -Number.MAX_VALUE),
    );
  return data.map((x) => x.row);
}
