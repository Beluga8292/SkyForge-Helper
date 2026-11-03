// Shared response contract, mirrored from Pydantic Analysis schema v1.
import { z } from "zod";
export const accessoryCandidateSchema = z.object({
  item_id: z.string(),
  family: z.string(),
  rarity: z.union([z.string(), z.null()]),
  gain: z.union([z.number().finite(), z.null()]),
  cost: z.union([z.number().finite(), z.null()]),
  coins_per_point: z.union([z.number().finite(), z.null()]),
  method: z.string(),
  confidence: z.string(),
  requirements: z.array(z.string()),
  price_timestamp: z.union([z.number().finite().int(), z.null()]),
});
export type AccessoryCandidate = z.infer<typeof accessoryCandidateSchema>;
export const assetSchema = z.object({
  key: z.string(),
  item_id: z.string(),
  name: z.string(),
  location: z.string(),
  category: z.string().nullable(),
  count: z.number().finite().int(),
  rarity: z.union([z.string(), z.null()]),
  modifiers: z.record(z.string(), z.unknown()),
  uuid: z.union([z.string(), z.null()]),
  match_key: z.union([z.string(), z.null()]),
  soulbound: z.boolean(),
  value: z.union([z.number().finite(), z.null()]),
  method: z.string(),
  confidence: z.string(),
  price_timestamp: z.union([z.number().finite().int(), z.null()]),
  /** Optional texture hints when the upstream exposes them. */
  material: z.union([z.string(), z.null()]).optional(),
  skull_texture: z.union([z.string(), z.null()]).optional(),
});
export type Asset = z.infer<typeof assetSchema>;

/**
 * Counts describing how much of an upstream payload had to be repaired or
 * dropped before it could be analysed. They are intentionally separate from
 * pricing warnings: a dropped item is never counted as a zero-value asset.
 */
export const analysisIntegritySchema = z.object({
  invalidAssets: z.number().finite().int().nonnegative(),
  invalidPets: z.number().finite().int().nonnegative(),
  invalidMetrics: z.number().finite().int().nonnegative(),
  invalidRecommendations: z.number().finite().int().nonnegative(),
  invalidAccessories: z.number().finite().int().nonnegative(),
  recoveredAssets: z.number().finite().int().nonnegative(),
  recoveredPets: z.number().finite().int().nonnegative(),
});
export type AnalysisIntegrity = z.infer<typeof analysisIntegritySchema>;

