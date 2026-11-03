import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useDataScope } from "@/data";
import { useSettingsStore } from "@/stores/settings";
import {
  DEFAULT_FILTERS,
  DEFAULT_AUCTION_FILTERS,
  type AuctionParams,
  type FlipParams,
  type HistoryRange,
} from "@/features/market/models";
import {
  readMarketSetting,
  writeMarketSetting,
} from "@/features/market/storage";
import { z } from "zod";
const flipFilters = z.object({
  mode: z.enum(["order", "instant"]),
  quantity: z.number().int().min(1).max(1e6),
  page: z.number().int().min(0).max(10000),
  page_size: z.number().int().min(1).max(100),
  tax_pct: z.number().finite().min(0).max(10),
  search: z.string().max(100),
  sort: z.enum(["score", "profit", "roi", "cost", "liquidity"]),
  descending: z.boolean(),
  min_profit: z.number().finite().min(-1e15).max(1e15),
  min_roi: z.number().finite().min(-100).max(1e9),
  max_cost: z.number().finite().min(0).max(1e15),
  min_liquidity: z.number().finite().min(0).max(100),
  max_spread: z.number().finite().min(0).max(1e9),
  min_activity: z.number().finite().min(0).max(1e18),
  exclude_loss: z.boolean(),
  exclude_illiquid: z.boolean(),
});
const auctionFilters = z.object({
  min_profit: z.number().finite().min(-1e15).max(1e15).optional(),
  min_roi: z.number().finite().min(-100).max(1e9).optional(),
  max_risk: z.number().finite().min(0).max(100).optional(),
  max_age_seconds: z.number().int().min(0).max(86400).optional(),
  page: z.number().int().min(0).max(10000),
  page_size: z.number().int().min(1).max(100),
  search: z.string().max(100),
  min_discount: z.number().finite().min(-100).max(100),
  max_cost: z.number().finite().min(0).max(1e15),
  min_confidence: z.enum(["high", "medium", "low", "insufficient"]),
  rarity: z.string().optional(),
  min_remaining: z.number().int().min(0).max(86400),
  new_only: z.boolean(),
  sort: z.enum(["discount", "price", "newest", "reference"]),
  descending: z.boolean(),
  fee_pct: z.number().finite().min(0).max(100).optional(),
  listing_fee: z.number().finite().min(0).max(1e12).optional(),
});
export function useMarketFilters() {
  const [filters, setFilters] = useState<FlipParams>(DEFAULT_FILTERS),
    [auctions, setAuctions] = useState<AuctionParams>(DEFAULT_AUCTION_FILTERS),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    void readMarketSetting("filters:v1")
      .then((v) => {
        const parsed = z
          .object({ filters: flipFilters, auctions: auctionFilters })
          .safeParse(v);
        if (live) {
          if (parsed.success) {
            setFilters(parsed.data.filters);
            setAuctions(parsed.data.auctions);
          }
          setLoaded(true);
        }
      })
      .catch(() => {
        if (live) {
          setLoaded(true);
          setError(true);
        }
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      void writeMarketSetting("filters:v1", { filters, auctions }).catch(() =>
        setError(true),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, auctions, loaded]);
  return { filters, setFilters, auctions, setAuctions, loaded, error };
}
function useDebounced<T>(input: T) {
  const [value, setValue] = useState(input);
  const serialized = JSON.stringify(input);
  useEffect(() => {
    const timer = setTimeout(() => setValue(input), 250);
    return () => clearTimeout(timer);
  }, [serialized]);
  return value;
}
export function useFlipScanner(filters: FlipParams, enabled = true) {
  const provider = useDataProvider(),
    scope = useDataScope(),
    tax = useSettingsStore((s) => s.settings.bazaarFeePct),
    debounced = useDebounced(filters),
    params = { ...debounced, tax_pct: tax };
  return useQuery({
    queryKey: ["market-flips", scope, params],
    queryFn: ({ signal }) => provider.getFlips(params, signal),
    enabled,
    staleTime: 20000,
    refetchInterval: provider.isDemo ? false : 30000,
    retry: 0,
  });
}
export function useAuctionScanner(filters: AuctionParams, enabled = true) {
  const provider = useDataProvider(),
    scope = useDataScope(),
    params = useDebounced(filters);
  return useQuery({
    queryKey: ["market-auctions", scope, params],
    queryFn: ({ signal }) => provider.getAuctionOpportunities(params, signal),
    enabled,
    staleTime: 45000,
    refetchInterval: provider.isDemo ? false : 60000,
    retry: 0,
  });
}
export function useItemAnalytics(
  id: string | null,
  range: HistoryRange,
  quantity = 64,
  mode: "order" | "instant" = "order",
) {
  const provider = useDataProvider(),
    scope = useDataScope(),
    tax = useSettingsStore((s) => s.settings.bazaarFeePct);
  return useQuery({
    queryKey: ["market-analytics", scope, id, range, quantity, tax, mode],
    queryFn: ({ signal }) =>
      provider.getAnalytics(id!, range, quantity, tax, signal, mode),
    enabled: Boolean(id),
    staleTime: 30000,
    retry: 0,
  });
}
export function useMarketOverview() {
  const provider = useDataProvider(),
    scope = useDataScope(),
    tax = useSettingsStore((s) => s.settings.bazaarFeePct);
  return useQuery({
    queryKey: ["market-overview", scope, tax],
    queryFn: ({ signal }) => provider.getMarketOverview(tax, signal),
    staleTime: 30000,
    refetchInterval: provider.isDemo ? false : 30000,
    retry: 0,
  });
}
