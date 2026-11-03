import { describe, expect, it } from "vitest";
import { analysisSchema, type Analysis, type Asset } from "@/features/intelligence/models";
import {
  buildNetworth,
  categoryForLocation,
  networthMethodKey,
  NETWORTH_CATEGORY_ORDER,
} from "./engine";

const networth = (overrides: Partial<Analysis["networth"]> = {}) => ({
  personal_liquid: null,
  shared_bank: null,
  tradable: null,
  untradeable_count: 0,
  unknown_count: 0,
  priced_count: 0,
  coverage: null,
  known_total: null,
  complete: false,
  ...overrides,
});

function analysis(overrides: Partial<Analysis> = {}): Analysis {
  return analysisSchema.parse({
    schema_version: "1",
    rules_version: "test",
    uuid: "0123456789abcdef0123456789abcdef",
    profile_id: "abcdefabcdefabcdefabcdefabcdefab",
    username: "Tester",
    profile_name: "Apple",
    profile_type: "normal",
    coop: false,
    first_join: null,
    last_save: null,
    fetched_at: 1_700_000_000_000,
    stale: false,
    demo: false,
    source: "test",
    completeness: {},
    metrics: [],
    assets: [],
    pets: [],
    recommendations: [],
    accessory_power: null,
    accessory_power_known_subset: null,
    accessories: [],
    networth: networth(),
    warnings: [],
    selected_class: null,
    floors: {},
    minions: null,
    ...overrides,
  });
}

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    key: "asset",
    item_id: "HYPERION",
    name: "Hyperion",
    location: "inv_contents",
    category: null,
    count: 1,
    rarity: "LEGENDARY",
    modifiers: {},
    uuid: null,
    match_key: null,
    soulbound: false,
    value: 100,
    method: "bazaar",
    confidence: "medium",
    price_timestamp: null,
    ...overrides,
  };
}

function pet(type: string): Analysis["pets"][number] {
  return {
    type,
    rarity: "LEGENDARY",
    xp: null,
    level: null,
    next_xp: null,
    remaining: null,
    progress: null,
    held_item: null,
    active: null,
    state: "unknown",
  };
}

