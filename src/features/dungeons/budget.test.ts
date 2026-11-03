import { it, expect } from "vitest";
import { totalBuildBudget, type UpgradeChange } from "./budget";
import {
  unknownPrice,
  type UpgradeState,
} from "@/features/upgrades/calculator";
const state = (books = 0, stars = 0): UpgradeState => ({
  stars,
  hotPotatoBooks: books,
  fumingPotatoBooks: 0,
  recombobulated: false,
  reforge: null,
  enchantments: {},
  gemstoneSlots: [],
});
const change = (key: string, books: number, current = 0): UpgradeChange => ({
  key,
  facts: {
    itemId: "LIVID_DAGGER",
    name: "Livid Dagger",
    category: "SWORD",
    rarity: "LEGENDARY",
  },
  current: state(current),
  target: state(books),
});
const quote = (unit: number | null) => ({
  unit,
  method: unit === null ? ("unknown" as const) : ("bazaar" as const),
  confidence: unit === null ? ("unknown" as const) : ("medium" as const),
});
const base = () => ({
  changes: [] as UpgradeChange[],
  purchases: [] as Array<{
    key: string;
    itemId: string;
    quantity: number;
    owned: boolean;
  }>,
  owned: {} as Record<string, number>,
  prices: () => quote(10),
  budget: 1000,
});
it("aggregates 8 + 6 resources and credits stock 10 once: missing 4", () => {
  const b = totalBuildBudget({
    ...base(),
    changes: [change("a", 8), change("b", 6)],
    owned: { HOT_POTATO_BOOK: 10 },
  });
  expect(b.materials.find((m) => m.id === "HOT_POTATO_BOOK")).toMatchObject({
    required: 14,
    owned: 10,
    missing: 4,
  });
  expect(b.total).toBe(40);
  expect(b.status).toBe("WITHIN");
  expect(b.remaining).toBe(960);
});
it("fully owned materials cost zero even with no market quote", () => {
  const b = totalBuildBudget({
    ...base(),
    changes: [change("a", 8)],
    owned: { HOT_POTATO_BOOK: 8 },
    prices: () => unknownPrice(),
  });
  expect(b.total).toBe(0);
  expect(b.unknown).toBe(0);
  expect(b.status).toBe("WITHIN");
});
it("merges duplicate targets for one instance rather than buying upgrades twice", () => {
  const b = totalBuildBudget({
    ...base(),
    changes: [change("a", 8), change("a", 8), change("a", 10)],
  });
  expect(b.materials[0]?.required).toBe(10);
  expect(b.total).toBe(100);
});
it("installed upgrades are not new costs", () => {
  expect(
    totalBuildBudget({ ...base(), changes: [change("a", 10, 10)] }).total,
  ).toBe(0);
});
it("keeps unknown mandatory quotes partial rather than zero within", () => {
  const b = totalBuildBudget({
    ...base(),
    changes: [change("a", 8)],
    prices: () => unknownPrice(),
  });
  expect(b.status).toBe("PARTIAL");
  expect(b.unknown).toBeGreaterThan(0);
  expect(b.remaining).toBeNull();
});
it("known over-budget wins even when extra costs are unknown", () => {
  const b = totalBuildBudget({
    ...base(),
    budget: 5,
    changes: [change("a", 8)],
    purchases: [{ key: "weapon", itemId: "NEW", quantity: 1, owned: false }],
    prices: (id) => (id === "NEW" ? quote(10) : unknownPrice()),
  });
  expect(b.status).toBe("OVER");
  expect(b.unknown).toBeGreaterThan(0);
  expect(b.remaining).toBeNull();
});
it("sums known purchases and upgrades", () => {
  const b = totalBuildBudget({
    ...base(),
    changes: [change("a", 8)],
    purchases: [{ key: "weapon", itemId: "NEW", quantity: 1, owned: false }],
  });
  expect(b.purchaseCost).toBe(10);
  expect(b.upgradeCost).toBe(80);
  expect(b.total).toBe(90);
});
it("does not sell or charge owned gear, or subtract its value", () => {
  const b = totalBuildBudget({
    ...base(),
    purchases: [
      { key: "weapon", itemId: "SOULBOUND", quantity: 1, owned: true },
    ],
  });
  expect(b.total).toBe(0);
  expect(b.remaining).toBe(1000);
});
it("deduplicates one purchase action", () => {
  const p = { key: "weapon", itemId: "NEW", quantity: 1, owned: false };
  expect(totalBuildBudget({ ...base(), purchases: [p, p] }).purchaseCost).toBe(
    10,
  );
});
it.each([-1, NaN, Infinity, null])("invalid budget %s is Unknown", (budget) => {
  expect(totalBuildBudget({ ...base(), budget }).status).toBe("UNKNOWN");
});
it("stale quotes are never guaranteed within budget", () => {
  expect(totalBuildBudget({ ...base(), stale: true }).status).toBe("PARTIAL");
});
it("shared essence is aggregated across two items", () => {
  const a = change("a", 0);
  a.facts = {
    itemId: "ADAPTIVE_BELT",
    name: "Belt",
    category: "BELT",
    rarity: "EPIC",
  };
  a.target.stars = 1;
  const b = { ...a, key: "b" };
  const result = totalBuildBudget({
    ...base(),
    changes: [a, b],
    owned: { ESSENCE_WITHER: 1 },
  });
  const essence = result.materials.find((m) => m.id.startsWith("ESSENCE_"));
  expect(essence).toBeDefined();
  expect(essence!.required).toBeGreaterThan(0);
  expect(result.materials.filter((m) => m.id === essence!.id)).toHaveLength(1);
});
it("rejects conflicting current instance states as unknown", () => {
  expect(
    totalBuildBudget({
      ...base(),
      changes: [change("a", 8), change("a", 10, 5)],
    }).unknown,
  ).toBeGreaterThan(0);
});

it("two different upgrades of one item merge into one gross plan", () => {
  const a = change("one", 8),
    b = change("one", 0);
  b.target.recombobulated = true;
  const result = totalBuildBudget({
    ...base(),
    changes: [a, b],
    owned: { HOT_POTATO_BOOK: 5, RECOMBOBULATOR_3000: 1 },
  });
  expect(
    result.materials.find((m) => m.id === "HOT_POTATO_BOOK")?.missing,
  ).toBe(3);
  expect(
    result.materials.find((m) => m.id === "RECOMBOBULATOR_3000")?.missing,
  ).toBe(0);
  expect(result.total).toBe(30);
});
