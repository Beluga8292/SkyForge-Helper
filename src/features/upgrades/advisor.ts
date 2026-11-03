import type { Analysis } from "@/features/intelligence/models";
import type { HypixelItem } from "@/types/hypixel";
import {
  checkRequirements,
  supportedEnchantments,
  confirmedEffects,
  type RequirementCheck,
  type ConfirmedEffect,
} from "./advisor-metadata";
import { reforgesFor, enchantmentsFor } from "./catalog";
import type {
  DecodedInventoryItem,
  InventorySummary,
  ProfileMemberStats,
} from "@/types/profile";
import {
  computeUpgradePlan,
  type PriceResolver,
  type UpgradePlan,
  type UpgradeState,
} from "./calculator";
import { catalogItem } from "./catalog";
import {
  factsFromItem,
  ownedMaterials,
  upgradeStateFromItem,
} from "./item-state";

export type EquipmentPurpose = "all" | "combat" | "dungeons" | "gathering";
export type AdvisorKind =
  | "stars"
  | "gemstone"
  | "recombobulator"
  | "potato"
  | "fuming"
  | "reforge"
  | "enchantment";
export interface AdvisorOption {
  id: string;
  kind: AdvisorKind;
  plan: UpgradePlan;
  effects: ConfirmedEffect[];
  affordability: "within" | "over" | "unknown";
}
export interface AdvisedItem {
  key: string;
  item: DecodedInventoryItem;
  location: string;
  equipped: boolean;
  options: AdvisorOption[];
  requirements: RequirementCheck[];
}
const ARMOR = new Set(["HELMET", "CHESTPLATE", "LEGGINGS", "BOOTS"]);
const WEAPONS = new Set(["SWORD", "LONGSWORD", "BOW"]);
const EQUIPMENT = new Set(["BELT", "NECKLACE", "BRACELET", "CLOAK", "GLOVES"]);
const TOOLS = new Set([
  "PICKAXE",
  "DRILL",
  "AXE",
  "SHOVEL",
  "FARMING TOOL",
  "FISHING ROD",
  "GAUNTLET",
]);

/** Only decoded, known containers; stored armour is not labelled equipped.
 * Each option is an alternative, not a shared-resource purchase basket.
 */
