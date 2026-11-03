import { demoProvider } from "@/data/demo";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { calculateMarketFlip, filterFlips, scenario } from "./engine";
import { analyseHistory } from "./history";
import { evaluateRules, type AlertRule } from "./alerts";
import { valueAuctions, type AuctionIdentity } from "./auction-engine";
import { DEFAULT_FILTERS, type MarketMeta } from "./models";
import { localMarketProvider } from "./local-provider";
import { dictionaries } from "@/locales";
import type { BazaarProduct, HypixelAuction } from "@/types/hypixel";
import type { DataProvider } from "@/data/types";

const product: BazaarProduct = {
  product_id: "X",
  buy_summary: [{ amount: 100000, pricePerUnit: 120, orders: 20 }],
  sell_summary: [{ amount: 100000, pricePerUnit: 100, orders: 20 }],
  quick_status: {
    productId: "X",
    buyPrice: 999,
    sellPrice: 1,
    buyVolume: 100000,
    sellVolume: 100000,
    buyMovingWeek: 1000000,
    sellMovingWeek: 1000000,
    buyOrders: 20,
    sellOrders: 20,
  },
};
const flip = () => calculateMarketFlip("X", product, "order", 64, 1.25);
const meta: MarketMeta = {
  fetched_at: new Date().toISOString(),
  fetched_at_ms: Date.now(),
  cache_age_ms: 0,
  stale: false,
  source: "upstream",
};
const rule = (patch: Partial<AlertRule> = {}): AlertRule => ({
  id: "rule",
  productId: "X",
  kind: "price_above",
  threshold: 90,
  enabled: true,
  cooldownMs: 60000,
  lastSnapshot: null,
  lastTriggeredAt: null,
  active: false,
  seenAuctions: [],
  baselinePrice: null,
  ...patch,
});
const snapshot = (id = "s1", price = 100) => ({
  id,
  stale: false,
  demo: false,
  source: "bazaar" as const,
  flips: [{ ...flip(), buy_price: price }],
});

