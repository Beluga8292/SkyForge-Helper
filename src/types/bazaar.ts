export interface BazaarOrderLevel {
  pricePerUnit: number;
  amount: number;
  orders: number;
}

export interface BazaarItemQuote {
  productId: string;
  name: string;
  tier: string | null;
  category: string | null;
  npcSellPrice: number | null;
  instantBuy: number;
  instantSell: number;
  /** instantBuy - instantSell (max order-to-order spread before undercut/tax). */
  spread: number;
  spreadPct: number;
  sellOfferVolume: number;
  buyOrderVolume: number;
  sellOfferMovingWeek: number;
  buyOrderMovingWeek: number;
  sellOrders: number;
  buyOrders: number;
  buyOrdersTop: BazaarOrderLevel[];
  sellOrdersTop: BazaarOrderLevel[];
  lastUpdated: number;
}

export interface FlipScenarioInput {
  instantBuy: number;
  instantSell: number;
  feePct: number;
  undercutPct: number;
  budget: number;
  dailyFillPct: number;
  buyMovingWeek: number;
  sellMovingWeek: number;
}

export interface FlipScenarioResult {
  /** Estimated buy-order fill price (we place an order near the instant-sell price). */
  entryPrice: number;
  /** Estimated sell-offer listing price (we place an offer near the instant-buy price). */
  exitPrice: number;
  grossSpread: number;
  feePerUnit: number;
  netPerUnit: number;
  marginPct: number;
  unitsByBudget: number;
  unitsByVolume: number;
  units: number;
  capitalUsed: number;
  grossProfit: number;
  feeTotal: number;
  netProfit: number;
  dailyVolumeUnits: number;
  instantRoundTrip: number;
  profitable: boolean;
}
