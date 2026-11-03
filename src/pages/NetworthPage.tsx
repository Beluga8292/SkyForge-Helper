import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Calculator,
  Landmark,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/locales";
import { useIntelligence } from "@/hooks/useIntelligence";
import { useBazaar } from "@/hooks/useBazaar";
import { useSettingsStore } from "@/stores/settings";
import { appendHistory } from "@/features/intelligence/planning";
import { buildNetworth } from "@/features/networth/engine";
import { PageHeader } from "@/components/common/PageHeader";
import { NetworthBreakdownView } from "@/components/networth/NetworthBreakdown";
import { ErrorState, InfoNote } from "@/components/common/States";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkAccountPrompt } from "@/components/account/LinkAccountPrompt";

export function NetworthPage() {
  const { t, language } = useI18n();
  const h = useIntelligence({ defaultMarket: true });
  const bazaar = useBazaar();
  const hideBalances = useSettingsStore((state) => state.settings.hideBalances);
  const analysis = h.query.data;
  const bazaarPrices = useMemo(() => {
    const prices = new Map<string, number>();
    for (const quote of bazaar.quotes) {
      const price = quote.instantSell > 0 ? quote.instantSell : quote.instantBuy;
      if (price > 0) prices.set(quote.productId.toUpperCase(), price);
    }
    return prices;
  }, [bazaar.quotes]);
  const breakdown = useMemo(
    () => (analysis ? buildNetworth(analysis, { bazaarPrices }) : null),
    [analysis, bazaarPrices],
  );

  return (
    <div className="animate-[fade-up_260ms_ease-out]">
      <PageHeader
        eyebrow={
          <>
            <Landmark className="size-3" /> {t("nav.section.account")}
          </>
        }
        title={t("networth.title")}
        description={t("networth.subtitle")}
        actions={
          <>
            {h.linked ? (
              <>
                <Badge variant={h.market ? "violet" : "outline"}>
                  {h.market ? t("networth.marketOn") : t("networth.marketOff")}
                </Badge>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => h.setMarket(!h.market)}
                >
                  <TrendingUp className="size-3.5" />
                  {h.market ? t("networth.marketOff") : t("networth.market")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={h.query.isFetching}
                  onClick={() => void h.query.refetch()}
                >
                  <RefreshCw
                    className={
                      h.query.isFetching ? "size-3.5 animate-spin" : "size-3.5"
                    }
                  />
                  {t("networth.refresh")}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {!h.linked ? (
        <LinkAccountPrompt redirect="/networth" icon={Landmark} />
      ) : h.query.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : h.query.error ? (
        <section className="panel">
          <ErrorState
            error={h.query.error}
            onRetry={() => void h.query.refetch()}
            title={t("networth.error")}
          />
        </section>
      ) : analysis && breakdown ? (
        <>
          <section className="panel mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h2 className="text-[13px] font-semibold text-fg">
                {h.linked.name}
                {analysis.profile_name ? ` · ${analysis.profile_name}` : ""}
              </h2>
              <p className="mt-0.5 text-[10.5px] text-fg-subtle">
                {t("networth.freshness")}:{" "}
                {new Date(analysis.fetched_at).toLocaleString(language)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-fg-subtle">
              <Badge variant={analysis.coop ? "cyan" : "outline"}>
                {analysis.coop ? t("networth.shared") : t("networth.personal")}
              </Badge>
              <Badge variant="outline">
                {t("networth.assetsCount", {
                  count: breakdown.assets.length,
                })}
              </Badge>
              <Button asChild size="sm" variant="ghost">
                <Link to="/calculators?tab=upgrade">
                  <Calculator className="size-3.5" />
                  {t("calculators.tabs.upgrade")}
                </Link>
              </Button>
            </div>
          </section>

          {h.error ? (
            <InfoNote>
              <span className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" />
                {t("networth.methodNote")}
              </span>
            </InfoNote>
          ) : null}
          {h.market ? (
            <InfoNote>{t("networth.marketSlow")}</InfoNote>
          ) : (
            <InfoNote>{t("networth.noMarket")}</InfoNote>
          )}

          <NetworthBreakdownView
            analysis={analysis}
            breakdown={breakdown}
            hideBalances={hideBalances}
            showHistory
            history={h.history}
            historyDisabled={analysis.demo || analysis.stale || !h.loaded}
            onSaveSnapshot={() => {
              h.setHistory(appendHistory(h.history, analysis));
              toast.success(t("networth.saved"));
            }}
          />
        </>
      ) : null}
    </div>
  );
}