describe("market flip contracts", () => {
  it("uses executable sides rather than misleading quick price names", () => {
    const r = flip();
    expect(r.buy_price).toBe(100);
    expect(r.sell_price).toBe(120);
    expect(r.fees).toBe(1.5);
    expect(r.net_profit).toBe(1184);
    expect(r.roi).toBe(18.5);
    expect(r.break_even).toBeCloseTo(100 / 0.9875);
  });
  it("shows an ordinary instant round trip as a loss", () => {
    const r = calculateMarketFlip("X", product, "instant", 64, 1.25);
    expect(r.net_per_item).toBe(-21.25);
    expect(r.scores.overall).toBe(0);
  });
  it("walks depth and refuses an unfilled instant position", () => {
    const p = {
      ...product,
      buy_summary: [
        { amount: 1, pricePerUnit: 120, orders: 1 },
        { amount: 1, pricePerUnit: 140, orders: 1 },
      ],
    };
    expect(calculateMarketFlip("X", p, "instant", 2, 0).buy_price).toBe(130);
    expect(calculateMarketFlip("X", p, "instant", 3, 0).net_profit).toBeNull();
  });
  it("has no positive score for a losing order", () => {
    const p = {
      ...product,
      buy_summary: [{ amount: 100, pricePerUnit: 100.1, orders: 1 }],
    };
    expect(calculateMarketFlip("X", p, "order", 1, 1.25).scores.overall).toBe(
      0,
    );
  });
  it.each([0, -1, NaN, Infinity])(
    "rejects invalid price %s without inventing one",
    (price) => {
      const r = calculateMarketFlip(
        "X",
        {
          ...product,
          buy_summary: [{ amount: 100, pricePerUnit: price, orders: 1 }],
        },
        "order",
        1,
        0,
      );
      expect(r.net_profit).toBeNull();
    },
  );
  it("handles empty books", () => {
    expect(
      calculateMarketFlip("X", { ...product, sell_summary: [] }, "order", 1, 0)
        .buy_price,
    ).toBeNull();
  });
  it("penalizes zero activity despite high ROI", () => {
    const p = {
      ...product,
      quick_status: { ...product.quick_status!, buyMovingWeek: 0 },
    };
    const r = calculateMarketFlip("X", p, "order", 64, 0);
    expect(r.scores.overall).toBe(0);
    expect(r.risks).toContain("low_liquidity");
  });
  it.each([0, 1000001, Infinity, NaN, 1.5])(
    "bounds quantity %s",
    (quantity) => {
      expect(() =>
        calculateMarketFlip("X", product, "order", quantity, 1.25),
      ).toThrow();
    },
  );
  it("keeps score components bounded and explains weights", () => {
    const r = flip();
    for (const key of ["profit", "risk", "liquidity", "overall"] as const)
      expect(r.scores[key]).toBeGreaterThanOrEqual(0);
    expect(r.scores.overall).toBeLessThanOrEqual(100);
    expect(
      r.scores.explanation.profit_weight! +
        r.scores.explanation.liquidity_weight! +
        r.scores.explanation.risk_weight!,
    ).toBe(1);
  });
  it("filters losses, supports stable sorting and pagination", () => {
    const rows = [
      { ...flip(), product_id: "B" },
      { ...flip(), product_id: "A" },
      { ...flip(), product_id: "C", net_profit: -1 },
    ];
    const filtered = filterFlips(rows, DEFAULT_FILTERS);
    expect(filtered.map((r) => r.product_id)).toEqual(["A", "B"]);
    expect(filtered.slice(1, 2)[0]?.product_id).toBe("B");
    expect(filterFlips(rows, { ...DEFAULT_FILTERS, max_cost: 1000 })).toEqual(
      [],
    );
  });
  it("computes quantity, capital, fees and break even independently of UI", () => {
    const r = scenario(100, 120, 64, 1.25, 1000)!;
    expect(r.net).toBe(1184);
    expect(r.cost).toBe(6400);
    expect(r.affordable).toBe(false);
    expect(r.breakEven).toBeCloseTo(100 / 0.9875);
    expect(scenario(0, 1, 1, 1, 100)).toBeNull();
    expect(scenario(1, 1, 1, NaN, 100)).toBeNull();
  });
});

describe("history", () => {
  const history = (count = 25, jump = false) =>
    Array.from({ length: count }, (_, i) => ({
      ts: new Date(1700000000000 + i * 300000).toISOString(),
      buy_price: jump && i === count - 1 ? 150 : 100,
      sell_price: 90,
      buy_volume: 10000,
      sell_volume: 10000,
    }));
  it("returns unknown values with no history", () => {
    const r = analyseHistory([], meta, "X", "24h");
    expect(r.average).toBeNull();
    expect(r.volatility_pct).toBeNull();
    expect(r.signals).toEqual([]);
  });
  it("suppresses signals on a small sample", () => {
    expect(analyseHistory(history(3, true), meta, "X", "1h").signals).toEqual(
      [],
    );
  });
  it("calculates volatility and detects a sufficient price shock", () => {
    const r = analyseHistory(history(25, true), meta, "X", "24h");
    expect(r.volatility_pct).toBeGreaterThan(0);
    expect(r.signals.map((s) => s.kind)).toContain("price_change");
    expect(r.signals[0]?.sufficient).toBe(true);
  });
  it("does not flag a constant market and does not divide by zero std", () => {
    const r = analyseHistory(history(), meta, "X", "24h");
    expect(r.volatility_pct).toBe(0);
    expect(r.z_score).toBeNull();
    expect(r.signals).toEqual([]);
  });
  it("inserts a chart gap and suppresses jumps across missing periods", () => {
    const p = history(25, true);
    p[24]!.ts = new Date(Date.parse(p[24]!.ts) + 86400000).toISOString();
    const r = analyseHistory(p, meta, "X", "24h");
    expect(r.points.some((p) => p.buy_price === null)).toBe(true);
    expect(r.signals).toEqual([]);
  });
});

