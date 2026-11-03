import type { DecodedInventoryItem, InventoryContainer, InventoryMissingContainer } from "@/types/profile";
import {
  asCompound,
  asNumber,
  asString,
  decodeBase64GzipNbt,
  type NbtCompound,
  type NbtValue,
} from "@/utils/nbt";
import { prettifyItemId } from "@/utils/item-name";
import {
  parseLore,
  plainLore,
  rarityFromLore,
  stripMinecraftFormatting,
} from "@/utils/item-lore";
import type { HypixelItem } from "@/types/hypixel";

export { stripMinecraftFormatting };

/**
 * Hypixel display names are usually JSON text components, sometimes legacy
 * strings with §-codes. Extract a plain label without executing anything.
 */
export function extractDisplayName(raw: NbtValue | undefined): string | null {
  const text = asString(raw);
  if (!text) return null;
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      const flattened = flattenTextComponent(parsed);
      if (flattened) return stripMinecraftFormatting(flattened);
    } catch {
      // Fall through to legacy formatting.
    }
  }
  return stripMinecraftFormatting(text) || null;
}

function flattenTextComponent(component: unknown): string {
  if (typeof component === "string") return component;
  if (Array.isArray(component)) return component.map(flattenTextComponent).join("");
  if (component && typeof component === "object") {
    const record = component as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text : "";
    const extra = Array.isArray(record.extra) ? record.extra.map(flattenTextComponent).join("") : "";
    return `${text}${extra}`;
  }
  return "";
}

export interface DecodedItemExtra {
  [key: string]: unknown;
}

function plainNbt(value: NbtValue | null | undefined): unknown {
  if (value === undefined) return undefined;
  if (typeof value === "bigint") {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  if (Array.isArray(value)) return value.map((entry) => plainNbt(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, plainNbt(entry)]),
    );
  }
  return value;
}

function numberMap(value: NbtValue | undefined): Record<string, number> {
  const compound = asCompound(value);
  if (!compound) return {};
  return Object.fromEntries(
    Object.entries(compound)
      .map(([key, entry]) => [key.toUpperCase(), asNumber(entry, Number.NaN)] as const)
      .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
      .map(([key, amount]) => [key, Math.trunc(amount)]),
  );
}

function stringKeys(value: NbtValue | undefined): string[] {
  const compound = asCompound(value);
  if (!compound) return [];
  return Object.keys(compound)
    .filter((key) => asString(compound[key]) !== null)
    .map((key) => key.toUpperCase());
}

function readStars(extra: NbtCompound | null): number {
  if (!extra) return 0;
  for (const key of ["upgrade_level", "dungeon_item_level", "stars"]) {
    const value = asNumber(extra[key], Number.NaN);
    if (Number.isFinite(value) && value > 0) return Math.min(10, Math.trunc(value));
  }
  return 0;
}

function readPotatoBooks(extra: NbtCompound | null): {
  hotPotatoBooks: number;
  fumingPotatoBooks: number;
} {
  if (!extra) return { hotPotatoBooks: 0, fumingPotatoBooks: 0 };
  const total = Math.max(0, Math.trunc(asNumber(extra["hot_potato_count"], 0)));
  const explicitFuming = asNumber(extra["fuming_potato_count"], Number.NaN);
  const fuming = Number.isFinite(explicitFuming)
    ? Math.max(0, Math.min(5, Math.trunc(explicitFuming)))
    : Math.max(0, Math.min(5, total - 10));
  const hotPotatoBooks = Number.isFinite(explicitFuming)
    ? Math.max(0, Math.min(10, total))
    : Math.max(0, Math.min(10, total));
  return { hotPotatoBooks, fumingPotatoBooks: fuming };
}

