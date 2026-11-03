import type { Analysis, Asset } from "@/features/intelligence/models";

export type NetworthCategoryId =
  | "inventory"
  | "armor"
  | "equipment"
  | "accessories"
  | "enderChest"
  | "wardrobe"
  | "storage"
  | "pets"
  | "other"
  | "liquid"
  | "coopBank";

export const NETWORTH_CATEGORY_ORDER: NetworthCategoryId[] = [
  "inventory",
  "armor",
  "equipment",
  "accessories",
  "enderChest",
  "wardrobe",
  "storage",
  "pets",
  "other",
  "liquid",
  "coopBank",
];

export interface NetworthAssetRow {
  key: string;
  itemId: string;
  name: string;
  location: string;
  category: NetworthCategoryId;
  count: number;
  rarity: string | null;
  modifiers: Record<string, unknown>;
  uuid: string | null;
  soulbound: boolean;
  value: number | null;
  /** Conservative local Bazaar estimate; never mixed into `value`. */
  estimatedValue: number | null;
  method: string;
  confidence: string;
  priceTimestamp: number | null;
  material: string | null;
  skullTexture: string | null;
}

export interface NetworthCategoryRow {
  id: NetworthCategoryId;
  entries: number;
  priced: number;
  unknown: number;
  untradeable: number;
  /** Entries covered by a confirmed price. */
  value: number;
  /** Entries covered only by the local Bazaar top-up. */
  estimatedEntries: number;
  estimatedValue: number;
  coverage: number | null;
  share: number | null;
}

export interface NetworthBreakdown {
  knownTotal: number | null;
  assetValue: number;
  tradableValue: number;
  /** Sum of clearly-labelled local Bazaar estimates for unpriced plain items. */
  estimatedValue: number;
  estimatedCount: number;
  liquid: number | null;
  purse: number | null;
  bank: number | null;
  coopBank: number | null;
  untradeableCount: number;
  pricedCount: number;
  unknownCount: number;
  unknownTradeable: number;
  unknownSoulbound: number;
  /** Entries dropped by tolerant parsing; never counted as zero-value assets. */
  invalidCount: number;
  /** Malformed entries that could be salvaged with safe defaults. */
  recoveredCount: number;
  /** True when at least one inventory container was missing or undecodable. */
  partialInventory: boolean;
  /** Container keys that could not be included in the calculation. */
  unavailableContainers: string[];
  bazaarPricedCount: number;
  auctionPricedCount: number;
  entryCount: number;
  coverage: number | null;
  /** Coverage including the labelled local Bazaar top-up. */
  coverageWithEstimates: number | null;
  complete: boolean;
  categories: NetworthCategoryRow[];
  assets: NetworthAssetRow[];
  duplicates: number;
  fetchedAt: number;
  stale: boolean;
  demo: boolean;
  source: string;
  warnings: string[];
}

/** Map a decoded inventory location to a Networth category. */
export function categoryForLocation(location: string): NetworthCategoryId {
  if (location === "inv_contents") return "inventory";
  if (location === "inv_armor") return "armor";
  if (location === "equipment_contents") return "equipment";
  if (location === "accessory_bag") return "accessories";
  if (location === "ender_chest_contents") return "enderChest";
  if (location === "wardrobe_contents") return "wardrobe";
  if (location.startsWith("backpack:") || location === "storage") {
    return "storage";
  }
  return "other";
}

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function metricValue(analysis: Analysis, id: string): number | null {
  return finite(analysis.metrics.find((metric) => metric.id === id)?.value);
}

const REQUIRED_CONTAINERS = new Set([
  "inv_contents",
  "inv_armor",
  "equipment_contents",
  "ender_chest_contents",
  "wardrobe_contents",
  "accessory_bag",
]);

/**
 * Container states that mean "this part of the inventory is not in the total".
 * The aggregate `storage` key is skipped: it is derived from backpack keys and
 * would otherwise report the same problem twice.
 */