function auctionInput(n = 12) {
  const id: AuctionIdentity = {
    key: "sword:legendary:1:ench5",
    id: "SWORD",
    count: 1,
    modifiers: { enchantments: '{"sharpness":5}' },
  };
  return Array.from({ length: n }, (_, i) => ({
    raw: {
      uuid: `a${i}`,
      auctioneer: `s${i}`,
      bin: true,
      item_name: "Sword",
      tier: "LEGENDARY",
      starting_bid: i === 0 ? 50 : 100,
      start: Date.now() - 1000,
      end: Date.now() + 3600000,
    } as HypixelAuction,
    identity: id,
  }));
}
describe("auction comparables", () => {
  it("is robust to an outlier and excludes the candidate", () => {
    const input = auctionInput();
    input[11]!.raw.starting_bid = 1e9;
    const r = valueAuctions(input)[0]!;
    expect(r.reference_price).toBe(100);
    expect(r.discount_pct).toBe(50);
    expect(r.net_upside).toBeNull();
    expect(r.comparable_ids).not.toContain("a0");
  });
  it("separates modifier and rarity fingerprints", () => {
    const input = auctionInput();
    input[0]!.identity = {
      ...input[0]!.identity,
      key: "different-rarity-or-mods",
    };
    expect(valueAuctions(input)[0]?.reference_price).toBeNull();
  });
  it("requires enough independent sellers", () => {
    const input = auctionInput();
    for (const item of input) item.raw.auctioneer = "one";
    expect(valueAuctions(input).every((r) => r.reference_price === null)).toBe(
      true,
    );
    expect(valueAuctions(auctionInput(3))[0]?.confidence).toBe("insufficient");
  });
  it("does not use an item name as a valuation identity", () => {
    const input = auctionInput();
    input[0]!.identity = null!;
    expect(valueAuctions(input)[0]?.reference_price).toBeNull();
  });
  it("excludes expired and non-BIN listings", () => {
    const input = auctionInput();
    input[0]!.raw.end = 1;
    input[1]!.raw.bin = false;
    expect(valueAuctions(input)).toHaveLength(10);
  });
});

describe("smart alert state machine", () => {
  it("deduplicates snapshots and repeated true states", () => {
    const r = evaluateRules([rule()], snapshot(), 100000);
    expect(r.events).toHaveLength(1);
    expect(evaluateRules(r.rules, snapshot(), 200000).events).toEqual([]);
    expect(evaluateRules(r.rules, snapshot("s2"), 200000).events).toEqual([]);
  });
  it("rearms after crossing and respects cooldown", () => {
    let r = evaluateRules([rule()], snapshot(), 100000);
    r = evaluateRules(r.rules, snapshot("s2", 10), 110000);
    r = evaluateRules(r.rules, snapshot("s3"), 120000);
    expect(r.events).toEqual([]);
    r = evaluateRules(r.rules, snapshot("s4", 10), 180000);
    r = evaluateRules(r.rules, snapshot("s5"), 190000);
    expect(r.events).toHaveLength(1);
  });
  it("does not evaluate demo, stale or disabled rules", () => {
    for (const s of [
      { ...snapshot(), demo: true },
      { ...snapshot(), stale: true },
    ])
      expect(evaluateRules([rule()], s, 100000).events).toEqual([]);
    expect(
      evaluateRules([rule({ enabled: false })], snapshot(), 100000).events,
    ).toEqual([]);
  });
  it("tracks a price-change baseline, not a fake prediction", () => {
    const r = evaluateRules(
      [rule({ kind: "price_change", threshold: 10 })],
      snapshot(),
      100000,
    );
    expect(r.events).toEqual([]);
    expect(
      evaluateRules(r.rules, snapshot("s2", 120), 200000).events[0]?.value,
    ).toBeCloseTo(20);
  });
  it("deduplicates auction UUIDs across changing snapshots", () => {
    const lots = valueAuctions(auctionInput()),
      s = {
        id: "au1",
        stale: false,
        demo: false,
        source: "auction" as const,
        auctions: lots,
      };
    const r = evaluateRules(
      [rule({ kind: "auction_new", productId: "*", threshold: 10 })],
      s,
      100000,
    );
    expect(r.events).toHaveLength(1);
    expect(evaluateRules(r.rules, { ...s, id: "au2" }, 200000).events).toEqual(
      [],
    );
  });
  it("keeps Bazaar and auction evaluation states independent", () => {
    const r = rule({ kind: "auction_new" });
    expect(evaluateRules([r], snapshot(), 100000).rules[0]).toBe(r);
  });
});

