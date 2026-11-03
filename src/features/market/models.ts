import { z } from "zod";
export const metaSchema = z.object({
  fetched_at: z.string(),
  fetched_at_ms: z.number(),
  cache_age_ms: z.number(),
  stale: z.boolean(),
  source: z.string(),
  snapshot_id: z.string().nullable().optional(),
  revalidate_error: z.string().nullable().optional(),
});
const n = z.number().finite().nullable();
export const scoresSchema = z.object({
  profit: z.number(),
  liquidity: z.number(),
  risk: z.number(),
  overall: z.number(),
  explanation: z.record(z.string(), n),
});
export const flipSchema = z.object({
  product_id: z.string(),
  name: z.string(),
  mode: z.enum(["order", "instant"]),
  quantity: z.number(),
  buy_price: n,
  sell_price: n,
  gross_margin: n,
  fees: n,
  tax_pct: z.number(),
  net_per_item: n,
  net_per_stack: n,
  net_profit: n,
  roi: n,
  position_cost: n,
  break_even: n,
  bid_depth: n,
  ask_depth: n,
  buy_volume: n,
  sell_volume: n,
  buy_orders: n,
  sell_orders: n,
  weekly_activity: n,
  imbalance: n,
  spread_pct: n,
  position_share: n,
  price_impact_pct: n,
  age_ms: z.number(),
  risks: z.array(z.string()),
  scores: scoresSchema,
});
export const flipPageSchema = z.object({
  items: z.array(flipSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  snapshot_id: z.string(),
  algorithm: z.string(),
  meta: metaSchema,
});
export const signalSchema = z.object({
  kind: z.string(),
  value: z.number(),
  threshold: z.number(),
  period_seconds: z.number(),
  samples: z.number(),
  updated_at: z.string(),
  sufficient: z.boolean(),
});
export const pointSchema = z.object({
  ts: z.string(),
  buy_price: n,
  sell_price: n,
  spread_pct: n,
  buy_volume: z.number().optional(),
  sell_volume: z.number().optional(),
});
export const analyticsSchema = z.object({
  product_id: z.string(),
  range: z.string(),
  points: z.array(pointSchema),
  samples: z.number(),
  sufficient: z.boolean(),
  observed_seconds: z.number(),
  minimum: n,
  maximum: n,
  average: n,
  volatility_pct: n,
  change_pct: n,
  rolling_std: n,
  z_score: n,
  signals: z.array(signalSchema),
  flip: flipSchema.nullable(),
  meta: metaSchema,
});
export const valuationSchema = z.object({
  auction_id: z.string(),
  item_id: z.string().nullable(),
  name: z.string(),
  rarity: z.string().nullable(),
  count: n,
  listing_price: z.number(),
  reference_price: n,
  difference: n,
  discount_pct: n,
  net_upside: n,
  confidence: z.enum(["high", "medium", "low", "insufficient"]),
  sample_size: z.number(),
  comparable_ids: z.array(z.string()),
  match_key: z.string().nullable(),
  modifiers: z.record(z.string(), z.string()),
  end: z.number(),
  start: z.number(),
  reason: z.string(),
});
export const auctionPageSchema = z.object({
  smart_filters_applied: z.boolean().optional(),
  items: z.array(valuationSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  snapshot_id: z.string(),
  algorithm: z.string(),
  partial: z.boolean(),
  analysis_limited: z.boolean().default(false),
  meta: metaSchema,
});
export const overviewSchema = z.object({
  bazaar: flipPageSchema,
  largest_changes: z.array(
    z.object({
      product_id: z.string(),
      change_pct: z.number(),
      ts: z.string(),
    }),
  ),
  history_available: z.boolean(),
  signals: z.array(signalSchema.extend({ product_id: z.string() })),
  meta: metaSchema,
});
export const valuationResponseSchema = z.object({
  valuation: valuationSchema,
  snapshot_id: z.string(),
  meta: metaSchema,
});
export type Flip = z.infer<typeof flipSchema>;
export type FlipPage = z.infer<typeof flipPageSchema>;
export type Analytics = z.infer<typeof analyticsSchema>;
export type Signal = z.infer<typeof signalSchema>;
export type Valuation = z.infer<typeof valuationSchema>;
export type AuctionPage = z.infer<typeof auctionPageSchema>;
export type Overview = z.infer<typeof overviewSchema>;
export type MarketMeta = z.infer<typeof metaSchema>;
export type HistoryRange = "1h" | "24h" | "7d" | "30d";
export interface FlipParams {
  mode: "order" | "instant";
  quantity: number;
  tax_pct: number;
  page: number;
  page_size: number;
  search: string;
  sort: "score" | "profit" | "roi" | "cost" | "liquidity";
  descending: boolean;
  min_profit: number;
  min_roi: number;
  max_cost: number;
  min_liquidity: number;
  max_spread: number;
  min_activity: number;
  exclude_loss: boolean;
  exclude_illiquid: boolean;
}
export const DEFAULT_FILTERS: FlipParams = {
  mode: "order",
  quantity: 64,
  tax_pct: 1.25,
  page: 0,
  page_size: 30,
  search: "",
  sort: "score",
  descending: true,
  min_profit: 0,
  min_roi: 0,
  max_cost: 100000000,
  min_liquidity: 0,
  max_spread: 200,
  min_activity: 0,
  exclude_loss: true,
  exclude_illiquid: false,
};
export interface AuctionParams {
  min_profit?: number;
  min_roi?: number;
  max_risk?: number;
  max_age_seconds?: number;
  page: number;
  page_size: number;
  search: string;
  min_discount: number;
  max_cost: number;
  min_confidence: "high" | "medium" | "low" | "insufficient";
  rarity?: string;
  min_remaining: number;
  new_only: boolean;
  sort: "discount" | "price" | "newest" | "reference";
  descending: boolean;
  fee_pct?: number;
  listing_fee?: number;
}
export const DEFAULT_AUCTION_FILTERS: AuctionParams = {
  page: 0,
  page_size: 30,
  search: "",
  min_discount: 5,
  max_cost: 100000000,
  min_confidence: "low",
  min_remaining: 60,
  new_only: false,
  sort: "discount",
  descending: true,
};
export interface MarketProvider {
  getFlips(params: FlipParams, signal?: AbortSignal): Promise<FlipPage>;
  getAnalytics(
    id: string,
    range: HistoryRange,
    quantity: number,
    tax: number,
    signal?: AbortSignal,
    mode?: "order" | "instant",
  ): Promise<Analytics>;
  getAuctionOpportunities(
    params: AuctionParams,
    signal?: AbortSignal,
  ): Promise<AuctionPage>;
  getAuctionValuation(
    id: string,
    signal?: AbortSignal,
  ): Promise<z.infer<typeof valuationResponseSchema>>;
  getMarketOverview(tax: number, signal?: AbortSignal): Promise<Overview>;
}
