import {
  SmartAuctionDetails,
  SmartAuctionSummary,
} from "@/components/common/SmartAuctionDetails";
import {
  assessAuction,
  selectAuctionPage,
} from "@/features/market/smart-auction";
import { SmartBazaarEvidence } from "@/components/common/SmartBazaarEvidence";
import {
  assessBazaar,
  selectBazaarPage,
  type SmartPageFilter,
} from "@/features/market/smart-bazaar";
import { DEVELOPER_TOOLS_ENABLED } from "@/version";
import { useQueryClient } from "@tanstack/react-query";
import { MarketNumber } from "@/components/common/MarketNumber";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  RefreshCw,
  Search,
  Star,
  ArrowDownUp,
  Bookmark,
  Bell,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useI18n, type TranslationKey } from "@/locales";
import {
  useMarketFilters,
  useFlipScanner,
  useAuctionScanner,
  useItemAnalytics,
} from "@/hooks/useMarketIntelligence";
import { useDataScope, useDataProvider } from "@/data";
import { useWatchlistStore } from "@/stores/watchlist";
import { useSettingsStore } from "@/stores/settings";
import { useMarketAlerts } from "@/stores/market-alerts";
import type {
  Flip,
  FlipParams,
  AuctionParams,
  HistoryRange,
  Valuation,
} from "@/features/market/models";
import { DEFAULT_AUCTION_FILTERS } from "@/features/market/models";
import {
  readMarketSetting,
  writeMarketSetting,
} from "@/features/market/storage";
import { PageHeader } from "@/components/common/PageHeader";
import {
  MarketOverviewPanel,
  MarketFreshness,
} from "@/components/common/MarketWidgets";
import { SmartAlertsPanel } from "@/components/common/SmartAlertsPanel";
import { ItemGlyph } from "@/components/common/ItemVisuals";
import { ErrorState, EmptyState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@/components/ui/dialog";
import { formatPrice } from "@/utils/format";
import { newRule } from "@/features/market/alerts";

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : formatPrice(v);
const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${v.toFixed(2)}%`;

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-fg-muted">{label}</span>
      <select
        aria-label={label}
        className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-xs text-fg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/30 p-3">
      <div className="mb-1 text-[10px] text-fg-subtle">{label}</div>
      <div className="break-words font-mono text-sm">{children}</div>
    </div>
  );
}
function Pager({
  page,
  total,
  size,
  onChange,
}: {
  page: number;
  total: number;
  size: number;
  onChange: (p: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="my-4 flex items-center justify-between gap-2 text-xs text-fg-muted">
      <span>
        {t("market.results", { count: total })} ·{" "}
        {t("market.page", { page: page + 1 })}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          {t("market.previous")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={(page + 1) * size >= total}
          onClick={() => onChange(page + 1)}
        >
          {t("market.next")}
        </Button>
      </div>
    </div>
  );
}
export function MarketPage() {
  const { t } = useI18n(),
    [params, setParams] = useSearchParams(),
    view = params.get("view") ?? "overview",
    { filters, setFilters, auctions, setAuctions, loaded, error } =
      useMarketFilters(),
    [selected, setSelected] = useState<Flip | null>(null),
    [auction, setAuction] = useState<Valuation | null>(null),
    [range, setRange] = useState<HistoryRange>("24h"),
    scope = useDataScope(),
    provider = useDataProvider(),
    [recent, setRecent] = useState<string[]>([]),
    [saved, setSaved] = useState<string[]>([]),
    watch = useWatchlistStore(),
    fee = useSettingsStore((s) => s.settings.bazaarFeePct);
  const flips = useFlipScanner(filters, loaded && view === "bazaar"),
    bins = useAuctionScanner(auctions, loaded && view === "auctions"),
    analytics = useItemAnalytics(
      selected?.product_id ?? null,
      range,
      selected?.quantity ?? 64,
      selected?.mode ?? "order",
    );
  const detail = analytics.data?.flip ?? selected;
  const [auctionContext, setAuctionContext] = useState<{
    meta: import("@/features/market/models").MarketMeta;
    partial: boolean;
  } | null>(null);
  const [auctionSmartSort, setAuctionSmartSort] = useState<
    "provider" | "profit" | "roi" | "risk"
  >("provider");
  const visibleAuctions = useMemo(
    () =>
      bins.data
        ? selectAuctionPage(
            bins.data.items,
            bins.data.meta,
            auctions,
            auctions,
            bins.data.partial || bins.data.analysis_limited,
            auctionSmartSort,
          )
        : [],
    [bins.data, auctions, auctionSmartSort],
  );

  const [quality, setQuality] = useState<SmartPageFilter>({
    maxRisk: null,
    maxAgeSeconds: null,
    sort: "provider",
  });
  const visibleFlips = useMemo(
    () =>
      flips.data
        ? selectBazaarPage(flips.data.items, flips.data.meta, quality)
        : [],
    [flips.data, quality],
  );

  useEffect(() => {
    let active = true;
    setSelected(null);
    setAuction(null);
    void readMarketSetting(`activity:${scope}`)
      .then((raw) => {
        if (!active) return;
        const r = raw as { recent?: unknown; saved?: unknown } | null;
        setRecent(
          Array.isArray(r?.recent)
            ? r.recent
                .filter((v): v is string => typeof v === "string")
                .slice(0, 12)
            : [],
        );
        setSaved(
          Array.isArray(r?.saved)
            ? r.saved
                .filter((v): v is string => typeof v === "string")
                .slice(0, 100)
            : [],
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [scope]);
  useEffect(() => {
    const id = params.get("item");
    if (!id || !flips.data) return;
    const row = flips.data.items.find((r) => r.product_id === id);
    if (row) setSelected(row);
  }, [params, flips.data]);
  const select = (row: Flip) => {
    setSelected(row);
    const next = [
      row.product_id,
      ...recent.filter((id) => id !== row.product_id),
    ].slice(0, 12);
    setRecent(next);
    void writeMarketSetting(`activity:${scope}`, { recent: next, saved }).catch(
      () => {},
    );
  };
  const saveAuction = (id: string) => {
    const next = saved.includes(id)
      ? saved.filter((v) => v !== id)
      : [id, ...saved].slice(0, 100);
    setSaved(next);
    void writeMarketSetting(`activity:${scope}`, { recent, saved: next }).catch(
      () => {},
    );
  };
  const changeFlip = (patch: Partial<FlipParams>) =>
    setFilters({ ...filters, ...patch, page: patch.page ?? 0 });
  const changeAuction = (patch: Partial<AuctionParams>) =>
    setAuctions({ ...auctions, ...patch, page: patch.page ?? 0 });
  const queryClient = useQueryClient();
  const refresh = () => {
    if (view === "auctions") void bins.refetch();
    else if (view === "bazaar") void flips.refetch();
    else
      void queryClient.invalidateQueries({
        predicate: (query) =>
          ["market-overview", "market-auctions", "bazaar"].includes(
            String(query.queryKey[0]),
          ),
      });
  };
  const setView = (v: string) => {
    const next = new URLSearchParams(params);
    next.set("view", v);
    next.delete("item");
    next.delete("lot");
    setParams(next);
  };
  useEffect(() => {
    const id = params.get("item");
    if (id && view === "bazaar" && loaded && filters.search !== id)
      changeFlip({ search: id });
  }, [params, view, loaded]);
  useEffect(() => {
    const id = params.get("lot");
    if (id && view === "auctions" && loaded && auctions.search !== id)
      changeAuction({
        search: id,
        min_confidence: "insufficient",
        min_discount: -100,
      });
  }, [params, view, loaded]);
  useEffect(() => {
    const id = params.get("lot");
    const row = bins.data?.items.find((r) => r.auction_id === id);
    if (row) setAuction(row);
  }, [params, bins.data]);
  const close = () => {
    setSelected(null);
    const next = new URLSearchParams(params);
    next.delete("item");
    setParams(next, { replace: true });
  };
  return (
    <div className="animate-[fade-up_260ms_ease-out]">
      <PageHeader
        eyebrow={
          <>
            <BarChart3 className="size-3" />
            Market Intelligence
          </>
        }
        title={t("market.title")}
        description={t("market.subtitle")}
        actions={
          <>
            {DEVELOPER_TOOLS_ENABLED && (
              <Badge variant={provider.isDemo ? "amber" : "outline"}>
                {provider.id.toUpperCase()}
              </Badge>
            )}
            <Button
              variant="secondary"
              onClick={refresh}
              disabled={flips.isFetching || bins.isFetching}
            >
              <RefreshCw className="size-3.5" />
              {t("common.refresh")}
            </Button>
          </>
        }
      />
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="tablist"
        aria-label={t("market.title")}
      >
        {(["overview", "bazaar", "auctions", "alerts"] as const).map((tab) => (
          <Button
            key={tab}
            role="tab"
            aria-selected={view === tab}
            variant={view === tab ? "default" : "secondary"}
            onClick={() => setView(tab)}
          >
            {t(`market.${tab}`)}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red">
          {t("market.storageError")}
        </p>
      ) : null}
      {view === "overview" ? (
        <>
          <MarketOverviewPanel />
          <AuctionPreview
            onSelect={(r, meta, partial) => {
              setAuctionContext({ meta, partial });
              setAuction(r);
            }}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <section className="panel p-4">
              <h2 className="mb-2 text-sm font-semibold">
                {t("market.recent")}
              </h2>
              {recent.map((id) => (
                <Link
                  key={id}
                  className="block py-1 text-xs text-violet"
                  to={`/flips?view=bazaar&item=${encodeURIComponent(id)}`}
                  onClick={() => changeFlip({ search: id })}
                >
                  {id}
                </Link>
              ))}
            </section>
            <section className="panel p-4">
              <h2 className="mb-2 text-sm font-semibold">
                {t("market.saved")}
              </h2>
              {saved.map((id) => (
                <div
                  key={id}
                  className="flex items-center justify-between py-1 text-xs"
                >
                  <Link
                    className="font-mono text-violet"
                    to={`/flips?view=auctions&lot=${encodeURIComponent(id)}`}
                  >
                    {id}
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => saveAuction(id)}
                  >
                    {t("market.delete")}
                  </Button>
                </div>
              ))}
            </section>
          </div>
        </>
      ) : null}
      {view === "bazaar" ? (
        <>
          <section className="panel p-4">
            <p className="mb-3 text-[11px] leading-relaxed text-fg-muted">
              {t("market.modeHelp")}
            </p>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <Label>{t("market.search")}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 size-3 text-fg-subtle" />
                  <Input
                    className="pl-8"
                    aria-label={t("market.search")}
                    value={filters.search}
                    maxLength={100}
                    onChange={(e) => changeFlip({ search: e.target.value })}
                  />
                </div>
              </div>
              <SelectField
                label={t("market.bazaar")}
                value={filters.mode}
                onChange={(v) => changeFlip({ mode: v as FlipParams["mode"] })}
                options={[
                  ["order", t("market.order")],
                  ["instant", t("market.instant")],
                ]}
              />
              <MarketNumber
                integer
                label={t("market.quantity")}
                value={filters.quantity}
                min={1}
                max={1e6}
                onChange={(v) => changeFlip({ quantity: Math.round(v) })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  ["min_profit", "market.minProfit", -1e15, 1e15],
                  ["min_roi", "market.minRoi", -100, 1e9],
                  ["max_cost", "market.maxCost", 0, 1e15],
                  ["min_liquidity", "market.minLiquidity", 0, 100],
                  ["max_spread", "market.maxSpread", 0, 1e9],
                  ["min_activity", "market.minActivity", 0, 1e18],
                ] as const
              ).map(([key, label, min, max]) => (
                <MarketNumber
                  key={key}
                  label={t(label)}
                  value={filters[key]}
                  min={min}
                  max={max}
                  onChange={(v) => changeFlip({ [key]: v })}
                />
              ))}
              <SelectField
                label={t("market.sort")}
                value={filters.sort}
                onChange={(v) => changeFlip({ sort: v as FlipParams["sort"] })}
                options={[
                  ["score", t("market.score")],
                  ["profit", t("market.net")],
                  ["roi", t("market.roi")],
                  ["cost", t("market.cost")],
                  ["liquidity", t("market.liquidity")],
                ]}
              />
              <Button
                className="self-end"
                variant="secondary"
                onClick={() => changeFlip({ descending: !filters.descending })}
              >
                <ArrowDownUp className="size-3.5" />
                {t("market.direction")} {filters.descending ? "↓" : "↑"}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-fg-muted">
              {(["exclude_loss", "exclude_illiquid"] as const).map((k, i) => (
                <label className="flex items-center gap-2" key={k}>
                  <input
                    type="checkbox"
                    checked={filters[k]}
                    onChange={(e) => changeFlip({ [k]: e.target.checked })}
                  />
                  {t(i ? "market.excludeIlliquid" : "market.excludeLoss")}
                </label>
              ))}
              <span>
                {t("market.fees")}: {fee}%
              </span>
            </div>
          </section>
          <section className="panel my-3 p-4">
            <h2 className="text-sm font-semibold">{t("smart.title")}</h2>
            <p className="my-2 text-xs text-fg-muted">{t("smart.heuristic")}</p>
            <p className="my-2 text-xs text-fg-subtle">
              {t("smart.pageScope")}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField
                label={t("smart.maxRisk")}
                value={quality.maxRisk === null ? "" : String(quality.maxRisk)}
                onChange={(v) =>
                  setQuality((q) => ({
                    ...q,
                    maxRisk: v === "" ? null : Number(v),
                  }))
                }
                options={[
                  ["", t("smart.all")],
                  ["25", "25"],
                  ["50", "50"],
                  ["75", "75"],
                  ["100", "100"],
                ]}
              />
              <SelectField
                label={t("smart.maxAge")}
                value={
                  quality.maxAgeSeconds === null
                    ? ""
                    : String(quality.maxAgeSeconds)
                }
                onChange={(v) =>
                  setQuality((q) => ({
                    ...q,
                    maxAgeSeconds: v === "" ? null : Number(v),
                  }))
                }
                options={[
                  ["", t("smart.all")],
                  ["30", "30 s"],
                  ["120", "120 s"],
                ]}
              />
              <SelectField
                label={t("smart.sort")}
                value={quality.sort}
                onChange={(v) =>
                  setQuality((q) => ({
                    ...q,
                    sort: v as SmartPageFilter["sort"],
                  }))
                }
                options={[
                  ["provider", t("smart.provider")],
                  ["risk", t("smart.risk")],
                  ["freshness", t("smart.freshness")],
                ]}
              />
            </div>
            {flips.data ? (
              <p className="mt-2 text-xs">
                {t("smart.rows", {
                  shown: visibleFlips.length,
                  total: flips.data.items.length,
                })}
              </p>
            ) : null}
          </section>
          <MarketFreshness meta={flips.data?.meta} />
          {flips.error && flips.data ? (
            <p role="alert" className="my-2 text-xs text-amber">
              {t("auctionSmart.cachedError")}
            </p>
          ) : null}
          {flips.isFetching ? (
            <p className="my-2 text-xs text-fg-subtle" role="status">
              {t("market.loading")}
            </p>
          ) : null}
          {flips.error && !flips.data ? (
            <section className="panel">
              <ErrorState
                error={flips.error}
                onRetry={() => void flips.refetch()}
              />
            </section>
          ) : flips.isPending ? (
            <Skeleton className="mt-4 h-80" />
          ) : !visibleFlips.length ? (
            <EmptyState
              icon={Search}
              title={t("market.empty")}
              description={t("market.emptyHint")}
            />
          ) : (
            <section className="panel mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line text-[10px] uppercase text-fg-subtle">
                  <tr>
                    {[
                      "item",
                      "buy",
                      "sell",
                      "net",
                      "roi",
                      "liquidity",
                      "score",
                    ].map((k) => (
                      <th key={k} className="px-3 py-3">
                        {t(`market.${k}` as TranslationKey)}
                      </th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleFlips.map((r) => (
                    <tr
                      key={r.product_id}
                      className="border-b border-line hover:bg-surface-2/50"
                    >
                      <td className="max-w-56 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <ItemGlyph
                            name={r.name}
                            size="sm"
                            itemId={r.product_id}
                          />
                          <div className="min-w-0">
                            <button
                              className="truncate text-left font-medium text-fg hover:text-violet"
                              onClick={() => select(r)}
                            >
                              {r.name}
                            </button>
                            <div className="truncate text-[10px] text-fg-subtle">
                              {r.product_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 font-mono">{fmt(r.buy_price)}</td>
                      <td className="px-3 font-mono">{fmt(r.sell_price)}</td>
                      <td
                        className={`px-3 font-mono ${(r.net_profit ?? 0) > 0 ? "text-green" : "text-red"}`}
                      >
                        {fmt(r.net_profit)}
                      </td>
                      <td className="px-3 font-mono">{pct(r.roi)}</td>
                      <td className="px-3">
                        {r.scores.liquidity.toFixed(0)}/100
                      </td>
                      <td className="px-3">
                        <Badge
                          variant={
                            (assessBazaar(r, flips.data!.meta).rating ?? 0) > 60
                              ? "green"
                              : "amber"
                          }
                        >
                          {assessBazaar(r, flips.data!.meta).rating?.toFixed(
                            0,
                          ) ?? t("smart.unknown")}
                        </Badge>
                      </td>
                      <td className="px-3">
                        <Button
                          aria-label={t("market.watch")}
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void watch.toggle(r.product_id)}
                        >
                          <Star
                            className={`size-3.5 ${watch.isWatched(r.product_id) ? "fill-amber text-amber" : ""}`}
                          />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {flips.data ? (
            <Pager
              page={filters.page}
              size={filters.page_size}
              total={flips.data.total}
              onChange={(p) => changeFlip({ page: p })}
            />
          ) : null}
        </>
      ) : null}
      {view === "auctions" ? (
        <>
          <section className="panel p-4">
            <p className="mb-3 text-[11px] leading-relaxed text-fg-muted">
              {t("market.auctionNote")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label>
                <Label>{t("market.search")}</Label>
                <Input
                  aria-label={t("market.search")}
                  value={auctions.search}
                  maxLength={100}
                  onChange={(e) => changeAuction({ search: e.target.value })}
                />
              </label>
              <MarketNumber
                label={t("market.discount")}
                value={auctions.min_discount}
                min={-100}
                max={100}
                onChange={(v) => changeAuction({ min_discount: v })}
              />
              <MarketNumber
                label={t("market.maxCost")}
                value={auctions.max_cost}
                onChange={(v) => changeAuction({ max_cost: v })}
              />
              <MarketNumber
                label={t("market.minRemaining")}
                value={auctions.min_remaining}
                max={86400}
                onChange={(v) =>
                  changeAuction({ min_remaining: Math.round(v) })
                }
              />
              <SelectField
                label={t("market.confidence")}
                value={auctions.min_confidence}
                onChange={(v) =>
                  changeAuction({
                    min_confidence: v as AuctionParams["min_confidence"],
                  })
                }
                options={(
                  ["low", "medium", "high", "insufficient"] as const
                ).map((v) => [v, t(`market.confidence.${v}`)])}
              />
              <SelectField
                label={t("market.rarity")}
                value={auctions.rarity ?? ""}
                onChange={(v) => changeAuction({ rarity: v || undefined })}
                options={[
                  ["", t("market.allRarities")],
                  ...[
                    "COMMON",
                    "UNCOMMON",
                    "RARE",
                    "EPIC",
                    "LEGENDARY",
                    "MYTHIC",
                    "DIVINE",
                    "SPECIAL",
                    "VERY_SPECIAL",
                  ].map((v) => [v, v] as [string, string]),
                ]}
              />
              <SelectField
                label={t("market.sort")}
                value={auctions.sort}
                onChange={(v) =>
                  changeAuction({ sort: v as AuctionParams["sort"] })
                }
                options={[
                  ["discount", t("market.discount")],
                  ["price", t("market.listing")],
                  ["newest", t("market.newest")],
                  ["reference", t("market.reference")],
                ]}
              />
              <Button
                variant="secondary"
                className="self-end"
                onClick={() =>
                  changeAuction({ descending: !auctions.descending })
                }
              >
                <ArrowDownUp className="size-4" />
                {t("market.direction")} {auctions.descending ? "↓" : "↑"}
              </Button>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={auctions.new_only}
                  onChange={(e) =>
                    changeAuction({ new_only: e.target.checked })
                  }
                />
                {t("market.newOnly")}
              </label>
              <label>
                <Label>{t("market.fees")} %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={auctions.fee_pct ?? ""}
                  onChange={(e) =>
                    changeAuction({
                      fee_pct:
                        e.target.value === ""
                          ? undefined
                          : Math.max(0, Math.min(100, Number(e.target.value))),
                    })
                  }
                />
              </label>
              <label>
                <Label>{t("market.listingFee")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={auctions.listing_fee ?? ""}
                  onChange={(e) =>
                    changeAuction({
                      listing_fee:
                        e.target.value === ""
                          ? undefined
                          : Math.max(0, Math.min(1e12, Number(e.target.value))),
                    })
                  }
                />
              </label>
            </div>
            <p className="mt-3 text-[10px] text-fg-subtle">
              {t("market.feeUnknown")}
            </p>
          </section>
          <section className="panel my-3 p-4">
            <p className="mb-3 text-xs text-fg-muted">
              {t(
                bins.data?.smart_filters_applied
                  ? "auctionSmart.scopeGlobal"
                  : "auctionSmart.scopePage",
              )}
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              {(
                [
                  ["min_profit", "market.minProfit", -1e15, 1e15],
                  ["min_roi", "market.minRoi", -100, 1e9],
                  ["max_risk", "smart.maxRisk", 0, 100],
                  ["max_age_seconds", "smart.maxAge", 0, 86400],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key}>
                  <Label>{t(label)}</Label>
                  <Input
                    aria-label={t(label)}
                    type="number"
                    min={min}
                    max={max}
                    value={auctions[key] ?? ""}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (
                        e.target.value === "" ||
                        (Number.isFinite(v) && v >= min && v <= max)
                      )
                        changeAuction({
                          [key]:
                            e.target.value === ""
                              ? undefined
                              : key === "max_age_seconds"
                                ? Math.trunc(v)
                                : v,
                        });
                    }}
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-fg-subtle">
              {t("auctionSmart.pageSort")}
            </p>
            <SelectField
              label={t("smart.sort")}
              value={auctionSmartSort}
              onChange={(v) =>
                setAuctionSmartSort(v as typeof auctionSmartSort)
              }
              options={[
                ["provider", t("smart.provider")],
                ["profit", t("market.net")],
                ["roi", t("market.roi")],
                ["risk", t("smart.risk")],
              ]}
            />
          </section>
          <MarketFreshness meta={bins.data?.meta} />
          {bins.error && bins.data ? (
            <p role="alert" className="my-2 text-xs text-amber">
              {t("auctionSmart.cachedError")}
            </p>
          ) : null}
          {bins.data?.analysis_limited ? (
            <p className="my-3 text-xs text-amber">
              {t("market.analysisLimited")}
            </p>
          ) : null}
          {bins.data?.partial ? (
            <p className="my-3 text-xs text-amber">{t("market.partial")}</p>
          ) : null}
          {bins.error && !bins.data ? (
            <ErrorState
              error={bins.error}
              onRetry={() => void bins.refetch()}
            />
          ) : bins.isPending ? (
            <Skeleton className="mt-4 h-80" />
          ) : !visibleAuctions.length ? (
            <EmptyState
              icon={Search}
              title={t("market.empty")}
              description={t("market.emptyHint")}
            />
          ) : (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {visibleAuctions.map((r) => (
                <AuctionCard
                  key={r.auction_id}
                  row={r}
                  meta={bins.data!.meta}
                  feePct={auctions.fee_pct}
                  listingFee={auctions.listing_fee}
                  partial={bins.data!.partial || bins.data!.analysis_limited}
                  onSelect={() => {
                    setAuctionContext({
                      meta: bins.data!.meta,
                      partial:
                        bins.data!.partial || bins.data!.analysis_limited,
                    });
                    setAuction(r);
                  }}
                  saved={saved.includes(r.auction_id)}
                  onSave={() => saveAuction(r.auction_id)}
                />
              ))}
            </div>
          )}
          {bins.data ? (
            <Pager
              page={auctions.page}
              size={auctions.page_size}
              total={bins.data.total}
              onChange={(p) => changeAuction({ page: p })}
            />
          ) : null}
        </>
      ) : null}
      {view === "alerts" ? <SmartAlertsPanel /> : null}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(v) => {
          if (!v) close();
        }}
      >
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>{t("market.subtitle")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {detail ? (
              <>
                <MarketFreshness
                  meta={analytics.data?.meta ?? flips.data?.meta}
                />
                <div className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["market.buy", fmt(detail.buy_price)],
                      ["market.sell", fmt(detail.sell_price)],
                      ["market.gross", fmt(detail.gross_margin)],
                      ["market.netItem", fmt(detail.net_per_item)],
                      ["market.stack", fmt(detail.net_per_stack)],
                      ["market.net", fmt(detail.net_profit)],
                      ["market.roi", pct(detail.roi)],
                      ["market.cost", fmt(detail.position_cost)],
                      ["market.breakEven", fmt(detail.break_even)],
                      ["market.fees", `${fee}% · ${fmt(detail.fees)}`],
                      [
                        "market.depth",
                        `${fmt(detail.bid_depth)} / ${fmt(detail.ask_depth)}`,
                      ],
                      [
                        "market.bookVolume",
                        `${fmt(detail.buy_volume)} / ${fmt(detail.sell_volume)}`,
                      ],
                      [
                        "market.orders",
                        `${fmt(detail.buy_orders)} / ${fmt(detail.sell_orders)}`,
                      ],
                      ["market.activity", fmt(detail.weekly_activity)],
                      [
                        "market.imbalance",
                        pct(
                          detail.imbalance === null
                            ? null
                            : detail.imbalance * 100,
                        ),
                      ],
                      ["market.impact", pct(detail.price_impact_pct)],
                      [
                        "market.share",
                        pct(
                          detail.position_share === null
                            ? null
                            : detail.position_share * 100,
                        ),
                      ],
                      ["market.profitScore", detail.scores.profit.toFixed(1)],
                      [
                        "market.liquidityScore",
                        detail.scores.liquidity.toFixed(1),
                      ],
                      [
                        "market.riskScore",
                        fmt(
                          (analytics.data?.meta ?? flips.data?.meta)
                            ? assessBazaar(
                                detail,
                                (analytics.data?.meta ?? flips.data?.meta)!,
                              ).risk
                            : null,
                        ),
                      ],
                    ] as Array<[TranslationKey, string]>
                  ).map(([key, value]) => (
                    <Metric key={key} label={t(key)}>
                      {value}
                    </Metric>
                  ))}
                </div>
                <p className="my-3 text-[11px] text-fg-muted">
                  {t("market.feeNote")}
                </p>
                <p className="my-3 text-[11px] text-fg-muted">
                  {t("market.activityHelp")}
                </p>
                <p className="my-3 text-[11px] text-fg-muted">
                  {t("market.scoreHelp")}
                </p>
                {flips.data ? (
                  <SmartBazaarEvidence
                    row={detail}
                    meta={analytics.data?.meta ?? flips.data.meta}
                    history={analytics.data}
                  />
                ) : null}
                <h3 className="text-xs font-semibold">{t("market.risks")}</h3>
                <div className="my-2 flex flex-wrap gap-2">
                  {detail.risks.map((r) => (
                    <Badge key={r} variant="amber">
                      {t(`market.risk.${r}` as TranslationKey)}
                    </Badge>
                  ))}
                </div>
                <div className="my-4 flex flex-wrap gap-2">
                  <Link
                    to={`/calculators?item=${encodeURIComponent(detail.product_id)}&tab=scenarios`}
                  >
                    <Button variant="secondary">
                      {t("market.calculator")}
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    onClick={() => void watch.toggle(detail.product_id)}
                  >
                    <Star className="size-3.5" />
                    {t("market.watch")}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={provider.isDemo}
                    onClick={() =>
                      useMarketAlerts
                        .getState()
                        .save(
                          newRule(
                            detail.product_id,
                            "price_below",
                            detail.buy_price ?? 0,
                          ),
                        )
                    }
                  >
                    <Bell className="size-3.5" />
                    {t("market.createRule")}
                  </Button>
                  <MarketNumber
                    integer
                    label={t("market.quantity")}
                    value={detail.quantity}
                    min={1}
                    max={1e6}
                    onChange={(v) => {
                      changeFlip({ quantity: Math.round(v) });
                      setSelected((current) =>
                        current
                          ? { ...current, quantity: Math.round(v) }
                          : null,
                      );
                    }}
                  />
                </div>
                <h3 className="mb-3 text-sm font-semibold">
                  {t("market.history")}
                </h3>
                <div className="mb-3 flex gap-2">
                  {(["1h", "24h", "7d", "30d"] as const).map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={range === r ? "default" : "secondary"}
                      onClick={() => setRange(r)}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
                {analytics.error ? (
                  <ErrorState
                    error={analytics.error}
                    onRetry={() => void analytics.refetch()}
                    compact
                  />
                ) : analytics.isPending ? (
                  <Skeleton className="h-44" />
                ) : analytics.data ? (
                  <>
                    <p className="mb-2 text-xs text-fg-muted">
                      {t("market.samples", { count: analytics.data.samples })} ·{" "}
                      {analytics.data.sufficient
                        ? t("market.sufficient")
                        : t("market.insufficient")}
                    </p>
                    {analytics.data.points.length ? (
                      <>
                        <div className="h-52 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analytics.data.points}>
                              <CartesianGrid stroke="var(--line)" />
                              <XAxis
                                dataKey="ts"
                                tickFormatter={(v) =>
                                  new Date(String(v)).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                }
                                minTickGap={60}
                              />
                              <YAxis width={65} />
                              <Tooltip
                                labelFormatter={(v) =>
                                  new Date(String(v)).toLocaleString()
                                }
                              />
                              <Line
                                name={t("market.buy")}
                                dataKey="buy_price"
                                stroke="var(--violet)"
                                dot={false}
                                connectNulls={false}
                              />
                              <Line
                                name={t("market.sell")}
                                dataKey="sell_price"
                                stroke="var(--cyan)"
                                dot={false}
                                connectNulls={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-3 h-36">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analytics.data.points}>
                              <XAxis dataKey="ts" hide />
                              <YAxis width={65} />
                              <Tooltip />
                              <Line
                                name={t("market.historySpread")}
                                dataKey="spread_pct"
                                stroke="var(--amber)"
                                dot={false}
                                connectNulls={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-fg-muted">
                        {t("market.historyUnavailable")}
                      </p>
                    )}
                    <div className="my-3 grid gap-2 sm:grid-cols-3">
                      {(
                        [
                          ["market.minimum", fmt(analytics.data.minimum)],
                          ["market.maximum", fmt(analytics.data.maximum)],
                          ["market.average", fmt(analytics.data.average)],
                          [
                            "market.volatility",
                            pct(analytics.data.volatility_pct),
                          ],
                          ["market.change", pct(analytics.data.change_pct)],
                          ["market.zscore", fmt(analytics.data.z_score)],
                        ] as Array<[TranslationKey, string]>
                      ).map(([k, v]) => (
                        <Metric label={t(k)} key={k}>
                          {v}
                        </Metric>
                      ))}
                    </div>
                    {analytics.data.signals.length ? (
                      analytics.data.signals.map((s) => (
                        <div
                          key={s.kind}
                          className="my-2 rounded-lg border border-amber/30 p-3 text-xs"
                        >
                          <strong>
                            {t(`market.signal.${s.kind}` as TranslationKey)}
                          </strong>
                          <p>
                            {t("market.value")}: {s.value.toFixed(2)} ·{" "}
                            {t("market.period")}: {s.period_seconds} ·{" "}
                            {t("market.samples", { count: s.samples })}
                          </p>
                          <time>{new Date(s.updated_at).toLocaleString()}</time>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-fg-subtle">
                        {t("market.noSignals")}
                      </p>
                    )}
                    <p className="mt-2 text-[10px] text-fg-subtle">
                      {t("market.signalNote")}
                    </p>
                  </>
                ) : null}
              </>
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>
      {auction && (auctionContext?.meta ?? bins.data?.meta) ? (
        <SmartAuctionDetails
          row={auction}
          meta={(auctionContext?.meta ?? bins.data?.meta)!}
          feePct={auctions.fee_pct}
          listingFee={auctions.listing_fee}
          partial={
            auctionContext?.partial ??
            Boolean(bins.data?.partial || bins.data?.analysis_limited)
          }
          onClose={() => {
            setAuction(null);
            setAuctionContext(null);
            const next = new URLSearchParams(params);
            next.delete("lot");
            setParams(next, { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}
function AuctionCard({
  row: r,
  onSelect,
  saved,
  onSave,
  meta,
  feePct,
  listingFee,
  partial,
}: {
  meta?: import("@/features/market/models").MarketMeta;
  feePct?: number;
  listingFee?: number;
  partial?: boolean;
  row: Valuation;
  onSelect: () => void;
  saved: boolean;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const confidence = meta
    ? assessAuction(r, meta, feePct, listingFee, partial).confidence
    : r.confidence;
  return (
    <article className="panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ItemGlyph
            name={r.name}
            tier={r.rarity}
            size="sm"
            itemId={r.item_id}
          />
          <button
            onClick={onSelect}
            className="truncate text-left text-sm font-semibold hover:text-violet"
          >
            {r.name}
          </button>
        </div>
        <Badge
          variant={
            confidence === "high"
              ? "green"
              : confidence === "insufficient"
                ? "outline"
                : "amber"
          }
        >
          {t(`market.confidence.${confidence}`)}
        </Badge>
      </div>
      <p className="mt-1 text-[10px] text-fg-subtle">
        {r.item_id ?? t("market.insufficient")} · {r.rarity} · ×{r.count ?? "?"}
      </p>
      <div className="my-3 grid grid-cols-3 gap-2">
        <Metric label={t("market.listing")}>{fmt(r.listing_price)}</Metric>
        <Metric label={t("market.reference")}>{fmt(r.reference_price)}</Metric>
        <Metric label={t("market.discount")}>{pct(r.discount_pct)}</Metric>
      </div>
      <p className="text-xs text-fg-muted">
        {t("market.upside")}: {fmt(r.net_upside)}
      </p>
      <p className="mt-1 text-[10px] text-fg-subtle">
        {t("market.comparables", { count: r.sample_size })} ·{" "}
        {t("market.remaining", {
          minutes: Math.max(0, Math.floor((r.end - Date.now()) / 60000)),
        })}
      </p>
      <p className="my-2 text-[10px] text-fg-subtle">
        {t(
          r.reference_price === null
            ? "market.insufficient"
            : "market.auctionNote",
        )}
      </p>
      {meta ? (
        <SmartAuctionSummary
          row={r}
          meta={meta}
          feePct={feePct}
          listingFee={listingFee}
          partial={partial}
        />
      ) : null}
      <Button size="sm" variant="ghost" onClick={onSave}>
        <Bookmark
          className={`size-3 ${saved ? "fill-violet text-violet" : ""}`}
        />
        {t("market.save")}
      </Button>
    </article>
  );
}
function AuctionPreview({
  onSelect,
}: {
  onSelect: (
    r: Valuation,
    meta: import("@/features/market/models").MarketMeta,
    partial: boolean,
  ) => void;
}) {
  const { t } = useI18n(),
    q = useAuctionScanner({ ...DEFAULT_AUCTION_FILTERS, page_size: 3 });
  return (
    <section className="my-4">
      <h2 className="mb-3 text-sm font-semibold">{t("market.topAuctions")}</h2>
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <MarketFreshness meta={q.data?.meta} />
          {q.data?.partial ? (
            <p className="mb-3 text-xs text-amber">{t("market.partial")}</p>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-3">
            {q.data?.items.map((r) => (
              <AuctionCard
                key={r.auction_id}
                row={r}
                onSelect={() =>
                  onSelect(
                    r,
                    q.data!.meta,
                    q.data!.partial || q.data!.analysis_limited,
                  )
                }
                saved={false}
                onSave={() =>
                  onSelect(
                    r,
                    q.data!.meta,
                    q.data!.partial || q.data!.analysis_limited,
                  )
                }
              />
            ))}
          </div>
          {!q.data?.items.length ? (
            <p className="text-xs text-fg-subtle">{t("market.empty")}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
