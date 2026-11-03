import { describe, it, expect, vi, afterEach } from "vitest";
import {
  normalizeProfile,
  enrichLocal,
  milestone,
  petProgress,
  gearCandidates,
} from "./engine";
import { demoProfile, localIntelligenceProvider } from "./provider";
import { analysisSchema, type AccessoryCandidate } from "./models";
import {
  optimizeAccessories,
  rank,
  defaultPreferences,
  goalSchema,
  goalProgress,
  updateGoals,
  appendHistory,
  slayerPlan,
  slayerMix,
} from "./planning";
import resources from "./demo-resources.json";
import { dictionaries } from "@/locales";
import {
  readMarketSetting,
  writeMarketSetting,
} from "@/features/market/storage";
import type { DataProvider } from "@/data/types";
const uuid = "0123456789abcdef0123456789abcdef",
  id = "abcdefabcdefabcdefabcdefabcdefab";
const items = Object.fromEntries(resources.items.map((i) => [i.id, i]));
const make = async () =>
  enrichLocal(
    await normalizeProfile(
      demoProfile(uuid, id),
      uuid,
      resources.skills,
      items,
      10000,
      "direct",
    ),
    items,
  );
const candidate = (
  item_id: string,
  family: string,
  gain: number,
  cost: number,
): AccessoryCandidate => ({
  item_id,
  family,
  gain,
  cost,
  rarity: "COMMON",
  coins_per_point: cost / gain,
  method: "test",
  confidence: "medium",
  requirements: [],
  price_timestamp: Date.now(),
});
const goal = (overrides = {}) =>
  goalSchema.parse({
    id: "g",
    category: "skills",
    subject: "MINING",
    target: 1,
    status: "planned",
    manual: false,
    notify: false,
    createdAt: 1000,
    completedAt: null,
    lastSnapshot: null,
    ...overrides,
  });
