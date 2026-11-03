import type { ZodType } from "zod";
import { readCache, writeCache } from "@/services/cache";
import type { DataEnvelope, DataMeta, DataMode } from "@/types/app";

interface CachedProviderOptions<T> {
  key: string;
  ttlMs: number;
  force?: boolean;
  schema?: ZodType<T>;
  provider: DataMode;
  signal?: AbortSignal;
  fetcher: () => Promise<DataEnvelope<T>>;
}

function metaFromCache(updatedAt: number, provider: DataMode, stale: boolean): DataMeta {
  return {
    fetchedAt: updatedAt,
    cacheAgeMs: Math.max(0, Date.now() - updatedAt),
    stale,
    source: `${provider}-local-cache`,
  };
}

/**
 * Persisted local cache on top of a provider. This keeps STAGE 1's offline
 * behaviour: a failed backend request still shows the last known values,
 * explicitly marked as stale, instead of inventing replacements.
 */
export async function cachedProviderFetch<T>({
  key,
  ttlMs,
  force,
  schema,
  provider,
  fetcher,
  signal,
}: CachedProviderOptions<T>): Promise<DataEnvelope<T>> {
  signal?.throwIfAborted();
  const cached = await readCache(key, schema);
  signal?.throwIfAborted();
  if (cached && !force && Date.now() - cached.updatedAt < ttlMs) {
    return {
      data: cached.data,
      updatedAt: cached.updatedAt,
      source: "cache",
      provider,
      meta: metaFromCache(cached.updatedAt, provider, false),
    };
  }

  try {
    const envelope = await fetcher();
    signal?.throwIfAborted();
    // Preserve upstream freshness: a failed refresh must never make stale data fresh.
    if (!envelope.stale) await writeCache(key, envelope.data, envelope.updatedAt);
    signal?.throwIfAborted();
    return envelope;
  } catch (error) {
    signal?.throwIfAborted();
    if (cached) {
      return {
        data: cached.data,
        updatedAt: cached.updatedAt,
        source: "cache",
        stale: true,
        provider,
        meta: metaFromCache(cached.updatedAt, provider, true),
      };
    }
    throw error;
  }
}
