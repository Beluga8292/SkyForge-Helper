import { z } from "zod";
import type { Analysis, AccessoryCandidate, Recommendation } from "./models";
import { rules } from "./engine";
export const preferencesSchema = z.object({
  activities: z.array(z.string()).max(10),
  budget: z.number().finite().min(0).max(1e15),
  avoidExpensive: z.boolean(),
  horizon: z.enum(["short", "long"]),
  dungeonClass: z.enum(["archer", "berserk", "mage", "healer", "tank"]),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: Preferences = {
  activities: ["general"],
  budget: 10000000,
  avoidExpensive: true,
  horizon: "short",
  dungeonClass: "mage",
};
export function rank(rows: Recommendation[], p: Preferences) {
  return rows
    .map((r) => {
      const preference = p.activities.some(
        (v) => v === r.category || v.toLowerCase() === r.subject.toLowerCase(),
      )
        ? 20
        : 0;
      const budget = r.cost !== null && r.cost > p.budget ? -30 : 0;
      const expensive =
        p.avoidExpensive && r.cost !== null && r.cost > p.budget / 2 ? -10 : 0;
      const horizon =
        p.horizon === "short" &&
        r.remaining !== null &&
        r.current !== null &&
        r.target !== null
          ? Math.min(10, (r.current / r.target) * 10)
          : 0;
      return {
        ...r,
        score: r.score + preference + budget + expensive + horizon,
        ranking: { base: r.score, preference, budget, expensive, horizon },
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function optimizeAccessories(
  candidates: AccessoryCandidate[],
  budget: number,
) {
  type Choice = { cost: number; gain: number; items: string[] };
  let states: Choice[] = [{ cost: 0, gain: 0, items: [] }],
    exact = true;
  const groups = new Map<string, AccessoryCandidate[]>();
  for (const c of candidates) {
    if (
      c.cost === null ||
      c.gain === null ||
      c.gain <= 0 ||
      c.cost < 0 ||
      c.cost > budget ||
      c.requirements.length ||
      c.price_timestamp === null ||
      Date.now() - c.price_timestamp > 120000
    )
      continue;
    groups.set(c.family, [...(groups.get(c.family) ?? []), c]);
  }
  for (const [, options] of [...groups].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const next = [...states];
    for (const s of states)
      for (const c of options)
        if (s.cost + c.cost! <= budget)
          next.push({
            cost: s.cost + c.cost!,
            gain: s.gain + c.gain!,
            items: [...s.items, c.item_id],
          });
    next.sort(
      (a, b) =>
        a.cost - b.cost ||
        b.gain - a.gain ||
        a.items.join().localeCompare(b.items.join()),
    );
    let gain = -1;
    states = next.filter((s) => {
      if (s.gain <= gain) return false;
      gain = s.gain;
      return true;
    });
    if (states.length > 5000) {
      exact = false;
      states = states
        .filter((_, i) => i % Math.ceil(states.length / 5000) === 0)
        .slice(0, 5000);
    }
  }
  const best = states.sort((a, b) => b.gain - a.gain || a.cost - b.cost)[0] ?? {
    cost: 0,
    gain: 0,
    items: [],
  };
  return { ...best, exact, groups: groups.size };
}
export const goalSchema = z.object({
  id: z.string(),
  category: z.enum([
    "skills",
    "slayer",
    "dungeons",
    "general",
    "accessories",
    "economy",
    "obtain",
    "floor",
  ]),
  subject: z.string().min(1).max(96),
  target: z.number().finite().min(0).max(1e18),
  status: z.enum(["planned", "in_progress", "completed", "paused"]),
  manual: z.boolean(),
  notify: z.boolean(),
  createdAt: z.number(),
  completedAt: z.number().nullable(),
  lastSnapshot: z.number().nullable(),
});
export type Goal = z.infer<typeof goalSchema>;
export interface GoalProgress {
  current: number | null;
  progress: number | null;
  verified: boolean;
}
export function goalProgress(goal: Goal, a: Analysis): GoalProgress {
  let current: number | null = null;
  if (goal.category === "floor")
    current =
      a.completeness.dungeons === "known"
        ? (a.floors[goal.subject] ?? 0)
        : null;
  else if (goal.category === "obtain")
    current =
      a.completeness.accessory_bag === "known"
        ? a.assets.some(
            (i) => i.location === "accessory_bag" && i.item_id === goal.subject,
          )
          ? 1
          : 0
        : null;
  else if (goal.category === "accessories") current = a.accessory_power;
  else {
    const m = a.metrics.find(
      (m) => m.category === goal.category && m.id === goal.subject,
    );
    current =
      m?.state === "known" &&
      m.scope === "member" &&
      !(
        goal.category === "skills" &&
        ["FARMING", "TAMING"].includes(goal.subject) &&
        goal.target > 50
      )
        ? goal.category === "economy"
          ? m.value
          : m.level
        : null;
  }
  return {
    current,
    progress:
      current === null
        ? null
        : goal.target === 0
          ? 1
          : Math.min(1, current / goal.target),
    verified: current !== null && !a.stale && !a.demo,
  };
}
export function updateGoals(goals: Goal[], a: Analysis) {
  const completed: Goal[] = [];
  const next = goals.map((g) => {
    const p = goalProgress(g, a);
    if (
      g.status !== "paused" &&
      g.status !== "completed" &&
      p.verified &&
      p.current! >= g.target &&
      a.fetched_at >= g.createdAt &&
      a.fetched_at > (g.lastSnapshot ?? 0)
    ) {
      const value = {
        ...g,
        status: "completed" as const,
        manual: false,
        completedAt: Date.now(),
        lastSnapshot: a.fetched_at,
      };
      completed.push(value);
      return value;
    }
    return g;
  });
  return { goals: next, completed };
}
export const historySchema = z
  .array(
    z.object({
      at: z.number(),
      total: z.number().nullable(),
      coverage: z.number().nullable(),
      unknown: z.number(),
      source: z.string(),
      stale: z.boolean(),
    }),
  )
  .max(365);
export type HistoryPoint = z.infer<typeof historySchema>[number];
export function appendHistory(
  history: z.infer<typeof historySchema>,
  a: Analysis,
) {
  if (a.demo || a.stale || history.some((h) => h.at === a.fetched_at))
    return history;
  return [
    ...history,
    {
      at: a.fetched_at,
      total: a.networth.known_total,
      coverage: a.networth.coverage,
      unknown: a.networth.unknown_count,
      source: a.source,
      stale: a.stale,
    },
  ]
    .sort((a, b) => a.at - b.at)
    .slice(-365);
}
export function slayerPlan(
  id: string,
  xp: number,
  targetLevel: number,
  tier: number,
  fee: number,
  bonusPct = 0,
) {
  const table = (rules.slayer_xp as Record<string, number[]>)[id],
    rewards =
      (rules.slayer_boss_xp_type as Record<string, number[]>)[id] ??
      rules.slayer_boss_xp;
  const max = (rules.slayer_tiers as Record<string, number>)[id];
  if (
    !table ||
    tier < 1 ||
    tier > max! ||
    !table[targetLevel] ||
    xp < 0 ||
    fee < 0 ||
    bonusPct < 0 ||
    !Number.isFinite(fee) ||
    !Number.isFinite(xp)
  )
    return null;
  const remaining = Math.max(0, table[targetLevel]! - xp),
    reward = rewards[tier - 1]! * (1 + bonusPct / 100),
    runs = Math.ceil(remaining / reward);
  return { remaining, reward, runs, cost: runs * fee };
}

/** Exact bounded min-cost mixture, or a labelled single-tier fallback for a large state space. */
export function slayerMix(id: string, remaining: number, fees: number[]) {
  const rewards =
      (rules.slayer_boss_xp_type as Record<string, number[]>)[id] ??
      rules.slayer_boss_xp,
    max = (rules.slayer_tiers as Record<string, number>)[id];
  if (
    !max ||
    !Number.isFinite(remaining) ||
    remaining < 0 ||
    fees.length < max ||
    fees.some((f) => !Number.isFinite(f) || f < 0)
  )
    return null;
  const target = Math.ceil(remaining),
    limit = target + Math.max(...rewards.slice(0, max));
  if (limit > 50000) {
    const options = rewards
      .slice(0, max)
      .map((r, i) => ({
        cost: Math.ceil(target / r) * fees[i]!,
        runs: Array.from({ length: max }, (_, j) =>
          i === j ? Math.ceil(target / r) : 0,
        ),
      }))
      .sort((a, b) => a.cost - b.cost);
    return { ...options[0]!, exact: false };
  }
  const costs = new Float64Array(limit + 1).fill(Infinity),
    previous = new Int32Array(limit + 1).fill(-1),
    tier = new Int16Array(limit + 1).fill(-1);
  costs[0] = 0;
  for (let xp = 0; xp <= limit; xp++) {
    if (!Number.isFinite(costs[xp])) continue;
    for (let i = 0; i < max; i++) {
      const next = xp + rewards[i]!;
      if (next <= limit && costs[xp]! + fees[i]! < costs[next]!) {
        costs[next] = costs[xp]! + fees[i]!;
        previous[next] = xp;
        tier[next] = i;
      }
    }
  }
  let best = target;
  for (let xp = target; xp <= limit; xp++)
    if (costs[xp]! < costs[best]!) best = xp;
  const runs = Array<number>(max).fill(0);
  let cursor = best;
  while (cursor > 0 && previous[cursor] !== -1) {
    runs[tier[cursor]!]!++;
    cursor = previous[cursor]!;
  }
  return { cost: costs[best]!, runs, exact: true };
}