afterEach(() => vi.unstubAllGlobals());
describe("profile intelligence contracts", () => {
  it("normalizes a synthetic fixture through the real bounded NBT decoder", async () => {
    const a = await make();
    expect(analysisSchema.parse(a)).toEqual(a);
    expect(a.assets.length).toBe(3);
    expect(a.accessory_power).toBe(6);
    expect(a.profile_id).toBe(id);
    expect(a.metrics.find((m) => m.id === "MINING")?.level).not.toBeNull();
  });
  it("separates selected co-op member and shared bank", async () => {
    const p = demoProfile(uuid, id);
    Object.assign(p.members, {
      ["f".repeat(32)]: { currencies: { coin_purse: 999999 } },
    });
    const a = enrichLocal(
      await normalizeProfile(p, uuid, {}, items, 10000, "direct"),
      items,
    );
    expect(a.coop).toBe(true);
    expect(a.networth.shared_bank).toBe(p.banking.balance);
    expect(a.networth.personal_liquid).toBe(
      p.members[uuid]?.currencies.coin_purse,
    );
  });
  it("rejects missing membership instead of choosing the first co-op member", async () => {
    await expect(
      normalizeProfile(
        demoProfile(uuid, id),
        "f".repeat(32),
        {},
        items,
        1000,
        "direct",
      ),
    ).rejects.toThrow("member");
  });
  it("does not recommend purchases when accessory bag is private", async () => {
    const p = demoProfile(uuid, id);
    delete (p.members[uuid] as Record<string, unknown>).inventory;
    const a = enrichLocal(
      await normalizeProfile(p, uuid, {}, items, 1000, "direct"),
      items,
    );
    expect(a.accessories).toEqual([]);
    expect(a.accessory_power).toBeNull();
    expect(a.completeness.accessory_bag).toBe("private");
  });
  it.each(["broken", "x".repeat(2 * 1024 * 1024 + 1)])(
    "classifies malformed or oversized NBT",
    async (blob) => {
      const p = demoProfile(uuid, id);
      p.members[uuid]!.inventory.inv_contents.data = blob;
      const a = await normalizeProfile(p, uuid, {}, items, 1000, "direct");
      expect(a.completeness.inv_contents).toBe("invalid");
    },
  );
  it("does not turn unknown progression into zero", () => {
    expect(
      milestone("x", "skills", undefined, [0, 100], "test").level,
    ).toBeNull();
    expect(milestone("x", "skills", 0, [0, 100], "test").value).toBe(0);
  });
  it("uses cumulative thresholds and omits completed milestones", async () => {
    expect(
      milestone("cata", "dungeons", 125, [0, 50, 125, 235], "test"),
    ).toMatchObject({ level: 2, remaining: 110, progress: 0 });
    const a = await make();
    expect(a.recommendations.some((r) => r.id === "floor:1")).toBe(false);
    expect(a.recommendations.find((r) => r.id === "floor:5")?.status).toBe(
      "locked",
    );
  });
  it("calculates nonlinear and custom pet levels", () => {
    expect(petProgress({ type: "WOLF", tier: "COMMON", exp: 210 }).level).toBe(
      3,
    );
    expect(
      petProgress({ type: "BINGO", tier: "LEGENDARY", exp: 100 }).level,
    ).toBe(2);
    expect(
      petProgress({ type: "REINDEER", tier: "COMMON", exp: 100 }).level,
    ).toBe(1);
    expect(
      petProgress({ type: "GOLDEN_DRAGON", tier: "LEGENDARY", exp: 1e12 })
        .level,
    ).toBe(200);
    expect(
      petProgress({ type: "WOLF", tier: "UNKNOWN", exp: 100 }).level,
    ).toBeNull();
  });
  it("returns deterministic recommendations and explanatory ranking", async () => {
    const a = await make(),
      b = await make();
    expect(a.recommendations).toEqual(b.recommendations);
    const ordered = rank(a.recommendations, {
      ...defaultPreferences,
      activities: ["dungeons"],
    });
    expect(
      ordered.find((r) => r.category === "dungeons")?.ranking.preference,
    ).toBe(20);
    expect(ordered.every((r) => r.reason && r.source)).toBe(true);
  });
  it("refuses actionable gear advice with missing Slayer prerequisites", async () => {
    const a = await make();
    a.metrics = a.metrics.filter((m) => m.category !== "slayer");
    const r = gearCandidates(a, items).find(
      (r) => r.subject === "JUJU_SHORTBOW",
    );
    expect(r?.status).toBe("missing_data");
    expect(r?.requirements.length).toBeGreaterThan(0);
  });
  it("preserves unknown asset values and incomplete coverage", async () => {
    const a = await make();
    expect(a.assets.every((i) => i.value === null)).toBe(true);
    expect(a.networth.complete).toBe(false);
    expect(a.networth.coverage).toBe(0);
  });
  it("does not invent history or mix demo/stale snapshots", async () => {
    const a = await make();
    expect(appendHistory([], { ...a, demo: true })).toEqual([]);
    expect(appendHistory([], { ...a, stale: true })).toEqual([]);
    const first = appendHistory([], a);
    expect(first).toHaveLength(1);
    expect(appendHistory(first, a)).toHaveLength(1);
  });
  it("keeps backend offline errors and cancelled direct requests", async () => {
    const p = {
      isDemo: false,
      getProfiles: async () => {
        throw Error("offline");
      },
    } as unknown as DataProvider;
    await expect(
      localIntelligenceProvider(() => p).getIntelligence(uuid, id),
    ).rejects.toThrow("offline");
    const controller = new AbortController();
    controller.abort();
    const cancelled = {
      isDemo: true,
      getItems: async () => ({ data: { items: [] } }),
      getSkills: async () => ({ data: { skills: {} } }),
    } as unknown as DataProvider;
    await expect(
      localIntelligenceProvider(() => cancelled).getIntelligence(
        uuid,
        id,
        false,
        controller.signal,
      ),
    ).rejects.toThrow();
  });
  it("provides every new label in RU and EN", () => {
    for (const key of Object.keys(dictionaries.ru).filter((k) =>
      k.startsWith("intel."),
    )) {
      expect(dictionaries.en[key as keyof typeof dictionaries.en]).toBeTruthy();
    }
  });
});
describe("bounded family shopping optimizer", () => {
  it("beats a naive ratio greedy choice and respects a family", () => {
    const plan = optimizeAccessories(
      [
        candidate("a", "a", 9, 6),
        candidate("b", "b", 8, 5),
        candidate("c", "c", 8, 5),
      ],
      10,
    );
    expect(plan.gain).toBe(16);
    expect(plan.items).toEqual(["b", "c"]);
    expect(plan.exact).toBe(true);
    const family = optimizeAccessories(
      [candidate("low", "same", 3, 3), candidate("high", "same", 8, 8)],
      20,
    );
    expect(family.gain).toBe(8);
    expect(family.items).toHaveLength(1);
  });
  it("excludes unknown prices, dependencies and over-budget candidates", () => {
    const a = candidate("a", "a", 5, 100);
    const plan = optimizeAccessories(
      [
        a,
        { ...a, item_id: "unknown", cost: null },
        { ...a, item_id: "locked", cost: 1, requirements: ["quest"] },
      ],
      10,
    );
    expect(plan.cost).toBe(0);
  });
  it("keeps deterministic ties and never overspends fractional costs", () => {
    const rows = [candidate("a", "a", 3, 1.2), candidate("b", "b", 4, 1.3)];
    expect(optimizeAccessories(rows, 2.4).cost).toBeLessThanOrEqual(2.4);
    expect(optimizeAccessories(rows, 2.4)).toEqual(
      optimizeAccessories(rows, 2.4),
    );
  });
});
describe("goals and local snapshots", () => {
  it("auto completes only a fresh, newer, non-demo profile observation", async () => {
    const a = await make(),
      g = goal();
    expect(updateGoals([g], a).goals[0]?.status).toBe("completed");
    for (const value of [
      { ...a, demo: true },
      { ...a, stale: true },
      { ...a, fetched_at: 500 },
    ])
      expect(updateGoals([g], value).completed).toEqual([]);
  });
  it("does not override paused or manually completed goals", async () => {
    const a = await make();
    const paused = goal({ status: "paused" }),
      manual = goal({ status: "completed", manual: true });
    expect(updateGoals([paused, manual], a).goals).toEqual([paused, manual]);
  });
  it("does not complete unknown accessory-power or missing subjects", async () => {
    const a = await make();
    expect(
      goalProgress(goal({ category: "accessories" }), {
        ...a,
        accessory_power: null,
      }).current,
    ).toBeNull();
    expect(updateGoals([goal({ subject: "UNKNOWN" })], a).completed).toEqual(
      [],
    );
  });
  it("persists different profile/source namespaces in existing settings JSON", async () => {
    const map = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => map.set(k, v),
      },
    });
    await writeMarketSetting("intelligence:v1:backend:one", {
      version: 1,
      goals: [goal()],
    });
    await writeMarketSetting("intelligence:v1:demo:one", {
      version: 1,
      goals: [],
    });
    expect(
      (
        (await readMarketSetting("intelligence:v1:backend:one")) as {
          goals: unknown[];
        }
      ).goals,
    ).toHaveLength(1);
    expect(await readMarketSetting("intelligence:v1:backend:two")).toBeNull();
  });
});
describe("Slayer run scenarios", () => {
  it("uses verified XP rewards and editable cost assumptions", () => {
    expect(slayerPlan("zombie", 1000, 5, 4, 50000)).toMatchObject({
      remaining: 4000,
      reward: 500,
      runs: 8,
      cost: 400000,
    });
    expect(slayerPlan("vampire", 75, 3, 3, 2000)).toMatchObject({
      remaining: 165,
      reward: 60,
      runs: 3,
    });
    expect(slayerPlan("zombie", 1000, 5, 4, 50000, 100)?.runs).toBe(4);
  });
  it("rejects unsupported categories and tiers", () => {
    expect(slayerPlan("future", 0, 5, 4, 1)).toBeNull();
    expect(slayerPlan("wolf", 0, 5, 5, 1)).toBeNull();
  });
});

