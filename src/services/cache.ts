import { isTauriRuntime } from "@/api/transport";
import type { ZodType } from "zod";
import type { CacheStats, DataEnvelope } from "@/types/app";
import { invokeDesktop } from "@/services/desktop";
import { getHistoryCount } from "@/services/history";

interface PersistedCacheRow {
  payload: string;
  updatedAt: number;
}

const PREFIX = "api:";
const browserKey = (key: string) => `sbc:cache:${key}`;

export async function readCache<T>(key: string, schema?: ZodType<T>): Promise<PersistedCacheRow & { data: T } | null> {
  const desktop = await invokeDesktop<{ payload: string; updatedAt: number } | null>("cache_get", { key: PREFIX + key });
  let payload: string | null = null;
  let updatedAt = 0;

  if (desktop) {
    payload = desktop.payload;
    updatedAt = desktop.updatedAt;
  } else {
    try {
      const raw = window.localStorage.getItem(browserKey(key));
      if (raw) {
        const parsed = JSON.parse(raw) as { payload: string; updatedAt: number };
        payload = parsed.payload;
        updatedAt = parsed.updatedAt;
      }
    } catch {
      return null;
    }
  }

  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (schema) {
      const result = schema.safeParse(parsed);
      if (!result.success) return null;
      return { data: result.data, payload, updatedAt };
    }
    return { data: parsed as T, payload, updatedAt };
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T, updatedAt = Date.now()): Promise<void> {
  const payload = JSON.stringify(data);
  await invokeDesktop<null>("cache_set", { key: PREFIX + key, payload, updatedAt });
  if (isTauriRuntime()) return;
  try {
    window.localStorage.setItem(browserKey(key), JSON.stringify({ payload, updatedAt }));
  } catch {
    // Browser storage may be full; cache is best-effort.
  }
}

async function deleteCache(key: string): Promise<void> {
  await invokeDesktop<null>("cache_delete", { key: PREFIX + key });
  if (isTauriRuntime()) return;
  window.localStorage.removeItem(browserKey(key));
}

export interface CachedFetchOptions<T> {
  key: string;
  ttlMs: number;
  force?: boolean;
  fetcher: () => Promise<T>;
  schema?: ZodType<T>;
  updatedAt?: number;
}

/**
 * Network-first with a persisted fallback. Fresh cache entries are returned
 * without hitting the API, stale entries are used if the network fails and are
 * marked `stale` so the UI can be honest about data age.
 */
export async function cachedFetch<T>(options: CachedFetchOptions<T>): Promise<DataEnvelope<T>> {
  const cached = await readCache(options.key, options.schema);
  if (cached && !options.force && Date.now() - cached.updatedAt < options.ttlMs) {
    return { data: cached.data, updatedAt: cached.updatedAt, source: "cache" };
  }

  try {
    const data = await options.fetcher();
    const updatedAt = options.updatedAt ?? Date.now();
    await writeCache(options.key, data, updatedAt);
    return { data, updatedAt, source: "network" };
  } catch (error) {
    if (cached) {
      return { data: cached.data, updatedAt: cached.updatedAt, source: "cache", stale: true };
    }
    throw error;
  }
}

export async function getCacheStats(): Promise<CacheStats> {
  const desktop = await invokeDesktop<CacheStats>("cache_stats", {});
  if (desktop) return desktop;

  let entries = 0;
  let bytes = 0;
  let oldest: number | null = null;
  const encoder = new TextEncoder();
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith("sbc:cache:")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      entries += 1;
      bytes += encoder.encode(raw).length;
      try {
        const parsed = JSON.parse(raw) as { updatedAt?: number };
        if (typeof parsed.updatedAt === "number") {
          oldest = oldest == null ? parsed.updatedAt : Math.min(oldest, parsed.updatedAt);
        }
      } catch {
        // ignore malformed cache rows
      }
    }
  } catch {
    // localStorage may be unavailable
  }

  return {
    entries,
    bytes,
    historyPoints: await getHistoryCount(),
    oldest,
  };
}

export async function clearApiCache(): Promise<void> {
  await invokeDesktop<null>("cache_clear", {});
  if (isTauriRuntime()) return;
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith("sbc:cache:")) keys.push(key);
  }
  for (const key of keys) window.localStorage.removeItem(key);
}

export async function deleteCached(key: string): Promise<void> {
  await deleteCache(key);
}
