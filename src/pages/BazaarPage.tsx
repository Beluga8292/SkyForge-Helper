import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  History,
  Info,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  Store,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/locales";
import { useBazaar } from "@/hooks/useBazaar";
import { useMarketHistory } from "@/hooks/useMarketHistory";
import { useSettingsStore } from "@/stores/settings";
import { useWatchlistStore } from "@/stores/watchlist";
import { filterAndSortQuotes, type BazaarSortKey } from "@/features/bazaar/calculations";
import { formatCoins, formatCompact, formatPercent, formatPrice, formatTime, timeAgo } from "@/utils/format";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, StaleNote } from "@/components/common/States";
import { ItemGlyph, RarityBadge } from "@/components/common/ItemVisuals";
import { CopyButton } from "@/components/common/CopyButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import type { BazaarItemQuote } from "@/types/bazaar";
import type { WatchlistEntry } from "@/types/app";

const PAGE_SIZE = 25;

export function BazaarPage() {
  const { t, language } = useI18n();
  const bazaar = useBazaar();
  const feePct = useSettingsStore((state) => state.settings.bazaarFeePct);
  const favorites = useWatchlistStore((state) => state.entries);
  const toggleWatch = useWatchlistStore((state) => state.toggle);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("item");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [minVolume, setMinVolume] = useState("0");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortKey, setSortKey] = useState<BazaarSortKey>("weeklyVolume");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const favoriteIds = useMemo(() => new Set(favorites.map((entry) => entry.productId)), [favorites]);
  const categories = useMemo(
    () => [...new Set(bazaar.quotes.map((quote) => quote.category).filter((value): value is string => Boolean(value)))].sort(),
    [bazaar.quotes],
  );

  const filtered = useMemo(
    () =>
      filterAndSortQuotes(
        bazaar.quotes,
        { search, onlyFavorites, minWeeklyVolume: Number(minVolume), category: category === "all" ? null : category },
        sortKey,
        sortDir,
        favoriteIds,
        feePct,
      ),
    [bazaar.quotes, search, onlyFavorites, minVolume, category, sortKey, sortDir, favoriteIds, feePct],
  );

  useEffect(() => {
    setPage(0);
  }, [search, category, minVolume, onlyFavorites, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = selectedId ? bazaar.quotes.find((quote) => quote.productId === selectedId) : undefined;

  const openItem = (productId: string) => {
    const next = new URLSearchParams(params);
    next.set("item", productId);
    setParams(next);
  };

  const closeItem = (open: boolean) => {
    if (open) return;
    const next = new URLSearchParams(params);
    next.delete("item");
    setParams(next, { replace: true });
  };

  const toggleFavorite = async (productId: string) => {
    try {
      const added = await toggleWatch(productId);
      toast.success(added ? t("bazaar.addedToWatchlist") : t("bazaar.removedFromWatchlist"));
    } catch {
      toast.error(t("toasts.error"));
    }
  };

  const potential = (quote: BazaarItemQuote) =>
    quote.instantSell > 0 ? ((quote.instantBuy * (1 - feePct / 100) - quote.instantSell) / quote.instantSell) * 100 : 0;

  return (
    <div className="animate-[fade-up_260ms_ease-out]">
      <PageHeader
        eyebrow={
          <>
            <Store className="size-3" /> {t("nav.section.analytics")}
          </>
        }
        title={t("bazaar.title")}
        description={t("bazaar.subtitle")}
        actions={
          <>
            {bazaar.demo ? <Badge variant="amber">{t("common.demo")}</Badge> : null}
            <Button variant="secondary" size="sm" asChild>
              <Link to="/watchlist">
                <Star className="size-3.5" /> {t("nav.watchlist")}
                {favorites.length ? <span className="ml-0.5 text-fg-subtle">{favorites.length}</span> : null}
              </Link>
            </Button>
            <Button size="sm" onClick={() => void bazaar.refresh()} disabled={bazaar.isFetching}>
              <RefreshCw className={cn("size-3.5", bazaar.isFetching && "animate-spin")} />
              {bazaar.isFetching ? t("common.refreshing") : t("common.refresh")}
            </Button>
          </>
        }
      />

      {bazaar.demo ? (
        <div className="mb-4 rounded-xl border border-amber/20 bg-amber/[0.05] px-4 py-2.5 text-[11.5px] text-amber/90">{t("bazaar.demoNote")}</div>
      ) : null}

      {bazaar.envelope?.stale ? <StaleNote updatedAt={bazaar.envelope.updatedAt} /> : null}

      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BazaarStat label={t("dashboard.products")} value={bazaar.summary.productCount.toLocaleString()} icon={Store} />
        <BazaarStat
          label={t("dashboard.medianSpread")}
          value={bazaar.summary.medianSpreadPct != null ? formatPercent(bazaar.summary.medianSpreadPct) : "—"}
          icon={TrendingUp}
          tone="green"
        />
        <BazaarStat
          label={t("dashboard.topOpportunity")}
          value={bazaar.summary.topGainer?.name ?? "—"}
          hint={bazaar.summary.topGainer ? formatPercent(bazaar.summary.topGainer.spreadPct) : undefined}
          icon={ArrowUp}
          tone="violet"
        />
        <BazaarStat
          label={t("common.updated")}
          value={bazaar.envelope ? timeAgo(bazaar.envelope.updatedAt, language) : "—"}
          hint={bazaar.envelope ? formatTime(bazaar.envelope.updatedAt, language) : undefined}
          icon={RefreshCw}
        />
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("bazaar.searchPlaceholder")}
                className="pl-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-auto">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="min-w-[140px]">
                  <SelectValue placeholder={t("bazaar.category")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("bazaar.allCategories")}</SelectItem>
                  {categories.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={minVolume} onValueChange={setMinVolume}>
                <SelectTrigger className="min-w-[130px]">
                  <SelectValue placeholder={t("bazaar.minVolume")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t("bazaar.minVolume")}: 0</SelectItem>
                  <SelectItem value="100000">≥ 100K</SelectItem>
                  <SelectItem value="1000000">≥ 1M</SelectItem>
                  <SelectItem value="10000000">≥ 10M</SelectItem>
                  <SelectItem value="100000000">≥ 100M</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortKey} onValueChange={(value) => setSortKey(value as BazaarSortKey)}>
                <SelectTrigger className="min-w-[130px]">
                  <SlidersHorizontal className="size-3.5 text-fg-subtle" />
                  <SelectValue placeholder={t("bazaar.sortBy")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spreadPct">{t("bazaar.spreadPct")}</SelectItem>
                  <SelectItem value="spread">{t("bazaar.spread")}</SelectItem>
                  <SelectItem value="potential">{t("bazaar.potential")}</SelectItem>
                  <SelectItem value="weeklyVolume">{t("bazaar.weeklyVolume")}</SelectItem>
                  <SelectItem value="instantBuy">{t("bazaar.instantBuy")}</SelectItem>
                  <SelectItem value="instantSell">{t("bazaar.instantSell")}</SelectItem>
                  <SelectItem value="name">{t("common.name")}</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={sortDir === "desc" ? "secondary" : "outline"}
                onClick={() => setSortDir((current) => (current === "desc" ? "asc" : "desc"))}
                className="justify-start"
              >
                <ArrowUpDown className="size-3.5" />
                {sortDir === "desc" ? t("common.value") + " ↓" : t("common.value") + " ↑"}
              </Button>
            </div>

            <Button
              variant={onlyFavorites ? "default" : "secondary"}
              onClick={() => setOnlyFavorites((current) => !current)}
              className="shrink-0"
            >
              <Star className={cn("size-3.5", onlyFavorites && "fill-current")} />
              {t("bazaar.onlyFavorites")}
              <span className={cn("text-[10px]", onlyFavorites ? "text-white/70" : "text-fg-subtle")}>{favorites.length}</span>
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-fg-subtle">
            <span className="flex items-center gap-1.5">
              <Filter className="size-3" />
              {filtered.length.toLocaleString()} / {bazaar.quotes.length.toLocaleString()} {t("bazaar.products").toLowerCase()}
            </span>
            <span className="flex items-center gap-1.5">
              <Info className="size-3" />
              {t("bazaar.feeNote", { fee: feePct })} · {t("dashboard.marketNote")}
            </span>
          </div>
        </div>

        {bazaar.isPending ? (
          <BazaarSkeleton />
        ) : bazaar.error ? (
          <ErrorState error={bazaar.error} onRetry={() => void bazaar.refresh()} title={t("bazaar.errorTitle")} />
        ) : !pageItems.length ? (
          <EmptyState
            icon={Search}
            title={t("bazaar.noResults")}
            description={t("bazaar.noResultsDesc")}
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                  setMinVolume("0");
                  setOnlyFavorites(false);
                }}
              >
                {t("common.reset")}
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-line bg-surface-2/30 text-[9.5px] uppercase tracking-[0.08em] text-fg-subtle">
                    <th className="w-10 px-3 py-2.5" />
                    <th className="px-2 py-2.5 font-medium">{t("common.name")}</th>
                    <th className="px-2 py-2.5 text-right font-medium">{t("bazaar.instantBuy")}</th>
                    <th className="px-2 py-2.5 text-right font-medium">{t("bazaar.instantSell")}</th>
                    <th className="px-2 py-2.5 text-right font-medium">{t("bazaar.spreadPct")}</th>
                    <th className="px-2 py-2.5 text-right font-medium">{t("bazaar.weeklyVolume")}</th>
                    <th className="px-2 py-2.5 text-right font-medium">{t("bazaar.potential")}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{t("common.details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((quote) => {
                    const watched = favoriteIds.has(quote.productId);
                    const pot = potential(quote);
                    return (
                      <tr key={quote.productId} className="group border-b border-line/60 transition-colors last:border-0 hover:bg-surface-2/40">
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => void toggleFavorite(quote.productId)}
                            aria-label={watched ? t("bazaar.removedFromWatchlist") : t("bazaar.addedToWatchlist")}
                            className="flex size-6 items-center justify-center rounded text-fg-subtle transition-colors hover:bg-surface-2 hover:text-amber"
                          >
                            <Star className={cn("size-3.5", watched && "fill-amber text-amber")} />
                          </button>
                        </td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => openItem(quote.productId)} className="flex items-center gap-2.5 text-left">
                            <ItemGlyph name={quote.name} tier={quote.tier} size="sm" itemId={quote.productId} category={quote.category} />
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <span className="max-w-[260px] truncate font-medium text-fg group-hover:text-violet">{quote.name}</span>
                                <RarityBadge tier={quote.tier} />
                              </span>
                              <span className="block font-mono text-[9px] text-fg-subtle">{quote.productId}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-fg-muted">{formatPrice(quote.instantBuy)}</td>
                        <td className="px-2 py-2 text-right font-mono text-fg-muted">{formatPrice(quote.instantSell)}</td>
                        <td className="px-2 py-2 text-right font-mono text-green">{formatPercent(quote.spreadPct)}</td>
                        <td className="px-2 py-2 text-right font-mono text-fg-subtle">{formatCompact(Math.min(quote.buyOrderMovingWeek, quote.sellOfferMovingWeek))}</td>
                        <td className={cn("px-2 py-2 text-right font-mono font-semibold", pot > 0 ? "text-green" : "text-red")}>{formatPercent(pot)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => openItem(quote.productId)}>
                            <ChevronRight className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2 p-3 sm:grid-cols-2 md:hidden">
              {pageItems.map((quote) => {
                const watched = favoriteIds.has(quote.productId);
                return (
                  <button
                    key={quote.productId}
                    type="button"
                    onClick={() => openItem(quote.productId)}
                    className="rounded-xl border border-line bg-surface-2/25 p-3 text-left transition-colors hover:border-line-strong"
                  >
                    <div className="flex items-center gap-2.5">
                      <ItemGlyph name={quote.name} tier={quote.tier} size="sm" itemId={quote.productId} category={quote.category} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-fg">{quote.name}</p>
                        <p className="font-mono text-[9px] text-fg-subtle">{quote.productId}</p>
                      </div>
                      <Star
                        className={cn("size-3.5 shrink-0", watched ? "fill-amber text-amber" : "text-fg-subtle")}
                        onClick={(event) => {
                          event.stopPropagation();
                          void toggleFavorite(quote.productId);
                        }}
                      />
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-1 text-[9px]">
                      <div>
                        <p className="text-fg-subtle">{t("bazaar.instantBuy")}</p>
                        <p className="font-mono text-[11px] text-fg-muted">{formatPrice(quote.instantBuy)}</p>
                      </div>
                      <div>
                        <p className="text-fg-subtle">{t("bazaar.instantSell")}</p>
                        <p className="font-mono text-[11px] text-fg-muted">{formatPrice(quote.instantSell)}</p>
                      </div>
                      <div>
                        <p className="text-fg-subtle">{t("bazaar.spreadPct")}</p>
                        <p className="font-mono text-[11px] text-green">{formatPercent(quote.spreadPct)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[11px] text-fg-subtle">
              <span>
                {t("common.page")} {safePage + 1} {t("common.of")} {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="secondary" size="icon-sm" disabled={safePage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-line bg-surface/40 px-4 py-3 text-[11px] leading-relaxed text-fg-subtle">
        <p className="mb-1 flex items-center gap-1.5 font-medium text-fg-muted">
          <Info className="size-3.5 text-violet" /> {t("bazaar.disclaimerTitle")}
        </p>
        {t("bazaar.disclaimer")}
      </section>

      {selected ? (
        <ItemDetailDialog
          key={selected.productId}
          quote={selected}
          open={Boolean(selectedId)}
          onOpenChange={closeItem}
          watched={favorites.find((entry) => entry.productId === selected.productId) ?? null}
          onToggleWatch={() => toggleFavorite(selected.productId)}
          feePct={feePct}
        />
      ) : null}
    </div>
  );
}

function BazaarStat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Store;
  tone?: "green" | "violet";
}) {
  return (
    <div className="panel p-3.5">
      <div className="flex items-center justify-between text-[9.5px] uppercase tracking-[0.08em] text-fg-subtle">
        {label}
        <Icon className="size-3.5" />
      </div>
      <p className={cn("mt-1.5 truncate text-[16px] font-semibold tracking-[-0.02em] tabular-nums", tone === "green" ? "text-green" : tone === "violet" ? "text-violet" : "text-fg")}>
        {value}
      </p>
      {hint ? <p className="text-[9.5px] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

function BazaarSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <SkeletonText lines={2} className="flex-1" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function ItemDetailDialog({
  quote,
  open,
  onOpenChange,
  watched,
  onToggleWatch,
  feePct,
}: {
  quote: BazaarItemQuote;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  watched: WatchlistEntry | null;
  onToggleWatch: () => void;
  feePct: number;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const history = useMarketHistory(quote.productId, open);
  const updateTarget = useWatchlistStore((state) => state.setTarget);
  const [target, setTarget] = useState(watched?.targetPrice ? String(watched.targetPrice) : "");
  const [savingTarget, setSavingTarget] = useState(false);

  const potentialPct = quote.instantSell > 0 ? ((quote.instantBuy * (1 - feePct / 100) - quote.instantSell) / quote.instantSell) * 100 : 0;
  const afterTax = quote.instantBuy * (1 - feePct / 100);

  const saveTarget = async () => {
    if (!watched) return;
    const value = target.trim() ? Number(target.replace(",", ".")) : null;
    if (value != null && (!Number.isFinite(value) || value <= 0)) {
      toast.error(t("calculators.invalidInput"));
      return;
    }
    setSavingTarget(true);
    try {
      await updateTarget(quote.productId, value);
      toast.success(t("bazaar.targetSaved"));
    } catch {
      toast.error(t("toasts.error"));
    } finally {
      setSavingTarget(false);
    }
  };

  const chartData = (history.data ?? []).map((point) => ({
    ts: point.ts,
    label: formatTime(point.ts),
    buy: point.buyPrice,
    sell: point.sellPrice,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide className="max-h-[92vh]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <ItemGlyph name={quote.name} tier={quote.tier} size="lg" itemId={quote.productId} category={quote.category} />
            <div className="min-w-0 flex-1">
              <DialogTitle className="pr-8">{quote.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  {quote.productId} <CopyButton value={quote.productId} className="size-5" label={t("common.copy")} />
                </span>
                <RarityBadge tier={quote.tier} />
                {quote.category ? <span>{quote.category}</span> : null}
                {quote.npcSellPrice != null ? <span>{t("bazaar.npcSell")}: {formatCoins(quote.npcSellPrice)}</span> : null}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <PriceTile label={t("bazaar.instantBuy")} value={formatPrice(quote.instantBuy)} tone="violet" />
            <PriceTile label={t("bazaar.instantSell")} value={formatPrice(quote.instantSell)} tone="green" />
            <PriceTile label={t("bazaar.spread")} value={formatPrice(quote.spread)} tone="neutral" hint={formatPercent(quote.spreadPct)} />
            <PriceTile label={t("bazaar.afterTax")} value={formatPrice(afterTax)} tone={potentialPct > 0 ? "green" : "red"} hint={formatPercent(potentialPct)} />
          </div>

          <div className="rounded-xl border border-line bg-surface-2/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg">
                  <Star className={cn("size-3.5", watched ? "fill-amber text-amber" : "text-fg-subtle")} /> {t("nav.watchlist")}
                </p>
                <p className="mt-0.5 text-[10px] text-fg-subtle">{t("bazaar.targetPrice")}: {watched?.targetPrice != null ? formatPrice(watched.targetPrice) : t("watchlist.noTarget")}</p>
              </div>
              <Button size="sm" variant={watched ? "success" : "secondary"} onClick={onToggleWatch}>
                <Star className={cn("size-3.5", watched && "fill-current")} />
                {watched ? t("bazaar.removedFromWatchlist") : t("bazaar.addedToWatchlist")}
              </Button>
            </div>
            {watched ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[160px] flex-1">
                  <Label htmlFor="watch-target">{t("bazaar.targetPrice")}</Label>
                  <Input id="watch-target" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} placeholder={formatPrice(quote.instantSell)} />
                </div>
                <Button size="sm" variant="secondary" onClick={() => void saveTarget()} disabled={savingTarget}>
                  <Target className="size-3.5" /> {t("bazaar.setTarget")}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <OrderBook title={t("bazaar.buyOrders")} levels={quote.buyOrdersTop} tone="green" total={quote.buyOrderVolume} />
            <OrderBook title={t("bazaar.sellOrders")} levels={quote.sellOrdersTop} tone="red" total={quote.sellOfferVolume} />
          </div>

          <div className="rounded-xl border border-line bg-surface-2/25 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg">
                <History className="size-3.5 text-violet" /> {t("bazaar.history")}
              </p>
              {chartData.length ? <Badge variant="outline">{chartData.length}</Badge> : null}
            </div>
            {history.isPending ? (
              <Skeleton className="h-40 w-full" />
            ) : chartData.length < 2 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-line-strong text-center">
                <History className="size-5 text-fg-subtle" />
                <p className="mt-2 text-[11.5px] font-medium text-fg-muted">{t("bazaar.historyEmpty")}</p>
                <p className="mt-0.5 max-w-xs px-4 text-[10px] leading-relaxed text-fg-subtle">{t("bazaar.historyEmptyDesc")}</p>
              </div>
            ) : (
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="buyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--violet)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--violet)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="sellGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--green)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} minTickGap={40} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} width={54} axisLine={false} tickLine={false} domain={["auto", "auto"]} tickFormatter={(value) => formatCompact(Number(value), 1)} />
                    <ChartTooltip
                      contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--line-strong)", borderRadius: 10, fontSize: 11 }}
                      labelStyle={{ color: "var(--muted)" }}
                      formatter={(value: unknown) => formatPrice(Array.isArray(value) ? Number(value[0]) : Number(value ?? 0))}
                    />
                    <Area type="monotone" dataKey="buy" name={t("bazaar.instantBuy")} stroke="var(--violet)" strokeWidth={1.8} fill="url(#buyGradient)" dot={false} />
                    <Area type="monotone" dataKey="sell" name={t("bazaar.instantSell")} stroke="var(--green)" strokeWidth={1.6} fill="url(#sellGradient)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] text-fg-subtle sm:grid-cols-4">
            <Metric label={t("bazaar.volume7d")} value={formatCompact(Math.min(quote.buyOrderMovingWeek, quote.sellOfferMovingWeek))} />
            <Metric label={t("bazaar.buyOrders")} value={formatCompact(quote.buyOrderVolume)} />
            <Metric label={t("bazaar.sellOrders")} value={formatCompact(quote.sellOfferVolume)} />
            <Metric label={t("common.updated")} value={timeAgo(quote.lastUpdated)} />
          </div>

          <div className="rounded-lg border border-line bg-bg-elevated/60 px-3 py-2 text-[10.5px] leading-relaxed text-fg-subtle">
            {t("bazaar.potentialExplain")} {t("calculators.disclaimer")}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onOpenChange(false);
              navigate(`/calculators?item=${encodeURIComponent(quote.productId)}`);
            }}
          >
            <TrendingUp className="size-3.5" /> {t("dashboard.openCalculators")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PriceTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: "violet" | "green" | "red" | "neutral" }) {
  const color = tone === "violet" ? "text-violet" : tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-fg";
  return (
    <div className="rounded-lg border border-line bg-bg-elevated/50 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.08em] text-fg-subtle">{label}</p>
      <p className={cn("mt-0.5 truncate font-mono text-[14px] font-semibold", color)}>{value}</p>
      {hint ? <p className="font-mono text-[9.5px] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

function OrderBook({ title, levels, tone, total }: { title: string; levels: BazaarItemQuote["buyOrdersTop"]; tone: "green" | "red"; total: number }) {
  const max = Math.max(1, ...levels.map((level) => level.amount));
  return (
    <div className="rounded-xl border border-line bg-surface-2/25 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className={cn("text-[11px] font-medium", tone === "green" ? "text-green" : "text-red")}>{title}</p>
        <span className="font-mono text-[9.5px] text-fg-subtle">{formatCompact(total)}</span>
      </div>
      {levels.length ? (
        <div className="space-y-1">
          {levels.slice(0, 6).map((level, index) => (
            <div key={`${level.pricePerUnit}-${index}`} className="relative overflow-hidden rounded px-1.5 py-1">
              <div
                className={cn("absolute inset-y-0 left-0 rounded opacity-15", tone === "green" ? "bg-green" : "bg-red")}
                style={{ width: `${(level.amount / max) * 100}%` }}
              />
              <div className="relative flex items-center justify-between font-mono text-[10px]">
                <span className="text-fg-muted">{formatPrice(level.pricePerUnit)}</span>
                <span className="text-fg-subtle">{formatCompact(level.amount)} · {level.orders}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-[10px] text-fg-subtle">—</p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-surface-2/30 px-2 py-1.5">
      <p className="truncate text-[8.5px] uppercase tracking-[0.08em] text-fg-subtle">{label}</p>
      <p className="truncate font-mono text-[10.5px] text-fg-muted">{value}</p>
    </div>
  );
}
