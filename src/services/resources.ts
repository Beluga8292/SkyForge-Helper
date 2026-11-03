import { fetchItemsResource, fetchSkillsResource } from "@/api/hypixel/client";
import { itemsResourceSchema, skillsResourceSchema } from "@/api/schemas";
import { cachedFetch } from "@/services/cache";
import type { HypixelItem, HypixelSkill } from "@/types/hypixel";

const DAY = 24 * 60 * 60 * 1000;

export interface ResourceEnvelope<T> {
  data: T;
  updatedAt: number;
  source: "network" | "cache";
  stale?: boolean;
}

export async function loadSkillsResource(force = false): Promise<ResourceEnvelope<Record<string, HypixelSkill>>> {
  const envelope = await cachedFetch({
    key: "resources:skills",
    ttlMs: DAY,
    force,
    schema: skillsResourceSchema,
    fetcher: () => fetchSkillsResource(),
  });
  return {
    data: envelope.data.skills ?? {},
    updatedAt: envelope.updatedAt,
    source: envelope.source,
    stale: envelope.stale,
  };
}

export async function loadItemsResource(force = false): Promise<ResourceEnvelope<Map<string, HypixelItem>>> {
  const envelope = await cachedFetch({
    key: "resources:items",
    ttlMs: DAY,
    force,
    schema: itemsResourceSchema,
    fetcher: () => fetchItemsResource(),
  });
  const map = new Map<string, HypixelItem>();
  for (const item of envelope.data.items ?? []) map.set(item.id, item);
  return {
    data: map,
    updatedAt: envelope.updatedAt,
    source: envelope.source,
    stale: envelope.stale,
  };
}

export function itemMetaFromMap(map: Map<string, HypixelItem> | undefined, id: string) {
  const item = map?.get(id);
  if (!item) return undefined;
  return {
    name: item.name,
    tier: item.tier,
    category: item.category,
    npcSellPrice: item.npc_sell_price,
  };
}
