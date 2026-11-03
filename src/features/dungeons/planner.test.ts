import { describe, it, expect } from "vitest";
import { buildDungeonPlan, floorRequirements } from "./planner";
import { CLASSES, FLOORS } from "./catalog";
import {
  createPriceResolver,
  unknownPrice,
} from "@/features/upgrades/calculator";
import type { DecodedInventoryItem, ProfileMemberStats } from "@/types/profile";
import type { Analysis } from "@/features/intelligence/models";
import type { HypixelItem } from "@/types/hypixel";
const item = (
  id: string,
  category: string,
  patch: Partial<DecodedInventoryItem> = {},
): DecodedInventoryItem => ({
  slot: 0,
  itemId: id,
  name: id,
  count: 1,
  damage: 0,
  rarity: "EPIC",
  category,
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
  uuid: id,
  soulbound: false,
  extra: {},
  ...patch,
});
const bow = item("JUJU_SHORTBOW", "BOW"),
  sword = item("ASPECT_OF_THE_DRAGON", "SWORD"),
  belt = item("ADAPTIVE_BELT", "BELT");
const analysis = (
  level: number | null = 33,
  floors: Record<string, number> = { "0": 1, "1": 1, "6": 1 },
) =>
  ({
    uuid: "player",
    profile_id: "profile",
    metrics: [
      { id: "catacombs", level, state: level === null ? "unknown" : "known" },
      { id: "combat", level: 50, state: "known" },
    ],
    floors,
  }) as unknown as Analysis;
const member = (
  items = [bow, sword, belt],
  partial = false,
): ProfileMemberStats =>
  ({
    uuid: "player",
    essence: { WITHER: 0 },
    inventory: {
      available: true,
      reason: null,
      items: [],
      armor: [],
      containers: items.map((x, i) => ({
        id: String(i),
        location: x.category === "BELT" ? "equipment_contents" : "inv_contents",
        known: true,
        size: 1,
        slots: [x],
      })),
      missing: partial
        ? [
            {
              id: "backpack:9",
              location: "backpack:9",
              reason: "backpack-limit",
            },
          ]
        : [],
      errors: [],
      truncated: partial,
      totalItems: items.length,
      availableContainers: items.length,
      totalContainers: items.length,
    },
  }) as unknown as ProfileMemberStats;
