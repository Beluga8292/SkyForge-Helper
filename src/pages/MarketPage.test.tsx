import { it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DEFAULT_FILTERS,
  DEFAULT_AUCTION_FILTERS,
} from "@/features/market/models";
import { calculateMarketFlip } from "@/features/market/engine";
const state = vi.hoisted(() => ({
  flip: {} as Record<string, unknown>,
  auction: {} as Record<string, unknown>,
}));
vi.mock("@/hooks/useMarketIntelligence", () => ({
  useMarketFilters: () => ({
    filters: { ...DEFAULT_FILTERS, quantity: 37 },
    auctions: { ...DEFAULT_AUCTION_FILTERS, fee_pct: 1, listing_fee: 1000 },
    loaded: true,
    error: false,
    setFilters: vi.fn(),
    setAuctions: vi.fn(),
  }),
  useFlipScanner: () => state.flip,
  useAuctionScanner: () => state.auction,
  useItemAnalytics: () => ({}),
  useMarketOverview: () => ({}),
}));
vi.mock("@/data", () => ({
  useDataScope: () => "isolated-test",
  useDataProvider: () => ({ id: "backend", isDemo: false, getItems: vi.fn() }),
}));
import { MarketPage } from "./MarketPage";
const now = Date.now(),
  meta = {
    fetched_at: new Date(now).toISOString(),
    fetched_at_ms: now,
    cache_age_ms: 0,
    stale: false,
    source: "cache",
  };
beforeEach(() => {
  const flip = calculateMarketFlip(
    "BAZAAR_ONLY",
    {
      product_id: "BAZAAR_ONLY",
      buy_summary: [{ pricePerUnit: 120, amount: 10000, orders: 1 }],
      sell_summary: [{ pricePerUnit: 100, amount: 10000, orders: 1 }],
    },
    "order",
    37,
    1.25,
  );
  state.flip = {
    data: { items: [flip], meta, total: 1, page_size: 30 },
    error: new Error("refresh timeout"),
    isPending: false,
  };
  state.auction = {
    data: {
      items: [
        {
          auction_id: "a",
          item_id: "AUCTION_ONLY",
          name: "AuctionOnlyName",
          rarity: "EPIC",
          count: 1,
          listing_price: 100,
          reference_price: 200,
          discount_pct: 50,
          net_upside: null,
          confidence: "medium",
          sample_size: 10,
          comparable_ids: [],
          match_key: "exact",
          modifiers: {},
          end: now + 60000,
          start: now,
          reason: "listing_median_not_sale",
        },
      ],
      meta,
      total: 1,
      page_size: 30,
      partial: false,
      analysis_limited: false,
    },
    error: new Error("refresh timeout"),
    isPending: false,
  };
});
const render = (view: string) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <MemoryRouter initialEntries={["/flips?view=" + view]}>
          <MarketPage />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
it("keeps cached Bazaar results visible on refresh errors, without Auction rows", () => {
  const html = render("bazaar");
  expect(html).toContain("Обновление не удалось");
  expect(html).toContain("BAZAAR_ONLY");
  expect(html).not.toContain("AuctionOnlyName");
  expect(html).toContain('value="37"');
});
it("keeps cached Auction results visible and explicitly labels legacy filter scope", () => {
  const html = render("auctions");
  expect(html).toContain("Обновление не удалось");
  expect(html).toContain("AuctionOnlyName");
  expect(html).not.toContain("BAZAAR_ONLY");
  expect(html).toContain("не подтверждает новые глобальные фильтры");
  expect(html).toContain('value="1000"');
});
it("shows an error without inventing results when no cached response exists", () => {
  state.flip = { error: new Error("offline"), isPending: false };
  const html = render("bazaar");
  expect(html).not.toContain("BAZAAR_ONLY");
  expect(html).not.toContain("Обновление не удалось. Показан предыдущий");
  expect(html).toContain("Повторить");
});
