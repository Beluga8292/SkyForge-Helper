import { prettifyItemId } from "@/utils/item-name";
import type { BazaarProduct } from "@/types/hypixel";
import type { Flip, FlipParams } from "./models";
const clamp = (v: number) => Math.max(0, Math.min(100, v));
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e18 ? v : null;
export function levels(raw: unknown, bids: boolean): Array<[number, number]> {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 30)
    .filter(
      (x) =>
        x &&
        num(x.pricePerUnit) !== null &&
        x.pricePerUnit > 0 &&
        num(x.amount) !== null &&
        x.amount > 0,
    )
    .map((x) => [x.pricePerUnit, x.amount] as [number, number])
    .sort((a, b) => (bids ? b[0] - a[0] : a[0] - b[0]));
}
export function vwap(
  book: Array<[number, number]>,
  quantity: number,
): number | null {
  let left = quantity,
    total = 0;
  for (const [price, amount] of book) {
    const take = Math.min(left, amount);
    total += take * price;
    left -= take;
    if (left <= 0) return total / quantity;
  }
  return null;
}
export function calculateMarketFlip(
  id: string,
  product: BazaarProduct,
  mode: "order" | "instant",
  quantity: number,
  tax: number,
  age = 0,
  volatility: number | null = null,
): Flip {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 1e6 ||
    !Number.isFinite(tax) ||
    tax < 0 ||
    tax > 10
  )
    throw new RangeError("Invalid quantity or tax");
  const bids = levels(product.sell_summary, true),
    asks = levels(product.buy_summary, false),
    quick = product.quick_status;
  const bidDepth = bids.length ? bids.reduce((s, x) => s + x[1], 0) : null,
    askDepth = asks.length ? asks.reduce((s, x) => s + x[1], 0) : null;
  let buy = bids[0]?.[0] ?? null,
    sell = asks[0]?.[0] ?? null,
    impact: number | null = null;
  const spread = buy && sell ? ((sell - buy) / buy) * 100 : null,
    risks: string[] = [];
  if (mode === "instant") {
    buy = vwap(asks, quantity);
    sell = vwap(bids, quantity);
    if (buy && sell)
      impact = Math.max(
        0,
        (buy / asks[0]![0] - 1 + (1 - sell / bids[0]![0])) * 100,
      );
  } else risks.push("unfilled_orders");
  if (buy === null || sell === null) risks.push("insufficient_depth");
  const wBuy = num(quick?.buyMovingWeek),
    wSell = num(quick?.sellMovingWeek),
    activity = wBuy !== null && wSell !== null ? Math.min(wBuy, wSell) : null;
  const depth =
      bidDepth !== null && askDepth !== null
        ? Math.min(bidDepth, askDepth)
        : null,
    share = depth ? quantity / depth : null;
  const gross = buy && sell ? sell - buy : null,
    fee = sell ? (sell * tax) / 100 : null,
    net = gross !== null && fee !== null ? gross - fee : null,
    roi = buy && net !== null ? (net / buy) * 100 : null;
  if (
    activity === null ||
    activity < 10000 ||
    depth === null ||
    depth < quantity * 10
  )
    risks.push("low_liquidity");
  if (share === null || share > 0.1) risks.push("large_position");
  if (age > 120000) risks.push("stale");
  if (spread !== null && spread > 50) risks.push("wide_spread");
  if (net !== null && net <= 0) risks.push("unprofitable");
  if (volatility === null) risks.push("unknown_volatility");
  const profit = clamp((roi ?? 0) * 5),
    activityScore = clamp((Math.log10(1 + (activity ?? 0)) / 6) * 100),
    depthScore = clamp(((depth ?? 0) / (quantity * 100)) * 100),
    liquidity = Math.min(activityScore, depthScore);
  const risk = clamp(
    15 +
      Math.min(40, Math.max(0, spread ?? 0)) +
      Math.min(30, (share || 1) * 100) +
      Math.min(30, (age / 120000) * 30) +
      (volatility === null ? 15 : Math.min(30, volatility * 3)),
  );
  const overall =
    net === null || net <= 0
      ? 0
      : clamp(
          ((0.4 * profit + 0.35 * liquidity + 0.25 * (100 - risk)) *
            liquidity) /
            100,
        );
  let stackNet = net === null ? null : net * 64;
  if (mode === "instant") {
    const stackBuy = vwap(asks, 64),
      stackSell = vwap(bids, 64);
    stackNet =
      stackBuy && stackSell
        ? (stackSell * (1 - tax / 100) - stackBuy) * 64
        : null;
  }
  return {
    product_id: id,
    name: prettifyItemId(id),
    mode,
    quantity,
    buy_price: buy,
    sell_price: sell,
    gross_margin: gross,
    fees: fee,
    tax_pct: tax,
    net_per_item: net,
    net_per_stack: stackNet,
    net_profit: net === null ? null : net * quantity,
    roi,
    position_cost: buy ? buy * quantity : null,
    break_even: buy ? buy / (1 - tax / 100) : null,
    bid_depth: bidDepth,
    ask_depth: askDepth,
    buy_volume: num(quick?.buyVolume),
    sell_volume: num(quick?.sellVolume),
    buy_orders: num(quick?.buyOrders),
    sell_orders: num(quick?.sellOrders),
    weekly_activity: activity,
    imbalance:
      bidDepth && askDepth
        ? (bidDepth - askDepth) / (bidDepth + askDepth)
        : null,
    spread_pct: spread,
    position_share: share,
    price_impact_pct: impact,
    age_ms: age,
    risks,
    scores: {
      profit,
      liquidity,
      risk,
      overall,
      explanation: {
        profit_weight: 0.4,
        liquidity_weight: 0.35,
        risk_weight: 0.25,
        activity: activityScore,
        depth: depthScore,
        volatility_pct: volatility,
      },
    },
  };
}
export function filterFlips(rows: Flip[], p: FlipParams): Flip[] {
  const fields = {
    score: (r: Flip) => r.scores.overall,
    profit: (r: Flip) => r.net_profit,
    roi: (r: Flip) => r.roi,
    cost: (r: Flip) => r.position_cost,
    liquidity: (r: Flip) => r.scores.liquidity,
  };
  return rows
    .filter(
      (r) =>
        (r.name + " " + r.product_id)
          .toLowerCase()
          .includes(p.search.toLowerCase()) &&
        r.net_profit !== null &&
        r.net_profit >= p.min_profit &&
        r.roi !== null &&
        r.roi >= p.min_roi &&
        r.position_cost !== null &&
        r.position_cost <= p.max_cost &&
        r.scores.liquidity >= p.min_liquidity &&
        r.spread_pct !== null &&
        r.spread_pct <= p.max_spread &&
        (r.weekly_activity ?? 0) >= p.min_activity &&
        (!p.exclude_loss || r.net_profit > 0) &&
        (!p.exclude_illiquid || !r.risks.includes("low_liquidity")),
    )
    .sort((a, b) => a.product_id.localeCompare(b.product_id))
    .sort(
      (a, b) =>
        ((fields[p.sort](a) ?? 0) - (fields[p.sort](b) ?? 0)) *
        (p.descending ? -1 : 1),
    );
}
export function scenario(
  buy: number,
  sell: number,
  quantity: number,
  tax: number,
  capital: number,
) {
  if (
    ![buy, sell, quantity, tax, capital].every(Number.isFinite) ||
    buy <= 0 ||
    sell < 0 ||
    quantity < 1 ||
    quantity > 1e6 ||
    !Number.isInteger(quantity) ||
    tax < 0 ||
    tax >= 100 ||
    capital < 0
  )
    return null;
  const cost = buy * quantity,
    gross = (sell - buy) * quantity,
    fees = (sell * quantity * tax) / 100;
  return {
    cost,
    gross,
    fees,
    net: gross - fees,
    roi: ((gross - fees) / cost) * 100,
    breakEven: buy / (1 - tax / 100),
    requiredVolume: quantity,
    affordable: cost <= capital,
  };
}
