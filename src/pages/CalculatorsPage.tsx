import { TradingScenarios } from "@/components/common/TradingScenarios";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Calculator,
  Check,
  Hammer,
  Info,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  Target,
  TrendingUp,
} from "lucide-react";
import { UpgradeCalculator } from "@/components/calculators/UpgradeCalculator";
import { useI18n } from "@/locales";
import { useBazaar } from "@/hooks/useBazaar";
import { useConnectedProfile } from "@/hooks/usePlayer";
import { useSettingsStore } from "@/stores/settings";
import { calculateFlip } from "@/features/bazaar/calculations";
import { formatCoins, formatCompact, formatPercent, formatPrice } from "@/utils/format";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, StaleNote } from "@/components/common/States";
import { ItemGlyph, RarityBadge } from "@/components/common/ItemVisuals";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import type { BazaarItemQuote } from "@/types/bazaar";

function parseNumber(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CalculatorsPage() {
  const { t } = useI18n();
  const bazaar = useBazaar();
  const settings = useSettingsStore((state) => state.settings);
  const [params, setParams] = useSearchParams();
  const initialItem = params.get("item");
  const requestedTab = params.get("tab");
  const [tab, setTab] = useState(
    requestedTab === "scenarios" || requestedTab === "upgrade"
      ? requestedTab
      : "flip",
  );

  const selected = bazaar.quotes.find((quote) => quote.productId === initialItem) ?? null;
  const selectItem = (quote: BazaarItemQuote) => {
    const next = new URLSearchParams(params);
    next.set("item", quote.productId);
    setParams(next, { replace: true });
  };

  return (
    <div className="animate-[fade-up_260ms_ease-out]">
      <PageHeader
        eyebrow={
          <>
            <Calculator className="size-3" /> {t("nav.section.tools")}
          </>
        }
        title={t("calculators.title")}
        description={t("calculators.subtitle")}
        actions={
          <>
            {bazaar.demo ? <Badge variant="amber">{t("common.demo")}</Badge> : null}
            <Button size="sm" variant="secondary" onClick={() => void bazaar.refresh()} disabled={bazaar.isFetching}>
              <RefreshCw className={cn("size-3.5", bazaar.isFetching && "animate-spin")} />
              {t("common.refresh")}
            </Button>
          </>
        }
      />

      {bazaar.envelope?.stale ? <StaleNote updatedAt={bazaar.envelope.updatedAt} /> : null}

      {bazaar.error && !bazaar.quotes.length ? (
        <section className="panel mb-4">
          <ErrorState error={bazaar.error} onRetry={() => void bazaar.refresh()} title={t("calculators.noBazaar")} compact />
        </section>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="flip">
              <TrendingUp className="size-3.5" /> {t("calculators.tabs.flip")}
            </TabsTrigger>
            <TabsTrigger value="goal">
              <Target className="size-3.5" /> {t("calculators.tabs.goal")}
            </TabsTrigger>
            <TabsTrigger value="batch">
              <Package className="size-3.5" /> {t("calculators.tabs.batch")}
            </TabsTrigger>
            <TabsTrigger value="upgrade">
              <Hammer className="size-3.5" /> {t("calculators.tabs.upgrade")}
            </TabsTrigger>
            <TabsTrigger value="scenarios">{t("market.calculator")}</TabsTrigger>
          </TabsList>
          <span className="text-[10px] text-fg-subtle">{t("calculators.settingsNote")}</span>
        </div>

        {bazaar.isPending ? (
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        ) : (
          <>
            <TabsContent value="flip" className="focus:outline-none">
              <FlipCalculator quotes={bazaar.quotes} selected={selected} onSelect={selectItem} feeDefault={settings.bazaarFeePct} demo={bazaar.demo} />
            </TabsContent>
            <TabsContent value="goal" className="focus:outline-none">
              <GoalCalculator />
            </TabsContent>
            <TabsContent value="batch" className="focus:outline-none">
              <BatchCalculator quotes={bazaar.quotes} selected={selected} onSelect={selectItem} feeDefault={settings.bazaarFeePct} />
            </TabsContent>
          </>
        )}
        <TabsContent value="upgrade" className="focus:outline-none">
          <UpgradeCalculator />
        </TabsContent>
        <TabsContent value="scenarios"><TradingScenarios product={selected ? bazaar.envelope?.data.products?.[selected.productId] : undefined}/></TabsContent>
      </Tabs>

      <div className="mt-5 rounded-xl border border-line bg-surface/40 px-4 py-3 text-[10.5px] leading-relaxed text-fg-subtle">
        <span className="flex items-start gap-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-violet" />
          <span>{t("calculators.disclaimer")} {t("bazaar.disclaimer")}</span>
        </span>
      </div>
    </div>
  );
}

function FlipCalculator({
  quotes,
  selected,
  onSelect,
  feeDefault,
  demo,
}: {
  quotes: BazaarItemQuote[];
  selected: BazaarItemQuote | null;
  onSelect: (quote: BazaarItemQuote) => void;
  feeDefault: number;
  demo: boolean;
}) {
  const { t } = useI18n();
  const [budget, setBudget] = useState("10000000");
  const [undercut, setUndercut] = useState("1");
  const [fill, setFill] = useState("10");
  const [fee, setFee] = useState(String(feeDefault));

  useEffect(() => {
    setFee(String(feeDefault));
  }, [feeDefault]);

  const result = selected
    ? calculateFlip({
        instantBuy: selected.instantBuy,
        instantSell: selected.instantSell,
        feePct: parseNumber(fee),
        undercutPct: parseNumber(undercut),
        budget: parseNumber(budget),
        dailyFillPct: parseNumber(fill),
        buyMovingWeek: selected.buyOrderMovingWeek,
        sellMovingWeek: selected.sellOfferMovingWeek,
      })
    : null;

  const reset = () => {
    setBudget("10000000");
    setUndercut("1");
    setFill("10");
    setFee(String(feeDefault));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <section className="panel p-5">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">{t("calculators.flip.title")}</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{t("calculators.flip.desc")}</p>
        {demo ? <p className="mt-2 rounded-md border border-amber/20 bg-amber/[0.05] px-2 py-1 text-[9.5px] text-amber/90">{t("bazaar.demoNote")}</p> : null}

        <div className="mt-4 space-y-3">
          <div>
            <Label>{t("calculators.selectItem")}</Label>
            <ItemPicker quotes={quotes} selected={selected} onSelect={onSelect} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="flip-budget">{t("calculators.budget")}</Label>
              <Input id="flip-budget" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="flip-undercut">{t("calculators.undercut")}</Label>
              <Input id="flip-undercut" inputMode="decimal" value={undercut} onChange={(event) => setUndercut(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="flip-fill">{t("calculators.fillRate")}</Label>
              <Input id="flip-fill" inputMode="decimal" value={fill} onChange={(event) => setFill(event.target.value)} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="flip-fee">{t("calculators.fee")}</Label>
              <Input id="flip-fee" inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} />
              <FieldHint>{t("bazaar.feeNote", { fee: parseNumber(fee) })}</FieldHint>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={reset}>
              <RotateCcw className="size-3.5" /> {t("calculators.reset")}
            </Button>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        {!selected ? (
          <EmptyState icon={Search} title={t("calculators.selectPrompt")} description={t("calculators.selectItem")} />
        ) : result ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex items-center gap-3">
                <ItemGlyph name={selected.name} tier={selected.tier} itemId={selected.productId} category={selected.category} />
                <div>
                  <p className="text-[13px] font-semibold text-fg">{selected.name}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <RarityBadge tier={selected.tier} />
                    <span className="font-mono text-[9px] text-fg-subtle">{selected.productId}</span>
                  </div>
                </div>
              </div>
              <Badge variant={result.profitable ? "green" : "red"}>
                {result.profitable ? t("calculators.netProfit") : t("calculators.notProfitable")}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2.5 p-5 sm:grid-cols-3">
              <ResultTile label={t("calculators.entry")} value={formatPrice(result.entryPrice)} />
              <ResultTile label={t("calculators.exit")} value={formatPrice(result.exitPrice)} />
              <ResultTile label={t("calculators.netPerUnit")} value={formatPrice(result.netPerUnit)} tone={result.netPerUnit > 0 ? "green" : "red"} />
              <ResultTile label={t("calculators.margin")} value={formatPercent(result.marginPct)} tone={result.marginPct > 0 ? "green" : "red"} />
              <ResultTile label={t("calculators.units")} value={formatCompact(result.units)} />
              <ResultTile label={t("calculators.capital")} value={formatCoins(result.capitalUsed)} />
            </div>

            <div className="mx-5 mb-5 rounded-xl border border-line bg-gradient-to-br from-violet/10 via-surface-2/30 to-transparent p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[9.5px] uppercase tracking-[0.1em] text-fg-subtle">{t("calculators.netProfit")}</p>
                  <p className={cn("mt-1 font-mono text-[26px] font-semibold tracking-[-0.03em]", result.netProfit > 0 ? "text-green" : "text-red")}>
                    {formatCoins(result.netProfit)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-fg-subtle">{t("common.estimated")} · {t("common.perUnit")}: {formatPrice(result.netPerUnit)}</p>
                </div>
                <div className="text-right text-[10px] text-fg-subtle">
                  <p>{t("calculators.dailyVolume")}: <b className="font-mono text-fg-muted">{formatCompact(result.dailyVolumeUnits)}</b></p>
                  <p className="mt-1">{t("calculators.units")}: {result.units} / {result.unitsByBudget}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 px-5 pb-5 text-[10.5px] leading-relaxed">
              {!result.profitable ? (
                <p className="flex items-start gap-2 rounded-lg border border-red/20 bg-red/[0.04] px-3 py-2 text-red/90">
                  <Info className="mt-0.5 size-3.5 shrink-0" /> {t("calculators.notProfitable")}
                </p>
              ) : null}
              <p className="flex items-start gap-2 rounded-lg border border-line bg-bg-elevated/50 px-3 py-2 text-fg-subtle">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                {t("calculators.instantLoss", { value: formatPrice(result.instantRoundTrip) })}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Mini label={t("bazaar.instantBuy")} value={formatPrice(selected.instantBuy)} />
                <Mini label={t("bazaar.instantSell")} value={formatPrice(selected.instantSell)} />
                <Mini label={t("bazaar.spread")} value={formatPrice(selected.spread)} />
                <Mini label={t("bazaar.weeklyVolume")} value={formatCompact(Math.min(selected.buyOrderMovingWeek, selected.sellOfferMovingWeek))} />
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function GoalCalculator() {
  const { t, language } = useI18n();
  const profile = useConnectedProfile();
  const [target, setTarget] = useState("1000000000");
  const [current, setCurrent] = useState("0");
  const [profit, setProfit] = useState("2500000");
  const [cycles, setCycles] = useState("4");

  const targetValue = parseNumber(target);
  const currentValue = parseNumber(current);
  const profitValue = parseNumber(profit);
  const cyclesValue = parseNumber(cycles);
  const remaining = Math.max(0, targetValue - currentValue);
  const perDay = profitValue * cyclesValue;
  const days = perDay > 0 ? Math.ceil(remaining / perDay) : null;
  const weeks = days != null ? days / 7 : null;
  const reached = targetValue > 0 && currentValue >= targetValue;
  const purse = profile.profile?.member?.purse;

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <section className="panel p-5">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">{t("calculators.goal.title")}</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{t("calculators.goal.desc")}</p>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="goal-target">{t("calculators.targetCoins")}</Label>
            <Input id="goal-target" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="goal-current">{t("calculators.currentCoins")}</Label>
            <Input id="goal-current" inputMode="decimal" value={current} onChange={(event) => setCurrent(event.target.value)} />
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <FieldHint>{t("calculators.useProfilePurse")}: {purse != null ? formatCoins(purse, language) : t("calculators.noProfile")}</FieldHint>
              <Button size="sm" variant="ghost" disabled={purse == null} onClick={() => purse != null && setCurrent(String(Math.floor(purse)))}>
                {t("calculators.useProfilePurse")}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="goal-profit">{t("calculators.profitPerCycle")}</Label>
              <Input id="goal-profit" inputMode="decimal" value={profit} onChange={(event) => setProfit(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="goal-cycles">{t("calculators.cyclesPerDay")}</Label>
              <Input id="goal-cycles" inputMode="decimal" value={cycles} onChange={(event) => setCycles(event.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setTarget("1000000000");
                setCurrent(purse != null ? String(Math.floor(purse)) : "0");
                setProfit("2500000");
                setCycles("4");
              }}
            >
              <RotateCcw className="size-3.5" /> {t("calculators.reset")}
            </Button>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        {reached ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-green/25 bg-green/10 text-green">
              <Check className="size-6" />
            </div>
            <p className="mt-3 text-[15px] font-semibold text-green">{t("calculators.goalReached")}</p>
            <p className="mt-1 text-[11px] text-fg-subtle">{formatCoins(currentValue, language)} / {formatCoins(targetValue, language)}</p>
          </div>
        ) : days == null ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
            <Info className="size-6 text-amber" />
            <p className="mt-2 text-[13px] font-medium text-fg">{t("calculators.invalidInput")}</p>
            <p className="mt-1 text-[11px] text-fg-subtle">{t("calculators.goal.desc")}</p>
          </div>
        ) : (
          <div className="flex h-full flex-col justify-center">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-violet/25 bg-violet-soft p-5">
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-fg-subtle">{t("calculators.daysNeeded")}</p>
                <p className="mt-1 font-mono text-[34px] font-semibold leading-none tracking-[-0.04em] text-violet">{days.toLocaleString(language === "ru" ? "ru-RU" : "en-US")}</p>
              </div>
              <div className="rounded-2xl border border-line bg-surface-2/40 p-5">
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-fg-subtle">{t("calculators.weeksNeeded")}</p>
                <p className="mt-1 font-mono text-[34px] font-semibold leading-none tracking-[-0.04em] text-fg">{weeks != null ? (Math.round(weeks * 10) / 10).toLocaleString(language === "ru" ? "ru-RU" : "en-US") : "—"}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 rounded-xl border border-line bg-bg-elevated/50 p-4 text-[11px] text-fg-muted">
              <Row label={t("calculators.targetCoins")} value={formatCoins(targetValue, language)} />
              <Row label={t("calculators.currentCoins")} value={formatCoins(currentValue, language)} />
              <Row label={t("calculators.profitPerHour")} value={formatCoins(perDay / 24, language)} />
              <Row label={t("calculators.profitPerCycle") + ` × ${cyclesValue}`} value={`${formatCoins(perDay, language)} / ${language === "ru" ? "день" : "day"}`} />
              <div className="h-px bg-line" />
              <Row label={t("common.total")} value={formatCoins(remaining, language)} strong />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function BatchCalculator({
  quotes,
  selected,
  onSelect,
  feeDefault,
}: {
  quotes: BazaarItemQuote[];
  selected: BazaarItemQuote | null;
  onSelect: (quote: BazaarItemQuote) => void;
  feeDefault: number;
}) {
  const { t } = useI18n();
  const [quantity, setQuantity] = useState("640");
  const [fee, setFee] = useState(String(feeDefault));

  const qty = Math.max(0, Math.floor(parseNumber(quantity)));
  const feePct = parseNumber(fee);
  const cost = selected ? selected.instantBuy * qty : 0;
  const revenue = selected ? selected.instantSell * qty : 0;
  const net = revenue * (1 - feePct / 100);
  const breakEven = selected ? selected.instantBuy / Math.max(0.0001, 1 - feePct / 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <section className="panel p-5">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">{t("calculators.batch.title")}</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{t("calculators.batch.desc")}</p>
        <div className="mt-4 space-y-3">
          <div>
            <Label>{t("calculators.selectItem")}</Label>
            <ItemPicker quotes={quotes} selected={selected} onSelect={onSelect} />
          </div>
          <div>
            <Label htmlFor="batch-qty">{t("calculators.quantity")}</Label>
            <Input id="batch-qty" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="batch-fee">{t("calculators.fee")}</Label>
            <Input id="batch-fee" inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} />
          </div>
          <Button variant="secondary" size="sm" onClick={() => { setQuantity("640"); setFee(String(feeDefault)); }}>
            <RotateCcw className="size-3.5" /> {t("calculators.reset")}
          </Button>
        </div>
      </section>

      <section className="panel p-5">
        {!selected ? (
          <EmptyState icon={Package} title={t("calculators.selectPrompt")} description={t("calculators.selectItem")} />
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <ItemGlyph name={selected.name} tier={selected.tier} itemId={selected.productId} category={selected.category} />
              <div>
                <p className="text-[13px] font-semibold text-fg">{selected.name}</p>
                <p className="font-mono text-[9px] text-fg-subtle">{selected.productId} · {qty} {t("calculators.units").toLowerCase()}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ResultTile label={t("calculators.totalCost")} value={formatCoins(cost)} tone="violet" />
              <ResultTile label={t("calculators.totalRevenue")} value={formatCoins(revenue)} />
              <ResultTile label={t("calculators.netAfterFee")} value={formatCoins(net)} tone={net >= cost ? "green" : "red"} />
            </div>
            <div className="mt-4 grid gap-2 rounded-xl border border-line bg-bg-elevated/50 p-4 text-[11px] text-fg-muted">
              <Row label={t("bazaar.instantBuy")} value={formatPrice(selected.instantBuy)} />
              <Row label={t("bazaar.instantSell")} value={formatPrice(selected.instantSell)} />
              <Row label={t("calculators.breakEven")} value={formatPrice(breakEven)} />
              <Row label={t("bazaar.weeklyVolume")} value={formatCompact(Math.min(selected.buyOrderMovingWeek, selected.sellOfferMovingWeek))} />
              <div className="h-px bg-line" />
              <Row label={t("calculators.margin")} value={formatPercent(cost > 0 ? ((net - cost) / cost) * 100 : 0)} strong />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ItemPicker({ quotes, selected, onSelect }: { quotes: BazaarItemQuote[]; selected: BazaarItemQuote | null; onSelect: (quote: BazaarItemQuote) => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const list = search
      ? quotes.filter((quote) => quote.name.toLowerCase().includes(search) || quote.productId.toLowerCase().includes(search))
      : [...quotes].sort((a, b) => b.spreadPct - a.spreadPct);
    return list.slice(0, 40);
  }, [quotes, query]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder={selected ? selected.name : t("bazaar.searchPlaceholder")}
          className="pl-8"
        />
      </div>
      {selected ? (
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-surface-2/40 px-2 py-1.5">
          <ItemGlyph name={selected.name} tier={selected.tier} size="sm" itemId={selected.productId} category={selected.category} />
          <span className="min-w-0 flex-1 truncate text-[10.5px] text-fg">{selected.name}</span>
          <span className="font-mono text-[9px] text-fg-subtle">{formatPrice(selected.instantSell)}</span>
        </div>
      ) : null}
      {open ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line-strong bg-surface-2 p-1 shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
          {filtered.length ? (
            filtered.map((quote) => (
              <button
                key={quote.productId}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(quote);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-3"
              >
                <ItemGlyph name={quote.name} tier={quote.tier} size="sm" itemId={quote.productId} category={quote.category} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-fg">{quote.name}</span>
                  <span className="block font-mono text-[8.5px] text-fg-subtle">{quote.productId}</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-[10px] text-fg-muted">{formatPrice(quote.instantSell)}</span>
                  <span className="block font-mono text-[8.5px] text-green">{formatPercent(quote.spreadPct)}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-5 text-center text-[10.5px] text-fg-subtle">{t("bazaar.noResults")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ResultTile({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" | "violet" }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/30 px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-[0.08em] text-fg-subtle">{label}</p>
      <p className={cn("mt-1 truncate font-mono text-[15px] font-semibold", tone === "green" ? "text-green" : tone === "red" ? "text-red" : tone === "violet" ? "text-violet" : "text-fg")}>
        {value}
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-surface-2/25 px-2 py-1.5">
      <p className="truncate text-[8.5px] text-fg-subtle">{label}</p>
      <p className="font-mono text-[10px] text-fg-muted">{value}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("text-fg-subtle", strong && "font-medium text-fg-muted")}>{label}</span>
      <span className={cn("font-mono", strong ? "text-[12px] font-semibold text-fg" : "text-fg-muted")}>{value}</span>
    </div>
  );
}
