import { useDataProvider } from "@/data";
import { useMarketAlerts } from "@/stores/market-alerts";
import { Link } from "react-router-dom";
import { BarChart3, ArrowUpRight } from "lucide-react";
import { useMarketOverview } from "@/hooks/useMarketIntelligence";
import { useI18n } from "@/locales";
import type { MarketMeta } from "@/features/market/models";
import { formatPrice } from "@/utils/format";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/common/States";
import { Skeleton } from "@/components/ui/skeleton";
export function MarketFreshness({ meta }: { meta: MarketMeta | undefined }) {
  const { t, language } = useI18n();
  if (!meta) return null;
  const age = Math.max(meta.cache_age_ms, Date.now() - meta.fetched_at_ms);
  return (
    <div className="my-3 flex flex-wrap items-center gap-2 text-[11px] text-fg-muted">
      <Badge
        variant={
          meta.source === "demo"
            ? "amber"
            : meta.stale || age > 120000
              ? "amber"
              : "green"
        }
      >
        {meta.source === "demo"
          ? t("common.demo")
          : t(meta.stale || age > 120000 ? "market.stale" : "market.fresh")}
      </Badge>
      <span>
        {t("market.updated", {
          time: new Date(meta.fetched_at_ms).toLocaleString(language),
          age: Math.floor(age / 1000),
        })}
      </span>
    </div>
  );
}
export function MarketOverviewPanel() {
  const provider = useDataProvider();
  const { t } = useI18n(),
    q = useMarketOverview(),
    events = useMarketAlerts((s) => s.events);
  return (
    <section className="panel my-5 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="size-4 text-violet" />
          {t("market.overview")}
        </h2>
        <Link className="flex items-center text-xs text-violet" to="/flips?view=bazaar">
          {t("market.openScanner")}
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      {q.isPending ? (
        <Skeleton className="h-32" />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} compact />
      ) : (
        <>
          <MarketFreshness meta={q.data?.meta} />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs text-fg-muted">
                {t("market.topBazaar")}
              </h3>
              {q.data?.bazaar.items.length ? (
                q.data.bazaar.items.map((r) => (
                  <Link
                    className="flex justify-between gap-2 border-b border-line py-2 text-xs"
                    key={r.product_id}
                    to={`/flips?item=${encodeURIComponent(r.product_id)}&view=bazaar`}
                  >
                    <span>{r.name}</span>
                    <span className="font-mono text-green">
                      {formatPrice(r.net_profit)} ·{" "}
                      {r.scores.overall.toFixed(0)}/100
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-xs text-fg-subtle">{t("market.empty")}</p>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-xs text-fg-muted">
                {t("market.largestChanges")}
              </h3>
              {q.data?.largest_changes.length ? (
                q.data.largest_changes.map((r) => (
                  <Link
                    to={`/flips?view=bazaar&item=${encodeURIComponent(r.product_id)}`}
                    className="flex justify-between py-2 text-xs"
                    key={r.product_id}
                  >
                    <span>{r.product_id}</span>
                    <span>{r.change_pct.toFixed(2)}%</span>
                  </Link>
                ))
              ) : (
                <p className="text-xs text-fg-subtle">
                  {t("market.noHistory")}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4">
            {q.data?.signals.map((signal) => (
              <Link
                key={`${signal.product_id}:${signal.kind}`}
                to={`/flips?view=bazaar&item=${encodeURIComponent(signal.product_id)}`}
                className="block py-1 text-xs text-amber"
              >
                {signal.product_id} ·{" "}
                {t(
                  `market.signal.${signal.kind}` as import("@/locales").TranslationKey,
                )}{" "}
                · {signal.value.toFixed(2)}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-[10px] text-fg-subtle">
            {t("market.heuristic")}
          </p>
        </>
      )}
      <div className="mt-4 border-t border-line pt-3">
        <Link to="/flips?view=alerts" className="text-xs text-violet">
          {t("market.alerts")}
        </Link>
        {(provider.isDemo ? [] : events).slice(0, 3).map((event) => (
          <p key={event.id} className="mt-1 text-[11px] text-fg-muted">
            {event.productId} · {t(`market.rule.${event.kind}`)} ·{" "}
            {new Date(event.ts).toLocaleString()}
          </p>
        ))}
      </div>
    </section>
  );
}
