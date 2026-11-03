import { describe, expect, it } from "vitest";
import { calculateFlip, filterAndSortQuotes, summarizeBazaar, toBazaarQuote } from "@/features/bazaar/calculations";
import type { BazaarProduct } from "@/types/hypixel";
import type { BazaarItemQuote } from "@/types/bazaar";

const product: BazaarProduct = {
  product_id: "ENCHANTED_DIAMOND",
  buy_summary: [{ amount: 100, pricePerUnit: 110, orders: 2 }],
  sell_summary: [{ amount: 100, pricePerUnit: 100, orders: 2 }],
  quick_status: {
    productId: "ENCHANTED_DIAMOND",
    buyPrice: 110,
    buyVolume: 1000,
    buyMovingWeek: 70000,
    buyOrders: 10,
    sellPrice: 100,
    sellVolume: 1000,
    sellMovingWeek: 70000,
    sellOrders: 10,
  },
};

describe("bazaar calculations", () => {
  it("maps API statuses to instant buy/sell without confusing them", () => {
    const quote = toBazaarQuote(product, { name: "Enchanted Diamond" }, 1);
    expect(quote).not.toBeNull();
    expect(quote?.instantBuy).toBe(110);
    expect(quote?.instantSell).toBe(100);
    expect(quote?.spread).toBe(10);
    expect(quote?.spreadPct).toBe(10);
    expect(quote?.buyOrdersTop[0]?.pricePerUnit).toBe(100);
    expect(quote?.sellOrdersTop[0]?.pricePerUnit).toBe(110);
  });

  it("accounts for the Bazaar tax on the sell side", () => {
    const result = calculateFlip({
      instantBuy: 110,
      instantSell: 100,
      feePct: 1.25,
      undercutPct: 0,
      budget: 1000,
      dailyFillPct: 100,
      buyMovingWeek: 7000,
      sellMovingWeek: 7000,
    });
    // 110 * 0.9875 - 100 = 8.625
    expect(result.netPerUnit).toBeCloseTo(8.625, 4);
    expect(result.units).toBe(10);
    expect(result.netProfit).toBeCloseTo(86.25, 4);
    expect(result.instantRoundTrip).toBeLessThan(0);
  });

  it("does not promise profit when the spread is negative after tax", () => {
    const result = calculateFlip({
      instantBuy: 100,
      instantSell: 100,
      feePct: 1.25,
      undercutPct: 0,
      budget: 1000,
      dailyFillPct: 100,
      buyMovingWeek: 7000,
      sellMovingWeek: 7000,
    });
    expect(result.profitable).toBe(false);
    expect(result.netProfit).toBeLessThan(0);
  });

  it("filters and sorts quotes by spread", () => {
    const base = toBazaarQuote(product, { name: "Enchanted Diamond" }, 1) as BazaarItemQuote;
    const quotes = [base, { ...base, productId: "GOLD", name: "Gold", spreadPct: 20, spread: 22 }];
    const filtered = filterAndSortQuotes(
      quotes,
      { search: "gold", onlyFavorites: false, minWeeklyVolume: 0, category: null },
      "spreadPct",
      "desc",
      new Set(),
      1.25,
    );
    expect(filtered.map((quote) => quote.productId)).toEqual(["GOLD"]);
    expect(summarizeBazaar(quotes).topGainer?.productId).toBe("GOLD");
  });

  it("keeps extreme one-sided spreads out of headline cards", () => {
    const base = toBazaarQuote(product, { name: "Enchanted Diamond" }, 1) as BazaarItemQuote;
    const quotes = [
      base,
      { ...base, productId: "MANIPULATED", name: "Manipulated", spreadPct: 900_000, spread: 90_000 },
    ];
    expect(summarizeBazaar(quotes).topGainer?.productId).toBe("ENCHANTED_DIAMOND");
  });
});
