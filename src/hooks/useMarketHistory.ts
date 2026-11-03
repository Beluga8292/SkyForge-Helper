import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useDataScope } from "@/data";
import { getMarketHistory } from "@/services/history";
import type { MarketHistoryPoint } from "@/types/app";

export function useMarketHistory(productId: string | null, enabled = true) {
  const provider = useDataProvider();
  const scope = useDataScope();
  return useQuery<MarketHistoryPoint[]>({
    queryKey: ["market-history", scope, productId],
    enabled: enabled && Boolean(productId),
    queryFn: async ({ signal }) => {
      if (provider.isDemo) return [];
      if (provider.id === "direct") return getMarketHistory(productId ?? "", 288);
      const history = await provider.getHistory(productId ?? "", "24h", signal);
      return (history?.points ?? []).map((point) => ({
        productId: productId ?? "", ts: Date.parse(point.ts),
        buyPrice: point.buy_price, sellPrice: point.sell_price,
        buyVolume: point.buy_volume, sellVolume: point.sell_volume,
      }));
    },
    staleTime: 60_000,
    retry: 0,
  });
}
