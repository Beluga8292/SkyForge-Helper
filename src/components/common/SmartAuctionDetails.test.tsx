import { it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Valuation } from "@/features/market/models";
const state = vi.hoisted(() => ({
  provider: { getAuction: vi.fn() },
  queryFn: null as null | ((p: { signal: AbortSignal }) => unknown),
  dialogProps: null as Record<string, unknown> | null,
}));
vi.mock("@/data", () => ({
  useDataProvider: () => state.provider,
  useDataScope: () => "isolated",
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryFn: typeof state.queryFn }) => {
    state.queryFn = options.queryFn;
    return {
      data: { data: { uuid: "a", bin: true, starting_bid: 100 } },
      isPending: false,
    };
  },
}));
vi.mock("@/pages/AuctionPage", () => ({
  AuctionDialog: (props: Record<string, unknown>) => {
    state.dialogProps = props;
    return <div data-existing-auction-dialog="true" />;
  },
}));
import {
  SmartAuctionDetails,
  SmartAuctionSummary,
} from "./SmartAuctionDetails";
const row: Valuation = {
  auction_id: "a",
  item_id: "X",
  name: "Item",
  rarity: "EPIC",
  count: 1,
  listing_price: 100,
  reference_price: 200,
  difference: 100,
  discount_pct: 50,
  net_upside: null,
  confidence: "medium",
  sample_size: 10,
  comparable_ids: [],
  match_key: "exact",
  modifiers: {},
  end: Date.now() + 60000,
  start: 0,
  reason: "listing_median_not_sale",
};
const now = Date.now(),
  meta = {
    fetched_at: new Date(now).toISOString(),
    fetched_at_ms: now,
    cache_age_ms: 0,
    stale: false,
    source: "cache",
  };
it("reuses existing AuctionDialog and requests only the selected lot", async () => {
  const html = renderToStaticMarkup(
    <SmartAuctionDetails row={row} meta={meta} onClose={() => {}} />,
  );
  expect(html).toContain("data-existing-auction-dialog");
  expect(state.dialogProps?.additionalContent).toBeTruthy();
  const signal = new AbortController().signal;
  await state.queryFn!({ signal });
  expect(state.provider.getAuction).toHaveBeenCalledExactlyOnceWith(
    "a",
    signal,
  );
});
it("labels listings and unknown fees honestly, with no NaN amounts", () => {
  const html = renderToStaticMarkup(
    <SmartAuctionSummary row={row} meta={meta} />,
  );
  expect(html).toContain("активным предложениям");
  expect(html).toContain("Полные комиссии неизвестны");
  expect(html).not.toContain("NaN");
});
