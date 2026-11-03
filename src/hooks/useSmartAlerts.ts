import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useBazaar } from "@/hooks/useBazaar";
import { useDataProvider, useDataScope } from "@/data";
import { useSettingsStore } from "@/stores/settings";
import { useMarketAlerts } from "@/stores/market-alerts";
import { calculateMarketFlip } from "@/features/market/engine";
import { DEFAULT_AUCTION_FILTERS } from "@/features/market/models";
import { notifyMarket } from "@/features/market/notifications";
import { useI18n } from "@/locales";
import type { AlertEvent } from "@/features/market/alerts";
export function useSmartAlerts() {
  const { envelope, demo } = useBazaar(),
    settings = useSettingsStore((s) => s.settings),
    rules = useMarketAlerts((s) => s.rules),
    hydrated = useMarketAlerts((s) => s.hydrated),
    provider = useDataProvider(),
    scope = useDataScope(),
    { t } = useI18n();
  useEffect(() => {
    void useMarketAlerts.getState().hydrate();
  }, []);
  const enabled = hydrated && !demo && settings.watchlistAlerts;
  const auctionEnabled =
    enabled && rules.some((r) => r.enabled && r.kind === "auction_new");
  const auctions = useQuery({
    queryKey: ["alert-auctions", scope],
    queryFn: ({ signal }) =>
      provider.getAuctionOpportunities(
        {
          ...DEFAULT_AUCTION_FILTERS,
          min_discount: 0,
          max_cost: 1e15,
          page_size: 100,
        },
        signal,
      ),
    enabled: auctionEnabled,
    refetchInterval: auctionEnabled ? 60000 : false,
    staleTime: 45000,
    retry: 0,
  });
  const send = (events: AlertEvent[]) => {
    if (!settings.notificationsEnabled) return;
    for (const event of events) {
      const title = t("market.alertTriggered"),
        body = `${event.productId} · ${t(`market.rule.${event.kind}`)}: ${event.value.toFixed(2)}`;
      toast.info(title, { description: body });
      void notifyMarket(title, body).catch(() => {});
    }
  };
  useEffect(() => {
    if (!enabled || !envelope || envelope.stale || envelope.demo) return;
    const ts = envelope.data.lastUpdated ?? envelope.updatedAt;
    if (Date.now() - ts > 120000) return;
    const ids = [
      ...new Set(
        rules
          .filter((r) => r.enabled && r.kind !== "auction_new")
          .map((r) => r.productId),
      ),
    ];
    const flips = ids.flatMap((id) => {
      const p = envelope.data.products?.[id];
      return p
        ? [
            calculateMarketFlip(
              id,
              p,
              "order",
              64,
              settings.bazaarFeePct,
              Math.max(0, Date.now() - ts),
            ),
          ]
        : [];
    });
    const events = useMarketAlerts.getState().evaluate({
      id: `${scope}:bz-${ts}`,
      stale: false,
      demo: false,
      flips,
      source: "bazaar",
    });
    send(events);
    // Evaluation state changes must not turn the same snapshot into a new signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    envelope,
    scope,
    settings.bazaarFeePct,
    settings.notificationsEnabled,
    rules,
  ]);
  useEffect(() => {
    const data = auctions.data;
    if (
      !enabled ||
      !data ||
      data.partial ||
      data.analysis_limited ||
      data.meta.stale ||
      data.meta.cache_age_ms > 120000
    )
      return;
    send(
      useMarketAlerts.getState().evaluate({
        id: `${scope}:${data.snapshot_id}`,
        stale: false,
        demo: false,
        auctions: data.items,
        source: "auction",
      }),
    );
  }, [enabled, auctions.data, scope, settings.notificationsEnabled]);
}
