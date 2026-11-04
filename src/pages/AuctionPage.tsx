import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Gavel,
  Info,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
} from "lucide-react";
import { useI18n } from "@/locales";
import { useAuctions } from "@/hooks/useBazaar";
import { useNow } from "@/hooks/useEnvironment";
import {
  formatCoins,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatShortUuid,
  formatTime,
} from "@/utils/format";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, StaleNote } from "@/components/common/States";
import { RarityBadge } from "@/components/common/ItemVisuals";
import { ItemIcon } from "@/components/common/ItemIcon";
import { ItemSlot } from "@/components/common/ItemSlot";
import {
  ItemTooltip,
  type ItemTooltipData,
} from "@/components/common/ItemTooltip";
import { ItemDetails } from "@/components/common/ItemDetails";
import {
  useItemRegistryByName,
  useItemRegistryEntry,
  type ItemRegistryEntry,
} from "@/features/items/registry";
import {
  decodeAuctionVisual,
  type AuctionVisual,
} from "@/features/market/auction-visual";
import { CopyButton } from "@/components/common/CopyButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import type { HypixelAuction } from "@/types/hypixel";

type SortMode = "ending" | "priceAsc" | "priceDesc" | "newest";
type AuctionView = "table" | "grid";

export function AuctionPage() {
  const { t, language } = useI18n();
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get("page") ?? 0);
  const page = Number.isFinite(requestedPage)
    ? Math.min(10000, Math.max(0, Math.floor(requestedPage)))
    : 0;
  const [search, setSearch] = useState(params.get("q") ?? "");
  const urlSearch = params.get("q") ?? "";
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  const auctionType = params.get("type") ?? "all";
  const category = params.get("category") ?? "all";
  const rarity = params.get("rarity") ?? "all";
  const sort = (params.get("sort") ?? "ending") as SortMode;
  const updateFilter = (key: string, value: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      next.set("page", "0");
      return next;
    });
    setSelected(null);
  };
  const commitSearch = () => updateFilter("q", search.trim());
  useEffect(() => {
    if (search.trim() === (params.get("q") ?? "")) return;
    const timer = window.setTimeout(
      () => updateFilter("q", search.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search, params]);
  const numericFilter = (key: string) => {
    const raw = params.get(key);
    const n = Number(raw);
    return raw && Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const minPrice = numericFilter("min"),
    maxPrice = numericFilter("max");
  const invalidPrice =
    ["min", "max"].some(
      (key) =>
        Boolean(params.get(key)) &&
        (numericFilter(key) === undefined || (numericFilter(key) ?? 0) > 1e15),
    ) ||
    (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice);
  const auctionsQuery = useAuctions(
    page,
    {
      search: params.get("q") ?? "",
      auctionType:
        auctionType === "bin" || auctionType === "auction"
          ? auctionType
          : "all",
      category: category === "all" ? undefined : category,
      rarity: rarity === "all" ? undefined : rarity,
      minPrice,
      maxPrice,
      endingWithin: numericFilter("ends"),
      sort:
        (
          {
            ending: "ending_soon",
            priceAsc: "price_asc",
            priceDesc: "price_desc",
            newest: "newest",
          } as const
        )[sort] ?? "ending_soon",
    },
    !invalidPrice,
  );
  const now = useNow();
  const [jump, setJump] = useState("");
  const [selected, setSelected] = useState<HypixelAuction | null>(null);
  const view: AuctionView = params.get("view") === "grid" ? "grid" : "table";

  const setView = (next: AuctionView) => {
    const nextParams = new URLSearchParams(params);
    if (next === "table") nextParams.delete("view");
    else nextParams.set("view", "grid");
    setParams(nextParams);
  };

  const totalPages = auctionsQuery.envelope?.data.totalPages ?? 1;
  const totalAuctions = auctionsQuery.envelope?.data.totalAuctions ?? 0;
  useEffect(() => {
    if (auctionsQuery.envelope && !auctionsQuery.error && page >= totalPages) {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("page", String(Math.max(0, totalPages - 1)));
          return next;
        },
        { replace: true },
      );
    }
  }, [
    page,
    totalPages,
    auctionsQuery.envelope,
    auctionsQuery.error,
    setParams,
  ]);

  const categories = auctionsQuery.envelope?.data.categories ?? [
    "weapon",
    "armor",
    "accessories",
    "consumables",
    "blocks",
    "misc",
    "cosmetic",
    "dyes",
    "helmet_skins",
    "other_skins",
    "runes",
  ];
  // Backend returns an already filtered/sorted page. Direct/Demo are explicitly
  // limited previews: never claim their page-local matches cover the snapshot.
  const auctions = useMemo(() => {
    if (auctionsQuery.globalSearch) return auctionsQuery.auctions;
    return auctionsQuery.auctions.slice(0, 50);
  }, [auctionsQuery.auctions, auctionsQuery.globalSearch]);
  const searching = search.trim() !== (params.get("q") ?? "");
  const filtersDisabled = !auctionsQuery.globalSearch;
  const pageLabel = auctionsQuery.envelope
    ? `${t("common.page")} ${page + 1} / ${Math.max(1, totalPages)}`
    : auctionsQuery.error
      ? "—"
      : t("common.loading");
  const pagingDisabled = !auctionsQuery.envelope || searching || invalidPrice;
  const goToPage = (next: number) => {
    const clamped = Math.max(0, Math.min(Math.max(0, totalPages - 1), next));
    const nextParams = new URLSearchParams(params);
    nextParams.set("page", String(clamped));
    setParams(nextParams);
    setSelected(null);
  };

  useEffect(() => {
    setSelected(null);
  }, [page]);

  return (
    <div className="animate-[fade-up_260ms_ease-out]">
      <PageHeader
        eyebrow={
          <>
            <Gavel className="size-3" /> {t("nav.section.analytics")}
          </>
        }
        title={t("auction.title")}
        description={t("auction.subtitle")}
        actions={
          <>
            {auctionsQuery.demo ? (
              <Badge variant="amber">{t("common.demo")}</Badge>
            ) : null}
            <Badge variant="outline">{pageLabel}</Badge>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void auctionsQuery.refresh()}
              disabled={auctionsQuery.isFetching}
            >
              <RefreshCw
                className={cn(
                  "size-3.5",
                  auctionsQuery.isFetching && "animate-spin",
                )}
              />
              {t("auction.refresh")}
            </Button>
          </>
        }
      />

      {auctionsQuery.demo ? (
        <div className="mb-4 rounded-xl border border-amber/20 bg-amber/[0.05] px-4 py-2.5 text-[11.5px] text-amber/90">
          {t("auction.demoNote")}
        </div>
      ) : null}
      {!auctionsQuery.globalSearch && (
        <p role="status" className="mb-3 text-sm text-amber">
          {t("auction.backendRequired")}
        </p>
      )}
      {auctionsQuery.globalSearch &&
        auctionsQuery.envelope &&
        auctionsQuery.envelope.data.snapshotComplete !== true && (
          <p role="status" className="mb-3 text-sm text-amber">
            {t("auction.incomplete")}
          </p>
        )}
      {auctionsQuery.globalSearch &&
        auctionsQuery.envelope &&
        (auctionsQuery.envelope.data.identityIndexed ?? 0) < totalAuctions && (
          <p role="status" className="mb-3 text-sm text-amber">
            {t("auction.identityPartial")}
          </p>
        )}
      {auctionsQuery.envelope &&
      (auctionsQuery.envelope.stale ||
        now -
          (auctionsQuery.envelope.data.lastUpdated ??
            auctionsQuery.envelope.updatedAt) >
          90_000) ? (
        <div role="status">
          <p className="mb-1 text-xs text-amber">{t("auction.stale")}</p>
          <StaleNote updatedAt={auctionsQuery.envelope.updatedAt} />
        </div>
      ) : null}

      <section className="panel mb-4 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
            <Input
              value={search}
              maxLength={64}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("auction.searchGlobal")}
              disabled={filtersDisabled}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitSearch();
              }}
              className="h-11 pl-9 text-sm"
            />
          </div>
          {search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                updateFilter("q", "");
              }}
            >
              {t("auction.clear")}
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:w-auto">
            <Select
              value={category}
              onValueChange={(value) => updateFilter("category", value)}
              disabled={filtersDisabled}
            >
              <SelectTrigger className="min-w-[140px]">
                <SelectValue placeholder={t("auction.category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {categories.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sort}
              onValueChange={(value) => updateFilter("sort", value)}
              disabled={filtersDisabled}
            >
              <SelectTrigger className="min-w-[140px]">
                <ArrowDownUp className="size-3.5 text-fg-subtle" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ending">
                  {t("auction.sortEnding")}
                </SelectItem>
                <SelectItem value="priceAsc">
                  {t("auction.sortPriceAsc")}
                </SelectItem>
                <SelectItem value="newest">
                  {t("auction.sortNewest")}
                </SelectItem>
                <SelectItem value="priceDesc">
                  {t("auction.sortPriceDesc")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={auctionType}
              onValueChange={(value) => updateFilter("type", value)}
              disabled={filtersDisabled}
            >
              <SelectTrigger aria-label={t("auction.type")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="bin">BIN</SelectItem>
                <SelectItem value="auction">{t("auction.auction")}</SelectItem>
              </SelectContent>
            </Select>
            <div
              className="flex items-center gap-0.5 rounded-lg border border-line bg-surface-2/40 p-0.5"
              role="group"
              aria-label={t("auction.viewMode")}
            >
              <Button
                variant={view === "table" ? "default" : "ghost"}
                size="icon-sm"
                onClick={() => setView("table")}
                aria-label={t("auction.viewTable")}
                title={t("auction.viewTable")}
              >
                <List className="size-3.5" />
              </Button>
              <Button
                variant={view === "grid" ? "default" : "ghost"}
                size="icon-sm"
                onClick={() => setView("grid")}
                aria-label={t("auction.viewGrid")}
                title={t("auction.viewGrid")}
              >
                <LayoutGrid className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <details className="border-b border-line px-4 py-3">
          <summary className="cursor-pointer text-sm">
            {t("auction.advanced")}
          </summary>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="text-xs">
              {t("auction.tier")}
              <select
                aria-label={t("auction.tier")}
                disabled={filtersDisabled}
                value={rarity}
                onChange={(e) => updateFilter("rarity", e.target.value)}
                className="ml-2 rounded border border-line bg-bg px-2 py-1"
              >
                <option value="all">{t("common.all")}</option>
                {[
                  "COMMON",
                  "UNCOMMON",
                  "RARE",
                  "EPIC",
                  "LEGENDARY",
                  "MYTHIC",
                  "DIVINE",
                  "SPECIAL",
                  "VERY_SPECIAL",
                ].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <Input
              aria-label={t("auction.minPrice")}
              placeholder={t("auction.minPrice")}
              type="number"
              min="0"
              disabled={filtersDisabled}
              value={params.get("min") ?? ""}
              onChange={(e) => updateFilter("min", e.target.value)}
              className="w-40"
            />
            <Input
              aria-label={t("auction.maxPrice")}
              placeholder={t("auction.maxPrice")}
              type="number"
              min="0"
              disabled={filtersDisabled}
              value={params.get("max") ?? ""}
              onChange={(e) => updateFilter("max", e.target.value)}
              className="w-40"
            />
            <label className="text-xs">
              {t("auction.sortEnding")}
              <select
                aria-label={t("auction.endingWithin")}
                disabled={filtersDisabled}
                value={params.get("ends") ?? ""}
                onChange={(e) => updateFilter("ends", e.target.value)}
                className="ml-2 rounded border border-line bg-bg px-2 py-1"
              >
                <option value="">{t("common.all")}</option>
                <option value="300">5 min</option>
                <option value="3600">1 h</option>
                <option value="86400">24 h</option>
              </select>
            </label>
          </div>
        </details>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[10.5px] text-fg-subtle">
          <span className="flex items-center gap-1.5">
            <Filter className="size-3" />{" "}
            {auctionsQuery.error
              ? t("auction.loadError")
              : auctionsQuery.envelope && !searching && !invalidPrice
                ? auctionsQuery.globalSearch
                  ? t("auction.results", {
                      count: auctionsQuery.envelope.data.filteredTotal ?? 0,
                    })
                  : t("auction.loaded", { count: auctions.length })
                : "—"}
            {totalAuctions ? (
              <span className="text-fg-subtle/70">
                · {formatNumber(totalAuctions)}{" "}
                {t("auction.total").toLowerCase()}
              </span>
            ) : null}
          </span>
          <span className="font-mono">
            {auctionsQuery.envelope?.updatedAt
              ? formatTime(auctionsQuery.envelope.updatedAt, language)
              : "—"}
          </span>
        </div>
      </section>

      {invalidPrice ? (
        <section role="alert" className="panel p-4 text-amber">
          {t("auction.invalidPrice")}
        </section>
      ) : auctionsQuery.isPending || searching ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="panel p-4">
              <div className="flex gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="mt-4 h-8 w-full" />
            </div>
          ))}
        </div>
      ) : auctionsQuery.error ? (
        <section className="panel">
          <ErrorState
            error={auctionsQuery.error}
            onRetry={() => void auctionsQuery.refresh()}
            title={t("auction.loadError")}
          />
        </section>
      ) : !auctions.length ? (
        <section className="panel">
          <EmptyState
            icon={Gavel}
            title={t("auction.noResults")}
            description={t("auction.noResultsDesc")}
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setParams((previous) => {
                    const next = new URLSearchParams();
                    if (previous.get("view"))
                      next.set("view", previous.get("view")!);
                    return next;
                  });
                }}
              >
                {t("common.reset")}
              </Button>
            }
          />
        </section>
      ) : view === "table" ? (
        <AuctionTable auctions={auctions} now={now} onOpen={setSelected} />
      ) : (
        <>
          <p className="mb-2 text-[10px] text-fg-subtle">
            {t("auction.gridHint")}
          </p>
          <AuctionGrid auctions={auctions} now={now} onOpen={setSelected} />
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/40 px-4 py-3">
        <span className="text-[10.5px] text-fg-subtle">{pageLabel}</span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="icon-sm"
            disabled={pagingDisabled || page <= 0}
            onClick={() => goToPage(0)}
            aria-label={t("auction.firstPage")}
          >
            <ChevronsLeft className="size-3.5" />
          </Button>
          <Button
            variant="secondary"
            size="icon-sm"
            disabled={pagingDisabled || page <= 0}
            onClick={() => goToPage(page - 1)}
            aria-label={t("common.prev")}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <div className="flex items-center gap-1">
            <Input
              value={jump}
              onChange={(event) =>
                setJump(event.target.value.replace(/\D/g, ""))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && jump) {
                  goToPage(Number(jump) - 1);
                  setJump("");
                }
              }}
              placeholder={String(page + 1)}
              className="h-8 w-14 text-center font-mono text-[11px]"
              inputMode="numeric"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={pagingDisabled || !jump}
              onClick={() => {
                goToPage(Number(jump) - 1);
                setJump("");
              }}
            >
              {t("auction.jump")}
            </Button>
          </div>
          <Button
            variant="secondary"
            size="icon-sm"
            disabled={pagingDisabled || page >= totalPages - 1}
            onClick={() => goToPage(page + 1)}
            aria-label={t("common.next")}
          >
            <ChevronRight className="size-3.5" />
          </Button>
          <Button
            variant="secondary"
            size="icon-sm"
            disabled={pagingDisabled || page >= totalPages - 1}
            onClick={() => goToPage(totalPages - 1)}
            aria-label={t("auction.lastPage")}
          >
            <ChevronsRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface/40 px-4 py-3 text-[10.5px] leading-relaxed text-fg-subtle">
        <Info className="mt-0.5 size-3.5 shrink-0 text-amber" />
        <span>
          <b className="text-fg-muted">
            {t(
              auctionsQuery.globalSearch
                ? "auction.snapshotScope"
                : "auction.limitationTitle",
            )}
            .
          </b>{" "}
          {t(
            auctionsQuery.globalSearch
              ? "auction.globalNote"
              : "auction.limitation",
          )}
        </span>
      </div>

      {selected ? (
        <AuctionDialog
          auction={selected}
          open={Boolean(selected)}
          onOpenChange={(open) => !open && setSelected(null)}
          now={now}
        />
      ) : null}
    </div>
  );
}

