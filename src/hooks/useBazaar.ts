import type { AuctionSearchQuery } from "@/types/hypixel";
import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { bazaarResponseSchema, auctionsResponseSchema } from "@/api/schemas";
import { cachedProviderFetch } from "@/data/envelope-cache";
import { useDataProvider, useDataScope } from "@/data";
import type { DataEnvelope } from "@/types/app";
import type { AuctionsResponse, BazaarResponse, HypixelAuction, HypixelItem, ItemsResourceResponse, SkillsResourceResponse } from "@/types/hypixel";
import { itemMetaFromMap } from "@/services/resources";
import { useSettingsStore } from "@/stores/settings";
import { useWatchlistStore } from "@/stores/watchlist";
import { useApiStatusStore } from "@/stores/api-status";
import { summarizeBazaar, toBazaarQuote, type BazaarSummary } from "@/features/bazaar/calculations";
import type { BazaarItemQuote } from "@/types/bazaar";

/** Backend caches upstream data already; keep the local persisted copy short. */
const BACKEND_BAZAAR_TTL = 15_000;
const BACKEND_AUCTIONS_TTL = 45_000;
const RESOURCE_TTL = 12 * 60 * 60 * 1000;

export function useBazaar() {
  const settings = useSettingsStore((state) => state.settings);
  const provider = useDataProvider();
  const scope = useDataScope();
  const ttl = settings.refreshIntervalSec * 1000;
  const rateLimited = useApiStatusStore(
    (state) => state.health === "degraded" && Boolean(state.lastError && /rate/i.test(state.lastError)),
  );
  const forceRef = useRef(false);

  const query = useQuery<DataEnvelope<BazaarResponse>>({
    queryKey: ["bazaar", scope],
    queryFn: async ({ signal }) => {
      const force = forceRef.current;
      forceRef.current = false;
      if (provider.isDemo) return provider.getBazaar(signal);
      return cachedProviderFetch<BazaarResponse>({
        schema: bazaarResponseSchema,
        key: `bazaar:${scope}`,
        ttlMs: provider.id === "backend" ? BACKEND_BAZAAR_TTL : ttl,
        force,
        signal,
        provider: provider.id,
        fetcher: () => provider.getBazaar(signal),
      });
    },
    staleTime: provider.id === "backend" ? BACKEND_BAZAAR_TTL : ttl,
    gcTime: 30 * 60 * 1000,
    // Back off automatic refreshes while Hypixel reports a rate limit. The
    // manual refresh button remains available and resumes the interval on
    // the next successful response.
    refetchInterval: rateLimited ? false : provider.isDemo ? false : ttl,
    refetchIntervalInBackground: false,
    retry: (count, error) => count < 1 && error instanceof Error && !error.message.includes("API key"),
  });

  const itemsQuery = useItemsResource();

  const itemMap = useMemo(() => {
    const map = new Map<string, HypixelItem>();
    for (const item of itemsQuery.data?.data.items ?? []) map.set(item.id, item);
    return map;
  }, [itemsQuery.data]);

  const quotes = useMemo<BazaarItemQuote[]>(() => {
    const products = query.data?.data.products;
    if (!products) return [];
    const updatedAt = query.data?.updatedAt ?? Date.now();
    return Object.values(products)
      .map((product) => toBazaarQuote(product, itemMetaFromMap(itemMap, product.product_id), updatedAt))
      .filter((quote): quote is BazaarItemQuote => quote !== null);
  }, [query.data, itemMap]);

  const summary = useMemo<BazaarSummary>(() => summarizeBazaar(quotes), [quotes]);
  const favorites = useWatchlistStore((state) => state.entries);
  const favoriteIds = useMemo(() => new Set(favorites.map((entry) => entry.productId)), [favorites]);
  const favoriteQuotes = useMemo(() => quotes.filter((quote) => favoriteIds.has(quote.productId)), [quotes, favoriteIds]);

  const refresh = async () => {
    forceRef.current = true;
    try {
      await query.refetch({ cancelRefetch: true });
    } finally {
      forceRef.current = false;
    }
  };

  return {
    ...query,
    envelope: query.data,
    quotes,
    summary,
    favoriteQuotes,
    itemMap,
    refresh,
    demo: provider.isDemo,
    feePct: settings.bazaarFeePct,
  };
}

export function useItemsResource() {
  const provider = useDataProvider();
  const scope = useDataScope();
  return useQuery<DataEnvelope<ItemsResourceResponse>>({
    queryKey: ["resources", "items", scope],
    queryFn: ({ signal }) => provider.getItems(signal),
    staleTime: provider.isDemo ? Infinity : RESOURCE_TTL,
    gcTime: RESOURCE_TTL,
    retry: 1,
  });
}

export function useSkillsResource() {
  const provider = useDataProvider();
  const scope = useDataScope();
  return useQuery<DataEnvelope<SkillsResourceResponse>>({
    queryKey: ["resources", "skills", scope],
    queryFn: ({ signal }) => provider.getSkills(signal),
    staleTime: provider.isDemo ? Infinity : RESOURCE_TTL,
    gcTime: RESOURCE_TTL,
    retry: 1,
  });
}

export function useAuctions(
  page: number,
  filters: AuctionSearchQuery = {},
  enabled = true,
) {
  const provider = useDataProvider();
  const scope = useDataScope();
  const forceRef = useRef(false);

  const query = useQuery<DataEnvelope<AuctionsResponse>>({
    queryKey: ["auctions", scope, page, filters],
    enabled,
    queryFn: async ({ signal }) => {
      const force = forceRef.current;
      forceRef.current = false;
      if (provider.searchAuctions)
        return provider.searchAuctions(page, filters, signal);
      if (provider.isDemo) return provider.getAuctions(page, signal);
      return cachedProviderFetch<AuctionsResponse>({
        schema: auctionsResponseSchema,
        key: `auctions:${scope}:${page}`,
        ttlMs: provider.id === "backend" ? BACKEND_AUCTIONS_TTL : 60_000,
        force,
        signal,
        provider: provider.id,
        fetcher: () => provider.getAuctions(page, signal),
      });
    },
    staleTime: provider.id === "backend" ? BACKEND_AUCTIONS_TTL : 60_000,
    gcTime: provider.searchAuctions ? 60_000 : 10 * 60 * 1000,
    refetchInterval: provider.searchAuctions ? BACKEND_AUCTIONS_TTL : false,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const refresh = async () => {
    forceRef.current = true;
    try {
      await query.refetch({ cancelRefetch: true });
    } finally {
      forceRef.current = false;
    }
  };

  const auctions = useMemo<HypixelAuction[]>(
    () => query.data?.data.auctions ?? [],
    [query.data],
  );

  return {
    ...query,
    envelope: query.data,
    auctions,
    refresh,
    demo: provider.isDemo,
    globalSearch: Boolean(provider.searchAuctions),
  };
}

export type { ItemsResourceResponse };