describe("large bounded inventories and mixed Slayer scenarios", () => {
  it("normalizes one thousand NBT slots without truncating or fabricating value", async () => {
    const fixture = await import("./test-large-inventory.json");
    const p = demoProfile(uuid, id);
    p.members[uuid]!.inventory.inv_contents.data = fixture.default.data;
    const a = await normalizeProfile(p, uuid, {}, items, 10000, "direct");
    expect(a.assets.filter((i) => i.location === "inv_contents")).toHaveLength(
      1000,
    );
  });
  it("finds a non-greedy minimum-cost mixed boss plan for a bounded target", () => {
    const result = slayerMix("zombie", 30, [3, 10, 100, 1000, 10000]);
    expect(result).toMatchObject({ cost: 13, exact: true });
    expect(result?.runs.slice(0, 2)).toEqual([1, 1]);
    expect(slayerMix("zombie", 1000000, [3, 10, 100, 1000, 10000])?.exact).toBe(
      false,
    );
  });
});

it("terminates an active profile worker when the caller cancels", async () => {
  const controller = new AbortController();
  const terminate = vi.fn();
  class FakeWorker {
    onmessage: unknown;
    onerror: unknown;
    terminate = terminate;
    postMessage() {
      controller.abort();
    }
  }
  vi.stubGlobal("Worker", FakeWorker);
  const provider = {
    isDemo: true,
    id: "demo",
    getItems: async () => ({ data: { items: resources.items } }),
    getSkills: async () => ({ data: { skills: resources.skills } }),
  } as unknown as DataProvider;
  await expect(
    localIntelligenceProvider(() => provider).getIntelligence(
      uuid,
      id,
      false,
      controller.signal,
    ),
  ).rejects.toThrow("Aborted");
  expect(terminate).toHaveBeenCalledOnce();
});