const map = new Map(
  [bow, sword, belt].map((x) => [
    x.itemId,
    {
      id: x.itemId,
      name: x.name,
      category: x.category,
      tier: x.rarity,
      dungeon_item: true,
      requirements: [],
      catacombs_requirements: [],
      stats: { intelligence: 0 },
    } as HypixelItem,
  ]),
);
const base = () => ({
  uuid: "player",
  profileId: "profile",
  member: member(),
  analysis: analysis(),
  itemMap: map,
  prices: createPriceResolver({
    bazaar: new Map([
      ["ESSENCE_WITHER", 2],
      ["HOT_POTATO_BOOK", 100],
    ]),
  }),
  dungeonClass: "archer" as const,
  floor: "F7" as const,
  budget: 1000000,
  strategy: "minimal" as const,
});
describe("Dungeon planner gates and scoped Advisor reuse", () => {
  it("lists five classes and fifteen explicit floor choices", () => {
    expect(CLASSES).toHaveLength(5);
    expect(FLOORS).toHaveLength(15);
  });
  it("checks known Catacombs threshold", () => {
    expect(
      floorRequirements("F7", analysis(23)).find(
        (x) => x.subject === "catacombs",
      )?.status,
    ).toBe("unmet");
  });
  it("level alone never proves completion", () => {
    expect(
      floorRequirements("F7", analysis(50, {})).find(
        (x) => x.subject === "completion:6",
      )?.status,
    ).toBe("unknown");
  });
  it("explicit zero completion is unmet", () => {
    expect(
      floorRequirements("F7", analysis(50, { "6": 0 })).at(-1)?.status,
    ).toBe("unmet");
  });
  it("positive completion is met", () => {
    expect(floorRequirements("F7", analysis()).at(-1)?.status).toBe("met");
  });
  it("Entrance requires Combat, not an invented prior clear", () => {
    expect(floorRequirements("E", analysis())).toHaveLength(2);
  });
  it.each(["F5", "F6"] as const)(
    "keeps conflicting %s threshold unknown",
    (f) => {
      expect(
        floorRequirements(f, analysis()).find((x) => x.subject === "catacombs")
          ?.status,
      ).toBe("unknown");
    },
  );
  it("Master Mode remains unsupported, not numerically unlocked", () => {
    const p = buildDungeonPlan({ ...base(), floor: "M7" });
    expect(p.supported).toBe(false);
    expect(p.partialBudget).toBe(true);
    expect(p.rows.every((r) => !r.option)).toBe(true);
  });
  it("Archer selects an actual bow; Berserk an actual sword", () => {
    expect(buildDungeonPlan(base()).rows.at(-1)?.chosen?.item.itemId).toBe(
      bow.itemId,
    );
    expect(
      buildDungeonPlan({ ...base(), dungeonClass: "berserk" }).rows.at(-1)
        ?.chosen?.item.itemId,
    ).toBe(sword.itemId);
  });
  it("does not present an ordinary sword as a Mage ability build", () => {
    expect(
      buildDungeonPlan({ ...base(), dungeonClass: "mage" }).rows.at(-1)?.chosen,
    ).toBe(null);
  });
  it("unknown inventory never means definitely missing", () => {
    const p = buildDungeonPlan({ ...base(), member: member([], true) });
    expect(p.rows.every((r) => r.action === "unknown")).toBe(true);
    expect(p.partialBudget).toBe(true);
  });
  it("a known empty inventory has a missing weapon and partial budget", () => {
    const p = buildDungeonPlan({ ...base(), member: member([]) });
    expect(p.rows.at(-1)?.action).toBe("missing");
    expect(p.remaining).toBe(null);
  });
  it("does not use another UUID's member or analysis", () => {
    const p = buildDungeonPlan({ ...base(), uuid: "other" });
    expect(p.advice).toHaveLength(0);
    expect(p.analysis).toBeUndefined();
  });
  it("does not use another profile's requirements", () => {
    expect(
      buildDungeonPlan({ ...base(), profileId: "other" }).requirements.every(
        (r) => r.status === "unknown",
      ),
    ).toBe(true);
  });
  it("current strategy never auto-applies upgrades", () => {
    expect(
      buildDungeonPlan({ ...base(), strategy: "current" }).rows.every(
        (r) => r.option === null,
      ),
    ).toBe(true);
  });
  it("keeps unknown prices and missing slots out of a complete budget", () => {
    const p = buildDungeonPlan({ ...base(), prices: () => unknownPrice() });
    expect(p.partialBudget).toBe(true);
    expect(p.remaining).toBeNull();
  });
  it("uses only one atomic Advisor option to prevent material double spending", () => {
    const p = buildDungeonPlan(base());
    expect(p.rows.filter((r) => r.option).length).toBeLessThanOrEqual(1);
  });
  it("missing essence is not invented as owned", () => {
    const p = buildDungeonPlan(base());
    for (const r of p.rows)
      for (const m of r.option?.plan.materials ?? [])
        if (m.id.startsWith("ESSENCE_")) expect(m.owned).toBe(0);
  });
  it("retains exact installed instance state and never duplicates one item in slots", () => {
    const p = buildDungeonPlan(base());
    const items = p.rows.flatMap((r) => (r.chosen ? [r.chosen.item.uuid] : []));
    expect(new Set(items).size).toBe(items.length);
    expect(p.rows.at(-1)?.current?.enchantments).toEqual(bow.enchantments);
  });
  it("unconnected purchase catalog always produces Partial Budget", () => {
    expect(
      buildDungeonPlan({ ...base(), strategy: "alternative" }).partialBudget,
    ).toBe(true);
  });
});