describe("provider and locale contracts", () => {
  it("offers profitable demo orders but no fabricated profitable instant round trips", async () => {
    const orders = await demoProvider.getFlips(DEFAULT_FILTERS);
    expect(orders.items.length).toBeGreaterThan(0);
    expect(orders.items.every((row) => (row.net_profit ?? 0) > 0)).toBe(true);
    const instant = await demoProvider.getFlips({
      ...DEFAULT_FILTERS,
      mode: "instant",
    });
    expect(instant.items).toHaveLength(0);
  });
  it("calculates direct data locally with no claimed server history", async () => {
    const getBazaar = vi.fn(async () => ({
      data: {
        success: true,
        lastUpdated: Date.now(),
        products: { X: product },
      },
      updatedAt: Date.now(),
      source: "network" as const,
    }));
    const provider = {
      isDemo: false,
      getBazaar,
      getHistory: vi.fn(async () => null),
    } as unknown as DataProvider;
    Object.assign(
      provider,
      localMarketProvider(() => provider),
    );
    const r = await provider.getFlips(DEFAULT_FILTERS);
    expect(r.items[0]?.net_profit).toBe(1184);
    await provider.getFlips({ ...DEFAULT_FILTERS, min_roi: 1 });
    expect(getBazaar).toHaveBeenCalledTimes(1);
    expect((await provider.getAnalytics("X", "24h", 64, 1.25)).samples).toBe(0);
  });
  it("marks demo analytics and never calls live history for synthetic rows", async () => {
    const provider = {
      isDemo: true,
      getBazaar: async () => ({
        data: {
          success: true,
          lastUpdated: Date.now(),
          products: { X: product },
        },
        updatedAt: Date.now(),
        source: "network",
        demo: true,
      }),
      getHistory: async () => null,
    } as unknown as DataProvider;
    Object.assign(
      provider,
      localMarketProvider(() => provider),
    );
    const r = await provider.getAnalytics("X", "24h", 64, 1.25);
    expect(r.meta.source).toBe("demo");
    expect(r.samples).toBe(25);
  });
  it("preserves backend offline errors instead of making up rows", async () => {
    const provider = {
      getBazaar: async () => {
        throw Error("backend offline");
      },
    } as unknown as DataProvider;
    const adapter = localMarketProvider(() => provider);
    await expect(adapter.getFlips(DEFAULT_FILTERS)).rejects.toThrow("offline");
  });
  it("has RU and EN translations for every market key", () => {
    for (const key of Object.keys(dictionaries.ru).filter(
      (k) => k.startsWith("market.") || k === "nav.flips",
    )) {
      expect(dictionaries.en[key as keyof typeof dictionaries.en]).toBeTruthy();
      expect(dictionaries.ru[key as keyof typeof dictionaries.ru]).toBeTruthy();
    }
  });
});

import { readMarketSetting, writeMarketSetting } from "./storage";
describe("local filter persistence", () => {
  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => map.set(k, v),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("round-trips filters separately from existing app settings", async () => {
    await writeMarketSetting("filters:v1", { filters: DEFAULT_FILTERS });
    expect(await readMarketSetting("filters:v1")).toEqual({
      filters: DEFAULT_FILTERS,
    });
  });
});
