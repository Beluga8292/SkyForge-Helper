import { it, expect } from "vitest";
import {
  VERIFIED_ITEMS,
  catalogClasses,
  replacementCandidates,
} from "./replacements";
import { UPGRADE_CATALOG } from "@/features/upgrades/catalog";
import { CLASSES } from "./catalog";
import type { HypixelItem } from "@/types/hypixel";
import type { Analysis } from "@/features/intelligence/models";
const registry = new Map(
  VERIFIED_ITEMS.items.map((x) => [x.id, x as HypixelItem]),
);
const a = {
  metrics: [
    { id: "catacombs", level: 50, state: "known" },
    { id: "enderman", category: "slayer", level: 9, state: "known" },
  ],
  floors: { "2": 1, "4": 1, "5": 1, "7": 1 },
} as unknown as Analysis;
it("all 21 IDs also exist in the independent commit-pinned NEU upgrade catalog", () => {
  expect(VERIFIED_ITEMS.items).toHaveLength(21);
  for (const x of VERIFIED_ITEMS.items) {
    expect(UPGRADE_CATALOG.items[x.id]).toBeDefined();
    expect(x.name).toBeTruthy();
    expect(x.category).toBeTruthy();
    expect(catalogClasses(x.id).length).toBeGreaterThan(0);
  }
});
it.each(CLASSES)("has verified weapon and armor candidates for %s", (cls) => {
  expect(
    replacementCandidates("weapon", cls, registry, a).length,
  ).toBeGreaterThan(0);
  expect(
    replacementCandidates("CHESTPLATE", cls, registry, a).length,
  ).toBeGreaterThan(0);
});
it("never returns a weapon in an armor slot", () => {
  expect(
    replacementCandidates("CHESTPLATE", "archer", registry, a).every(
      (x) => x.item.category === "CHESTPLATE",
    ),
  ).toBe(true);
});
it("runtime registry absence or slot mismatch excludes a catalog entry", () => {
  expect(replacementCandidates("weapon", "archer", new Map(), a)).toEqual([]);
  const bad = new Map(registry);
  bad.set("JUJU_SHORTBOW", {
    id: "JUJU_SHORTBOW",
    name: "bad",
    category: "HELMET",
  });
  expect(replacementCandidates("weapon", "archer", bad, a)).toEqual([]);
});
it("unknown requirements are not met; level is not proof of completion", () => {
  const r = replacementCandidates("CHESTPLATE", "tank", registry, {
    ...a,
    floors: {},
  });
  expect(r[0]!.requirements.some((x) => x.status === "unknown")).toBe(true);
});
it("keeps base proposals separate from upgraded/dungeonized instances", () => {
  const r = replacementCandidates("weapon", "archer", registry, a)[0]!;
  expect(r.location).toBe("catalog");
  expect(r.item.uuid).toBeNull();
  expect(r.item.extra).toEqual({});
  expect(r.item.stars).toBe(0);
});

it("compares verified base stats without interpreting an absent stat as zero", async () => {
  const { baseStatComparison } = await import("./replacements");
  const changes = baseStatComparison(
    "FLORID_ZOMBIE_SWORD",
    "TANK_WITHER_CHESTPLATE",
    registry,
  );
  expect(changes.find((x) => x.stat === "DEFENSE")?.before).toBeNull();
  expect(changes.find((x) => x.stat === "DEFENSE")?.after).toBe(275);
});
