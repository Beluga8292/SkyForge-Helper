import type { ItemTooltipData } from "@/components/common/ItemTooltip";

/**
 * Convert the raw Hypixel `ExtraAttributes`-style modifier bag from the
 * backend analysis contract into safe, display-ready tooltip fields.
 *
 * The backend already sanitises the NBT blob; this layer only reads known keys
 * and never invents stats that are not present.
 */
export interface AssetLike {
  itemId: string;
  name: string;
  rarity?: string | null;
  category?: string | null;
  material?: string | null;
  count?: number;
  modifiers?: Record<string, unknown> | null;
  soulbound?: boolean;
  value?: number | null;
  /** Conservative local Bazaar estimate, never treated as a confirmed price. */
  estimatedValue?: number | null;
  method?: string | null;
  location?: string | null;
  lore?: string[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finite(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readEnchantments(
  modifiers: Record<string, unknown> | null | undefined,
): Record<string, number> {
  const source = record(modifiers?.enchantments) ?? record(modifiers?.enchantments_legacy);
  if (!source) return {};
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    const level = finite(value);
    if (level !== null && level > 0) result[key] = level;
  }
  return result;
}

export function readGemstones(
  modifiers: Record<string, unknown> | null | undefined,
): string[] {
  const gems = modifiers?.gems;
  if (Array.isArray(gems)) {
    return gems
      .map((entry) => {
        if (typeof entry === "string") return entry;
        const compound = record(entry);
        return text(compound?.quality) ?? text(compound?.type) ?? text(compound?.slot);
      })
      .filter((value): value is string => Boolean(value));
  }
  const source = record(gems);
  if (!source) return [];
  return Object.entries(source)
    .map(([slot, value]) => {
      const compound = record(value);
      const label =
        text(value) ??
        text(compound?.quality) ??
        text(compound?.type) ??
        text(compound?.gem);
      return label ? `${slot}: ${label}` : null;
    })
    .filter((value): value is string => Boolean(value));
}

export function readStars(modifiers: Record<string, unknown> | null | undefined): {
  stars: number;
  masterStars: number;
} {
  const level = finite(modifiers?.dungeon_item_level) ?? 0;
  const stars = Math.max(0, Math.min(5, Math.trunc(level)));
  const masterStars = Math.max(0, Math.min(5, Math.trunc(level) - 5));
  return { stars, masterStars };
}

export function readPotatoBooks(
  modifiers: Record<string, unknown> | null | undefined,
): { hotPotatoBooks: number; fumingPotatoBooks: number } {
  const total = Math.max(0, Math.trunc(finite(modifiers?.hot_potato_count) ?? 0));
  const explicitFuming = finite(modifiers?.fuming_potato_count);
  const fuming =
    explicitFuming !== null
      ? Math.max(0, Math.min(5, Math.trunc(explicitFuming)))
      : Math.max(0, Math.min(5, total - 10));
  return { hotPotatoBooks: Math.min(10, total), fumingPotatoBooks: fuming };
}

export function assetToTooltip(item: AssetLike): ItemTooltipData {
  const modifiers = item.modifiers ?? null;
  const { stars, masterStars } = readStars(modifiers);
  const potato = readPotatoBooks(modifiers);
  const recombobulated = (finite(modifiers?.rarity_upgrades) ?? 0) > 0;
  return {
    itemId: item.itemId,
    name: item.name,
    rarity: item.rarity,
    category: item.category,
    material: item.material,
    lore: item.lore,
    count: item.count ?? 1,
    stars,
    masterStars,
    recombobulated,
    hotPotatoBooks: potato.hotPotatoBooks,
    fumingPotatoBooks: potato.fumingPotatoBooks,
    reforge: text(modifiers?.reforge),
    enchantments: readEnchantments(modifiers),
    gemstoneSlots: readGemstones(modifiers),
    soulbound: item.soulbound,
    value: item.value ?? null,
    estimatedValue: item.estimatedValue ?? null,
    valueMethod: item.method ?? null,
    location: item.location ?? null,
  };
}
