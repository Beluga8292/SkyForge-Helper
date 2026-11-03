import type { HypixelAuction } from "@/types/hypixel";
import {
  asCompound,
  asString,
  decodeBase64GzipNbt,
} from "@/utils/nbt";
import { readSkullTexture } from "@/utils/inventory";

export interface AuctionVisual {
  itemId: string | null;
  material?: string | null;
  skullTexture: string | null;
}

const EMPTY: AuctionVisual = { itemId: null, skullTexture: null };
const MAX_CACHE = 250;
const cache = new Map<string, Promise<AuctionVisual>>();

function itemBlob(raw: HypixelAuction): string | null {
  const value =
    typeof raw.item_bytes === "string" ? raw.item_bytes : raw.item_bytes?.data;
  return typeof value === "string" && value.length <= 2 * 1024 * 1024
    ? value
    : null;
}

/**
 * Read the real SkyBlock id and the Mojang skin from an auction NBT blob.
 *
 * Auction display names can carry reforges, levels or skin prefixes, so the
 * name-based registry lookup is only a hint. The NBT id is authoritative and
 * also unlocks the real custom-head texture.
 */
export async function decodeAuctionVisual(
  raw: HypixelAuction,
): Promise<AuctionVisual> {
  const blob = itemBlob(raw);
  if (!blob) return EMPTY;
  const cached = cache.get(blob);
  if (cached) return cached;
  const promise = (async (): Promise<AuctionVisual> => {
    try {
      const root = await decodeBase64GzipNbt(blob, 128 * 1024);
      const item = asCompound(Array.isArray(root.i) ? root.i[0] : root);
      const tag = asCompound(item?.tag);
      const extra = asCompound(tag?.ExtraAttributes);
      return {
        itemId: asString(extra?.id),
        material: asString(item?.id)?.replace(/^minecraft:/, "") ?? null,
        skullTexture: readSkullTexture(tag),
      };
    } catch {
      return EMPTY;
    }
  })();
  cache.set(blob, promise);
  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return promise;
}