function priceOf(auction: HypixelAuction): number {
  return Math.max(auction.starting_bid ?? 0, auction.highest_bid_amount ?? 0);
}

function auctionItemData(
  auction: HypixelAuction,
  registry: ItemRegistryEntry | null | undefined,
  visual: AuctionVisual | null = null,
): ItemTooltipData {
  const lore = auction.item_lore
    ? auction.item_lore
        .split("\n")
        .map((line) => line.trimEnd())
        .filter(Boolean)
    : [];
  return {
    itemId: visual?.itemId ?? registry?.id,
    name: auction.item_name ?? auction.uuid,
    rarity: auction.tier ?? registry?.tier,
    category: auction.category ?? registry?.category,
    material: visual?.material ?? registry?.material,
    skullTexture: visual?.skullTexture,
    lore,
    count: 1,
    value: priceOf(auction),
    valueMethod: auction.bin ? "auction_bin" : "auction_bid",
    location: auction.uuid,
  };
}

/**
 * Resolve an auction through its NBT first, then the display-name registry.
 * The NBT id survives reforge/level prefixes and carries custom-head skins.
 */
function useAuctionItemData(auction: HypixelAuction): ItemTooltipData {
  const byName = useItemRegistryByName(auction.item_name);
  const [decoded, setDecoded] = useState<{
    auction: HypixelAuction;
    visual: AuctionVisual;
  } | null>(null);
  const visual = decoded?.auction === auction ? decoded.visual : null;
  useEffect(() => {
    let active = true;
    void decodeAuctionVisual(auction).then((value) => {
      if (active) setDecoded({ auction, visual: value });
    });
    return () => {
      active = false;
    };
  }, [auction]);
  const byId = useItemRegistryEntry(visual?.itemId ?? null);
  return useMemo(
    () => auctionItemData(auction, visual?.itemId ? byId : byName, visual),
    [auction, byId, byName, visual],
  );
}

