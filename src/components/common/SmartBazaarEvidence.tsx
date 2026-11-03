import { useI18n } from "@/locales";
import { assessBazaar } from "@/features/market/smart-bazaar";
import type { Analytics, Flip, MarketMeta } from "@/features/market/models";
import { formatPrice } from "@/utils/format";
export function SmartBazaarEvidence({
  row,
  meta,
  history,
}: {
  row: Flip;
  meta: MarketMeta;
  history?: Analytics;
}) {
  const { t } = useI18n(),
    e = assessBazaar(row, meta, history);
  const fmt = (n: number | null) =>
    n === null ? t("smart.unknown") : formatPrice(n);
  return (
    <section className="my-4 rounded-xl border border-line p-3 text-xs text-fg-muted">
      <h3 className="font-semibold text-fg">{t("smart.evidence")}</h3>
      <p>
        {t(e.confidence === "limited" ? "smart.limited" : "smart.estimated")}
      </p>
      <p>
        {t("smart.risk")}: {fmt(e.risk)} · {t("market.score")}: {fmt(e.rating)}
      </p>
      <p>
        {t("smart.fees")}: {fmt(e.fees)}
      </p>
      <p>
        {t("smart.stability")}:{" "}
        {e.positiveSpreadFraction === null
          ? t("smart.unknown")
          : `${(e.positiveSpreadFraction * 100).toFixed(1)}%`}
      </p>
      <p>
        {t("smart.deviation")}: {fmt(e.spreadDeviation)}
      </p>
      <p>
        {t("smart.time")}: {t("smart.unknown")}
      </p>
      <ul className="my-2 list-inside list-disc">
        {e.reasons.map((r) => (
          <li key={r}>{t(`smart.reason.${r}`)}</li>
        ))}
      </ul>
      <p>{t("smart.heuristic")}</p>
      <p>{t("smart.timeHint")}</p>
      <p>{t("smart.formula")}</p>
      <p>{t("smart.tax")}</p>
    </section>
  );
}
