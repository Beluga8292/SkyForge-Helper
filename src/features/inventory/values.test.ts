import { describe, it, expect } from "vitest";
import {
  analysisSchema,
  type Analysis,
  type Asset,
} from "@/features/intelligence/models";
import type { DecodedInventoryItem } from "@/types/profile";
import {
  inventoryValueIndex,
  inventoryItemValue,
  compactInventoryValue,
} from "./values";
const now = 1700000000000;
const analysis = (assets: Asset[], patch: Partial<Analysis> = {}): Analysis =>
  analysisSchema.parse({
    schema_version: "1",
    rules_version: "test",
    uuid: "player",
    profile_id: "profile",
    username: "Player",
    profile_name: "Apple",
    profile_type: "normal",
    coop: false,
    first_join: null,
    last_save: null,
    fetched_at: now,
    stale: false,
    demo: false,
    source: "backend",
    completeness: {},
    metrics: [],
    assets,
    pets: [],
    recommendations: [],
    accessory_power: null,
    accessory_power_known_subset: null,
    accessories: [],
    networth: {
      personal_liquid: null,
      shared_bank: null,
      tradable: null,
      untradeable_count: 0,
      unknown_count: 0,
      priced_count: 0,
      coverage: null,
      known_total: null,
      complete: false,
    },
    warnings: [],
    selected_class: null,
    floors: {},
    minions: null,
    ...patch,
  });
const asset = (p: Partial<Asset> = {}): Asset => ({
  key: "inv_contents:0",
  item_id: "MATERIAL",
  name: "Material",
  location: "inv_contents",
  category: null,
  count: 64,
  rarity: "RARE",
  modifiers: {},
  uuid: null,
  match_key: null,
  soulbound: false,
  value: 3200000,
  method: "bazaar_visible_bid",
  confidence: "medium",
  price_timestamp: now,
  ...p,
});
const item = (p: Partial<DecodedInventoryItem> = {}): DecodedInventoryItem => ({
  slot: 0,
  itemId: "MATERIAL",
  name: "Material",
  count: 64,
  damage: 0,
  rarity: "RARE",
  category: null,
  material: null,
  lore: [],
  loreLines: [],
  stars: 0,
  recombobulated: false,
  hotPotatoBooks: 0,
  fumingPotatoBooks: 0,
  reforge: null,
  enchantments: {},
  gemstoneSlots: [],
  uuid: null,
  soulbound: false,
  extra: {},
  ...p,
});
const index = (assets = [asset()], patch: Partial<Analysis> = {}) =>
  inventoryValueIndex(
    analysis(assets, patch),
    "player",
    "profile",
    new Map(),
    now,
  );
const get = (
  p: Partial<DecodedInventoryItem> = {},
  rows = [asset()],
  patch: Partial<Analysis> = {},
) =>
  inventoryItemValue(
    item(p),
    "inv_contents",
    index(rows, patch),
    undefined,
    now,
  );