export function equipmentAdvice(input: {
  inventory: InventorySummary | null | undefined;
  member?: Pick<ProfileMemberStats, "essence"> | null;
  prices: PriceResolver;
  budget: number | null;
  purpose?: EquipmentPurpose;
  stale?: boolean;
  dungeonItems?: ReadonlySet<string>;
  itemMap?: ReadonlyMap<string, HypixelItem>;
  analysis?: Analysis;
}): AdvisedItem[] {
  const { inventory, prices, budget, purpose = "all" } = input;
  if (!inventory?.available) return [];
  const knownInventory = {
    ...inventory,
    containers: inventory.containers.filter((c) => c.known),
    items: [],
    armor: [],
  };
  const owned = knownInventory.containers.length
    ? ownedMaterials(knownInventory, input.member)
    : {};
  const result: AdvisedItem[] = [];
  const seen = new Set<string>();
  for (const container of knownInventory.containers) {
    if (
      !["inv_armor", "equipment_contents", "inv_contents"].includes(
        container.location,
      )
    )
      continue;
    for (const decoded of container.slots) {
      if (!decoded) continue;
      // Profile normalization may run before the item registry is available.
      // Enrich known fields without decoding NBT again or replacing instance state.
      const registry = input.itemMap?.get(decoded.itemId);
      const item = {
        ...decoded,
        category: decoded.category ?? registry?.category ?? null,
        material: decoded.material ?? registry?.material ?? null,
      };
      const category = item.category?.toUpperCase() ?? "";
      const armor = ARMOR.has(category),
        weapon = WEAPONS.has(category),
        equipment = EQUIPMENT.has(category),
        tool = TOOLS.has(category);
      if (!(armor || weapon || equipment || tool)) continue;
      if (container.location === "inv_contents" && !(weapon || tool)) continue;
      if (purpose === "combat" && tool) continue;
      if (purpose === "gathering" && !tool && !equipment) continue;
      const catalog = catalogItem(item.itemId);
      if (purpose === "dungeons" && !input.dungeonItems?.has(item.itemId))
        continue;
      const key = `${container.id}:${item.slot}:${item.itemId}`;
      if (seen.has(item.uuid ?? key)) continue;
      seen.add(item.uuid ?? key);
      const state = upgradeStateFromItem(item);
      state.enchantments = Object.fromEntries(
        Object.entries(state.enchantments).map(([id, level]) => [
          enchantmentsFor(item.category).find(
            (name) => name.toLowerCase() === id.toLowerCase(),
          ) ?? id,
          level,
        ]),
      );
      const options: AdvisorOption[] = [];
      const add = (
        kind: AdvisorKind,
        patch: Partial<UpgradeState>,
        suffix = "",
      ) => {
        const plan = computeUpgradePlan(
          factsFromItem(item),
          state,
          { ...state, ...patch },
          {
            owned,
            inventoryKnown: true,
            prices,
            enchantmentBooks: "target-level",
          },
        );
        if (!plan.stages.some((s) => s.status === "ready")) return;
        if (
          plan.stages.some(
            (s) => s.status === "unsupported" || s.status === "unknown",
          )
        )
          return;
        const cost = plan.totalCost;
        options.push({
          id: `${key}:${kind}:${suffix}`,
          kind,
          plan,
          effects: confirmedEffects(item, plan, kind),
          affordability:
            input.stale ||
            cost === null ||
            budget === null ||
            !Number.isFinite(budget) ||
            budget < 0
              ? "unknown"
              : cost <= budget
                ? "within"
                : "over",
        });
      };
      if (
        catalog &&
        state.stars < Math.min(5, catalog.maxStars) &&
        catalog.stars[String(state.stars + 1)] !== undefined
      )
        add("stars", { stars: state.stars + 1 });
      if (armor || weapon) {
        if (state.hotPotatoBooks < 10) add("potato", { hotPotatoBooks: 10 });
        if (state.fumingPotatoBooks < 5)
          add("fuming", { hotPotatoBooks: 10, fumingPotatoBooks: 5 });
      }
      if (
        !state.recombobulated &&
        ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"].includes(
          item.rarity?.toUpperCase() ?? "",
        )
      )
        add("recombobulator", { recombobulated: true });
      for (const slot of Object.keys(catalog?.gemstoneSlots ?? {}))
        if (
          !state.gemstoneSlots.includes(slot) &&
          (catalog?.gemstoneSlots[slot]?.length ?? 0) > 0
        )
          add(
            "gemstone",
            { gemstoneSlots: [...state.gemstoneSlots, slot] },
            slot,
          );
      for (const row of reforgesFor(item.category, item.rarity, item.itemId)) {
        if (
          !item.rarity ||
          row.name.toLowerCase() === item.reforge?.toLowerCase() ||
          row.stone.toLowerCase() === item.reforge?.toLowerCase()
        )
          continue;
        add("reforge", { reforge: row.stone }, row.stone);
      }
      const pool = enchantmentsFor(item.category).map((id) => id.toLowerCase());
      for (const enchant of supportedEnchantments(item)) {
        if (!pool.includes(enchant.id)) continue;
        // Preserve the catalog spelling (some upstream IDs are uppercase).
        const id = enchantmentsFor(item.category).find(
          (id) => id.toLowerCase() === enchant.id,
        )!;
        add(
          "enchantment",
          { enchantments: { ...state.enchantments, [id]: enchant.level } },
          `${id}:${enchant.level}`,
        );
      }
      options.sort(
        (a, b) =>
          (a.plan.totalCost ?? Infinity) - (b.plan.totalCost ?? Infinity),
      );
      const meta = input.itemMap?.get(item.itemId);
      const requirements = meta
        ? [
            ...checkRequirements(
              Array.isArray(meta.requirements) ? meta.requirements : [],
              input.analysis,
            ),
            ...checkRequirements(
              Array.isArray(meta.catacombs_requirements)
                ? meta.catacombs_requirements
                : [],
              input.analysis,
            ).map((r) => ({ ...r, scope: "dungeons" as const })),
          ]
        : checkRequirements(undefined, input.analysis);
      result.push({
        key,
        item,
        location: container.location,
        equipped: container.location !== "inv_contents",
        options,
        requirements,
      });
    }
  }
  return result;
}
