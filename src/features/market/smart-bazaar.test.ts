import { describe, it, expect } from "vitest";
import { calculateMarketFlip } from "./engine";
import { assessBazaar, selectBazaarPage } from "./smart-bazaar";
import type { BazaarProduct } from "@/types/hypixel";
import type { Analytics, MarketMeta } from "./models";
const now = 1700000000000;
const meta: MarketMeta = {
  fetched_at: new Date(now).toISOString(),
  fetched_at_ms: now,
  cache_age_ms: 0,
  stale: false,
  source: "cache",
};
const product: BazaarProduct = {
  product_id: "X",
  buy_summary: [{ pricePerUnit: 120, amount: 100000, orders: 10 }],
  sell_summary: [{ pricePerUnit: 100, amount: 100000, orders: 10 }],
  quick_status: {
    productId: "X",
    buyPrice: 120,
    sellPrice: 100,
    buyVolume: 100000,
    sellVolume: 100000,
    buyMovingWeek: 1000000,
    sellMovingWeek: 1000000,
    buyOrders: 10,
    sellOrders: 10,
  },
};
const row = () => calculateMarketFlip("X", product, "order", 64, 1.25);
function history(): Analytics {
  return {
    product_id: "X",
    range: "24h",
    sufficient: true,
    samples: 13,
    observed_seconds: 3600,
    points: Array.from({ length: 13 }, (_, i) => ({
      ts: new Date(now - (12 - i) * 300000).toISOString(),
      buy_price: 120,
      sell_price: 100,
      spread_pct: 20,
    })),
    volatility_pct: 0,
    minimum: 100,
    maximum: 100,
    average: 100,
    rolling_std: 0,
    z_score: null,
    change_pct: 0,
    signals: [],
    flip: null,
    meta,
  };
}
describe("Smart Bazaar evidence", () => {
  it("distinguishes gross spread, sale tax and net position profit", () => {
    const e = assessBazaar(row(), meta, undefined, now);
    expect(e.gross).toBe(1280);
    expect(e.fees).toBe(96);
    expect(e.net).toBe(1184);
    expect(e.roi).toBe(18.5);
  });
  it("keeps risk, confidence and execution time unknown without history", () => {
    const e = assessBazaar(row(), meta, undefined, now);
    expect(e.risk).toBeNull();
    expect(e.rating).toBeNull();
    expect(e.confidence).toBe("limited");
    expect(e.fillTimeSeconds).toBeNull();
  });
  it("uses sufficient observed history for spread persistence without claiming fills", () => {
    const e = assessBazaar(row(), meta, history(), now);
    expect(e.positiveSpreadFraction).toBe(1);
    expect(e.spreadDeviation).toBe(0);
    expect(e.rating).not.toBeNull();
    expect(e.confidence).toBe("estimated");
    expect(e.fillTimeSeconds).toBeNull();
  });
  it("does not let one snapshot or stale history establish persistence", () => {
    const h = history();
    h.points = h.points.slice(-1);
    expect(assessBazaar(row(), meta, h, now).positiveSpreadFraction).toBeNull();
    h.points = history().points;
    h.meta = { ...meta, stale: true };
    expect(assessBazaar(row(), meta, h, now).confidence).toBe("limited");
  });
  it("rejects mismatched-history product identity", () => {
    const h = history();
    h.product_id = "OTHER";
    expect(assessBazaar(row(), meta, h, now).positiveSpreadFraction).toBeNull();
  });
  it("handles instant round-trip losses and insufficient depth", () => {
    const r = calculateMarketFlip("X", product, "instant", 64, 1.25);
    expect(assessBazaar(r, meta, undefined, now).net).toBe(-1360);
    const low = {
      ...product,
      buy_summary: [{ pricePerUnit: 120, amount: 1, orders: 1 }],
    };
    expect(
      assessBazaar(
        calculateMarketFlip("X", low, "instant", 64, 1.25),
        meta,
        undefined,
        now,
      ).valid,
    ).toBe(false);
  });
  it("excludes inverted books rather than presenting an instant arbitrage", () => {
    const crossed = {
      ...product,
      buy_summary: [{ pricePerUnit: 90, amount: 100000, orders: 1 }],
    };
    const e = assessBazaar(
      calculateMarketFlip("X", crossed, "instant", 64, 0),
      meta,
      undefined,
      now,
    );
    expect(e.valid).toBe(false);
    expect(e.net).toBeNull();
    expect(e.reasons).toContain("crossed_book");
  });
  it("rejects malformed financial arithmetic and never exposes nonfinite totals", () => {
    for (const r of [
      { ...row(), net_profit: 999999 },
      { ...row(), buy_price: NaN },
      { ...row(), sell_price: Infinity },
    ]) {
      const e = assessBazaar(r, meta, undefined, now);
      expect(e.valid).toBe(false);
      expect(e.net).toBeNull();
      expect(e.rating).toBeNull();
    }
  });
  it("treats zero volume differently from missing volume", () => {
    const zero = { ...row(), weekly_activity: 0 };
    expect(assessBazaar(zero, meta, undefined, now).reasons).not.toContain(
      "liquidity_unknown",
    );
    expect(
      assessBazaar({ ...row(), weekly_activity: null }, meta, undefined, now)
        .reasons,
    ).toContain("liquidity_unknown");
  });
  it("marks stale snapshots and preserves valid prices without a confident rating", () => {
    const e = assessBazaar(row(), { ...meta, stale: true }, history(), now);
    expect(e.net).toBe(1184);
    expect(e.rating).toBeNull();
    expect(e.reasons).toContain("stale");
  });
  it("detects unstable tax-adjusted spreads and jump signals", () => {
    const h = history();
    h.points = h.points.map((p, i) => ({ ...p, buy_price: i % 2 ? 100 : 120 }));
    h.signals = [
      {
        kind: "price_change",
        sufficient: true,
        value: 50,
        threshold: 10,
        period_seconds: 3600,
        samples: 13,
        updated_at: meta.fetched_at,
      },
    ];
    const e = assessBazaar(row(), meta, h, now);
    expect(e.reasons).toContain("unstable_spread");
    expect(e.reasons).toContain("price_jump");
  });
  it("does not mask invalid liquidity scores or missing position share", () => {
    const invalid = { ...row(), scores: { ...row().scores, liquidity: NaN } };
    expect(assessBazaar(invalid, meta, history(), now).rating).toBeNull();
    const missing = { ...row(), position_share: null };
    expect(assessBazaar(missing, meta, history(), now).risk).toBeNull();
    expect(assessBazaar(missing, meta, history(), now).reasons).toContain(
      "position_unknown",
    );
  });
  it("filters only the supplied page, preserving provider order and excluding unknown risks explicitly", () => {
    const rows = [
      row(),
      {
        ...row(),
        product_id: "B",
        scores: {
          ...row().scores,
          explanation: { ...row().scores.explanation, volatility_pct: 0 },
        },
      },
    ];
    expect(
      selectBazaarPage(
        rows,
        meta,
        { maxRisk: null, maxAgeSeconds: null, sort: "provider" },
        now,
      ).map((r) => r.product_id),
    ).toEqual(["X", "B"]);
    expect(
      selectBazaarPage(
        rows,
        meta,
        { maxRisk: 100, maxAgeSeconds: null, sort: "provider" },
        now,
      ).map((r) => r.product_id),
    ).toEqual(["B"]);
    expect(
      selectBazaarPage(
        rows,
        { ...meta, stale: true },
        { maxRisk: null, maxAgeSeconds: 120, sort: "freshness" },
        now,
      ),
    ).toEqual([]);
  });
  it("accepts zero spread, high configured fees and a large position without NaN", () => {
    const p = {
      ...product,
      buy_summary: [{ pricePerUnit: 100, amount: 1000000, orders: 1 }],
    };
    const e = assessBazaar(
      calculateMarketFlip("X", p, "order", 1000000, 10),
      meta,
      undefined,
      now,
    );
    expect(e.net).toBe(-10000000);
    expect(e.reasons).toContain("large_position");
  });
});