describe("inventory valuation adapter", () => {
  it("treats Networth values as complete stack values, not unit prices", () => {
    const v = get();
    expect(v.total).toBe(3200000);
    expect(v.unit).toBe(50000);
    expect(compactInventoryValue(v)).toBe("3.2M");
  });
  it("reuses the separate Networth Bazaar top-up without double multiplying", () => {
    const a = analysis([asset({ value: null, method: "unknown" })]);
    const ix = inventoryValueIndex(
      a,
      "player",
      "profile",
      new Map([["MATERIAL", 50000]]),
      now,
    );
    const v = inventoryItemValue(item(), "inv_contents", ix, undefined, now);
    expect(v.total).toBe(3200000);
    expect(v.unit).toBe(50000);
    expect(v.state).toBe("estimated");
    expect(v.source).toBe("local_bazaar_topup");
  });
  it("does not turn missing/unknown prices into zero", () => {
    for (const rows of [
      [],
      [asset({ value: null, modifiers: { upgrade: 1 } })],
    ]) {
      const v = get({}, rows);
      expect(v.total).toBeNull();
      expect(compactInventoryValue(v)).toBe("?");
    }
  });
  it("validates quantity before dividing and rejects changed stack sizes", () => {
    for (const count of [0, -1, NaN, Infinity, 1.5, 65])
      expect(get({ count }).state).toBe("unavailable");
    expect(get({ count: 32 }).reason).toBe("variant");
    const v = get({ count: 1 }, [asset({ count: 1, value: 50000 })]);
    expect(v.unit).toBe(50000);
    expect(v.total).toBe(50000);
  });
  it("keeps stale known values and unknown freshness explicit", () => {
    const v = get({}, [asset({ price_timestamp: now - 120001 })]);
    expect(v.state).toBe("stale");
    expect(v.total).toBe(3200000);
    expect(get({}, [asset({ price_timestamp: null })]).timestamp).toBeNull();
    expect(get({}, [asset()], { stale: true }).state).toBe("stale");
  });
  it("retains soulbound asset value but never sells it", () => {
    const v = get({ soulbound: true });
    expect(v.total).toBe(3200000);
    expect(v.tradeability).toBe("soulbound");
    expect(v.sellable).toBeNull();
    expect(v.state).toBe("estimated");
  });
  it("distinguishes explicit untradeable, tradeable and unknown metadata", () => {
    const ix = index();
    for (const [meta, expected] of [
      [{ untradeable: true }, "untradeable"],
      [{ tradeable: true }, "tradeable"],
      [{}, "unknown"],
    ] as const) {
      const v = inventoryItemValue(
        item(),
        "inv_contents",
        ix,
        { id: "MATERIAL", name: "Material", ...meta },
        now,
      );
      expect(v.tradeability).toBe(expected);
      expect(v.sellable).toBe(expected === "tradeable" ? 3200000 : null);
    }
  });
  it("refuses differing NBT modifier, UUID or rarity instead of pricing by item ID", () => {
    expect(get({ extra: { modifier: "withered" } }).reason).toBe("variant");
    expect(get({ uuid: "other" }).reason).toBe("variant");
    expect(get({ rarity: "LEGENDARY" }).reason).toBe("variant");
  });
  it("maps container + slot, not display name or item ID alone", () => {
    for (const location of [
      "inv_armor",
      "equipment_contents",
      "ender_chest_contents",
      "backpack:3",
      "accessory_bag",
      "wardrobe_contents",
      "personal_vault_contents",
    ]) {
      const ix = index([asset({ key: location + ":0", location })]);
      expect(
        inventoryItemValue(item(), location, ix, undefined, now).total,
      ).toBe(3200000);
      expect(
        inventoryItemValue(item(), "inv_contents", ix, undefined, now).total,
      ).toBeNull();
    }
  });
  it("rejects old responses for a different UUID or SkyBlock profile", () => {
    const a = analysis([asset()]);
    expect(
      inventoryValueIndex(a, "other", "profile", new Map(), now),
    ).toBeNull();
    expect(
      inventoryValueIndex(a, "player", "other", new Map(), now),
    ).toBeNull();
    expect(inventoryItemValue(item(), "inv_contents", null).state).toBe(
      "unavailable",
    );
  });
  it("does not price duplicate UUID mirrors twice", () => {
    const ix = index([
      asset({ uuid: "one" }),
      asset({
        key: "wardrobe_contents:0",
        location: "wardrobe_contents",
        uuid: "one",
      }),
    ]);
    expect(
      inventoryItemValue(
        item({ uuid: "one" }),
        "inv_contents",
        ix,
        undefined,
        now,
      ).total,
    ).toBe(3200000);
    expect(
      inventoryItemValue(
        item({ uuid: "one" }),
        "wardrobe_contents",
        ix,
        undefined,
        now,
      ).total,
    ).toBeNull();
  });
  it("handles partial inventory and leaves modified top-ups unknown", () => {
    const v = get({}, [asset()], { completeness: { "backpack:0": "invalid" } });
    expect(v.partial).toBe(true);
    const a = analysis([
      asset({ modifiers: { modifier: "ancient" }, value: null }),
    ]);
    const ix = inventoryValueIndex(
      a,
      "player",
      "profile",
      new Map([["MATERIAL", 50000]]),
      now,
    );
    expect(
      inventoryItemValue(
        item({ extra: { modifier: "ancient" } }),
        "inv_contents",
        ix,
        undefined,
        now,
      ).total,
    ).toBeNull();
  });
});