export function unavailableInventoryContainers(
  analysis: Analysis,
): string[] {
  return Object.entries(analysis.completeness ?? {})
    .filter(([key, state]) => {
      if (key === "storage") return false;
      if (!REQUIRED_CONTAINERS.has(key) && !key.startsWith("backpack:")) {
        return false;
      }
      return state === "unknown" || state === "invalid" || state === "private";
    })
    .map(([key]) => key)
    .sort();
}

/**
 * Build a full, category-aware Networth breakdown from the analysis contract.
 *
 * This deliberately recomputes the total from decoded assets instead of
 * trusting a single number: UUID mirrors are counted once, distinct slots
 * without a UUID stay separate, soulbound entries never get an invented value
 * and the co-op bank stays outside the personal total.
 */
export function buildNetworth(
  analysis: Analysis,
  options: { bazaarPrices?: Map<string, number> | null } = {},
): NetworthBreakdown {
  const bazaarPrices = options.bazaarPrices ?? new Map<string, number>();
  const seenUuids = new Set<string>();
  let duplicates = 0;
  const assets: NetworthAssetRow[] = [];

  for (const asset of analysis.assets) {
    const uuid = asset.uuid?.trim() ? asset.uuid.trim() : null;
    if (uuid) {
      if (seenUuids.has(uuid)) {
        duplicates += 1;
        continue;
      }
      seenUuids.add(uuid);
    }
    assets.push(assetRow(asset, bazaarPrices));
  }

  const pricedAssets = assets.filter((asset) => asset.value !== null);
  const assetValue = pricedAssets.reduce((sum, asset) => sum + (asset.value ?? 0), 0);
  const tradableValue = pricedAssets
    .filter((asset) => !asset.soulbound)
    .reduce((sum, asset) => sum + (asset.value ?? 0), 0);
  const untradeableCount = assets.filter((asset) => asset.soulbound).length;
  const unknownAssets = assets.filter((asset) => asset.value === null).length;
  const estimatedAssets = assets.filter(
    (asset) => asset.estimatedValue !== null && asset.estimatedValue > 0,
  );
  const estimatedValue = estimatedAssets.reduce(
    (sum, asset) => sum + (asset.estimatedValue ?? 0),
    0,
  );
  const unknownTradeable = assets.filter(
    (asset) => asset.value === null && !asset.soulbound,
  ).length;
  const unknownSoulbound = assets.filter(
    (asset) => asset.value === null && asset.soulbound,
  ).length;
  const pets = analysis.pets.length;
  const integrity = analysis.integrity;
  const invalidCount =
    (integrity?.invalidAssets ?? 0) + (integrity?.invalidPets ?? 0);
  const recoveredCount =
    (integrity?.recoveredAssets ?? 0) + (integrity?.recoveredPets ?? 0);
  const missingContainers = unavailableInventoryContainers(analysis);
  const partialInventory = missingContainers.length > 0;

  const liquid = finite(analysis.networth.personal_liquid);
  const coopBank = finite(analysis.networth.shared_bank);
  const purse = metricValue(analysis, "purse");
  const bank = metricValue(analysis, "bank");

  const entryCount = assets.length + pets;
  const pricedCount = pricedAssets.length;
  const unknownCount = unknownAssets + pets;
  const coverage = entryCount ? pricedCount / entryCount : null;
  const coverageWithEstimates = entryCount
    ? (pricedCount + estimatedAssets.length) / entryCount
    : null;
  const knownTotal =
    liquid === null && !pricedCount ? null : assetValue + (liquid ?? 0);
  const bazaarPricedCount = pricedAssets.filter((asset) =>
    /^bazaar/.test(asset.method),
  ).length;
  const auctionPricedCount = pricedAssets.filter(
    (asset) => !/^bazaar/.test(asset.method),
  ).length;

  const categories = NETWORTH_CATEGORY_ORDER.map((id) =>
    emptyCategory(id),
  );

  for (const asset of assets) {
    const row = categories.find((category) => category.id === asset.category);
    if (!row) continue;
    row.entries += 1;
    if (asset.value === null) row.unknown += 1;
    else {
      row.priced += 1;
      row.value += asset.value;
    }
    if (asset.estimatedValue !== null) {
      row.estimatedEntries += 1;
      row.estimatedValue += asset.estimatedValue;
    }
    if (asset.soulbound) row.untradeable += 1;
  }

  const petsRow = categories.find((category) => category.id === "pets");
  if (petsRow) {
    petsRow.entries = pets;
    petsRow.unknown = pets;
  }

  const liquidRow = categories.find((category) => category.id === "liquid");
  if (liquidRow && liquid !== null) {
    liquidRow.entries = 1;
    liquidRow.priced = 1;
    liquidRow.value = liquid;
  }

  const coopRow = categories.find((category) => category.id === "coopBank");
  if (coopRow && coopBank !== null) {
    coopRow.entries = 1;
    coopRow.priced = 1;
    coopRow.value = coopBank;
  }

  for (const row of categories) {
    row.coverage = row.entries ? row.priced / row.entries : null;
    row.share =
      knownTotal && knownTotal > 0 && row.id !== "coopBank"
        ? row.value / knownTotal
        : null;
  }

  return {
    knownTotal,
    assetValue,
    tradableValue,
    estimatedValue,
    estimatedCount: estimatedAssets.length,
    liquid,
    purse,
    bank,
    coopBank,
    untradeableCount,
    pricedCount,
    unknownCount,
    unknownTradeable,
    unknownSoulbound,
    invalidCount,
    recoveredCount,
    partialInventory,
    unavailableContainers: missingContainers,
    bazaarPricedCount,
    auctionPricedCount,
    entryCount,
    coverage,
    coverageWithEstimates,
    complete:
      !analysis.demo &&
      !analysis.stale &&
      entryCount > 0 &&
      unknownCount === 0 &&
      invalidCount === 0 &&
      recoveredCount === 0 &&
      !partialInventory &&
      coverage === 1,
    categories: categories.filter(
      (row) => row.entries > 0 || row.id === "inventory",
    ),
    assets: assets.sort(
      (a, b) =>
        (b.value ?? -1) - (a.value ?? -1) || a.name.localeCompare(b.name),
    ),
    duplicates,
    fetchedAt: analysis.fetched_at,
    stale: analysis.stale,
    demo: analysis.demo,
    source: analysis.source,
    warnings: analysis.warnings,
  };
}

