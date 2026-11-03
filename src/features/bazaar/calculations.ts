import type { BazaarProduct } from "@/types/hypixel";
import type { BazaarItemQuote, FlipScenarioInput, FlipScenarioResult } from "@/types/bazaar";
import { prettifyItemId } from "@/utils/item-name";

export interface ItemMeta {
  name?: string;
  tier?: string;
  category?: string;
  npcSellPrice?: number;
}

export function toBazaarQuote(product: BazaarProduct, meta: ItemMeta | undefined, lastUpdated: number): BazaarItemQuote | null {
  const quick = product.quick_status;
  if (!quick) return null;
  if (!Number.isFinite(quick.buyPrice) || !Number.isFinite(quick.sellPrice)) return null;

  const instantBuy = quick.buyPrice;
  const instantSell = quick.sellPrice;
  const spread = instantBuy - instantSell;
  const spreadPct = instantSell > 0 ? (spread / instantSell) * 100 : 0;

  return {
    productId: product.product_id,
    name: meta?.name ?? prettifyItemId(product.product_id),
    tier: meta?.tier ?? null,
    category: meta?.category ?? null,
    npcSellPrice: meta?.npcSellPrice ?? null,
    instantBuy,
    instantSell,
    spread,
    spreadPct,
    sellOfferVolume: quick.buyVolume ?? 0,
    buyOrderVolume: quick.sellVolume ?? 0,
    sellOfferMovingWeek: quick.buyMovingWeek ?? 0,
    buyOrderMovingWeek: quick.sellMovingWeek ?? 0,
    sellOrders: quick.buyOrders ?? 0,
    buyOrders: quick.sellOrders ?? 0,
    buyOrdersTop: (product.sell_summary ?? []).slice(0, 10).map((order) => ({
      pricePerUnit: order.pricePerUnit,
      amount: order.amount,
      orders: order.orders,
    })),
    sellOrdersTop: (product.buy_summary ?? []).slice(0, 10).map((order) => ({
      pricePerUnit: order.pricePerUnit,
      amount: order.amount,
      orders: order.orders,
    })),
    lastUpdated,
  };
}

/**
 * Calculates an order-to-order Bazaar flip.
 *
 * Terminology (important):
 * - instantBuy: what you pay to fill a sell offer immediately.
 * - instantSell: what you receive when selling into a buy order immediately.
 * - Order-to-order flip: place a buy order slightly above the top buy order,
 *   then place a sell offer slightly below the lowest sell offer. Both orders
 *   may not fill; the spread is therefore an *upper bound*, not a guarantee.
 * - Bazaar tax is deducted from the sell side only (1.25% base at the time of
 *   writing, configurable in Settings).
 */
export function calculateFlip(input: FlipScenarioInput): FlipScenarioResult {
  const feePct = Math.min(100, Math.max(0, input.feePct));
  const undercutPct = Math.min(50, Math.max(0, input.undercutPct));
  const fillPct = Math.min(100, Math.max(0, input.dailyFillPct)) / 100;

  // Buy order: pay a touch above the best existing buy order (instant sell).
  // Sell offer: list a touch below the cheapest existing sell offer (instant buy).
  const entryPrice = input.instantSell * (1 + undercutPct / 100);
  const exitPrice = input.instantBuy * (1 - undercutPct / 100);
  const grossSpread = exitPrice - entryPrice;
  const feePerUnit = exitPrice * (feePct / 100);
  const netPerUnit = grossSpread - feePerUnit;
  const marginPct = entryPrice > 0 ? (netPerUnit / entryPrice) * 100 : 0;

  const unitsByBudget = entryPrice > 0 ? Math.floor(input.budget / entryPrice) : 0;
  // Never claim more units than the market plausibly absorbs in a day.
  const buySideDaily = input.buyMovingWeek / 7;
  const sellSideDaily = input.sellMovingWeek / 7;
  const dailyVolumeUnits = Math.max(0, Math.min(buySideDaily, sellSideDaily) * fillPct);
  const unitsByVolume = Math.floor(dailyVolumeUnits);
  const units = Math.max(0, Math.min(unitsByBudget, unitsByVolume));

  const capitalUsed = units * entryPrice;
  const grossProfit = units * grossSpread;
  const feeTotal = units * feePerUnit;
  const netProfit = units * netPerUnit;
  // Sanity: instant buy followed by instant sell cannot be profitable.
  const instantRoundTrip = input.instantSell * (1 - feePct / 100) - input.instantBuy;

  return {
    entryPrice,
    exitPrice,
    grossSpread,
    feePerUnit,
    netPerUnit,
    marginPct,
    unitsByBudget,
    unitsByVolume,
    units,
    capitalUsed,
    grossProfit,
    feeTotal,
    netProfit,
    dailyVolumeUnits,
    instantRoundTrip,
    profitable: netPerUnit > 0 && units > 0,
  };
}

export type BazaarSortKey = "name" | "instantBuy" | "instantSell" | "spread" | "spreadPct" | "weeklyVolume" | "potential";

