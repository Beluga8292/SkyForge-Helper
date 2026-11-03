import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useBazaar } from "@/hooks/useBazaar";
import { useWatchlistStore } from "@/stores/watchlist";
import { useSettingsStore } from "@/stores/settings";
import { useI18n } from "@/locales";
import { formatPrice } from "@/utils/format";
import { recordMarketHistory } from "@/services/history";
import type { MarketHistoryPoint } from "@/types/app";

const LAST_WRITE_KEY = "sbc:history:last-write";
const HISTORY_INTERVAL = 5 * 60 * 1000;

/**
 * Records real Bazaar snapshots for watched items (max once per 5 minutes) and
 * raises in-app alerts when a watched instant-sell price reaches its target.
 * Never writes data in demo mode.
 */
export function useMarketMonitor() {
  const { quotes, envelope, demo } = useBazaar();
  const entries = useWatchlistStore((state) => state.entries);
  const settings = useSettingsStore((state) => state.settings);
  const { t } = useI18n();
  const fired = useRef<Set<string>>(new Set());

  const quoteMap = useMemo(() => new Map(quotes.map((quote) => [quote.productId, quote])), [quotes]);

  useEffect(() => {
    if (demo || envelope?.stale || !envelope || envelope.source !== "network" || !entries.length) return;

    let lastWrite = 0;
    try {
      lastWrite = Number(window.localStorage.getItem(LAST_WRITE_KEY) ?? 0);
    } catch {
      lastWrite = 0;
    }
    if (Date.now() - lastWrite < HISTORY_INTERVAL) return;

    const points: MarketHistoryPoint[] = [];
    for (const entry of entries) {
      const quote = quoteMap.get(entry.productId);
      if (!quote) continue;
      points.push({
        productId: entry.productId,
        ts: envelope.updatedAt,
        buyPrice: quote.instantBuy,
        sellPrice: quote.instantSell,
        buyVolume: quote.buyOrderVolume,
        sellVolume: quote.sellOfferVolume,
      });
    }
    if (!points.length) return;

    void recordMarketHistory(points).then(() => {
      try {
        window.localStorage.setItem(LAST_WRITE_KEY, String(Date.now()));
      } catch {
        // ignore
      }
    });
  }, [demo, envelope, entries, quoteMap]);

  useEffect(() => {
    if (demo || envelope?.stale || !settings.watchlistAlerts) return;
    for (const entry of entries) {
      if (entry.targetPrice == null) continue;
      const quote = quoteMap.get(entry.productId);
      if (!quote) continue;
      if (quote.instantSell > entry.targetPrice) continue;
      const key = `${entry.productId}:${entry.targetPrice}`;
      if (fired.current.has(key)) continue;
      fired.current.add(key);
      if (settings.notificationsEnabled) {
        toast.success(t("watchlist.targetReached"), {
          description: `${quote.name} — ${t("watchlist.priceAlert", { price: formatPrice(quote.instantSell) })}`,
        });
      }
    }
  }, [demo, envelope, entries, quoteMap, settings.watchlistAlerts, settings.notificationsEnabled, t]);
}
