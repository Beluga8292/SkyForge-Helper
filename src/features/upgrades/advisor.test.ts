import { describe, it, expect } from "vitest";
import type { DecodedInventoryItem, InventorySummary } from "@/types/profile";
import { equipmentAdvice } from "./advisor";
import { createPriceResolver, unknownPrice } from "./calculator";
const item = (
  patch: Partial<DecodedInventoryItem> = {},
): DecodedInventoryItem => ({
  slot: 0,
  itemId: "ADAPTIVE_BELT",
  name: "Adaptive Belt",
  count: 1,
  damage: 0,
  rarity: "EPIC",
  category: "BELT",
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
  ...patch,
});
function inventory(
  items: DecodedInventoryItem[],
  location = "equipment_contents",
): InventorySummary {
  return {
    available: true,
    reason: null,
    items: [],
    armor: [],
    containers: [
      { id: location, location, size: items.length, slots: items, known: true },
    ],
    missing: [],
    availableContainers: 1,
    totalContainers: 1,
    totalItems: items.length,
    truncated: false,
    errors: [],
  };
}
const prices = createPriceResolver({
  bazaar: {
    RECOMBOBULATOR_3000: 100,
    HOT_POTATO_BOOK: 10,
    FUMING_POTATO_BOOK: 20,
    ESSENCE_WITHER: 2,
  },
});
const advice = (
  inv: InventorySummary,
  extra: Partial<Parameters<typeof equipmentAdvice>[0]> = {},
) => equipmentAdvice({ inventory: inv, prices, budget: 1000, ...extra });
describe("equipment advisor", () => {
  it("handles private, empty and failed containers without inventing items", () => {
    expect(equipmentAdvice({ inventory: null, prices, budget: 1000 })).toEqual(
      [],
    );
    const inv = inventory([item()]);
    inv.containers[0]!.known = false;
    expect(advice(inv)).toEqual([]);
    expect(advice(inventory([]))).toEqual([]);
  });
  it("recognizes equipped equipment and only proposes verified next star", () => {
    const entry = advice(inventory([item()]))[0]!;
    expect(entry.equipped).toBe(true);
    const star = entry.options.find((o) => o.kind === "stars")!;
    expect(star.plan.essence).toEqual([{ type: "Wither", amount: 10 }]);
    expect(star.plan.totalCost).toBe(20);
    expect(
      entry.options.some((o) => o.kind === "potato" || o.kind === "fuming"),
    ).toBe(false);
  });
  it("never repeats installed recombination, stars or gemstones", () => {
    const entry = advice(
      inventory([item({ stars: 5, recombobulated: true })]),
    )[0]!;
    expect(
      entry.options.some((o) =>
        ["stars", "recombobulator", "gemstone"].includes(o.kind),
      ),
    ).toBe(false);
  });
  it("excludes unknown star recipes rather than guessing essence", () => {
    const entry = advice(inventory([item({ itemId: "UNKNOWN_BELT" })]))[0]!;
    expect(entry.options.some((o) => o.kind === "stars")).toBe(false);
  });
  it("distinguishes two copies of the same item and excludes stored armor", () => {
    const inv = inventory([item(), item({ slot: 1, stars: 4 })]);
    expect(advice(inv)).toHaveLength(2);
    expect(advice(inv)[0]!.key).not.toBe(advice(inv)[1]!.key);
    expect(
      advice(inventory([item({ category: "HELMET" })], "wardrobe_contents")),
    ).toEqual([]);
  });
  it("credits owned materials once per alternative and does not mutate inputs", () => {
    const inv = inventory([
      item(),
      item({ itemId: "ESSENCE_WITHER", category: null, count: 7, slot: 1 }),
    ]);
    const before = JSON.stringify(inv);
    const entry = advice(inv)[0]!;
    expect(entry.options.find((o) => o.kind === "stars")!.plan.totalCost).toBe(
      6,
    );
    expect(JSON.stringify(inv)).toBe(before);
  });
  it("keeps unknown prices out of budget eligibility, including zero budget", () => {
    const entry = advice(inventory([item()]), {
      prices: unknownPrice,
      budget: 0,
    })[0]!;
    expect(
      entry.options.every(
        (o) => o.plan.totalCost === null && o.affordability === "unknown",
      ),
    ).toBe(true);
  });
  it("supports exact budget boundary and flags stale/invalid budgets", () => {
    const inv = inventory([item()]);
    expect(
      advice(inv, { budget: 20 })[0]!.options.find((o) => o.kind === "stars")!
        .affordability,
    ).toBe("within");
    expect(
      advice(inv, { budget: 19 })[0]!.options.find((o) => o.kind === "stars")!
        .affordability,
    ).toBe("over");
    expect(
      advice(inv, { stale: true })[0]!.options.every(
        (o) => o.affordability === "unknown",
      ),
    ).toBe(true);
    expect(
      advice(inv, { budget: NaN })[0]!.options.every(
        (o) => o.affordability === "unknown",
      ),
    ).toBe(true);
  });
  it("treats carried weapons as candidates, never as confirmed held items", () => {
    const entry = advice(
      inventory(
        [item({ category: "SWORD", itemId: "HYPERION" })],
        "inv_contents",
      ),
    )[0]!;
    expect(entry.equipped).toBe(false);
    expect(entry.options.some((o) => o.kind === "potato")).toBe(true);
  });
  it("includes ten HPB prerequisite in Fuming alternative without doubling costs", () => {
    const entry = advice(
      inventory(
        [
          item({
            category: "SWORD",
            itemId: "HYPERION",
            hotPotatoBooks: 8,
            fumingPotatoBooks: 0,
          }),
        ],
        "inv_contents",
      ),
    )[0]!;
    const plan = entry.options.find((o) => o.kind === "fuming")!.plan;
    expect(
      plan.materials.find((m) => m.id === "HOT_POTATO_BOOK")!.required,
    ).toBe(2);
    expect(plan.totalCost).toBe(120);
  });
  it("filters purposes without calling gathering tools combat weapons", () => {
    const inv = inventory(
      [item({ category: "PICKAXE", itemId: "PICKONIMBUS_2000" })],
      "inv_contents",
    );
    expect(advice(inv, { purpose: "combat" })).toEqual([]);
    expect(advice(inv, { purpose: "gathering" })).toHaveLength(1);
    expect(
      advice(inv)[0]!.options.some(
        (o) => o.kind === "potato" || o.kind === "fuming",
      ),
    ).toBe(false);
  });
  it("enriches missing decoded category from resource metadata without losing instance upgrades", () => {
    const inv = inventory([item({ category: null, stars: 4 })]);
    const entry = advice(inv, {
      itemMap: new Map([
        [
          "ADAPTIVE_BELT",
          {
            id: "ADAPTIVE_BELT",
            name: "Adaptive Belt",
            category: "BELT",
            material: "SKULL_ITEM",
          },
        ],
      ]),
    })[0]!;
    expect(entry.item.category).toBe("BELT");
    expect(entry.item.stars).toBe(4);
    expect(
      entry.options.find((o) => o.kind === "stars")?.plan.target.stars,
    ).toBe(5);
    expect(inv.containers[0]?.slots[0]?.category).toBeNull();
  });
  it("does not infer dungeon suitability from an essence recipe", () => {
    const inv = inventory([item()]);
    expect(advice(inv, { purpose: "dungeons" })).toEqual([]);
    expect(
      advice(inv, {
        purpose: "dungeons",
        dungeonItems: new Set(["ADAPTIVE_BELT"]),
      }),
    ).toHaveLength(1);
  });
  it("fully owned materials need no purchase price", () => {
    const inv = inventory([item()]);
    const entry = advice(inv, {
      prices: unknownPrice,
      member: { essence: { Wither: 10 } },
      budget: 0,
    })[0]!;
    const star = entry.options.find((o) => o.kind === "stars")!;
    expect(star.plan.totalCost).toBe(0);
    expect(star.affordability).toBe("within");
  });
  it("ignores resources from failed containers and never counts missing gear as equipped", () => {
    const inv = inventory([item()]);
    inv.containers.push({
      id: "bad",
      location: "inv_contents",
      size: 1,
      known: false,
      slots: [item({ category: null, itemId: "ESSENCE_WITHER", count: 100 })],
    });
    expect(
      advice(inv)[0]!.options.find((o) => o.kind === "stars")!.plan.totalCost,
    ).toBe(20);
  });
});
