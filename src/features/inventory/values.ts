import type { Analysis } from "@/features/intelligence/models";
import {
  buildNetworth,
  type NetworthAssetRow,
} from "@/features/networth/engine";
import type { DecodedInventoryItem } from "@/types/profile";
import type { HypixelItem } from "@/types/hypixel";
export interface InventoryValue {
  state: "known" | "estimated" | "unknown" | "unavailable" | "stale";
  total: number | null;
  unit: number | null;
  source: string;
  timestamp: number | null;
  confidence: string;
  coverage: number | null;
  partial: boolean;
  tradeability: "soulbound" | "untradeable" | "tradeable" | "unknown";
  sellable: number | null;
  reason: "none" | "missing" | "variant" | "quantity" | "scope";
}
export interface InventoryValueIndex {
  rows: Map<string, NetworthAssetRow | null>;
  analysis: Analysis;
  coverage: number | null;
  partial: boolean;
  bazaarAt: number | null;
}
const clean = (s: string) => s.replaceAll("-", "").toLowerCase();
const ignored = new Set(["id", "uuid", "timestamp", "originTag", "spawnedFor"]);
export function modifiersOf(extra: Record<string, unknown>): string {
  const stable = (x: unknown): string =>
    x && typeof x === "object"
      ? Array.isArray(x)
        ? `[${x.map(stable).join(",")}]`
        : `{${Object.entries(x)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => JSON.stringify(k) + ":" + stable(v))
            .join(",")}}`
      : (JSON.stringify(typeof x === "bigint" ? String(x) : x) ?? "null");
  return stable(
    Object.fromEntries(Object.entries(extra).filter(([k]) => !ignored.has(k))),
  );
}
/** Reuses Networth rows/stack semantics. No price inference or NBT decoder here. */
export function inventoryValueIndex(
  analysis: Analysis | undefined,
  uuid: string,
  profileId: string,
  bazaarPrices: Map<string, number>,
  bazaarAt: number | null,
): InventoryValueIndex | null {
  if (
    !analysis ||
    clean(analysis.uuid) !== clean(uuid) ||
    clean(analysis.profile_id) !== clean(profileId)
  )
    return null;
  const breakdown = buildNetworth(analysis, { bazaarPrices });
  const rows = new Map<string, NetworthAssetRow | null>();
  for (const row of breakdown.assets)
    rows.set(row.key, rows.has(row.key) ? null : row);
  return {
    rows,
    analysis,
    coverage: breakdown.coverageWithEstimates,
    partial: !breakdown.complete,
    bazaarAt,
  };
}
export function inventoryItemValue(
  item: DecodedInventoryItem,
  location: string,
  index: InventoryValueIndex | null,
  meta?: HypixelItem,
  now = Date.now(),
): InventoryValue {
  const tradeability =
    item.soulbound ||
    Boolean(
      item.extra.soulbound ||
      item.extra.donated_museum ||
      item.extra.coop_soulbound,
    ) ||
    meta?.soulbound === true
      ? "soulbound"
      : meta?.untradeable === true || meta?.untradable === true
        ? "untradeable"
        : meta?.tradeable === true
          ? "tradeable"
          : "unknown";
  const base: InventoryValue = {
    state: index ? "unknown" : "unavailable",
    total: null,
    unit: null,
    source: "unknown",
    timestamp: null,
    confidence: "unknown",
    coverage: index?.coverage ?? null,
    partial: index?.partial ?? true,
    tradeability,
    sellable: null,
    reason: index ? "missing" : "scope",
  };
  if (!Number.isSafeInteger(item.count) || item.count < 1 || item.count > 64)
    return { ...base, state: "unavailable", reason: "quantity" };
  const row = index?.rows.get(`${location}:${item.slot}`);
  if (!row) return base;
  if (
    row.itemId !== item.itemId ||
    row.count !== item.count ||
    clean(row.uuid ?? "") !== clean(item.uuid ?? "") ||
    ((row.rarity?.toUpperCase()??null) !== (item.rarity?.toUpperCase()??null)) ||
    modifiersOf(row.modifiers) !== modifiersOf(item.extra)
  )
    return { ...base, reason: "variant" };
  const total = row.value ?? row.estimatedValue;
  if (total === null || !Number.isFinite(total) || total < 0) return base;
  const timestamp = row.value !== null ? row.priceTimestamp : index!.bazaarAt;
  const stale =
    index!.analysis.stale || (timestamp !== null && now - timestamp > 120000);
  const bound = tradeability === "soulbound" || row.soulbound;
  const estimated =
    bound ||
    tradeability === "untradeable" ||
    row.value === null ||
    !row.method.startsWith("bazaar");
  return {
    ...base,
    state: stale ? "stale" : estimated ? "estimated" : "known",
    total,
    unit: total / item.count,
    source: row.value === null ? "local_bazaar_topup" : row.method,
    timestamp,
    confidence: row.value === null ? "low" : row.confidence,
    tradeability: bound ? "soulbound" : tradeability,
    sellable: !bound && tradeability === "tradeable" && row.value !== null && row.method === "bazaar_visible_bid" ? total : null,
    reason: "none",
  };
}
export function compactInventoryValue(value: InventoryValue): string {
  if (value.total === null) return "?";
  const n = value.total;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return n === 0 ? "0" : n < 1 ? "<1" : String(Math.round(n));
}
