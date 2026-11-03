import metadata from "@/data/upgrades/advisor-metadata.json";
import type { Analysis } from "@/features/intelligence/models";
import type { DecodedInventoryItem } from "@/types/profile";
import type { UpgradePlan } from "./calculator";
export const ADVISOR_METADATA = metadata as {
  source: { url: string; commit: string };
  reforges: Record<
    string,
    {
      reforgeName: string;
      reforgeStats?: Record<string, Record<string, number>>;
      reforgeAbility?: string;
    }
  >;
  conflicts: string[][];
  enchantLevels: Record<string, number>;
  potatoStats: {
    armor: Record<string, number>;
    weapon: Record<string, number>;
  };
};
export interface RequirementCheck {
  scope?: "dungeons";
  type: string;
  subject: string;
  target: number | null;
  current: number | null;
  status: "met" | "unmet" | "unknown";
}
/** Unknown requirement kinds and missing metrics never become failed requirements. */
export function checkRequirements(
  raw: unknown,
  analysis?: Analysis,
): RequirementCheck[] {
  if (!Array.isArray(raw))
    return [
      {
        type: "UNKNOWN",
        subject: "",
        target: null,
        current: null,
        status: "unknown",
      },
    ];
  return raw.map((value) => {
    const r =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    const type = typeof r.type === "string" ? r.type : "UNKNOWN";
    let subject = "",
      current: number | null = null;
    const target =
      typeof r.level === "number" && Number.isFinite(r.level) && r.level >= 0
        ? r.level
        : type === "DUNGEON_TIER" &&
            typeof r.tier === "number" &&
            Number.isInteger(r.tier) &&
            r.tier >= 0
          ? r.tier
          : null;
    let metric;
    if (type === "DUNGEON_SKILL" && r.dungeon_type === "CATACOMBS") {
      subject = "catacombs";
      metric = analysis?.metrics.find((m) => m.id === "catacombs");
    }
    if (type === "SKILL" && typeof r.skill === "string") {
      subject = r.skill.toLowerCase();
      metric = analysis?.metrics.find(
        (m) => m.category === "skills" && m.id.toLowerCase() === subject,
      );
    }
    if (type === "SLAYER" && typeof r.slayer_boss_type === "string") {
      subject = r.slayer_boss_type.toLowerCase();
      metric = analysis?.metrics.find(
        (m) => m.category === "slayer" && m.id.toLowerCase() === subject,
      );
    }
    if (metric?.state === "known" && metric.level !== null)
      current = metric.level;
    let status: RequirementCheck["status"] =
      target !== null && current !== null
        ? current >= target
          ? "met"
          : "unmet"
        : "unknown";
    if (
      type === "DUNGEON_TIER" &&
      r.dungeon_type === "CATACOMBS" &&
      target !== null
    ) {
      subject = `catacombs:${target}`;
      // Missing floor entry is unknown, not evidence of zero completions.
      const completions = analysis?.floors[String(target)];
      current =
        typeof completions === "number" &&
        Number.isFinite(completions) &&
        completions >= 0
          ? completions
          : null;
      status = current === null ? "unknown" : current > 0 ? "met" : "unmet";
    }
    return { type, subject, target, current, status };
  });
}
export function supportedEnchantments(
  item: DecodedInventoryItem,
): Array<{ id: string; level: number }> {
  const installed = Object.fromEntries(
    Object.entries(item.enchantments).map(([k, v]) => [k.toLowerCase(), v]),
  );
  // Applicability comes from the existing category catalog, supplied by the caller.
  return Object.entries(ADVISOR_METADATA.enchantLevels).flatMap(([id, max]) => {
    const current = installed[id] ?? 0;
    if (current >= max) return [];
    if (
      ADVISOR_METADATA.conflicts.some(
        (pool) =>
          pool.map((s) => s.toLowerCase()).includes(id) &&
          pool.some(
            (other) =>
              other.toLowerCase() !== id &&
              (installed[other.toLowerCase()] ?? 0) > 0,
          ),
      )
    )
      return [];
    return [{ id, level: current + 1 }];
  });
}
export interface ConfirmedEffect {
  stat: string;
  base: number;
  delta: number | null;
}
export function confirmedEffects(
  item: DecodedInventoryItem,
  plan: UpgradePlan,
  kind: string,
): ConfirmedEffect[] {
  if (kind === "potato" || kind === "fuming") {
    const count =
      plan.target.hotPotatoBooks -
      item.hotPotatoBooks +
      plan.target.fumingPotatoBooks -
      item.fumingPotatoBooks;
    const stats =
      ADVISOR_METADATA.potatoStats[
        ["HELMET", "CHESTPLATE", "LEGGINGS", "BOOTS"].includes(
          item.category ?? "",
        )
          ? "armor"
          : "weapon"
      ];
    return Object.entries(stats).map(([stat, perBook]) => ({
      stat,
      base: count * perBook,
      delta: count * perBook,
    }));
  }
  if (kind === "reforge") {
    const target = ADVISOR_METADATA.reforges[plan.target.reforge ?? ""];
    const current = Object.values(ADVISOR_METADATA.reforges).find(
      (r) => r.reforgeName.toLowerCase() === item.reforge?.toLowerCase(),
    );
    const stats = target?.reforgeStats?.[item.rarity ?? ""];
    const old = current?.reforgeStats?.[item.rarity ?? ""];
    if (!stats) return [];
    return [...new Set([...Object.keys(stats), ...Object.keys(old ?? {})])].map(
      (stat) => ({
        stat,
        base: stats[stat] ?? 0,
        delta: old ? (stats[stat] ?? 0) - (old[stat] ?? 0) : null,
      }),
    );
  }
  return [];
}
