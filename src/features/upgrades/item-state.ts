import type { DecodedInventoryItem, InventorySummary, ProfileMemberStats } from "@/types/profile";
import type { ItemFacts, UpgradeState } from "./calculator";
import { isGearCategory, normalizeState } from "./calculator";
import { essenceMaterialId } from "./catalog";

export interface UpgradeItemState {
  item: DecodedInventoryItem;
  facts: ItemFacts;
  state: UpgradeState;
}

export function factsFromItem(item: DecodedInventoryItem): ItemFacts {
  return {
    itemId: item.itemId,
    name: item.name,
    category: item.category,
    rarity: item.rarity,
    material: item.material,
  };
}

export function upgradeStateFromItem(item: DecodedInventoryItem): UpgradeState {
  return normalizeState({
    stars: item.stars,
    recombobulated: item.recombobulated,
    hotPotatoBooks: item.hotPotatoBooks,
    fumingPotatoBooks: item.fumingPotatoBooks,
    gemstoneSlots: item.gemstoneSlots,
    reforge: item.reforge,
    enchantments: item.enchantments,
  });
}

export function upgradeItemState(item: DecodedInventoryItem): UpgradeItemState {
  return {
    item,
    facts: factsFromItem(item),
    state: upgradeStateFromItem(item),
  };
}

export function allInventoryItems(inventory: InventorySummary | null | undefined): DecodedInventoryItem[] {
  if (!inventory?.available) return [];
  const seen = new Set<string>();
  const result: DecodedInventoryItem[] = [];
  for (const container of inventory.containers ?? []) {
    for (const item of container.slots) {
      if (!item) continue;
      const key = `${container.location}:${item.slot}:${item.itemId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
  }
  if (!result.length) {
    for (const item of [...inventory.armor, ...inventory.items]) result.push(item);
  }
  return result;
}

/** Gear candidates that can plausibly be upgraded (armour, weapons, tools). */
export function upgradeCandidates(inventory: InventorySummary | null | undefined): DecodedInventoryItem[] {
  return allInventoryItems(inventory)
    .filter((item) => isGearCategory(item.category))
    .sort(
      (a, b) =>
        (b.stars - a.stars) ||
        (b.rarity ?? "").localeCompare(a.rarity ?? "") ||
        a.name.localeCompare(b.name),
    );
}

export function findInventoryItem(
  inventory: InventorySummary | null | undefined,
  itemId: string,
): DecodedInventoryItem | null {
  return allInventoryItems(inventory).find((item) => item.itemId === itemId) ?? null;
}

/**
 * Aggregates materials currently owned by the member. Inventory counts are
 * exact slot counts; essence comes from `currencies.essence` and is never
 * inferred from item lore.
 */
export function ownedMaterials(
  inventory: InventorySummary | null | undefined,
  member?: Pick<ProfileMemberStats, "essence"> | null,
): Record<string, number> {
  const owned: Record<string, number> = {};
  for (const item of allInventoryItems(inventory)) {
    owned[item.itemId] = (owned[item.itemId] ?? 0) + item.count;
  }
  for (const [type, amount] of Object.entries(member?.essence ?? {})) {
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const id = essenceMaterialId(type);
    owned[id] = (owned[id] ?? 0) + Math.trunc(amount);
  }
  return owned;
}

export function itemUpgradeSummary(item: DecodedInventoryItem): string[] {
  const summary: string[] = [];
  if (item.stars) summary.push(`${item.stars}★`);
  if (item.recombobulated) summary.push("Recombobulated");
  if (item.hotPotatoBooks) summary.push(`HPB ${item.hotPotatoBooks}/10`);
  if (item.fumingPotatoBooks) summary.push(`Fuming ${item.fumingPotatoBooks}/5`);
  if (item.reforge) summary.push(`Reforge: ${item.reforge}`);
  if (item.gemstoneSlots.length) summary.push(`Gems: ${item.gemstoneSlots.length}`);
  return summary;
}