export interface BazaarFilter {
  search: string;
  onlyFavorites: boolean;
  minWeeklyVolume: number;
  category: string | null;
}

export function filterAndSortQuotes(
  quotes: BazaarItemQuote[],
  filter: BazaarFilter,
  sortKey: BazaarSortKey,
  sortDir: "asc" | "desc",
  favorites: Set<string>,
  feePct: number,
): BazaarItemQuote[] {
  const search = filter.search.trim().toLowerCase();
  const result = quotes.filter((quote) => {
    if (filter.onlyFavorites && !favorites.has(quote.productId)) return false;
    if (filter.minWeeklyVolume > 0 && Math.min(quote.buyOrderMovingWeek, quote.sellOfferMovingWeek) < filter.minWeeklyVolume) {
      return false;
    }
    if (filter.category && quote.category !== filter.category) return false;
    if (!search) return true;
    return quote.name.toLowerCase().includes(search) || quote.productId.toLowerCase().includes(search);
  });

  const potential = (quote: BazaarItemQuote) => {
    const exitPrice = quote.instantBuy;
    return (exitPrice * (1 - feePct / 100) - quote.instantSell) / Math.max(quote.instantSell, 0.0001);
  };

  const direction = sortDir === "asc" ? 1 : -1;
  result.sort((a, b) => {
    let left: number | string = 0;
    let right: number | string = 0;
    switch (sortKey) {
      case "name":
        left = a.name;
        right = b.name;
        break;
      case "instantBuy":
        left = a.instantBuy;
        right = b.instantBuy;
        break;
      case "instantSell":
        left = a.instantSell;
        right = b.instantSell;
        break;
      case "spread":
        left = a.spread;
        right = b.spread;
        break;
      case "spreadPct":
        left = a.spreadPct;
        right = b.spreadPct;
        break;
      case "weeklyVolume":
        left = Math.min(a.buyOrderMovingWeek, a.sellOfferMovingWeek);
        right = Math.min(b.buyOrderMovingWeek, b.sellOfferMovingWeek);
        break;
      case "potential":
        left = potential(a);
        right = potential(b);
        break;
    }
    if (typeof left === "string" && typeof right === "string") {
      return left.localeCompare(right) * direction;
    }
    return (Number(left) - Number(right)) * direction;
  });

  return result;
}

/**
 * Headline cards intentionally exclude extreme, thinly traded spreads. The
 * official API occasionally reports one-sided books where the percentage is
 * mathematically correct but not actionable (e.g. a single order priced at
 * 1 coin). Those products stay visible in the full table and are not altered.
 */
const HEADLINE_MIN_WEEKLY_VOLUME = 10_000;
const HEADLINE_MAX_SPREAD_PCT = 200;

export interface BazaarSummary {
  productCount: number;
  activeBuyOrders: number;
  activeSellOrders: number;
  medianSpreadPct: number | null;
  topGainer: BazaarItemQuote | null;
}

export function summarizeBazaar(quotes: BazaarItemQuote[]): BazaarSummary {
  const liquid = quotes.filter((quote) => quote.instantBuy > 0 && quote.instantSell > 0 && Math.min(quote.buyOrderMovingWeek, quote.sellOfferMovingWeek) > 0);
  const spreads = liquid.map((quote) => quote.spreadPct).sort((a, b) => a - b);
  const median = spreads.length
    ? spreads.length % 2 === 1
      ? spreads[Math.floor(spreads.length / 2)]!
      : ((spreads[spreads.length / 2 - 1] ?? 0) + (spreads[spreads.length / 2] ?? 0)) / 2
    : null;
  const topGainer =
    liquid
      .filter(
        (quote) =>
          Math.min(quote.buyOrderMovingWeek, quote.sellOfferMovingWeek) >= HEADLINE_MIN_WEEKLY_VOLUME &&
          quote.spreadPct >= 0 &&
          quote.spreadPct <= HEADLINE_MAX_SPREAD_PCT,
      )
      .sort((a, b) => b.spreadPct - a.spreadPct)[0] ?? null;

  return {
    productCount: quotes.length,
    activeBuyOrders: quotes.reduce((sum, quote) => sum + quote.buyOrders, 0),
    activeSellOrders: quotes.reduce((sum, quote) => sum + quote.sellOrders, 0),
    medianSpreadPct: median,
    topGainer,
  };
}

export function topOpportunities(quotes: BazaarItemQuote[], limit = 5): BazaarItemQuote[] {
  return quotes
    .filter((quote) => quote.instantBuy > 0 && quote.instantSell > 0)
    .filter((quote) => Math.min(quote.buyOrderMovingWeek, quote.sellOfferMovingWeek) >= 50_000)
    .filter((quote) => quote.spreadPct >= 0 && quote.spreadPct <= HEADLINE_MAX_SPREAD_PCT)
    .sort((a, b) => b.spreadPct - a.spreadPct)
    .slice(0, limit);
}
