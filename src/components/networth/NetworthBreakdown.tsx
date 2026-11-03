import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Coins,
  Database,
  Info,
  Package,
  ShieldQuestion,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  Line,
  LineChart,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n, type TranslationKey } from "@/locales";
import { DEVELOPER_TOOLS_ENABLED } from "@/version";
import { useSettingsStore } from "@/stores/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/controls";
import { InfoNote } from "@/components/common/States";
import { ItemIcon } from "@/components/common/ItemIcon";
import { ItemDetails } from "@/components/common/ItemDetails";
import { ItemTooltip } from "@/components/common/ItemTooltip";
import { assetToTooltip } from "@/features/items/modifiers";
import { useItemRegistryEntry } from "@/features/items/registry";
import { formatCoins, formatCompact, formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { Analysis } from "@/features/intelligence/models";
import type { HistoryPoint } from "@/features/intelligence/planning";
import {
  networthMethodKey,
  type NetworthAssetRow,
  type NetworthBreakdown,
  type NetworthCategoryId,
} from "@/features/networth/engine";

const PAGE_SIZE = 30;

export function NetworthBreakdownView({
  analysis,
  breakdown,
  hideBalances = false,
  history,
  onSaveSnapshot,
  historyDisabled = false,
  viewOnly = false,
  showHistory = false,
}: {
  analysis: Analysis;
  breakdown: NetworthBreakdown;
  hideBalances?: boolean;
  history?: HistoryPoint[];
  onSaveSnapshot?: () => void;
  historyDisabled?: boolean;
  viewOnly?: boolean;
  showHistory?: boolean;
}) {
  const { t, language } = useI18n();
  const developerMode = useSettingsStore(
    (state) => DEVELOPER_TOOLS_ENABLED && state.settings.developerMode,
  );
  const [page, setPage] = useState(0);
  const [category, setCategory] = useState<NetworthCategoryId | "all">("all");
  const [selected, setSelected] = useState<NetworthAssetRow | null>(null);
  const selectedRegistry = useItemRegistryEntry(selected?.itemId ?? null);
  const selectedName =
    selected && selected.name && selected.name !== selected.itemId
      ? selected.name
      : (selectedRegistry?.name ?? selected?.name ?? "");

  const coins = (value: number | null | undefined) =>
    hideBalances ? "••••" : formatCoins(value, language);
  const percent = (value: number | null) =>
    value === null ? "—" : `${(value * 100).toFixed(1)}%`;

  const filteredAssets = useMemo(
    () =>
      category === "all"
        ? breakdown.assets
        : breakdown.assets.filter((asset) => asset.category === category),
    [breakdown.assets, category],
  );
  const pages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const visible = filteredAssets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const categoryLabel = (id: NetworthCategoryId) =>
    t(`networth.category.${id}` as TranslationKey);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={Coins}
          tone="violet"
          label={t("networth.knownTotal")}
          value={coins(breakdown.knownTotal)}
          hint={t("networth.partial")}
        />
        <StatTile
          icon={Sparkles}
          tone="amber"
          label={t("networth.estimatedAdditional")}
          value={coins(breakdown.estimatedValue)}
          hint={t("networth.estimatedAdditionalHint")}
        />
        <StatTile
          icon={ShieldQuestion}
          tone={breakdown.unknownCount || breakdown.invalidCount ? "amber" : "green"}
          label={t("networth.unknownAssets")}
          value={formatNumber(breakdown.unknownCount + breakdown.invalidCount)}
          hint={`${t("networth.unknownTradeable")}: ${formatNumber(
            breakdown.unknownTradeable,
          )}`}
        />
        <StatTile
          icon={BarChart3}
          tone={breakdown.coverage === 1 ? "green" : "amber"}
          label={t("networth.coverage")}
          value={percent(breakdown.coverage)}
          hint={`${t("networth.coverageWithEstimates")}: ${percent(
            breakdown.coverageWithEstimates,
          )}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <MiniTile
          label={t("networth.liquid")}
          value={coins(breakdown.liquid)}
        />
        <MiniTile
          label={t("networth.coopBank")}
          value={coins(breakdown.coopBank)}
        />
        <MiniTile
          label={t("networth.priced")}
          value={formatNumber(breakdown.pricedCount)}
        />
        <MiniTile
          label={t("networth.unknownTradeable")}
          value={formatNumber(breakdown.unknownTradeable)}
          tone={breakdown.unknownTradeable ? "amber" : "green"}
        />
        <MiniTile
          label={t("networth.unknownSoulbound")}
          value={formatNumber(breakdown.unknownSoulbound)}
          tone={breakdown.unknownSoulbound ? "amber" : "green"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9.5px] uppercase tracking-[0.08em] text-fg-subtle">
          {t("networth.pricingSources")}
        </span>
        <Badge variant="outline">
          {t("networth.bazaarPriced", { count: breakdown.bazaarPricedCount })}
        </Badge>
        <Badge variant="outline">
          {t("networth.auctionPriced", { count: breakdown.auctionPricedCount })}
        </Badge>
        <Badge variant={breakdown.estimatedCount ? "amber" : "outline"}>
          {t("networth.localTopUp", { count: breakdown.estimatedCount })}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={breakdown.complete ? "green" : "amber"}>
          {breakdown.complete
            ? t("networth.complete")
            : t("networth.partial")}
        </Badge>
        <Badge variant={breakdown.demo ? "amber" : breakdown.stale ? "outline" : "green"}>
          {breakdown.demo
            ? t("networth.demo")
            : breakdown.stale
              ? t("networth.stale")
              : t("networth.fresh")}
        </Badge>
        <Badge variant="outline">
          {t("networth.freshness")}:{" "}
          {new Date(breakdown.fetchedAt).toLocaleString(language)}
        </Badge>
        {breakdown.duplicates ? (
          <Badge variant="outline">
            UUID ×{breakdown.duplicates}
          </Badge>
        ) : null}
      </div>

      {(breakdown.unknownCount > 0 || breakdown.invalidCount > 0) ? (
        <InfoNote>
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" />
            <span>
              {t("networth.warnUnpriced")}
              {breakdown.invalidCount > 0
                ? ` · ${t("networth.warnInvalid", {
                    count: breakdown.invalidCount,
                  })}`
                : ""}
            </span>
          </span>
        </InfoNote>
      ) : null}
      {breakdown.partialInventory ? (
        <InfoNote>
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" />
            <span>
              {t("networth.warnPartialInventory")}
              {breakdown.unavailableContainers.length ? (
                <span className="text-fg-subtle">
                  {" "}
                  ({breakdown.unavailableContainers.length})
                </span>
              ) : null}
            </span>
          </span>
        </InfoNote>
      ) : null}
      {!breakdown.complete && !breakdown.partialInventory ? (
        <InfoNote>
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" />
            <span>{t("networth.partialNote")}</span>
          </span>
        </InfoNote>
      ) : null}
      <InfoNote>{t("networth.methodNote")}</InfoNote>
      <InfoNote>{t("networth.dedupNote")}</InfoNote>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-fg">
            <Database className="size-4 text-violet" />
            {t("networth.categoryBreakdown")}
          </h2>
          <span className="text-[10.5px] text-fg-subtle">
            {t("networth.assetsCount", { count: breakdown.assets.length })}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10.5px]">
            <thead className="bg-surface-2/40 text-fg-subtle">
              <tr>
                <th className="p-2.5">{t("networth.category")}</th>
                <th className="p-2.5 text-right">{t("networth.entries")}</th>
                <th className="p-2.5 text-right">{t("networth.priced")}</th>
                <th className="p-2.5 text-right">{t("networth.unknown")}</th>
                <th className="p-2.5 text-right">{t("networth.untradeable")}</th>
                <th className="p-2.5 text-right">{t("networth.value")}</th>
                <th className="p-2.5 text-right">
                  {t("networth.estimatedAdditional")}
                </th>
                <th className="p-2.5 text-right">{t("networth.share")}</th>
                <th className="p-2.5">{t("networth.coverage")}</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.categories.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-t border-line",
                    row.id === "coopBank" && "bg-surface-2/20",
                  )}
                >
                  <td className="p-2.5 text-fg">
                    {categoryLabel(row.id)}
                    {row.id === "coopBank" ? (
                      <span className="ml-1.5 text-[9px] text-fg-subtle">
                        ({t("networth.shared")})
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2.5 text-right font-mono text-fg-muted">
                    {formatNumber(row.entries)}
                  </td>
                  <td className="p-2.5 text-right font-mono text-fg-muted">
                    {formatNumber(row.priced)}
                  </td>
                  <td className="p-2.5 text-right font-mono text-amber">
                    {formatNumber(row.unknown)}
                  </td>
                  <td className="p-2.5 text-right font-mono text-fg-subtle">
                    {formatNumber(row.untradeable)}
                  </td>
                  <td className="p-2.5 text-right font-mono text-fg">
                    {coins(row.value)}
                  </td>
                  <td className="p-2.5 text-right font-mono text-amber/80">
                    {row.estimatedValue > 0
                      ? `≈ ${coins(row.estimatedValue)}`
                      : "—"}
                  </td>
                  <td className="p-2.5 text-right font-mono text-fg-subtle">
                    {row.id === "coopBank" ? "—" : percent(row.share)}
                  </td>
                  <td className="w-28 p-2.5">
                    {row.coverage === null ? (
                      <span className="text-fg-subtle">—</span>
                    ) : (
                      <Progress
                        value={row.coverage * 100}
                        className="h-1.5"
                        indicatorClassName={
                          row.coverage === 1 ? "bg-green" : "bg-amber"
                        }
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-fg">
            <Package className="size-4 text-violet" />
            {t("networth.assets")}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCategory("all");
                setPage(0);
              }}
              className={cn(
                "rounded-md border px-2 py-1 text-[9.5px] transition-colors",
                category === "all"
                  ? "border-violet/35 bg-violet-soft text-violet"
                  : "border-line text-fg-muted hover:border-line-strong",
              )}
            >
              {t("common.all")}
            </button>
            {breakdown.categories
              .filter((row) => row.entries && !["liquid", "coopBank"].includes(row.id))
              .map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    setCategory(row.id);
                    setPage(0);
                  }}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[9.5px] transition-colors",
                    category === row.id
                      ? "border-violet/35 bg-violet-soft text-violet"
                      : "border-line text-fg-muted hover:border-line-strong",
                  )}
                >
                  {categoryLabel(row.id)}
                </button>
              ))}
          </div>
        </div>

        {visible.length ? (
          <>
            <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((asset) => (
                <NetworthAssetButton
                  key={asset.key}
                  asset={asset}
                  onSelect={() => setSelected(asset)}
                  coins={coins}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
              <span className="text-[10px] text-fg-subtle">
                {t("common.page")} {page + 1} / {pages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page === 0}
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                >
                  {t("common.prev")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page + 1 >= pages}
                  onClick={() =>
                    setPage((value) => Math.min(pages - 1, value + 1))
                  }
                >
                  {t("common.next")}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
            <ShieldQuestion className="size-6 text-fg-subtle" />
            <p className="text-[12px] font-medium text-fg">
              {t("networth.noAssets")}
            </p>
            <p className="text-[10px] text-fg-subtle">
              {t("networth.methodNote")}
            </p>
          </div>
        )}
      </section>

      {showHistory ? (
        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-fg">
              <BarChart3 className="size-4 text-violet" />
              {t("networth.history")}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-fg-subtle">
                {t("networth.snapshotCoverage")}
              </span>
              <Button
                size="sm"
                disabled={historyDisabled || !onSaveSnapshot}
                onClick={onSaveSnapshot}
              >
                {t("networth.saveSnapshot")}
              </Button>
            </div>
          </div>
          <p className="mt-1 text-[10.5px] leading-relaxed text-fg-subtle">
            {t("networth.historyNote")}
          </p>
          {viewOnly ? (
            <p className="mt-2 rounded-lg border border-amber/20 bg-amber/[0.04] px-3 py-2 text-[10px] text-amber/90">
              {t("networth.viewOnlyNote")}
            </p>
          ) : null}

          {history && history.length && !hideBalances ? (
            <>
              <div className="mt-4 h-56">
                <ResponsiveContainer>
                  <LineChart data={history}>
                    <XAxis
                      dataKey="at"
                      tickFormatter={(value) =>
                        new Date(Number(value)).toLocaleDateString(language)
                      }
                    />
                    <YAxis tickFormatter={(value) => formatCompact(Number(value))} />
                    <ChartTooltip
                      labelFormatter={(value) =>
                        new Date(Number(value)).toLocaleString(language)
                      }
                      formatter={(value) => formatCoins(Number(value), language)}
                    />
                    <Line
                      dataKey="total"
                      stroke="var(--violet)"
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1">
                {history.slice(-8).map((snapshot) => (
                  <div
                    key={snapshot.at}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-bg-elevated/40 px-2.5 py-1.5 text-[9.5px] text-fg-muted"
                  >
                    <span>
                      {new Date(snapshot.at).toLocaleString(language)}
                    </span>
                    <span className="font-mono">{coins(snapshot.total)}</span>
                    <span>
                      {t("networth.coverage")}: {percent(snapshot.coverage)}
                    </span>
                    <span>
                      {t("networth.unknown")}: {snapshot.unknown}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[9.5px] text-fg-subtle">
                {t("networth.chartNote")} {t("networth.notEarnings")}
              </p>
            </>
          ) : (
            <p className="mt-3 text-[11px] text-fg-muted">
              {hideBalances
                ? t("networth.hideBalances")
                : t("networth.noHistory")}
            </p>
          )}
        </section>
      ) : null}

      {!showHistory ? (
        <InfoNote>{t("networth.notEarnings")}</InfoNote>
      ) : null}

      <div className="flex items-start gap-2 rounded-xl border border-line bg-surface/40 px-4 py-3 text-[10px] leading-relaxed text-fg-subtle">
        <Info className="mt-0.5 size-3.5 shrink-0 text-violet" />
        <span>
          {t("networth.methodNote")} {t("networth.coverageNote")}
        </span>
      </div>

      <ItemDetails
        item={
          selected
            ? {
                ...assetToTooltip(selected),
                name: selectedName,
                rarity: selected.rarity ?? selectedRegistry?.tier ?? null,
              }
            : null
        }
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />

      <details className="rounded-xl border border-line bg-surface/40 px-4 py-3 text-[10px] text-fg-subtle">
        <summary className="cursor-pointer text-[10.5px] font-medium text-fg-muted">
          {t("networth.methods")}
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline">{t("networth.bazaar")}</Badge>
          <Badge variant="outline">{t("networth.auction")}</Badge>
          <Badge variant="outline">{t("networth.fixed")}</Badge>
          <Badge variant="outline">{t("networth.manual")}</Badge>
        </div>
        <p className="mt-2">
          {t("networth.methodNote")}
          {developerMode ? (
            <span className="mt-1 block font-mono text-[9px] text-fg-subtle">
              {analysis.warnings.join(" · ") || "—"}
              {breakdown.unavailableContainers.length
                ? ` · missing: ${breakdown.unavailableContainers.join(", ")}`
                : ""}
            </span>
          ) : null}
        </p>
      </details>
    </div>
  );
}

function NetworthAssetButton({
  asset,
  onSelect,
  coins,
}: {
  asset: NetworthAssetRow;
  onSelect: () => void;
  coins: (value: number | null | undefined) => string;
}) {
  const { t } = useI18n();
  const registry = useItemRegistryEntry(asset.itemId);
  const tooltip = assetToTooltip(asset);
  const displayName =
    asset.name && asset.name !== asset.itemId
      ? asset.name
      : (registry?.name ?? asset.name);
  const rarity = asset.rarity ?? registry?.tier ?? null;

  return (
    <ItemTooltip item={{ ...tooltip, name: displayName, rarity }}>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2/30 p-2.5 text-left transition-colors hover:border-violet/35 hover:bg-surface-2/50 focus-visible:outline-2 focus-visible:outline-violet"
      >
        <ItemIcon
          itemId={asset.itemId}
          material={asset.material}
          name={displayName}
          rarity={rarity}
          count={asset.count}
          size="sm"
          skullTexture={asset.skullTexture}
          gemstones={tooltip.gemstoneSlots?.length}
          enchanted={Boolean(Object.keys(tooltip.enchantments ?? {}).length)}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-medium text-fg">
            {displayName}
          </span>
          <span className="block truncate text-[9px] text-fg-subtle">
            {asset.location} ·{" "}
            {t(networthMethodKey(asset.method) as TranslationKey)}
            {asset.soulbound ? ` · ${t("networth.soulbound")}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span
            className={cn(
              "block font-mono text-[10.5px]",
              asset.value === null && asset.estimatedValue !== null
                ? "text-amber/80"
                : "text-fg-muted",
            )}
          >
            {asset.value !== null
              ? coins(asset.value)
              : asset.estimatedValue !== null
                ? `≈ ${coins(asset.estimatedValue)}`
                : "—"}
          </span>
          <span className="block text-[8.5px] text-fg-subtle">
            {asset.value === null && asset.estimatedValue !== null
              ? t("tooltip.estimated")
              : `×${asset.count}`}
          </span>
        </span>
      </button>
    </ItemTooltip>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  hint?: string;
  tone: "violet" | "amber" | "cyan" | "green";
}) {
  const tones = {
    violet: "border-violet/25 bg-violet-soft text-violet",
    amber: "border-amber/20 bg-amber/10 text-amber",
    cyan: "border-cyan/20 bg-cyan/10 text-cyan",
    green: "border-green/20 bg-green/10 text-green",
  } as const;
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] uppercase tracking-[0.08em] text-fg-subtle">
          {label}
        </p>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg border",
            tones[tone],
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-2 truncate font-mono text-[19px] font-semibold tracking-[-0.02em] text-fg">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </section>
  );
}

function MiniTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "amber" | "green";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/30 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.08em] text-fg-subtle">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono text-[13px] font-semibold",
          tone === "amber" ? "text-amber" : tone === "green" ? "text-green" : "text-fg",
        )}
      >
        {value}
      </p>
    </div>
  );
}
