import { ApiError } from "@/api/errors";
import type { DataProvider } from "@/data/types";
import type { DataEnvelope } from "@/types/app";
import type { BazaarResponse, HypixelAuction } from "@/types/hypixel";
import {
  DEFAULT_FILTERS,
  type AuctionPage,
  type MarketMeta,
  type MarketProvider,
  type Valuation,
} from "./models";
import { calculateMarketFlip, filterFlips } from "./engine";
import { analyseHistory } from "./history";
import { valueAuctions } from "./auction-engine";

function meta(envelope: DataEnvelope<BazaarResponse>): MarketMeta {
  const ts = envelope.data.lastUpdated ?? envelope.updatedAt;
  return {
    fetched_at: new Date(ts).toISOString(),
    fetched_at_ms: ts,
    cache_age_ms: Math.max(0, Date.now() - ts),
    stale: Boolean(envelope.stale),
    source: envelope.demo ? "demo" : "upstream",
  };
}
function workerValues(
  rows: HypixelAuction[],
  signal?: AbortSignal,
): Promise<Valuation[]> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./auction.worker.ts", import.meta.url), {
      type: "module",
    });
    const timer = setTimeout(() => {
      finish();
      reject(new ApiError("timeout", "Auction analysis timed out"));
    }, 15000);
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      finish();
      reject(new DOMException("Aborted", "AbortError"));
    };
    worker.onmessage = (
      event: MessageEvent<{ items?: Valuation[]; error?: string }>,
    ) => {
      finish();
      event.data.items
        ? resolve(event.data.items)
        : reject(
            new ApiError(
              "validation",
              event.data.error ?? "Invalid worker result",
            ),
          );
    };
    worker.onerror = () => {
      finish();
      reject(new ApiError("validation", "Auction worker failed"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    worker.postMessage(rows);
  });
}
export function localMarketProvider(get: () => DataProvider): MarketProvider {
  let cached: DataEnvelope<BazaarResponse> | null = null;
  let auctions: { key: string; rows: Valuation[] } | null = null;
  const load = async (signal?: AbortSignal) => {
    if (cached && Date.now() - cached.updatedAt < 30000) return cached;
    const value = await get().getBazaar(signal);
    signal?.throwIfAborted();
    cached = value;
    return value;
  };
  return {
    async getFlips(p, signal) {
      const envelope = await load(signal),
        m = meta(envelope),
        rows = Object.entries(envelope.data.products ?? {}).map(
          ([id, product]) =>
            calculateMarketFlip(
              id,
              product,
              p.mode,
              p.quantity,
              p.tax_pct,
              m.cache_age_ms,
            ),
        ),
        filtered = filterFlips(rows, p);
      signal?.throwIfAborted();
      return {
        items: filtered.slice(p.page * p.page_size, (p.page + 1) * p.page_size),
        total: filtered.length,
        page: p.page,
        page_size: p.page_size,
        snapshot_id: `bz-${envelope.data.lastUpdated}`,
        algorithm: "market-v1",
        meta: m,
      };
    },
    async getAnalytics(id, range, quantity, tax, signal, mode = "order") {
      const envelope = await load(signal),
        product = envelope.data.products?.[id];
      if (!product) throw new ApiError("not-found", "Bazaar product not found");
      const history = await get().getHistory(id, range, signal),
        m = meta(envelope);
      let points = history?.points ?? [];
      if (get().isDemo) {
        const current = product.quick_status;
        points = Array.from({ length: 25 }, (_, i) => ({
          ts: new Date(Date.now() - (24 - i) * 300000).toISOString(),
          buy_price: (current?.buyPrice ?? 0) * (1 + Math.sin(i) * 0.01),
          sell_price: (current?.sellPrice ?? 0) * (1 + Math.sin(i) * 0.01),
          buy_volume: current?.buyVolume ?? 0,
          sell_volume: current?.sellVolume ?? 0,
        }));
      }
      const result = analyseHistory(points, m, id, range);
      result.flip = calculateMarketFlip(
        id,
        product,
        mode,
        quantity,
        tax,
        m.cache_age_ms,
        result.volatility_pct,
      );
      signal?.throwIfAborted();
      return result;
    },
    async getAuctionOpportunities(p, signal) {
      const envelope = await get().getAuctions(0, signal),
        key = String(envelope.data.lastUpdated ?? envelope.updatedAt);
      let rows: Valuation[];
      if (get().isDemo) {
        const now = Date.now();
        rows = valueAuctions(
          Array.from({ length: 12 }, (_, i) => ({
            raw: {
              uuid: `demo-opportunity-${i}`,
              item_name: "Demo Sword",
              tier: "LEGENDARY",
              bin: true,
              auctioneer: `demo-seller-${i}`,
              starting_bid: i === 0 ? 70000 : 100000 + i * 100,
              end: now + 3600000,
              start: now - 60000,
            },
            identity: {
              key: "demo-sword",
              id: "DEMO_SWORD",
              count: 1,
              modifiers: {},
            },
          })),
        );
      } else if (auctions?.key === key) rows = auctions.rows;
      else {
        rows = await workerValues(envelope.data.auctions ?? [], signal);
        signal?.throwIfAborted();
        auctions = { key, rows };
      }
      const rank = { insufficient: 0, low: 1, medium: 2, high: 3 },
        partial = !get().isDemo;
      // A single direct page cannot establish whole-market confidence.
      rows = rows.map((r) => ({
        ...r,
        confidence:
          partial && r.confidence !== "insufficient"
            ? ("low" as const)
            : r.confidence,
        net_upside:
          r.reference_price !== null &&
          p.fee_pct !== undefined &&
          p.listing_fee !== undefined
            ? r.reference_price * (1 - p.fee_pct / 100) -
              r.listing_price -
              p.listing_fee
            : null,
      }));
      const filtered = rows.filter(
        (r) =>
          r.end > Date.now() + p.min_remaining * 1000 &&
          (!p.new_only || r.start > Date.now() - 900000) &&
          r.listing_price <= p.max_cost &&
          rank[r.confidence] >= rank[p.min_confidence] &&
          (!p.rarity || r.rarity === p.rarity) &&
          (r.name + " " + r.item_id + " " + r.auction_id)
            .toLowerCase()
            .includes(p.search.toLowerCase()) &&
          (r.discount_pct ?? 0) >= p.min_discount,
      );
      const field = {
        discount: "discount_pct",
        price: "listing_price",
        newest: "start",
        reference: "reference_price",
      } as const;
      filtered
        .sort((a, b) => a.auction_id.localeCompare(b.auction_id))
        .sort(
          (a, b) =>
            ((a[field[p.sort]] ?? 0) - (b[field[p.sort]] ?? 0)) *
            (p.descending ? -1 : 1),
        );
      const ts = envelope.data.lastUpdated ?? envelope.updatedAt;
      const result: AuctionPage = {
        items: filtered.slice(p.page * p.page_size, (p.page + 1) * p.page_size),
        total: filtered.length,
        page: p.page,
        page_size: p.page_size,
        snapshot_id: key,
        algorithm: "auction-v1",
        partial,
        analysis_limited: false,
        meta: {
          fetched_at: new Date(ts).toISOString(),
          fetched_at_ms: ts,
          cache_age_ms: Date.now() - ts,
          stale: Boolean(envelope.stale),
          source: get().isDemo ? "demo" : "upstream",
        },
      };
      return result;
    },
    async getAuctionValuation(id, signal) {
      const response = await get().getAuctionOpportunities(
        {
          page: 0,
          page_size: 1000,
          search: id,
          min_discount: -100,
          max_cost: 1e15,
          min_confidence: "insufficient",
          min_remaining: 0,
          new_only: false,
          sort: "discount",
          descending: true,
        },
        signal,
      );
      const row = response.items.find((r) => r.auction_id === id);
      if (!row)
        throw new ApiError("not-found", "Auction not in loaded direct page");
      return {
        valuation: row,
        snapshot_id: response.snapshot_id,
        meta: response.meta,
      };
    },
    async getMarketOverview(tax, signal) {
      const page = await get().getFlips(
        { ...DEFAULT_FILTERS, tax_pct: tax, page_size: 5 },
        signal,
      );
      return {
        bazaar: page,
        largest_changes: [],
        history_available: get().isDemo,
        signals: [],
        meta: page.meta,
      };
    },
  };
}
