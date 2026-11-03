import { describe, it, expect } from "vitest";
import { itemTypesMatch, reforgesFor } from "./catalog";
import {
  supportedEnchantments,
  checkRequirements,
  confirmedEffects,
} from "./advisor-metadata";
import {
  computeUpgradePlan,
  createPriceResolver,
  emptyUpgradeState,
} from "./calculator";
import type { DecodedInventoryItem } from "@/types/profile";
import type { Analysis } from "@/features/intelligence/models";
const item = (extra: Partial<DecodedInventoryItem> = {}) =>
  ({
    itemId: "HYPERION",
    category: "SWORD",
    rarity: "LEGENDARY",
    enchantments: {},
    reforge: "withered",
    hotPotatoBooks: 8,
    fumingPotatoBooks: 0,
    ...extra,
  }) as DecodedInventoryItem;
const analysis = (extra: Record<string, unknown> = {}) =>
  ({ metrics: [], floors: {}, ...extra }) as unknown as Analysis;
const metric = (
  id: string,
  category: string,
  level: number | null,
  state = "known",
) => ({ id, category, level, state });
describe("advisor verified metadata", () => {
  it("matches armor/equipment category groups and item-specific stones", () => {
    expect(itemTypesMatch("ARMOR", "CHESTPLATE")).toBe(true);
    expect(itemTypesMatch("EQUIPMENT", "BELT")).toBe(true);
    expect(itemTypesMatch("ARMOR", "SWORD")).toBe(false);
    expect(
      itemTypesMatch(
        { internalName: ["ASPECT_OF_THE_END"] },
        "SWORD",
        "HYPERION",
      ),
    ).toBe(false);
    expect(
      itemTypesMatch(
        { internalName: ["ASPECT_OF_THE_END"] },
        "SWORD",
        "ASPECT_OF_THE_END",
      ),
    ).toBe(true);
    expect(
      reforgesFor("CHESTPLATE", "EPIC", "SHADOW_ASSASSIN_CHESTPLATE").some(
        (r) => r.name === "Ancient",
      ),
    ).toBe(true);
  });
  it("does not recommend incompatible reforge through shared calculator", () => {
    const p = computeUpgradePlan(
      {
        itemId: "HYPERION",
        name: "Hyperion",
        category: "SWORD",
        rarity: "LEGENDARY",
      },
      emptyUpgradeState(),
      { reforge: "PRECURSOR_GEAR" },
    );
    expect(p.stages.find((s) => s.kind === "reforge")?.status).toBe(
      "unsupported",
    );
  });
  it("excludes conflict pools, including existing ultimate One For All", () => {
    const e = supportedEnchantments(
      item({ enchantments: { first_strike: 4, ultimate_one_for_all: 1 } }),
    );
    expect(e.some((x) => x.id === "triple_strike" || x.id === "critical")).toBe(
      false,
    );
    const armor = supportedEnchantments(
      item({ enchantments: { respite: 2, fire_protection: 5 } }),
    );
    expect(
      armor.some((x) => x.id === "rejuvenate" || x.id === "protection"),
    ).toBe(false);
  });
  it("recognizes installed levels case-insensitively and stops at catalog ceiling", () => {
    expect(
      supportedEnchantments(item({ enchantments: { CRITICAL: 7 } })).some(
        (x) => x.id === "critical",
      ),
    ).toBe(false);
    expect(
      supportedEnchantments(item({ enchantments: { critical: 5 } })).find(
        (x) => x.id === "critical",
      )?.level,
    ).toBe(6);
  });
  it("uses one target-level book rather than summing intermediate books", () => {
    const state = { ...emptyUpgradeState(), enchantments: { critical: 4 } };
    const plan = computeUpgradePlan(
      {
        itemId: "HYPERION",
        name: "Hyperion",
        category: "SWORD",
        rarity: "LEGENDARY",
      },
      state,
      { ...state, enchantments: { critical: 6 } },
      {
        enchantmentBooks: "target-level",
        prices: createPriceResolver({
          bazaar: { ENCHANTMENT_CRITICAL_6: 100 },
        }),
      },
    );
    expect(plan.materials.map((m) => m.id)).toEqual(["ENCHANTMENT_CRITICAL_6"]);
    expect(plan.totalCost).toBe(100);
  });
  it("keeps unpriced target books unknown", () => {
    const plan = computeUpgradePlan(
      {
        itemId: "HYPERION",
        name: "Hyperion",
        category: "SWORD",
        rarity: "LEGENDARY",
      },
      emptyUpgradeState(),
      { enchantments: { critical: 6 } },
      { enchantmentBooks: "target-level" },
    );
    expect(plan.totalCost).toBeNull();
  });
  it("checks known skill/slayer/catacombs requirements", () => {
    const a = analysis({
      metrics: [
        metric("MINING", "skills", 25),
        metric("zombie", "slayer", 6),
        metric("catacombs", "dungeons", 20),
      ],
    });
    const r = checkRequirements(
      [
        { type: "SKILL", skill: "MINING", level: 20 },
        { type: "SLAYER", slayer_boss_type: "zombie", level: 7 },
        { type: "DUNGEON_SKILL", dungeon_type: "CATACOMBS", level: 20 },
      ],
      a,
    );
    expect(r.map((x) => x.status)).toEqual(["met", "unmet", "met"]);
  });
  it("does not treat missing completion as zero or unknown requirement as failure", () => {
    const r = checkRequirements(
      [
        { type: "DUNGEON_TIER", dungeon_type: "CATACOMBS", tier: 5 },
        { type: "ANY_OF", requirements: [] },
      ],
      analysis(),
    );
    expect(r.map((x) => x.status)).toEqual(["unknown", "unknown"]);
    expect(
      checkRequirements(
        [{ type: "DUNGEON_TIER", dungeon_type: "CATACOMBS", tier: 5 }],
        analysis({ floors: { "5": 0 } }),
      )[0]?.status,
    ).toBe("unmet");
    expect(
      checkRequirements(
        [{ type: "DUNGEON_TIER", dungeon_type: "CATACOMBS", tier: 5 }],
        analysis({ floors: { "5": 1 } }),
      )[0]?.status,
    ).toBe("met");
  });
  it("preserves unknown metrics and malformed thresholds", () => {
    expect(
      checkRequirements(
        [{ type: "SKILL", skill: "MINING", level: 20 }],
        analysis({ metrics: [metric("mining", "skills", 0, "unknown")] }),
      )[0]?.status,
    ).toBe("unknown");
    expect(
      checkRequirements(
        [{ type: "SKILL", skill: "MINING", level: null }],
        analysis(),
      )[0]?.status,
    ).toBe("unknown");
  });
  it("calculates only sourced base potato stats without DPS or pet multipliers", () => {
    const i = item();
    const state = { ...emptyUpgradeState(), hotPotatoBooks: 8 };
    const p = computeUpgradePlan(
      {
        itemId: i.itemId,
        name: "Hyperion",
        category: "SWORD",
        rarity: "LEGENDARY",
      },
      state,
      { ...state, hotPotatoBooks: 10 },
    );
    expect(confirmedEffects(i, p, "potato")).toEqual([
      { stat: "strength", base: 4, delta: 4 },
      { stat: "damage", base: 4, delta: 4 },
    ]);
    expect(confirmedEffects(i, p, "gemstone")).toEqual([]);
  });
  it("reports reforge base stats while leaving delta unknown for unknown current reforge", () => {
    const i = item({ category: "CHESTPLATE", reforge: "unrecognized" });
    const p = computeUpgradePlan(
      {
        itemId: "SHADOW_ASSASSIN_CHESTPLATE",
        name: "SA",
        category: "CHESTPLATE",
        rarity: "LEGENDARY",
      },
      emptyUpgradeState(),
      { reforge: "PRECURSOR_GEAR" },
    );
    const effect = confirmedEffects(i, p, "reforge").find(
      (e) => e.stat === "strength",
    );
    expect(effect?.base).toBe(25);
    expect(effect?.delta).toBeNull();
  });
});