export function readSkullTexture(tag: NbtCompound | null): string | null {  const owner = asCompound(tag?.["SkullOwner"]);
  const properties = asCompound(owner?.["Properties"]);
  const textures = properties?.["textures"];
  if (!Array.isArray(textures)) return null;
  for (const entry of textures) {
    const compound = asCompound(entry);
    const value = asString(compound?.["Value"]);
    if (!value) continue;
    try {
      const decoded = JSON.parse(atob(value)) as {
        textures?: { SKIN?: { url?: string } };
      };
      const url = decoded.textures?.SKIN?.url;
      if (typeof url === "string" && /^https?:\/\//.test(url)) return url;
    } catch {
      // Ignore malformed texture properties.
    }
  }
  return null;
}

function itemFromCompound(
  compound: NbtCompound,
  slot: number,
  items?: Map<string, HypixelItem>,
): DecodedInventoryItem | null {
  const tag = asCompound(compound["tag"]);
  const extra = asCompound(tag?.["ExtraAttributes"]);
  const skyblockId = asString(extra?.["id"]);
  const vanillaId = asString(compound["id"]);
  const rawId = skyblockId ?? vanillaId;
  if (!rawId) return null;

  const itemId = rawId.replace(/^minecraft:/, "");
  const meta = items?.get(itemId);
  const display = asCompound(tag?.["display"]);
  const name = extractDisplayName(display?.["Name"]) ?? meta?.name ?? prettifyItemId(itemId);
  const count = Math.max(1, asNumber(compound["Count"], 1));
  const damage = asNumber(compound["Damage"], 0);
  const lore = plainLore(display?.["Lore"]);
  const rarity = meta?.tier ?? rarityFromLore(lore);
  const potato = readPotatoBooks(extra);
  const rarityUpgrades = Math.max(0, Math.trunc(asNumber(extra?.["rarity_upgrades"], 0)));

  return {
    slot,
    itemId,
    name,
    count,
    damage,
    rarity,
    category: meta?.category ?? null,
    material: meta?.material ?? null,
    lore,
    loreLines: parseLore(display?.["Lore"]),
    stars: readStars(extra),
    recombobulated: rarityUpgrades > 0,
    hotPotatoBooks: potato.hotPotatoBooks,
    fumingPotatoBooks: potato.fumingPotatoBooks,
    reforge: asString(extra?.["modifier"]),
    enchantments: numberMap(extra?.["enchantments"]),
    gemstoneSlots: stringKeys(extra?.["gems"]),
    uuid: asString(extra?.["uuid"]),
    soulbound: Boolean(extra?.["soulbound"] || extra?.["donated_museum"] || meta?.soulbound),
    skullTexture: readSkullTexture(tag),
    extra: (plainNbt(extra) as DecodedItemExtra | undefined) ?? {},
  };
}

function readSlots(
  root: NbtCompound,
  key: string,
  items?: Map<string, HypixelItem>,
): Array<DecodedInventoryItem | null> {
  const list = root[key];
  if (!Array.isArray(list)) return [];
  return list.map((entry, index) => {
    const compound = asCompound(entry);
    return compound ? itemFromCompound(compound, index, items) : null;
  });
}

export interface DecodeInventoryResult {
  items: DecodedInventoryItem[];
  armor: DecodedInventoryItem[];
  /** Full slot grid for the decoded blob (empty slots are null). */
  slots?: Array<DecodedInventoryItem | null>;
}

export async function decodeInventoryBlob(
  base64: string | undefined,
  items?: Map<string, HypixelItem>,
): Promise<DecodeInventoryResult> {
  if (!base64) return { items: [], armor: [] };
  const root = await decodeBase64GzipNbt(base64);
  const slots = readSlots(root, "i", items);
  return {
    items: slots.filter((entry): entry is DecodedInventoryItem => entry !== null),
    armor: [],
    slots,
  };
}

export interface DecodeMemberInventoryResult extends DecodeInventoryResult {
  containers: InventoryContainer[];
  missing: InventoryMissingContainer[];
  errors: string[];
}

const MEMBER_CONTAINERS: Array<{
  id: string;
  location: string;
  size: number;
  read: (inventory: Record<string, unknown>) => unknown;
}> = [
  { id: "main", location: "inv_contents", size: 36, read: (inv) => inv["inv_contents"] },
  { id: "armor", location: "inv_armor", size: 4, read: (inv) => inv["inv_armor"] },
  {
    id: "equipment",
    location: "equipment_contents",
    size: 4,
    read: (inv) => inv["equipment_contents"],
  },
  {
    id: "ender-chest",
    location: "ender_chest_contents",
    size: 27,
    read: (inv) => inv["ender_chest_contents"],
  },
  {
    id: "wardrobe",
    location: "wardrobe_contents",
    size: 18,
    read: (inv) => inv["wardrobe_contents"],
  },
  {
    id: "accessory-bag",
    location: "accessory_bag",
    size: 45,
    read: (inv) =>
      (inv["bag_contents"] as Record<string, unknown> | undefined)?.["talisman_bag"] ??
      inv["talisman_bag"],
  },
  {
    id: "vault",
    location: "personal_vault_contents",
    size: 45,
    read: (inv) => inv["personal_vault_contents"],
  },
];

function readBlob(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { data?: unknown }).data === "string"
  ) {
    return (value as { data: string }).data;
  }
  return undefined;
}

