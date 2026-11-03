import { beforeEach, it, expect, vi } from "vitest";
import {
  saveDungeonPlan,
  loadDungeonPlan,
  type SavedDungeonPlan,
} from "./storage";
vi.mock("@/api/transport", () => ({ isTauriRuntime: () => false }));
const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => memory.set(k, v),
    },
  });
});
const plan: SavedDungeonPlan = {
  schemaVersion: 1,
  uuid: "player",
  profileId: "profile",
  dungeonClass: "archer",
  floor: "F7",
  budget: 100,
  strategy: "current",
  selectedBuild: [
    { slot: "weapon", itemId: "JUJU_SHORTBOW", uuid: "instance" },
  ],
  plannedUpgrades: [],
  timestamp: 123,
};
it("roundtrips build without touching other settings", async () => {
  memory.set("sbc:settings", "unchanged");
  await saveDungeonPlan(plan);
  expect(await loadDungeonPlan("player", "profile")).toEqual(plan);
  expect(memory.get("sbc:settings")).toBe("unchanged");
});
it("isolates UUID", async () => {
  await saveDungeonPlan(plan);
  expect(await loadDungeonPlan("other", "profile")).toBeNull();
});
it("isolates profile", async () => {
  await saveDungeonPlan(plan);
  expect(await loadDungeonPlan("player", "other")).toBeNull();
});
it("rejects corrupt or future schema without deleting it", async () => {
  await saveDungeonPlan(plan);
  const k = [...memory.keys()][0]!;
  memory.set(k, '{"schemaVersion":2}');
  expect(await loadDungeonPlan("player", "profile")).toBeNull();
  expect(memory.has(k)).toBe(true);
});
it("rejects nonfinite and negative budgets", async () => {
  await expect(saveDungeonPlan({ ...plan, budget: -1 })).rejects.toThrow();
  await expect(
    saveDungeonPlan({ ...plan, budget: Infinity }),
  ).rejects.toThrow();
});

it("retains v1 compatibility and roundtrips v2 shared-budget selection", async () => {
  await saveDungeonPlan(plan);
  expect((await loadDungeonPlan("player", "profile"))?.schemaVersion).toBe(1);
  const v2: SavedDungeonPlan = {
    ...plan,
    schemaVersion: 2,
    upgradeSelection: ["one", "two"],
    plannedUpgrades: [
      { slot: "weapon", optionId: "one" },
      { slot: "weapon", optionId: "two" },
    ],
    budgetSnapshot: { total: 40, unknown: 2, status: "PARTIAL" },
  };
  await saveDungeonPlan(v2);
  expect(await loadDungeonPlan("player", "profile")).toEqual(v2);
});