it("normalizes metric ID case without inventing missing skills", () => {
  const a = analysis();
  a.metrics[1]!.id = "Combat";
  expect(floorRequirements("E", a)[0]?.status).toBe("met");
});
it("calculates a known zero-spend current build without selling owned gear", () => {
  const items = [
    ...(
      [
        "HELMET",
        "CHESTPLATE",
        "LEGGINGS",
        "BOOTS",
        "NECKLACE",
        "CLOAK",
        "BELT",
        "BRACELET",
      ] as const
    ).map((c) => item(`fixture_${c}`, c)),
    bow,
  ];
  const m = member(items);
  m.inventory.containers.forEach((c) => {
    const category = c.slots[0]!.category!;
    c.location = ["HELMET", "CHESTPLATE", "LEGGINGS", "BOOTS"].includes(
      category,
    )
      ? "inv_armor"
      : category === "BOW"
        ? "inv_contents"
        : "equipment_contents";
  });
  const registry = new Map(
    items.map((x) => [
      x.itemId,
      {
        id: x.itemId,
        name: x.name,
        category: x.category,
        requirements: [],
        catacombs_requirements: [],
      } as HypixelItem,
    ]),
  );
  const p = buildDungeonPlan({
    ...base(),
    member: m,
    itemMap: registry,
    strategy: "current",
    budget: 123,
  });
  expect(p.knownCost).toBe(0);
  expect(p.partialBudget).toBe(false);
  expect(p.remaining).toBe(123);
});
it("retains reforge, enchantments, master-star and gem evidence instead of name-only matching", () => {
  const upgraded = item(sword.itemId, "SWORD", {
    reforge: "withered",
    stars: 7,
    enchantments: { sharpness: 6 },
    recombobulated: true,
    gemstoneSlots: ["COMBAT_0"],
    hotPotatoBooks: 10,
    fumingPotatoBooks: 3,
  });
  const p = buildDungeonPlan({
    ...base(),
    member: member([upgraded]),
    dungeonClass: "berserk",
    strategy: "current",
  });
  expect(p.rows.at(-1)?.chosen?.item).toMatchObject({
    reforge: "withered",
    stars: 7,
    enchantments: { sharpness: 6 },
    recombobulated: true,
    fumingPotatoBooks: 3,
  });
});

it("generates role templates, keeps owned gear and never treats unknown acquisition costs as within", async () => {
  const { VERIFIED_ITEMS } = await import("./replacements");
  const registry = new Map(
    VERIFIED_ITEMS.items.map((x) => [x.id, x as HypixelItem]),
  );
  const a = analysis(50, { "0": 1, "2": 1, "4": 1, "5": 1, "7": 1 });
  a.metrics.push({
    id: "enderman",
    category: "slayer",
    level: 9,
    state: "known",
  } as Analysis["metrics"][number]);
  for (const cls of CLASSES) {
    const p = buildDungeonPlan({
      ...base(),
      member: member([]),
      itemMap: registry,
      analysis: a,
      dungeonClass: cls,
      strategy: "balanced",
      prices: () => unknownPrice(),
    });
    expect(
      p.rows.find((r) => r.slot === "CHESTPLATE")?.chosen?.item.category,
    ).toBe("CHESTPLATE");
    expect(p.rows.at(-1)?.chosen).toBeTruthy();
    expect(p.basket.status).toBe("PARTIAL");
    expect(p.basket.unknown).toBeGreaterThan(0);
  }
});
it("does not charge a current catalog item as a new purchase and preserves its upgrades", async () => {
  const { VERIFIED_ITEMS } = await import("./replacements");
  const registry = new Map(
    VERIFIED_ITEMS.items.map((x) => [x.id, x as HypixelItem]),
  );
  const existing = item("SHADOW_FURY", "SWORD", {
    stars: 5,
    hotPotatoBooks: 10,
    reforge: "withered",
  });
  const p = buildDungeonPlan({
    ...base(),
    member: member([existing]),
    itemMap: registry,
    analysis: analysis(50, { "5": 1, "7": 1 }),
    dungeonClass: "berserk",
    strategy: "balanced",
    upgradeSelection: [],
  });
  expect(p.rows.at(-1)?.purchase).toBe(false);
  expect(p.rows.at(-1)?.chosen?.item.reforge).toBe("withered");
  expect(p.rows.at(-1)?.action).toBe("keep");
});
it("a locked replacement is not immediately available", async () => {
  const { VERIFIED_ITEMS } = await import("./replacements");
  const registry = new Map(
    VERIFIED_ITEMS.items.map((x) => [x.id, x as HypixelItem]),
  );
  const p = buildDungeonPlan({
    ...base(),
    member: member([]),
    itemMap: registry,
    analysis: analysis(50, { "7": 0 }),
    dungeonClass: "tank",
    strategy: "balanced",
  });
  const r = p.rows.find((r) => r.slot === "CHESTPLATE")!;
  expect(r.availability).toBe("unmet");
  expect(r.action).toBe("unknown");
  expect(r.purchase).toBe(false);
});
