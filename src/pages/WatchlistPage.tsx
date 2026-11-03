import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Bell, BellOff, ChevronRight, History, Star, Target, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/locales";
import { useBazaar } from "@/hooks/useBazaar";
import { useMarketHistory } from "@/hooks/useMarketHistory";
import { useWatchlistStore } from "@/stores/watchlist";
import { useSettingsStore } from "@/stores/settings";
import { formatCompact, formatPercent, formatPrice, timeAgo } from "@/utils/format";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState, ErrorState, StaleNote } from "@/components/common/States";
import { ItemGlyph, RarityBadge } from "@/components/common/ItemVisuals";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/controls";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import type { MarketHistoryPoint, WatchlistEntry } from "@/types/app";
import type { BazaarItemQuote } from "@/types/bazaar";

export function WatchlistPage() {
  const { t, language } = useI18n();
  const bazaar = useBazaar();
  const entries = useWatchlistStore((state) => state.entries);
  const remove = useWatchlistStore((state) => state.remove);
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.update);
  const [targetEntry, setTargetEntry] = useState<WatchlistEntry | null>(null);

  const quoteMap = useMemo(() => new Map(bazaar.quotes.map((quote) => [quote.productId, quote])), [bazaar.quotes]);
  const reached = entries.filter((entry) => {
    const quote = quoteMap.get(entry.productId);
    return entry.targetPrice != null && quote && quote.instantSell <= entry.targetPrice;
  }).length;

  const removeEntry = async (entry: WatchlistEntry) => {
    try {
      await remove(entry.productId);
      toast.success(t("bazaar.removedFromWatchlist"));
    } catch {
      toast.error(t("toasts.error"));
    }
  };

  return (
    <div className="animate-[fade-up_260ms_ease-out]">
      <PageHeader
        eyebrow={
          <>
            <Star className="size-3" /> {t("nav.section.analytics")}
          </>
        }
        title={t("watchlist.title")}
        description={t("watchlist.subtitle")}
        actions={
          <>
            {bazaar.demo ? <Badge variant="amber">{t("common.demo")}</Badge> : null}
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface/60 px-2.5 py-1.5">
              {settings.watchlistAlerts ? <Bell className="size-3.5 text-violet" /> : <BellOff className="size-3.5 text-fg-subtle" />}
              <span className="text-[10.5px] text-fg-muted">{t("settings.watchlistAlerts")}</span>
              <Switch checked={settings.watchlistAlerts} onCheckedChange={(checked) => updateSettings({ watchlistAlerts: checked })} />
            </div>
            <Button asChild size="sm" variant="secondary"><Link to="/flips?view=alerts"><Bell className="size-3.5"/>{t("market.alerts")}</Link></Button>
            <Button asChild size="sm">
              <Link to="/bazaar">
                <Star className="size-3.5" /> {t("watchlist.addFromBazaar")}
              </Link>
            </Button>
          </>
        }
      />

      {bazaar.envelope?.stale ? <StaleNote updatedAt={bazaar.envelope.updatedAt} /> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("dashboard.watchlist")} value={entries.length} hint={t("watchlist.itemsHint")} icon={Star} tone="violet" />
        <StatCard label={t("watchlist.targetReached")} value={reached} hint={t("watchlist.targetHint")} icon={Target} tone="green" />
        <StatCard
          label={t("dashboard.topOpportunity")}
          value={bazaar.summary.topGainer?.name ?? "—"}
          hint={bazaar.summary.topGainer ? formatPercent(bazaar.summary.topGainer.spreadPct) : undefined}
          icon={TrendingUp}
          tone="cyan"
        />
        <StatCard
          label={t("common.updated")}
          value={bazaar.envelope ? timeAgo(bazaar.envelope.updatedAt, language) : "—"}
          hint={bazaar.demo ? t("watchlist.demoNote") : t("common.hypixelApi")}
          icon={History}
          tone="neutral"
        />
      </div>

      {!entries.length ? (
        <section className="panel">
          <EmptyState
            icon={Star}
            title={t("watchlist.empty")}
            description={t("watchlist.emptyDesc")}
            action={
              <Button asChild size="sm">
                <Link to="/bazaar">
                  {t("watchlist.addFromBazaar")} <ChevronRight className="size-3.5" />
                </Link>
              </Button>
            }
          />
        </section>
      ) : bazaar.isPending ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {entries.map((entry) => (
            <Skeleton key={entry.productId} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : bazaar.error && !bazaar.quotes.length ? (
        <section className="panel">
          <ErrorState error={bazaar.error} onRetry={() => void bazaar.refresh()} title={t("bazaar.errorTitle")} />
        </section>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {entries.map((entry) => {
            const quote = quoteMap.get(entry.productId) ?? null;
            return (
              <WatchlistCard
                key={entry.productId}
                entry={entry}
                quote={quote}
                demo={bazaar.demo}
                onRemove={() => void removeEntry(entry)}
                onSetTarget={() => setTargetEntry(entry)}
                language={language}
              />
            );
          })}
        </div>
      )}

      {targetEntry ? (
        <TargetDialog
          entry={targetEntry}
          quote={quoteMap.get(targetEntry.productId) ?? null}
          open={Boolean(targetEntry)}
          onOpenChange={(open) => !open && setTargetEntry(null)}
        />
      ) : null}
    </div>
  );
}

function WatchlistCard({
  entry,
  quote,
  demo,
  onRemove,
  onSetTarget,
  language,
}: {
  entry: WatchlistEntry;
  quote: BazaarItemQuote | null;
  demo: boolean;
  onRemove: () => void;
  onSetTarget: () => void;
  language: "ru" | "en";
}) {
  const { t } = useI18n();
  const history = useMarketHistory(entry.productId, !demo);
  const hit = Boolean(quote && entry.targetPrice != null && quote.instantSell <= entry.targetPrice);
  const diff = quote && entry.targetPrice ? ((quote.instantSell - entry.targetPrice) / entry.targetPrice) * 100 : null;
  const historyData = (history.data ?? []).slice(-120);
  const points = historyData.length >= 2;

  return (
    <section className={cn("panel overflow-hidden", hit && "border-green/25")}>
      <div className="flex items-start gap-3 p-4">
        <ItemGlyph name={quote?.name ?? entry.productId} tier={quote?.tier} size="lg" itemId={entry.productId} category={quote?.category} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[13px] font-semibold text-fg">{quote?.name ?? entry.productId}</p>
            {quote ? <RarityBadge tier={quote.tier} /> : null}
            {hit ? <Badge variant="green">{t("watchlist.targetReached")}</Badge> : null}
            {demo ? <Badge variant="amber">{t("common.demo")}</Badge> : null}
          </div>
          <p className="mt-0.5 font-mono text-[9px] text-fg-subtle">{entry.productId} · {t("watchlist.added", { time: timeAgo(entry.addedAt, language) })}</p>
          {quote ? (
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label={t("watchlist.currentBuy")} value={formatPrice(quote.instantBuy)} />
              <Metric label={t("watchlist.currentSell")} value={formatPrice(quote.instantSell)} tone="green" />
              <Metric label={t("bazaar.spread")} value={formatPercent(quote.spreadPct)} tone="green" />
              <Metric label={t("bazaar.weeklyVolume")} value={formatCompact(Math.min(quote.buyOrderMovingWeek, quote.sellOfferMovingWeek))} />
            </div>
          ) : (
            <p className="mt-2 rounded-md border border-amber/20 bg-amber/[0.05] px-2 py-1 text-[10px] text-amber/90">{t("watchlist.itemUnavailable")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-red/10 hover:text-red"
          aria-label={t("common.remove")}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_1.2fr] gap-3 border-t border-line px-4 py-3">
        <div>
          <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.08em] text-fg-subtle">
            <Target className="size-3" /> {t("watchlist.target")}
          </p>
          <p className="mt-0.5 font-mono text-[13px] font-semibold text-fg">{entry.targetPrice != null ? formatPrice(entry.targetPrice) : t("watchlist.noTarget")}</p>
          {diff != null ? (
            <p className={cn("mt-0.5 flex items-center gap-1 text-[9.5px]", hit ? "text-green" : diff > 0 ? "text-amber" : "text-green")}>
              {diff > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {formatPercent(diff)}
            </p>
          ) : null}
          <Button size="sm" variant="ghost" className="mt-1 h-7 px-1.5" onClick={onSetTarget}>
            <Target className="size-3" /> {t("watchlist.setTarget")}
          </Button>
        </div>

        <div className="min-w-0">
          <p className="flex items-center justify-between text-[9px] uppercase tracking-[0.08em] text-fg-subtle">
            <span className="flex items-center gap-1"><History className="size-3" /> {t("watchlist.showHistory")}</span>
            {points ? <span className="normal-case tracking-normal">{historyData.length}</span> : null}
          </p>
          {points ? (
            <div className="mt-1 h-14 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id={`watch-${entry.productId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--green)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey={(point: MarketHistoryPoint) => point.sellPrice}
                    stroke="var(--green)"
                    strokeWidth={1.4}
                    fill={`url(#watch-${entry.productId})`}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-1 flex h-14 items-center rounded-lg border border-dashed border-line px-2 text-[9px] leading-relaxed text-fg-subtle">
              {demo ? t("bazaar.historyDemo") : t("bazaar.historyEmptyDesc")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "green" }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[8.5px] uppercase tracking-[0.07em] text-fg-subtle">{label}</p>
      <p className={cn("truncate font-mono text-[10.5px]", tone === "green" ? "text-green" : "text-fg-muted")}>{value}</p>
    </div>
  );
}

function TargetDialog({
  entry,
  quote,
  open,
  onOpenChange,
}: {
  entry: WatchlistEntry;
  quote: BazaarItemQuote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const setTarget = useWatchlistStore((state) => state.setTarget);
  const [value, setValue] = useState(entry.targetPrice != null ? String(entry.targetPrice) : "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parsed = value.trim() ? Number(value.replace(",", ".").replace(/\s/g, "")) : null;
    if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
      toast.error(t("calculators.invalidInput"));
      return;
    }
    setBusy(true);
    try {
      await setTarget(entry.productId, parsed);
      toast.success(t("watchlist.saved"));
      onOpenChange(false);
    } catch {
      toast.error(t("toasts.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("watchlist.setTarget")}</DialogTitle>
          <DialogDescription>{t("watchlist.setTargetDesc")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/30 px-3 py-2">
            <ItemGlyph name={quote?.name ?? entry.productId} tier={quote?.tier} size="sm" itemId={entry.productId} category={quote?.category} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] text-fg">{quote?.name ?? entry.productId}</p>
              <p className="font-mono text-[9.5px] text-fg-subtle">{t("watchlist.currentSell")}: {formatPrice(quote?.instantSell)}</p>
            </div>
          </div>
          <div>
            <Label htmlFor="target-price">{t("bazaar.targetPrice")}</Label>
            <Input id="target-price" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder={formatPrice(quote?.instantSell)} autoFocus />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={() => void save()} disabled={busy}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