export function emptyIntegrity(): AnalysisIntegrity {
  return {
    invalidAssets: 0,
    invalidPets: 0,
    invalidMetrics: 0,
    invalidRecommendations: 0,
    invalidAccessories: 0,
    recoveredAssets: 0,
    recoveredPets: 0,
  };
}
export const metricSchema = z.object({
  id: z.string(),
  category: z.string(),
  value: z.union([z.number().finite(), z.null()]),
  level: z.union([z.number().finite().int(), z.null()]),
  target: z.union([z.number().finite(), z.null()]),
  remaining: z.union([z.number().finite(), z.null()]),
  progress: z.union([z.number().finite(), z.null()]),
  state: z.enum([
    "known",
    "unknown",
    "private",
    "not_supported",
    "not_applicable",
    "invalid",
  ]),
  source: z.string(),
  scope: z.enum(["member", "shared"]),
});
export type Metric = z.infer<typeof metricSchema>;
export const networthSchema = z.object({
  personal_liquid: z.union([z.number().finite(), z.null()]),
  shared_bank: z.union([z.number().finite(), z.null()]),
  tradable: z.union([z.number().finite(), z.null()]),
  untradeable_count: z.number().finite().int(),
  unknown_count: z.number().finite().int(),
  priced_count: z.number().finite().int(),
  coverage: z.union([z.number().finite(), z.null()]),
  known_total: z.union([z.number().finite(), z.null()]),
  complete: z.boolean(),
});
export type Networth = z.infer<typeof networthSchema>;
export const petSchema = z.object({
  type: z.string(),
  rarity: z.union([z.string(), z.null()]),
  xp: z.union([z.number().finite(), z.null()]),
  level: z.union([z.number().finite().int(), z.null()]),
  next_xp: z.union([z.number().finite(), z.null()]),
  remaining: z.union([z.number().finite(), z.null()]),
  progress: z.union([z.number().finite(), z.null()]),
  held_item: z.union([z.string(), z.null()]),
  active: z.union([z.boolean(), z.null()]),
  state: z.enum([
    "known",
    "unknown",
    "private",
    "not_supported",
    "not_applicable",
    "invalid",
  ]),
});
export type Pet = z.infer<typeof petSchema>;
export const recommendationSchema = z.object({
  id: z.string(),
  category: z.string(),
  subject: z.string(),
  current: z.union([z.number().finite(), z.null()]),
  target: z.union([z.number().finite(), z.null()]),
  remaining: z.union([z.number().finite(), z.null()]),
  score: z.number().finite(),
  status: z.enum(["available", "locked", "missing_data"]),
  requirements: z.array(z.string()),
  dependencies: z.array(z.string()),
  cost: z.union([z.number().finite(), z.null()]),
  effort: z.union([z.number().finite(), z.null()]),
  confidence: z.string(),
  source: z.string(),
  reason: z.string(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;
export const analysisSchema = z.object({
  schema_version: z.literal("1"),
  rules_version: z.string(),
  uuid: z.string(),
  profile_id: z.string(),
  username: z.union([z.string(), z.null()]),
  profile_name: z.union([z.string(), z.null()]),
  profile_type: z.union([z.string(), z.null()]),
  coop: z.boolean(),
  first_join: z.union([z.number().finite().int(), z.null()]),
  last_save: z.union([z.number().finite().int(), z.null()]),
  fetched_at: z.number().finite().int(),
  stale: z.boolean(),
  demo: z.boolean(),
  source: z.string(),
  completeness: z.record(
    z.string(),
    z.enum([
      "known",
      "unknown",
      "private",
      "not_supported",
      "not_applicable",
      "invalid",
    ]),
  ),
  metrics: z.array(metricSchema),
  assets: z.array(assetSchema),
  pets: z.array(petSchema),
  recommendations: z.array(recommendationSchema),
  accessory_power: z.union([z.number().finite(), z.null()]),
  accessory_power_known_subset: z.union([z.number().finite(), z.null()]),
  accessories: z.array(accessoryCandidateSchema),
  networth: networthSchema,
  warnings: z.array(z.string()),
  selected_class: z.union([z.string(), z.null()]),
  floors: z.record(z.string(), z.number().finite()),
  minions: z.union([z.array(z.string()), z.null()]),
  integrity: analysisIntegritySchema.optional(),
});
export type Analysis = z.infer<typeof analysisSchema>;

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegativeNumberOrNull(value: unknown): number | null {
  const numeric = finiteNumberOrNull(value);
  return numeric !== null && numeric >= 0 ? numeric : null;
}

function positiveInteger(value: unknown): number {
  const numeric = finiteNumberOrNull(value);
  return numeric !== null && numeric >= 1 ? Math.trunc(numeric) : 1;
}

function integerOrNull(value: unknown): number | null {
  const numeric = finiteNumberOrNull(value);
  return numeric !== null && Number.isInteger(numeric) ? numeric : null;
}

function booleanOrFalse(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function repairAsset(raw: unknown, index: number): Asset | null {
  const record = recordOf(raw);
  if (!record) return null;
  const itemId = typeof record.item_id === "string" ? record.item_id.trim() : "";
  if (!itemId) return null;
  const location =
    typeof record.location === "string" && record.location.trim()
      ? record.location
      : "unknown";
  const name =
    typeof record.name === "string" && record.name.trim()
      ? record.name
      : itemId;
  const modifiers = recordOf(record.modifiers) ?? {};
  const value = nonNegativeNumberOrNull(record.value);
  return {
    key:
      typeof record.key === "string" && record.key.trim()
        ? record.key
        : `${location}:${index}`,
    item_id: itemId,
    name,
    location,
    category: stringOrNull(record.category),
    count: positiveInteger(record.count),
    rarity: stringOrNull(record.rarity),
    modifiers,
    uuid: typeof record.uuid === "string" && record.uuid.trim() ? record.uuid : null,
    match_key: stringOrNull(record.match_key),
    soulbound: booleanOrFalse(record.soulbound),
    value,
    method: typeof record.method === "string" ? record.method : "unknown",
    confidence:
      typeof record.confidence === "string" ? record.confidence : "insufficient",
    price_timestamp: integerOrNull(record.price_timestamp),
    material: stringOrNull(record.material),
    skull_texture: stringOrNull(record.skull_texture),
  };
}

function repairPet(raw: unknown): Analysis["pets"][number] | null {
  const record = recordOf(raw);
  if (!record) return null;
  const type = typeof record.type === "string" ? record.type.trim() : "";
  if (!type) return null;
  const states = [
    "known",
    "unknown",
    "private",
    "not_supported",
    "not_applicable",
    "invalid",
  ] as const;
  const state = states.find((value) => value === record.state) ?? "unknown";
  return {
    type,
    rarity: stringOrNull(record.rarity),
    xp: nonNegativeNumberOrNull(record.xp),
    level: integerOrNull(record.level),
    next_xp: nonNegativeNumberOrNull(record.next_xp),
    remaining: nonNegativeNumberOrNull(record.remaining),
    progress: nonNegativeNumberOrNull(record.progress),
    held_item: stringOrNull(record.held_item),
    active: typeof record.active === "boolean" ? record.active : null,
    state,
  };
}

function filterList<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  repair: (value: unknown, index: number) => T | null,
): { values: T[]; invalid: number; recovered: number } {
  const values: T[] = [];
  let invalid = 0;
  let recovered = 0;
  for (const [index, entry] of (Array.isArray(raw) ? raw : []).entries()) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) {
      values.push(parsed.data);
      continue;
    }
    const fixed = repair(entry, index);
    if (fixed) {
      values.push(fixed);
      recovered += 1;
    } else {
      invalid += 1;
    }
  }
  return { values, invalid, recovered };
}

/**
 * Parse an analysis payload without letting one malformed asset or pet discard
 * the whole result. Invalid entries are dropped and counted in `integrity` so
 * the UI can label the result as partial instead of faking a complete total.
 */
export function parseAnalysis(raw: unknown): Analysis {
  const record = recordOf(raw);
  if (!record) {
    throw new Error("Analysis payload is not an object");
  }

  const metrics = filterList(
    record.metrics,
    metricSchema,
    (value) => (metricSchema.safeParse(value).success ? (value as never) : null),
  );
  const assets = filterList(record.assets, assetSchema, repairAsset);
  const pets = filterList(record.pets, petSchema, repairPet);
  const recommendations = filterList(
    record.recommendations,
    recommendationSchema,
    () => null,
  );
  const accessories = filterList(
    record.accessories,
    accessoryCandidateSchema,
    () => null,
  );
  const warnings = Array.isArray(record.warnings)
    ? record.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];
  const completeness: Record<string, Analysis["completeness"][string]> = {};
  for (const [key, state] of Object.entries(recordOf(record.completeness) ?? {})) {
    if (
      state === "known" ||
      state === "unknown" ||
      state === "private" ||
      state === "not_supported" ||
      state === "not_applicable" ||
      state === "invalid"
    ) {
      completeness[key] = state;
    } else {
      completeness[key] = "invalid";
    }
  }
  const floors: Record<string, number> = {};
  for (const [key, value] of Object.entries(recordOf(record.floors) ?? {})) {
    const numeric = finiteNumberOrNull(value);
    if (numeric !== null) floors[key] = numeric;
  }
  const integrity: AnalysisIntegrity = {
    invalidAssets: assets.invalid,
    invalidPets: pets.invalid,
    invalidMetrics: metrics.invalid,
    invalidRecommendations: recommendations.invalid,
    invalidAccessories: accessories.invalid,
    recoveredAssets: assets.recovered,
    recoveredPets: pets.recovered,
  };

  const parsed = analysisSchema.safeParse({
    ...record,
    metrics: metrics.values,
    assets: assets.values,
    pets: pets.values,
    recommendations: recommendations.values,
    accessories: accessories.values,
    warnings,
    completeness,
    floors,
    integrity,
  });
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}
export interface IntelligenceProvider {
  getIntelligence(
    uuid: string,
    profileId: string,
    market?: boolean,
    signal?: AbortSignal,
  ): Promise<Analysis>;
}
