import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/locales";
import { useSettingsStore } from "@/stores/settings";
import { scenario, levels } from "@/features/market/engine";
import { MarketNumber } from "@/components/common/MarketNumber";
import type { BazaarProduct } from "@/types/hypixel";
import { formatPrice } from "@/utils/format";
export function TradingScenarios({
  product,
}: {
  product: BazaarProduct | undefined;
}) {
  const { t } = useI18n(),
    fee = useSettingsStore((s) => s.settings.bazaarFeePct),
    [buy, setBuy] = useState(0),
    [sell, setSell] = useState(0),
    [quantity, setQuantity] = useState(64),
    [capital, setCapital] = useState(1000000),
    [tax, setTax] = useState(fee),
    [adjust, setAdjust] = useState([
      { buy: 5, sell: -5 },
      { buy: 0, sell: 0 },
      { buy: -5, sell: 5 },
    ]);
  useEffect(() => {
    if (product) {
      setBuy(levels(product.sell_summary, true)[0]?.[0] ?? 0);
      setSell(levels(product.buy_summary, false)[0]?.[0] ?? 0);
    }
  }, [product]);
  const depth = useMemo(
    () =>
      product
        ? Math.min(
            levels(product.sell_summary, true).reduce((s, l) => s + l[1], 0),
            levels(product.buy_summary, false).reduce((s, l) => s + l[1], 0),
          )
        : null,
    [product],
  );
  return (
    <section className="panel p-5">
      <h2 className="mb-2 text-sm font-semibold">{t("market.calculator")}</h2>
      <p className="mb-4 text-xs text-fg-muted">{t("market.assumptions")}</p>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MarketNumber label={t("market.buy")} value={buy} onChange={setBuy} />
        <MarketNumber
          label={t("market.sell")}
          value={sell}
          onChange={setSell}
        />
        <MarketNumber
          integer
          label={t("market.quantity")}
          value={quantity}
          min={1}
          max={1e6}
          onChange={(n) => setQuantity(Math.floor(n))}
        />
        <MarketNumber
          label={t("market.capital")}
          value={capital}
          onChange={setCapital}
        />
        <MarketNumber
          label={`${t("market.fees")} %`}
          value={tax}
          max={10}
          onChange={setTax}
        />
        <div className="self-center text-xs text-fg-subtle">
          {t("market.depth")}: {depth === null ? "—" : formatPrice(depth)}
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {adjust.map((a, i) => {
          const result = scenario(
            buy * (1 + a.buy / 100),
            sell * (1 + a.sell / 100),
            quantity,
            tax,
            capital,
          );
          return (
            <div
              className="rounded-xl border border-line bg-surface-2/30 p-4"
              key={i}
            >
              <h3 className="mb-3 text-xs font-semibold">
                {t(
                  i === 0
                    ? "market.conservative"
                    : i === 1
                      ? "market.base"
                      : "market.optimistic",
                )}
              </h3>
              <div className="space-y-2">
                <MarketNumber
                  label={t("market.buyAdjustment")}
                  value={a.buy}
                  min={-99}
                  max={100}
                  onChange={(v) =>
                    setAdjust(
                      adjust.map((s, j) => (i === j ? { ...s, buy: v } : s)),
                    )
                  }
                />
                <MarketNumber
                  label={t("market.sellAdjustment")}
                  value={a.sell}
                  min={-99}
                  max={100}
                  onChange={(v) =>
                    setAdjust(
                      adjust.map((s, j) => (i === j ? { ...s, sell: v } : s)),
                    )
                  }
                />
              </div>
              {result ? (
                <dl className="mt-4 space-y-2 text-xs">
                  {(
                    [
                      ["market.cost", result.cost],
                      ["market.grossTotal", result.gross],
                      ["market.feesTotal", result.fees],
                      ["market.net", result.net],
                      ["market.roi", result.roi],
                      ["market.breakEven", result.breakEven],
                      ["market.quantity", result.requiredVolume],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-fg-muted">{t(k)}</dt>
                      <dd className="font-mono">
                        {k === "market.roi"
                          ? `${v.toFixed(2)}%`
                          : formatPrice(v)}
                      </dd>
                    </div>
                  ))}
                  {!result.affordable ? (
                    <p className="text-amber">{t("market.overBudget")}</p>
                  ) : null}
                  {depth !== null && quantity > depth ? (
                    <p className="text-amber">{t("market.overDepth")}</p>
                  ) : null}
                </dl>
              ) : (
                <p className="mt-4 text-xs text-fg-subtle">
                  {t("market.insufficient")}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[10px] text-fg-subtle">{t("market.feeNote")}</p>
    </section>
  );
}
