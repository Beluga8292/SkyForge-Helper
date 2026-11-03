import type { InventoryValue } from "@/features/inventory/values";
import { useI18n } from "@/locales";
import { formatCoinsExact } from "@/utils/format";
export function InventoryValueInfo({ value: v }: { value: InventoryValue }) {
  const { t, language } = useI18n(),
    fmt = (x: number | null) =>
      x === null ? t("smart.unknown") : formatCoinsExact(x, language);
  const source =
    v.source === "local_bazaar_topup"
      ? "invValue.topup"
      : v.source.startsWith("bazaar")
        ? "invValue.bazaar"
        : /auction|bin_listing/.test(v.source)
          ? "invValue.auction"
          : "invValue.other";
  const displayState =
    v.total !== null &&
    v.timestamp !== null &&
    Date.now() - v.timestamp > 120000
      ? "stale"
      : v.state;
  return (
    <div className="mt-2 space-y-1 border-t border-line/50 pt-2 text-[10px] text-fg-muted">
      <p className={displayState === "stale" ? "text-amber" : ""}>
        {t(`invValue.${displayState}`)}
      </p>
      <p>
        {t("invValue.stack")}: {fmt(v.total)}
      </p>
      <p>
        {t("invValue.unit")}: {fmt(v.unit)}
      </p>
      <p>
        {t("invValue.source")}: {t(source)}
      </p>
      <p>
        {t("invValue.time")}:{" "}
        {v.timestamp === null
          ? t("smart.unknown")
          : new Date(v.timestamp).toLocaleString(
              language === "ru" ? "ru-RU" : "en-US",
            )}
      </p>
      <p>
        {t("invValue.confidence")}:{" "}
        {["high", "medium", "low", "insufficient"].includes(v.confidence)
          ? t(`market.confidence.${v.confidence}` as "market.confidence.high")
          : t("smart.unknown")}
      </p>
      <p>
        {t("invValue.coverage")}:{" "}
        {v.coverage === null
          ? t("smart.unknown")
          : `${(v.coverage * 100).toFixed(1)}%`}
      </p>
      <p>
        {t(
          v.tradeability === "unknown"
            ? "invValue.tradeUnknown"
            : `invValue.${v.tradeability}`,
        )}
      </p>
      <p>
        {t("invValue.sellable")}: {fmt(v.sellable)}
      </p>
      {v.partial ? <p className="text-amber">{t("invValue.partial")}</p> : null}
      {v.reason === "variant" ? <p>{t("invValue.variant")}</p> : null}
      <p>{t("invValue.note")}</p>
    </div>
  );
}
