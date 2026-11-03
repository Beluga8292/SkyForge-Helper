import { describe, it, expect } from "vitest";
import { assessAuction, selectAuctionPage } from "./smart-auction";
import { identityFromAuctionItem } from "./auction-engine";
import type { MarketMeta, Valuation } from "./models";
const now = 1700000000000,
  meta: MarketMeta = {
    fetched_at: new Date(now).toISOString(),
    fetched_at_ms: now,
    cache_age_ms: 0,
    stale: false,
    source: "cache",
  };
const row = (p: Partial<Valuation> = {}): Valuation => ({
  auction_id: "a",
  item_id: "X",
  name: "X",
  rarity: "EPIC",
  count: 1,
  listing_price: 100,
  reference_price: 200,
  difference: 100,
  discount_pct: 50,
  net_upside: null,
  confidence: "medium",
  sample_size: 10,
  comparable_ids: [],
  match_key: "exact",
  modifiers: {},
  end: now + 60000,
  start: now - 1000,
  reason: "listing_median_not_sale",
  ...p,
});
const item = (mods: Record<string, unknown> = {}) =>
  ({
    Count: 1,
    Damage: 0,
    tag: { ExtraAttributes: { id: "X", ...mods } },
  }) as Parameters<typeof identityFromAuctionItem>[0];
describe("auction smart evidence", () => {
  it("calculates gross, fees, net and ROI with explicit assumptions", () => {
    const e = assessAuction(row(), meta, 2, 5, false, now);
    expect(e.gross).toBe(100);
    expect(e.fees).toBe(9);
    expect(e.net).toBe(91);
    expect(e.roi).toBe(91);
    expect(e.reasons).toContain("listing_only");
  });
  it("never replaces missing fees or valuation with zero", () => {
    expect(assessAuction(row(), meta, undefined, 5, false, now).net).toBeNull();
    expect(
      assessAuction(row({ reference_price: null }), meta, 0, 0, false, now)
        .gross,
    ).toBeNull();
  });
  it("requires independent comparables and exact identity", () => {
    for (const p of [
      { sample_size: 4 },
      { match_key: null },
      { item_id: null },
    ]) {
      const e = assessAuction(row(p), meta, 0, 0, false, now);
      expect(e.net).toBeNull();
      expect(e.confidence).toBe("insufficient");
    }
  });
  it("downgrades stale/partial estimates and keeps their risks unknown", () => {
    for (const [m, partial] of [
      [{ ...meta, stale: true }, false],
      [meta, true],
    ] as const) {
      const e = assessAuction(row(), m, 0, 0, partial, now);
      expect(e.confidence).toBe("low");
      expect(e.risk).toBeNull();
    }
  });
  it("filters and sorts only supplied page; unknown net fails a specified minimum", () => {
    const rows = [row(), row({ auction_id: "b", listing_price: 50 })];
    expect(
      selectAuctionPage(
        rows,
        meta,
        { min_profit: 120 },
        { fee_pct: 0, listing_fee: 0 },
        false,
        "provider",
        now,
      ).map((r) => r.auction_id),
    ).toEqual(["b"]);
    expect(
      selectAuctionPage(
        rows,
        meta,
        { min_profit: 0 },
        {},
        false,
        "provider",
        now,
      ),
    ).toEqual([]);
    expect(
      selectAuctionPage(
        rows,
        meta,
        {},
        { fee_pct: 0, listing_fee: 0 },
        false,
        "profit",
        now,
      )[0]?.auction_id,
    ).toBe("b");
  });
  it("retains every meaningful modifier instead of grouping display names", () => {
    const base = identityFromAuctionItem(item(), "EPIC")!.key;
    for (const mods of [
      { modifier: "ancient" },
      { enchantments: { growth: 6 } },
      { upgrade_level: 5 },
      { master_star: 1 },
      { gems: { JASPER_0: "PERFECT" } },
      { rarity_upgrades: 1 },
      { hot_potato_count: 10 },
      { fuming_potato_count: 5 },
      { unknown_future_modifier: 1 },
    ])
      expect(identityFromAuctionItem(item(mods), "EPIC")!.key).not.toBe(base);
    expect(identityFromAuctionItem(item(), "LEGENDARY")!.key).not.toBe(base);
  });
  it("ignores optional provenance UUIDs but preserves pet XP/skin/candy/held item", () => {
    const pet = { type: "SHEEP", tier: "LEGENDARY", exp: 100000, uuid: "one" };
    const key = (p: Record<string, unknown>) =>
      identityFromAuctionItem(
        item({ id: "PET", petInfo: JSON.stringify(p) }),
        "LEGENDARY",
      )?.key;
    expect(key(pet)).toBe(key({ ...pet, uuid: "two" }));
    for (const p of [
      { exp: 100001 },
      { skin: "BLUE" },
      { candyUsed: 1 },
      { heldItem: "PET_ITEM_TEXTBOOK" },
    ])
      expect(key({ ...pet, ...p })).not.toBe(key(pet));
    expect(
      identityFromAuctionItem(item({ petInfo: "malformed" }), "LEGENDARY"),
    ).toBeNull();
  });
});

it("downgrades extreme listing gaps and applies confidence to page fallback", () => {
  const r = row({ reference_price: 10000, confidence: "high" }),
    e = assessAuction(r, meta, 0, 0, false, now);
  expect(e.confidence).toBe("low");
  expect(e.reasons).toContain("extreme_discount");
  expect(
    selectAuctionPage(
      [r],
      meta,
      { min_confidence: "high" },
      { fee_pct: 0, listing_fee: 0 },
      false,
      "provider",
      now,
    ),
  ).toEqual([]);
  expect(identityFromAuctionItem(item({ id: "PET" }), "LEGENDARY")).toBeNull();
});

it("keeps legacy armor colors in the price identity", () => {
  const key = (color: number) =>
    identityFromAuctionItem(
      {
        Count: 1,
        tag: { display: { color }, ExtraAttributes: { id: "ARMOR" } },
      },
      "EPIC",
    )?.key;
  expect(key(0)).not.toBe(key(0xffffff));
});