function padSlots(
  slots: Array<DecodedInventoryItem | null>,
  expected: number,
): Array<DecodedInventoryItem | null> {
  const size = Math.max(expected, slots.length);
  const padded = [...slots];
  while (padded.length < size) padded.push(null);
  return padded;
}

/** Decodes the Hypixel member.inventory object (multiple separate blobs). */
export async function decodeMemberInventory(
  inventory: Record<string, unknown> | undefined,
  items?: Map<string, HypixelItem>,
): Promise<DecodeMemberInventoryResult> {
  if (!inventory) {
    return { items: [], armor: [], containers: [], missing: [], errors: [] };
  }

  const containers: InventoryContainer[] = [];
  const missing: InventoryMissingContainer[] = [];
  const errors: string[] = [];

  const decodeInto = async (
    id: string,
    location: string,
    expected: number,
    value: unknown,
  ) => {
    const blob = readBlob(value);
    if (!blob) return null;
    try {
      const result = await decodeInventoryBlob(blob, items);
      const slots = padSlots(result.slots ?? [], expected);
      containers.push({
        id,
        location,
        size: slots.length,
        slots,
        known: true,
      });
      return result;
    } catch (error) {
      errors.push(location);
      missing.push({
        id,
        location,
        reason: "decode-error",
        detail: error instanceof Error ? error.message : String(error),
      });
      containers.push({
        id,
        location,
        size: expected,
        slots: Array.from({ length: expected }, () => null),
        known: false,
      });
      return null;
    }
  };

  const results = await Promise.all(
    MEMBER_CONTAINERS.map((entry) =>
      decodeInto(entry.id, entry.location, entry.size, entry.read(inventory)),
    ),
  );

  const main = results[0];
  const armor = results[1];

  const backpacks = inventory["backpack_contents"];
  if (backpacks && typeof backpacks === "object" && !Array.isArray(backpacks)) {
    const entries = Object.entries(backpacks as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    if (entries.length > 16) {
      errors.push("backpacks_truncated_16");
      for (const [key] of entries.slice(16)) {
        missing.push({
          id: `backpack-${key}`,
          location: `backpack:${key}`,
          reason: "backpack-limit",
        });
      }
    }
    await Promise.all(
      entries.slice(0, 16).map(([key, value]) =>
        decodeInto(`backpack-${key}`, `backpack:${key}`, 45, value),
      ),
    );
  }

  return {
    items: (main?.items ?? []).slice(0, 200),
    armor: armor?.items ?? [],
    containers,
    missing,
    errors,
  };
}

/** @internal exposed for fixtures/tests */
export function inventoryItemFromCompoundForTest(
  compound: NbtCompound,
  slot: number,
  items?: Map<string, HypixelItem>,
): DecodedInventoryItem | null {
  return itemFromCompound(compound, slot, items);
}
