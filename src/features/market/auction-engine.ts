import type { HypixelAuction } from "@/types/hypixel";
import {
  asCompound,
  asNumber,
  asString,
  decodeBase64GzipNbt,
} from "@/utils/nbt";
import type { Valuation } from "./models";
export interface AuctionIdentity {
  key: string;
  id: string;
  count: number;
  modifiers: Record<string, string>;
}
const ignored = new Set(["uuid", "timestamp", "originTag", "spawnedFor", "id"]);
function stable(value: unknown): string {
  if (value === null || typeof value !== "object")
    return (
      JSON.stringify(typeof value === "bigint" ? String(value) : value) ??
      "null"
    );
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
    .join(",")}}`;
}
export async function decodeAuctionIdentity(
  raw: HypixelAuction,
): Promise<AuctionIdentity | null> {
  const blob =
    typeof raw.item_bytes === "string" ? raw.item_bytes : raw.item_bytes?.data;
  if (!blob || blob.length > 262144) return null;
  try {
    const root = await decodeBase64GzipNbt(blob, 128 * 1024),
      item = asCompound(Array.isArray(root.i) ? root.i[0] : undefined),
      tag = asCompound(item?.tag),
      extra = asCompound(tag?.ExtraAttributes),
      id = asString(extra?.id),
      count = asNumber(item?.Count, 1);
    if (!id || !Number.isInteger(count) || count < 1 || count > 64) return null;
    return identityFromAuctionItem(item, raw.tier);
  } catch {
    return null;
  }
}
export function identityFromAuctionItem(
  item: ReturnType<typeof asCompound>,
  rarity?: string,
): AuctionIdentity | null {
  return identityFromCompound(item, rarity);
}
function identityFromCompound(
  item: ReturnType<typeof asCompound>,
  rarity?: string,
): AuctionIdentity | null {
  const extra = asCompound(item?.tag)
    ? asCompound(asCompound(item?.tag)?.ExtraAttributes)
    : null;
  const tag = asCompound(item?.tag);
  const id = asString(extra?.id);
  const count = asNumber(item?.Count, 1);
  if (!id || !Number.isInteger(count) || count < 1 || count > 64) return null;
  const mods = Object.fromEntries(
    Object.entries(extra ?? {}).filter(([k]) => !ignored.has(k)),
  );
  if (id === "PET" && !("petInfo" in mods)) return null;
  if ("petInfo" in mods) {
    try {
      const pet =
        typeof mods.petInfo === "string"
          ? JSON.parse(mods.petInfo)
          : mods.petInfo;
      if (
        !pet ||
        typeof pet !== "object" ||
        Array.isArray(pet) ||
        typeof pet.type !== "string" ||
        typeof pet.tier !== "string" ||
        typeof pet.exp !== "number" ||
        !Number.isFinite(pet.exp) ||
        pet.exp < 0
      )
        return null;
      mods.petInfo = Object.fromEntries(
        Object.entries(pet).filter(([key]) => key !== "uuid"),
      ) as Exclude<typeof mods.petInfo, undefined>;
    } catch {
      return null;
    }
  }
  return {
    key: stable([
      id,
      rarity ?? null,
      count,
      item?.Damage ?? null,
      asCompound(tag?.display)?.color ?? null,
      mods,
      tag?.ench ?? null,
    ]),
    id,
    count,
    modifiers: Object.fromEntries(
      Object.entries(mods).map(([k, v]) => [k, stable(v)]),
    ),
  };
}
const medianWithout = (prices: number[], index: number) => {
  const n = prices.length - 1,
    at = (i: number) => prices[i + (i >= index ? 1 : 0)]!;
  return n % 2 ? at(Math.floor(n / 2)) : (at(n / 2 - 1) + at(n / 2)) / 2;
};
export function valueAuctions(
  input: Array<{ raw: HypixelAuction; identity: AuctionIdentity | null }>,
  now = Date.now(),
): Valuation[] {
  const active = input.filter(
    ({ raw: r }) =>
      r.bin &&
      !r.claimed &&
      Number.isFinite(r.starting_bid) &&
      r.starting_bid! > 0 &&
      (r.end ?? 0) > now,
  );
  const groups = new Map<string, typeof active>();
  for (const item of active) {
    if (item.identity) {
      const group = groups.get(item.identity.key) ?? [];
      group.push(item);
      groups.set(item.identity.key, group);
    }
  }
  const info = new Map<
    string,
    {
      group: typeof active;
      prices: number[];
      sellers: Set<string>;
      indices: Map<string, number>;
    }
  >();
  for (const [key, listings] of groups) {
    const bySeller = new Map<string, typeof active>();
    for (const item of listings) {
      if (!item.raw.auctioneer) continue;
      const entries = bySeller.get(item.raw.auctioneer) ?? [];
      entries.push(item);
      bySeller.set(item.raw.auctioneer, entries);
    }
    const group = [...bySeller.values()].map((entries) => {
      entries.sort((a, b) => a.raw.starting_bid! - b.raw.starting_bid!);
      const mid = Math.floor(entries.length / 2),
        sample = entries[mid]!,
        price =
          entries.length % 2
            ? sample.raw.starting_bid!
            : (entries[mid - 1]!.raw.starting_bid! + sample.raw.starting_bid!) /
              2;
      return { ...sample, raw: { ...sample.raw, starting_bid: price } };
    });
    group.sort(
      (a, b) =>
        a.raw.starting_bid! - b.raw.starting_bid! ||
        a.raw.uuid.localeCompare(b.raw.uuid),
    );
    info.set(key, {
      group,
      prices: group.map((x) => x.raw.starting_bid!),
      sellers: new Set(
        group.flatMap((x) => (x.raw.auctioneer ? [x.raw.auctioneer] : [])),
      ),
      indices: new Map(group.map((x, i) => [x.raw.auctioneer!, i])),
    });
  }
  return active.map(({ raw: r, identity: i }) => {
    const g = i ? info.get(i.key) : undefined,
      size = g && r.auctioneer ? g.group.length - 1 : 0,
      independent = g
        ? g.sellers.size - (r.auctioneer && g.sellers.has(r.auctioneer) ? 1 : 0)
        : 0;
    let reference: number | null = null,
      confidence: Valuation["confidence"] = "insufficient";
    if (g && size >= 5 && independent >= 3) {
      reference = medianWithout(g.prices, g.indices.get(r.auctioneer!)!);
      const dispersion =
        (g.prices[Math.floor((3 * g.prices.length) / 4)]! -
          g.prices[Math.floor(g.prices.length / 4)]!) /
        reference;
      confidence =
        size >= 20 && independent >= 10 && dispersion <= 0.15
          ? "high"
          : size >= 8 && independent >= 5 && dispersion <= 0.3
            ? "medium"
            : "low";
    }
    const difference = reference === null ? null : reference - r.starting_bid!;
    return {
      auction_id: r.uuid,
      item_id: i?.id ?? null,
      name: r.item_name ?? i?.id ?? r.uuid,
      rarity: r.tier ?? null,
      count: i?.count ?? null,
      listing_price: r.starting_bid!,
      reference_price: reference,
      difference,
      discount_pct:
        reference && difference !== null
          ? (difference / reference) * 100
          : null,
      net_upside: null,
      confidence,
      sample_size: size,
      comparable_ids: g
        ? g.group
            .slice(0, 26)
            .filter((x) => x.raw.auctioneer !== r.auctioneer)
            .slice(0, 25)
            .map((x) => x.raw.uuid)
        : [],
      match_key: i?.key ?? null,
      modifiers: i?.modifiers ?? {},
      end: r.end!,
      start: r.start ?? 0,
      reason: reference
        ? "listing_median_not_sale"
        : "insufficient_independent_comparables",
    };
  });
}