function AuctionTable({
  auctions,
  now,
  onOpen,
}: {
  auctions: HypixelAuction[];
  now: number;
  onOpen: (auction: HypixelAuction) => void;
}) {
  const { t } = useI18n();
  const headers = [
    t("auction.colItem"),
    t("auction.colType"),
    t("auction.colPrice"),
    t("auction.colEnds"),
    t("auction.colSeller"),
    t("auction.colBids"),
  ];
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-2/30 text-[8.5px] uppercase tracking-[0.08em] text-fg-subtle">
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {auctions.map((auction) => (
              <AuctionRow
                key={auction.uuid}
                auction={auction}
                now={now}
                onOpen={() => onOpen(auction)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuctionRow({
  auction,
  now,
  onOpen,
}: {
  auction: HypixelAuction;
  now: number;
  onOpen: () => void;
}) {
  const { t, language } = useI18n();
  const data = useAuctionItemData(auction);
  const endsIn = ((auction.end ?? now) - now) / 1000;
  const bidCount = auction.bids?.length ?? 0;

  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-line/50 transition-colors last:border-0 hover:bg-surface-2/40"
    >
      <td className="px-3 py-2">
        <ItemTooltip item={data}>
          <span className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-violet">
            <ItemIcon
              itemId={data.itemId}
              material={data.material}
              category={data.category}
              name={data.name}
              rarity={data.rarity}
              size="sm"
              skullTexture={data.skullTexture}
            />
            <span className="min-w-0">
              <span className="block max-w-[280px] truncate text-[11.5px] font-medium text-fg">
                {data.name}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5">
                <RarityBadge tier={data.rarity} />
                {auction.category ? (
                  <span className="text-[9px] text-fg-subtle">
                    {auction.category}
                  </span>
                ) : null}
              </span>
            </span>
          </span>
        </ItemTooltip>
      </td>
      <td className="px-3 py-2">
        {auction.bin ? (
          <Badge variant="violet">{t("auction.bin")}</Badge>
        ) : (
          <Badge variant="outline">{t("auction.auction")}</Badge>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] font-semibold text-amber">
        {formatCoins(priceOf(auction), language)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-[10.5px] text-fg-muted">
        {endsIn > 0 ? formatDuration(endsIn) : t("auction.ended")}
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] text-fg-subtle">
        {auction.auctioneer ? formatShortUuid(auction.auctioneer) : "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-[10.5px] text-fg-muted">
        {bidCount}
      </td>
    </tr>
  );
}

function AuctionGrid({
  auctions,
  now,
  onOpen,
}: {
  auctions: HypixelAuction[];
  now: number;
  onOpen: (auction: HypixelAuction) => void;
}) {
  return (
    <div className="panel p-3">
      <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(56px,1fr))]">
        {auctions.map((auction) => (
          <AuctionTile
            key={auction.uuid}
            auction={auction}
            now={now}
            onOpen={() => onOpen(auction)}
          />
        ))}
      </div>
    </div>
  );
}

function AuctionTile({
  auction,
  now,
  onOpen,
}: {
  auction: HypixelAuction;
  now: number;
  onOpen: () => void;
}) {
  const { language } = useI18n();
  const data = useAuctionItemData(auction);
  const endsIn = ((auction.end ?? now) - now) / 1000;

  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <div className="relative w-full">
        <ItemSlot item={data} size="sm" onClick={onOpen} />
        <span
          className={cn(
            "pointer-events-none absolute -right-0.5 -top-0.5 rounded-[2px] px-1 text-[7px] font-bold uppercase leading-[11px] tracking-[0.04em] text-white",
            auction.bin ? "bg-violet/90" : "bg-black/70 text-slate-200",
          )}
        >
          {auction.bin ? "BIN" : "AUC"}
        </span>
        {endsIn > 0 && endsIn < 3600 ? (
          <span className="pointer-events-none absolute -bottom-0.5 -left-0.5 rounded-[2px] bg-black/70 px-1 text-[7px] font-semibold leading-[11px] text-amber">
            ⏱
          </span>
        ) : null}
      </div>
      <span className="w-full truncate text-center font-mono text-[8px] text-amber/90">
        {formatCoins(priceOf(auction), language)}
      </span>
    </div>
  );
}

export function AuctionDialog({
  auction,
  open,
  onOpenChange,
  now,
  additionalContent,
  marketEstimate,
}: {
  additionalContent?: ReactNode;
  marketEstimate?: number | null;
  auction: HypixelAuction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  now: number;
}) {
  const { t, language } = useI18n();
  const data = useAuctionItemData(auction);
  const endsIn = ((auction.end ?? now) - now) / 1000;
  const bids = [...(auction.bids ?? [])].sort(
    (a, b) => (b.amount ?? 0) - (a.amount ?? 0),
  );

  return (
    <ItemDetails
      item={
        marketEstimate !== undefined
          ? {
              ...data,
              value: marketEstimate,
              valueMethod: t("auctionSmart.listingEstimate"),
            }
          : data
      }
      open={open}
      onOpenChange={onOpenChange}
      footer={
        <div className="w-full space-y-3">
          {additionalContent}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <DetailMetric
              label={t("auction.startingBid")}
              value={formatCoins(auction.starting_bid, language)}
            />
            <DetailMetric
              label={t("auction.highestBid")}
              value={formatCoins(
                auction.highest_bid_amount || auction.starting_bid,
                language,
              )}
            />
            <DetailMetric
              label={t("auction.bids")}
              value={String(bids.length)}
            />
            <DetailMetric
              label={t("auction.endsIn")}
              value={endsIn > 0 ? formatDuration(endsIn) : t("auction.ended")}
            />
          </div>

          {bids.length ? (
            <div className="rounded-lg border border-line bg-surface-2/25 p-2.5">
              <p className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-fg">
                {t("auction.bids")}
                <span className="font-mono text-[9px] text-fg-subtle">
                  {bids.length}
                </span>
              </p>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {bids.slice(0, 8).map((bid, index) => (
                  <div
                    key={`${bid.bidder}-${index}`}
                    className="flex items-center justify-between rounded bg-surface-2/50 px-2 py-1 font-mono text-[10px]"
                  >
                    <span className="flex items-center gap-1.5 text-fg-muted">
                      <span className="text-fg-subtle">#{index + 1}</span>
                      {bid.bidder ? formatShortUuid(bid.bidder) : "—"}
                    </span>
                    <span className="text-amber">
                      {formatCoins(bid.amount, language)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-fg-subtle">
            <span className="flex items-center gap-1">
              {t("auction.seller")}:{" "}
              <span className="font-mono text-fg-muted">
                {auction.auctioneer ? formatShortUuid(auction.auctioneer) : "—"}
              </span>
              {auction.auctioneer ? (
                <CopyButton value={auction.auctioneer} className="size-5" />
              ) : null}
            </span>
            <span>
              {t("auction.endsIn")}:{" "}
              {auction.end ? formatDateTime(auction.end, language) : "—"}
            </span>
          </div>
        </div>
      }
    />
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg-elevated/50 px-3 py-2">
      <p className="text-[8.5px] uppercase tracking-[0.08em] text-fg-subtle">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-[12.5px] font-semibold text-fg">
        {value}
      </p>
    </div>
  );
}