describe("Networth breakdown engine", () => {
  it("maps inventory locations to stable categories", () => {
    expect(categoryForLocation("inv_contents")).toBe("inventory");
    expect(categoryForLocation("inv_armor")).toBe("armor");
    expect(categoryForLocation("equipment_contents")).toBe("equipment");
    expect(categoryForLocation("accessory_bag")).toBe("accessories");
    expect(categoryForLocation("ender_chest_contents")).toBe("enderChest");
    expect(categoryForLocation("wardrobe_contents")).toBe("wardrobe");
    expect(categoryForLocation("backpack:3")).toBe("storage");
    expect(categoryForLocation("storage")).toBe("storage");
    expect(categoryForLocation("unknown_blob")).toBe("other");
  });

  it("counts UUID mirrors once but keeps distinct slots without UUIDs", () => {
    const breakdown = buildNetworth(
      analysis({
        assets: [
          asset({ key: "a", uuid: "uuid-1", value: 100 }),
          asset({ key: "b", uuid: "uuid-1", value: 100 }),
          asset({ key: "c", uuid: null, value: 50 }),
          asset({ key: "d", uuid: null, value: 50 }),
        ],
        networth: networth({ personal_liquid: 10 }),
      }),
    );

    expect(breakdown.duplicates).toBe(1);
    expect(breakdown.assets).toHaveLength(3);
    expect(breakdown.assetValue).toBe(200);
    expect(breakdown.pricedCount).toBe(3);
    expect(breakdown.knownTotal).toBe(210);
  });

  it("builds per-category totals and coverage from decoded assets", () => {
    const breakdown = buildNetworth(
      analysis({
        assets: [
          asset({ key: "main", location: "inv_contents", value: 100 }),
          asset({ key: "armor", location: "inv_armor", value: 200 }),
          asset({ key: "belt", location: "equipment_contents", value: 50 }),
          asset({ key: "bag", location: "accessory_bag", value: 300 }),
          asset({ key: "chest", location: "ender_chest_contents", value: 25 }),
          asset({ key: "wardrobe", location: "wardrobe_contents", value: 5 }),
          asset({ key: "backpack", location: "backpack:2", value: 75 }),
          asset({ key: "other", location: "unknown_blob", value: null }),
        ],
      }),
    );

    const byId = Object.fromEntries(
      breakdown.categories.map((category) => [category.id, category]),
    );
    expect(byId.inventory?.value).toBe(100);
    expect(byId.armor?.value).toBe(200);
    expect(byId.equipment?.value).toBe(50);
    expect(byId.accessories?.value).toBe(300);
    expect(byId.enderChest?.value).toBe(25);
    expect(byId.wardrobe?.value).toBe(5);
    expect(byId.storage?.value).toBe(75);
    expect(byId.other).toMatchObject({ entries: 1, unknown: 1, value: 0 });
    expect(breakdown.assetValue).toBe(755);
    expect(breakdown.coverage).toBe(7 / 8);
    expect(breakdown.complete).toBe(false);
  });

  it("keeps the co-op bank outside the personal total", () => {
    const breakdown = buildNetworth(
      analysis({
        assets: [asset({ value: 100 })],
        metrics: [
          {
            id: "purse",
            category: "economy",
            value: 500,
            level: null,
            target: null,
            remaining: null,
            progress: null,
            state: "known",
            source: "profile",
            scope: "member",
          },
          {
            id: "bank",
            category: "economy",
            value: 1000,
            level: null,
            target: null,
            remaining: null,
            progress: null,
            state: "known",
            source: "profile",
            scope: "shared",
          },
        ],
        networth: networth({ personal_liquid: 500, shared_bank: 1000 }),
      }),
    );

    expect(breakdown.purse).toBe(500);
    expect(breakdown.bank).toBe(1000);
    expect(breakdown.liquid).toBe(500);
    expect(breakdown.coopBank).toBe(1000);
    expect(breakdown.knownTotal).toBe(600);
    expect(breakdown.categories.find((row) => row.id === "liquid")).toMatchObject({
      entries: 1,
      priced: 1,
      value: 500,
    });
    expect(breakdown.categories.find((row) => row.id === "coopBank")).toMatchObject({
      entries: 1,
      priced: 1,
      value: 1000,
      share: null,
    });
  });

  it("excludes soulbound items from the tradable total but still counts them", () => {
    const breakdown = buildNetworth(
      analysis({
        assets: [
          asset({ key: "bound", soulbound: true, value: 100 }),
          asset({ key: "free", soulbound: false, value: 200 }),
        ],
      }),
    );

    expect(breakdown.assetValue).toBe(300);
    expect(breakdown.tradableValue).toBe(200);
    expect(breakdown.untradeableCount).toBe(1);
  });

  it("treats pets as unpriced entries and lowers coverage honestly", () => {
    const breakdown = buildNetworth(
      analysis({
        assets: [asset({ value: 100 })],
        pets: [pet("GOLDEN_DRAGON"), pet("ENDER_DRAGON")],
        networth: networth({ personal_liquid: 100 }),
      }),
    );

    expect(breakdown.entryCount).toBe(3);
    expect(breakdown.pricedCount).toBe(1);
    expect(breakdown.unknownCount).toBe(2);
    expect(breakdown.coverage).toBeCloseTo(1 / 3);
    expect(breakdown.knownTotal).toBe(200);
    expect(breakdown.categories.find((row) => row.id === "pets")).toMatchObject({
      entries: 2,
      priced: 0,
      unknown: 2,
      value: 0,
    });
  });

  it("returns a null total when nothing can be priced", () => {
    const breakdown = buildNetworth(
      analysis({ assets: [asset({ value: null, method: "unknown" })] }),
    );

    expect(breakdown.knownTotal).toBeNull();
    expect(breakdown.assetValue).toBe(0);
    expect(breakdown.coverage).toBe(0);
    expect(breakdown.assets[0]?.value).toBeNull();
  });

  it("adds a labelled local Bazaar top-up only for plain, tradable, exact-id items", () => {
    const prices = new Map<string, number>([["DRAGON_CLAW", 1_000]]);
    const breakdown = buildNetworth(
      analysis({
        assets: [
          asset({
            key: "plain",
            item_id: "DRAGON_CLAW",
            value: null,
            method: "unknown",
            count: 2,
          }),
          asset({
            key: "modified",
            item_id: "DRAGON_CLAW",
            value: null,
            method: "unknown",
            modifiers: { reforge: "warped" },
          }),
          asset({
            key: "bound",
            item_id: "DRAGON_CLAW",
            value: null,
            method: "unknown",
            soulbound: true,
          }),
          asset({
            key: "missing-price",
            item_id: "UNKNOWN_ITEM",
            value: null,
            method: "unknown",
          }),
        ],
      }),
      { bazaarPrices: prices },
    );

    const byKey = Object.fromEntries(
      breakdown.assets.map((entry) => [entry.key, entry]),
    );
    expect(byKey.plain?.estimatedValue).toBe(2_000);
    expect(byKey.modified?.estimatedValue).toBeNull();
    expect(byKey.bound?.estimatedValue).toBeNull();
    expect(byKey["missing-price"]?.estimatedValue).toBeNull();

    expect(breakdown.estimatedValue).toBe(2_000);
    expect(breakdown.estimatedCount).toBe(1);
    expect(breakdown.unknownTradeable).toBe(3);
    expect(breakdown.unknownSoulbound).toBe(1);
    // The top-up never leaks into confirmed value or confirmed coverage.
    expect(breakdown.assetValue).toBe(0);
    expect(breakdown.knownTotal).toBeNull();
    expect(breakdown.coverage).toBe(0);
    expect(breakdown.coverageWithEstimates).toBe(1 / 4);
  });

  it("exposes per-category estimate totals without changing confirmed values", () => {
    const breakdown = buildNetworth(
      analysis({
        assets: [
          asset({ key: "priced", location: "inv_contents", value: 100 }),
          asset({
            key: "estimate",
            item_id: "CARROT_ITEM",
            location: "inv_contents",
            value: null,
            method: "unknown",
          }),
        ],
      }),
      { bazaarPrices: new Map([["CARROT_ITEM", 250]]) },
    );

    const inventory = breakdown.categories.find((row) => row.id === "inventory");
    expect(inventory).toMatchObject({
      entries: 2,
      priced: 1,
      unknown: 1,
      value: 100,
      estimatedEntries: 1,
      estimatedValue: 250,
      coverage: 0.5,
    });
    expect(breakdown.knownTotal).toBe(100);
  });

  it("reports pricing sources for confirmed assets", () => {
    const breakdown = buildNetworth(
      analysis({
        assets: [
          asset({ key: "bazaar", value: 10, method: "bazaar_visible_ask" }),
          asset({ key: "auction", value: 20, method: "auction_bin" }),
          asset({ key: "unknown", value: null, method: "unknown" }),
        ],
      }),
    );

    expect(breakdown.bazaarPricedCount).toBe(1);
    expect(breakdown.auctionPricedCount).toBe(1);
    expect(breakdown.pricedCount).toBe(2);
  });

  it("sorts assets by value and exposes the category order", () => {
    const breakdown = buildNetworth(
      analysis({
        assets: [
          asset({ key: "low", name: "Low", value: 10 }),
          asset({ key: "high", name: "High", value: 900 }),
          asset({ key: "unknown", name: "Unknown", value: null }),
        ],
      }),
    );

    expect(breakdown.assets.map((row) => row.key)).toEqual(["high", "low", "unknown"]);
    expect(NETWORTH_CATEGORY_ORDER).toEqual([
      "inventory",
      "armor",
      "equipment",
      "accessories",
      "enderChest",
      "wardrobe",
      "storage",
      "pets",
      "other",
      "liquid",
      "coopBank",
    ]);
  });

  it("maps backend valuation methods to translation keys", () => {
    expect(networthMethodKey("bazaar_visible_ask")).toBe("networth.bazaar");
    expect(networthMethodKey("auction_bin")).toBe("networth.auction");
    expect(networthMethodKey("fixed")).toBe("networth.fixed");
    expect(networthMethodKey("manual")).toBe("networth.manual");
    expect(networthMethodKey("something_else")).toBe("networth.noValue");
  });

  it("marks the result partial when containers are missing or undecodable", () => {
    const breakdown = buildNetworth(
      analysis({
        completeness: {
          inv_contents: "known",
          inv_armor: "invalid",
          "backpack:2": "unknown",
          storage: "unknown",
        },
        assets: [asset({ value: 100 })],
        networth: networth({ personal_liquid: 50 }),
      }),
    );

    expect(breakdown.partialInventory).toBe(true);
    expect(breakdown.unavailableContainers).toEqual(["backpack:2", "inv_armor"]);
    expect(breakdown.complete).toBe(false);
    // The known subset is still returned in full.
    expect(breakdown.knownTotal).toBe(150);
  });

  it("counts dropped items from tolerant parsing without adding zero-value rows", () => {
    const breakdown = buildNetworth(
      analysis({
        assets: [asset({ value: 100 })],
        integrity: {
          invalidAssets: 2,
          invalidPets: 1,
          invalidMetrics: 0,
          invalidRecommendations: 0,
          invalidAccessories: 0,
          recoveredAssets: 1,
          recoveredPets: 0,
        },
        networth: networth({ personal_liquid: 50 }),
      }),
    );

    expect(breakdown.assets).toHaveLength(1);
    expect(breakdown.invalidCount).toBe(3);
    expect(breakdown.recoveredCount).toBe(1);
    expect(breakdown.pricedCount).toBe(1);
    expect(breakdown.knownTotal).toBe(150);
    expect(breakdown.complete).toBe(false);
  });

  it("reports complete only when every entry is priced and storage is known", () => {
    const breakdown = buildNetworth(
      analysis({
        completeness: {
          inv_contents: "known",
          inv_armor: "known",
          equipment_contents: "known",
          ender_chest_contents: "known",
          wardrobe_contents: "known",
          accessory_bag: "known",
          storage: "known",
        },
        assets: [asset({ value: 100 }), asset({ key: "second", value: 50 })],
        networth: networth({ personal_liquid: 25 }),
      }),
    );

    expect(breakdown.unknownCount).toBe(0);
    expect(breakdown.coverage).toBe(1);
    expect(breakdown.partialInventory).toBe(false);
    expect(breakdown.complete).toBe(true);
  });
});
