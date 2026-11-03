import snapshot from "./verified-items.json";
import type { HypixelItem } from "@/types/hypixel";
import type { Analysis } from "@/features/intelligence/models";
import type { DungeonClass } from "./catalog";
import { checkRequirements } from "@/features/upgrades/advisor-metadata";
import type { AdvisedItem } from "@/features/upgrades/advisor";
import type { DecodedInventoryItem } from "@/types/profile";
export const VERIFIED_ITEMS = snapshot;
const all: DungeonClass[] = ["berserk", "mage", "archer", "tank", "healer"];
export function catalogClasses(id: string): DungeonClass[] {
  if (id.startsWith("POWER_WITHER")) return ["berserk", "archer"];
  if (id.startsWith("WISE_WITHER") || id === "BAT_WAND") return ["mage"];
  if (id.startsWith("TANK_WITHER") || id === "FLORID_ZOMBIE_SWORD")
    return ["tank", "healer"];
  if (id === "JUJU_SHORTBOW") return ["archer"];
  if (id === "LIVID_DAGGER" || id === "SHADOW_FURY") return ["berserk"];
  return all;
}
export function replacementCandidates(
  slot: string,
  cls: DungeonClass,
  registry: ReadonlyMap<string, HypixelItem>,
  analysis?: Analysis,
): AdvisedItem[] {
  return snapshot.items.flatMap((raw) => {
    const meta = registry.get(raw.id);
    if (
      !meta ||
      meta.category !== raw.category ||
      !catalogClasses(raw.id).includes(cls) ||
      (slot === "weapon"
        ? !["SWORD", "BOW", "LONGSWORD"].includes(raw.category)
        : slot !== (raw.category === "GLOVES" ? "BRACELET" : raw.category))
    )
      return [];
    // Snapshot supplies verified base metadata only, never a fabricated upgraded
    // instance. Runtime requirements override snapshot when present.
    const merged: HypixelItem = { ...raw, ...meta };
    const requirements = [
      ...checkRequirements(merged.requirements, analysis),
      ...checkRequirements(
        Array.isArray(merged.catacombs_requirements)
          ? merged.catacombs_requirements
          : [],
        analysis,
      ),
    ];
    const item: DecodedInventoryItem = {
      slot: 0,
      itemId: raw.id,
      name: meta.name,
      category: raw.category,
      material: typeof merged.material === "string" ? merged.material : null,
      rarity: typeof merged.tier === "string" ? merged.tier : null,
      count: 1,
      damage: 0,
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
      soulbound: merged.soulbound === true,
      extra: {},
    };
    return [
      {
        key: `catalog:${raw.id}`,
        item,
        location: "catalog",
        equipped: false,
        options: [],
        requirements,
      },
    ];
  });
}

/** Base metadata only; missing stats remain null, never inferred as zero. */
export function baseStatComparison(
  currentId: string | undefined,
  targetId: string,
  registry: ReadonlyMap<string, HypixelItem>,
) {
  const before = registry.get(currentId ?? "")?.stats as
    Record<string, unknown> | undefined;
  const after = registry.get(targetId)?.stats as
    Record<string, unknown> | undefined;
  return [
    "DAMAGE",
    "STRENGTH",
    "CRITICAL_DAMAGE",
    "INTELLIGENCE",
    "HEALTH",
    "DEFENSE",
  ].flatMap((stat) => {
    const a = after?.[stat],
      b = before?.[stat];
    if (typeof a !== "number" || !Number.isFinite(a)) return [];
    return [
      {
        stat,
        before: typeof b === "number" && Number.isFinite(b) ? b : null,
        after: a,
      },
    ];
  });
}