function emptyCategory(id: NetworthCategoryId): NetworthCategoryRow {
  return {
    id,
    entries: 0,
    priced: 0,
    unknown: 0,
    untradeable: 0,
    value: 0,
    estimatedEntries: 0,
    estimatedValue: 0,
    coverage: null,
    share: null,
  };
}

function assetRow(
  asset: Asset,
  bazaarPrices: Map<string, number>,
): NetworthAssetRow {
  const value = finite(asset.value);
  let estimatedValue: number | null = null;
  if (
    value === null &&
    !asset.soulbound &&
    Object.keys(asset.modifiers ?? {}).length === 0
  ) {
    const price = bazaarPrices.get(asset.item_id.toUpperCase());
    if (price != null && Number.isFinite(price) && price > 0) {
      estimatedValue = price * Math.max(1, asset.count);
    }
  }
  return {
    key: asset.key,
    itemId: asset.item_id,
    name: asset.name,
    location: asset.location,
    category: categoryForLocation(asset.location),
    count: asset.count,
    rarity: asset.rarity,
    modifiers: asset.modifiers ?? {},
    uuid: asset.uuid,
    soulbound: asset.soulbound,
    value,
    estimatedValue,
    method: asset.method,
    confidence: asset.confidence,
    priceTimestamp: asset.price_timestamp,
    material: asset.material ?? null,
    skullTexture: asset.skull_texture ?? null,
  };
}

export function networthMethodKey(method: string): string {
  switch (method) {
    case "bazaar_visible_bid":
    case "bazaar_visible_ask":
    case "bazaar":
      return "networth.bazaar";
    case "auction":
    case "auction_bin":
    case "auction_median":
    case "exact_bin_listing":
    case "exact_bin_listing_median":
      return "networth.auction";
    case "fixed":
      return "networth.fixed";
    case "manual":
      return "networth.manual";
    default:
      return "networth.noValue";
  }
}
