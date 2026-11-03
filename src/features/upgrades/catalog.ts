import catalogJson from "@/data/upgrades/catalog.json";

export interface MaterialRequirement {
  id: string;
  count: number;
}

export interface CatalogItem {
  essenceType: string | null;
  maxStars: number;
  stars: Record<string, number>;
  starItems: Record<string, MaterialRequirement[]>;
  gemstoneSlots: Record<string, MaterialRequirement[]>;
  aliasOf?: string;
}

export interface ReforgeRow {
  stone: string;
  name: string;
  itemTypes: unknown;
  rarities: string[];
  costs: Record<string, number>;
}

export interface UpgradeCatalog {
  meta: {
    version: string;
    generatedAt: string;
    commit: string;
    sources: Array<{
      name: string;
      url: string;
      license: string;
      commit: string;
    }>;
    note: string;
  };
  items: Record<string, CatalogItem>;
  materialNames: Record<string, string>;
  reforges: ReforgeRow[];
  enchantPools: Record<string, string[]>;
  constants: {
    recombobulator: string;
    hotPotatoBook: string;
    fumingPotatoBook: string;
    hotPotatoMax: number;
    fumingPotatoMax: number;
  };
}

export const UPGRADE_CATALOG = catalogJson as UpgradeCatalog;

export function catalogItem(itemId: string): CatalogItem | null {
  return UPGRADE_CATALOG.items[itemId] ?? null;
}

export function materialName(itemId: string): string {
  return (
    UPGRADE_CATALOG.materialNames[itemId] ??
    itemId
      .split("_")
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ")
  );
}

export function essenceMaterialId(essenceType: string): string {
  return `ESSENCE_${essenceType.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}

export function itemTypesMatch(
  types: unknown,
  category: string | null | undefined,
  itemId?: string,
): boolean {
  if (!category) return false;
  const normalized = category.toUpperCase().replaceAll(" ", "_");
  if (types && typeof types === "object" && !Array.isArray(types)) {
    const ids = (types as { internalName?: unknown }).internalName;
    return Boolean(itemId && Array.isArray(ids) && ids.includes(itemId));
  }
  if (Array.isArray(types))
    return types.some((t) => itemTypesMatch(t, category, itemId));
  if (typeof types !== "string") return false;
  return types
    .toUpperCase()
    .split("/")
    .some(
      (t) =>
        t === normalized ||
        (t === "ARMOR" &&
          ["HELMET", "CHESTPLATE", "LEGGINGS", "BOOTS"].includes(normalized)) ||
        (t === "EQUIPMENT" &&
          ["BELT", "CLOAK", "NECKLACE", "BRACELET", "GLOVES"].includes(
            normalized,
          )) ||
        (t === "ROD" && ["FISHING_ROD", "FISHING_WEAPON"].includes(normalized)),
    );
}

export function reforgesFor(
  category: string | null | undefined,
  rarity: string | null | undefined,
  itemId?: string,
): ReforgeRow[] {
  const tier = rarity?.toUpperCase() ?? null;
  return UPGRADE_CATALOG.reforges.filter(
    (row) =>
      itemTypesMatch(row.itemTypes, category, itemId) &&
      (!tier || !row.rarities.length || row.rarities.includes(tier)),
  );
}

export function enchantmentsFor(category: string | null | undefined): string[] {
  if (!category) return [];
  const key = category.toUpperCase();
  return UPGRADE_CATALOG.enchantPools[key] ?? [];
}

export function gemstoneSlotKeys(itemId: string): string[] {
  return Object.keys(catalogItem(itemId)?.gemstoneSlots ?? {});
}
