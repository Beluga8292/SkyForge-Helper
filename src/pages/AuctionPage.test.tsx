import { beforeEach, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/api/errors";
const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  args: [] as unknown[],
}));
vi.mock("@/hooks/useBazaar", () => ({
  useAuctions: (...args: unknown[]) => {
    state.args = args;
    return state.query;
  },
}));
vi.mock("@/hooks/useEnvironment", () => ({ useNow: () => 1800000000000 }));
vi.mock("@/features/items/registry", () => ({
  useItemRegistryByName: () => null,
  useItemRegistryEntry: () => null,
}));
vi.mock("@/components/common/ItemIcon", () => ({
  ItemIcon: () => <span>icon</span>,
}));
import { AuctionPage } from "./AuctionPage";
const render = (path = "/auction") =>
  renderToStaticMarkup(
    <TooltipProvider>
      <MemoryRouter initialEntries={[path]}>
        <AuctionPage />
      </MemoryRouter>
    </TooltipProvider>,
  );
beforeEach(() => {
  state.query = {
    globalSearch: true,
    demo: false,
    isPending: false,
    isFetching: false,
    refresh: vi.fn(),
    auctions: [],
    envelope: {
      data: {
        totalPages: 8,
        totalAuctions: 42000,
        filteredTotal: 377,
        snapshotComplete: true,
        identityIndexed: 42000,
      },
      updatedAt: 1800000000000,
    },
  };
});
it("passes bookmarked search, page and every filter to the backend query", () => {
  render(
    "/auction?q=Necron&page=2&type=bin&category=armor&rarity=LEGENDARY&min=10&max=50&ends=3600&sort=priceAsc",
  );
  expect(state.args).toEqual([
    2,
    {
      search: "Necron",
      auctionType: "bin",
      category: "armor",
      rarity: "LEGENDARY",
      minPrice: 10,
      maxPrice: 50,
      endingWithin: 3600,
      sort: "price_asc",
    },
    true,
  ]);
});
it("renders filtered totals and preserves the server order without a page-local search", () => {
  state.query.auctions = [
    {
      uuid: "second-price",
      item_name: "Server first",
      starting_bid: 20,
      end: 1800000001000,
    },
    {
      uuid: "first-price",
      item_name: "Server second",
      starting_bid: 1,
      end: 1800000002000,
    },
  ];
  const html = render("/auction?q=not-a-local-match&sort=priceAsc");
  expect(html).toContain("377");
  expect(html.indexOf("Server first")).toBeLessThan(
    html.indexOf("Server second"),
  );
});
it("shows an HTTP error rather than a zero-result empty state", () => {
  state.query.error = new ApiError("unavailable", "private raw HTTP error");
  state.query.envelope = undefined;
  const html = render();
  expect(html).not.toContain("private raw HTTP error");
  expect(html).not.toContain("По вашему запросу ничего не найдено");
  expect(html).not.toContain("Найдено: 0");
});
it("separately explains incomplete snapshot and item-identity index", () => {
  state.query.envelope = {
    data: {
      snapshotComplete: false,
      identityIndexed: 10,
      totalAuctions: 100,
      totalPages: 1,
      filteredTotal: 0,
    },
    updatedAt: 1800000000000,
  };
  const html = render();
  expect(html).toContain("Полнота снимка");
  expect(html).toContain("item ID");
});
it("blocks invalid price ranges before a request instead of applying a partial filter", () => {
  const html = render("/auction?min=100&max=10");
  expect(state.args[2]).toBe(false);
  expect(html).toContain("корректный диапазон");
});
it("marks Direct as a limited preview and renders at most 50 cards", () => {
  state.query.globalSearch = false;
  state.query.auctions = Array.from({ length: 1000 }, (_, i) => ({
    uuid: String(i),
    item_name: `Preview ${i}`,
    end: 1800000010000,
  }));
  const html = render();
  expect(html).toContain("Direct/Demo");
  expect(html).not.toContain("Preview 50");
  expect(html).toContain("Preview 49");
});
it("retains a clear unavailable-snapshot empty message without claiming the item does not exist", () => {
  const html = render("/auction?q=Terminator");
  expect(html).toContain(
    "По вашему запросу ничего не найдено в доступном снимке",
  );
});
