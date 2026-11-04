import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { backendProvider } from "@/data/backend";
import { DEFAULT_SETTINGS } from "@/services/settings";
import { transportFetch } from "@/api/transport";

vi.mock("@/api/transport", () => ({ isTauriRuntime: () => false, transportFetch: vi.fn() }));
vi.mock("@/stores/settings", () => ({ getSettings: () => ({ ...DEFAULT_SETTINGS }) }));
vi.mock("@/stores/api-status", () => ({ reportRequestFailure: vi.fn(), reportRequestSuccess: vi.fn() }));

const payload = { success: true, lastUpdated: 1700000000000, products: {},
  meta: { fetched_at: "2026-10-29T20:00:00Z", cache_age_ms: 120000, stale: true, source: "memory" } };

describe("backend transport contracts", () => {
  beforeEach(() => { vi.mocked(transportFetch).mockReset(); });
  afterEach(() => { vi.useRealTimers(); });
  it("adapts upstream metadata and sends no API key", async () => {
    vi.mocked(transportFetch).mockResolvedValue(new Response(JSON.stringify(payload)));
    const result = await backendProvider.getBazaar();
    expect(result.stale).toBe(true);
    expect(result.meta?.cacheAgeMs).toBe(120000);
    const [url, init] = vi.mocked(transportFetch).mock.calls[0]!;
    expect(url).toBe("/backend/api/v1/bazaar");
    expect(init.headers).not.toHaveProperty("API-Key");
    expect(JSON.stringify(init)).not.toContain("Authorization");
  });
  it("maps backend rate limiting with Retry-After", async () => {
    vi.mocked(transportFetch).mockResolvedValue(new Response(JSON.stringify({ error: { code: "upstream_rate_limited", message: "limited" } }), { status: 503, headers: { "Retry-After": "3" } }));
    await expect(backendProvider.getBazaar()).rejects.toMatchObject({ kind: "rate-limit", retryAfterMs: 3000 });
  });
  it("reports offline backend", async () => {
    vi.mocked(transportFetch).mockRejectedValue(new TypeError("offline"));
    await expect(backendProvider.getBazaar()).rejects.toMatchObject({ kind: "network" });
  });
  it("validates the backend response", async () => {
    vi.mocked(transportFetch).mockResolvedValue(new Response('{"wrong":true}'));
    await expect(backendProvider.getBazaar()).rejects.toMatchObject({ kind: "validation" });
  });
  it("rejects a pre-cancelled request without transport", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(backendProvider.getBazaar(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(transportFetch).not.toHaveBeenCalled();
  });
  it("maps the timeout reason to timeout, not offline", async () => {
    vi.useFakeTimers();
    vi.mocked(transportFetch).mockImplementation(async (_, init) => new Promise((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    const result = expect(backendProvider.getBazaar()).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(20000);
    await result;
  });
});

it("adapts nullable FastAPI optional fields without breaking auction browsing", async () => {
  vi.mocked(transportFetch).mockResolvedValue(new Response(JSON.stringify({
    success: true, page: 0, page_size: 50, total_pages: 1, total_auctions: 1,
    auctions: [{ uuid: "one", item_name: "Item", item_lore: null, tier: null, auctioneer: null }],
  })));
  const result = await backendProvider.getAuctions(0);
  expect(result.data.totalPages).toBe(1);
  expect(result.data.auctions?.[0]?.uuid).toBe("one");
});

it("accepts missing upstream resource timestamps emitted as null by FastAPI", async () => {
  vi.mocked(transportFetch).mockResolvedValue(new Response(JSON.stringify({
    success: true, lastUpdated: null, items: [{ id: "X", name: "Item" }],
  })));
  expect((await backendProvider.getItems()).data.items).toHaveLength(1);
});

it("preserves nullable intelligence states and sends no client key", async () => {
  const { normalizeProfile, enrichLocal } = await import("@/features/intelligence/engine");
  const { demoProfile } = await import("@/features/intelligence/provider");
  const uuid = "0123456789abcdef0123456789abcdef", profile = "abcdefabcdefabcdefabcdefabcdefab";
  const domain = enrichLocal(await normalizeProfile(demoProfile(uuid, profile), uuid, {}, {}, 1000, "backend"), {});
  vi.mocked(transportFetch).mockResolvedValue(new Response(JSON.stringify(domain)));
  const result = await backendProvider.getIntelligence(uuid, profile);
  expect(result.assets[0]?.value).toBeNull();
  expect(result.metrics.find(m => m.id === "MINING")?.level).toBeNull();
  const call = vi.mocked(transportFetch).mock.calls.at(-1)!;
  expect(String(call[0])).toContain("/intelligence/players/");
  expect(call[1].headers).not.toHaveProperty("API-Key");
});

it("distinguishes shared budget outage from an offline backend or profile timeout", async () => {
  const { errorMessageKey } = await import("@/api/errors");
  vi.mocked(transportFetch).mockResolvedValue(new Response(JSON.stringify({
    error: { code: "upstream_budget_unavailable", message: "Shared budget unavailable" },
  }), { status: 503, headers: { "Retry-After": "5" } }));
  const error = await backendProvider.getProfiles("0031f8f258ab4254a4834bad8f9a25a8").catch(e => e);
  expect(error).toMatchObject({ kind: "unavailable", status: 503, retryAfterMs: 5000 });
  expect(errorMessageKey(error)).toBe("errors.upstreamBudgetUnavailable");
});

it("reports a rejected server key without leaking the upstream response", async () => {
  const { errorMessageKey } = await import("@/api/errors");
  vi.mocked(transportFetch).mockResolvedValue(new Response(JSON.stringify({
    error: { code: "upstream_forbidden", message: "Hypixel denied access to this endpoint" },
  }), { status: 502 }));
  const error = await backendProvider.getIntelligence(
    "0123456789abcdef0123456789abcdef",
    "abcdefabcdefabcdefabcdefabcdefab",
  ).catch(e => e);
  expect(error).toMatchObject({
    kind: "auth",
    status: 502,
    detail: "upstream_forbidden",
  });
  expect(errorMessageKey(error)).toBe("errors.profileUnavailable");
  expect(error.message).not.toMatch(/api key/i);
});

it("keeps a partial intelligence payload usable when one asset is broken", async () => {
  const { normalizeProfile, enrichLocal } = await import("@/features/intelligence/engine");
  const { demoProfile } = await import("@/features/intelligence/provider");
  const uuid = "0123456789abcdef0123456789abcdef", profile = "abcdefabcdefabcdefabcdefabcdefab";
  const domain = enrichLocal(
    await normalizeProfile(demoProfile(uuid, profile), uuid, {}, {}, 1000, "backend"),
    {},
  );
  vi.mocked(transportFetch).mockResolvedValue(new Response(JSON.stringify({
    ...domain,
    assets: [domain.assets[0], { key: "broken", location: "inv_contents" }],
    pets: [domain.pets[0], { rarity: "LEGENDARY" }],
  })));
  const result = await backendProvider.getIntelligence(uuid, profile);
  expect(result.assets).toHaveLength(1);
  expect(result.integrity).toMatchObject({
    invalidAssets: 1,
    invalidPets: 1,
  });
  // A dropped asset never becomes a zero-priced row.
  expect(result.assets.every((entry) => entry.item_id !== "broken")).toBe(true);
});

it("sends global auction filters and preserves totals, snapshot status and server order", async () => {
  const rows = [
    { uuid: "cheap", item_name: "Hyperion", starting_bid: 1 },
    { uuid: "later", item_name: "Hyperion", starting_bid: 5 },
  ];
  vi.mocked(transportFetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        page: 2,
        page_size: 50,
        total_pages: 8,
        total_auctions: 42000,
        filtered_total: 377,
        search_version: 1,
        snapshot_complete: true,
        snapshot_pages: 43,
        identity_indexed: 41990,
        categories: ["weapon"],
        lastUpdated: 1800000000000,
        auctions: rows,
        meta: { stale: true, snapshot_id: "generation-1" },
      }),
    ),
  );
  const result = await backendProvider.searchAuctions!(2, {
    search: "Necron's Chestplate",
    auctionType: "auction",
    rarity: "LEGENDARY",
    category: "armor",
    minPrice: 1,
    maxPrice: 50,
    endingWithin: 3600,
    sort: "price_asc",
  });
  const url = new URL(
    String(vi.mocked(transportFetch).mock.calls[0]![0]),
    "http://localhost",
  );
  expect(Object.fromEntries(url.searchParams)).toMatchObject({
    page: "2",
    page_size: "50",
    search: "Necron's Chestplate",
    auction_type: "auction",
    category: "armor",
    rarity: "LEGENDARY",
    min_price: "1",
    max_price: "50",
    ending_within: "3600",
    sort: "price_asc",
  });
  expect(result.data).toMatchObject({
    filteredTotal: 377,
    totalAuctions: 42000,
    totalPages: 8,
    snapshotComplete: true,
    identityIndexed: 41990,
    categories: ["weapon"],
  });
  expect(result.data.auctions?.map((x) => x.uuid)).toEqual(["cheap", "later"]);
  expect(result.stale).toBe(true);
});

it("does not claim advanced filters were applied by an older backend", async () => {
  vi.mocked(transportFetch).mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          success: true,
          page: 0,
          page_size: 50,
          total_pages: 1,
          total_auctions: 2000,
          filtered_total: 2000,
          auctions: [],
        }),
      ),
  );
  await expect(
    backendProvider.searchAuctions!(0, { minPrice: 100 }),
  ).rejects.toMatchObject({ detail: "auction_search_update_required" });
  const basic = await backendProvider.searchAuctions!(0, {
    search: "Juju",
    auctionType: "bin",
  });
  expect(basic.data.filteredTotal).toBe(2000);
  expect(basic.data.snapshotComplete).toBeUndefined();
  const url = String(vi.mocked(transportFetch).mock.calls.at(-1)![0]);
  expect(url).toContain("bin_only=true");
});

it("aborts an obsolete auction request and never converts an HTTP failure into empty results", async () => {
  const controller = new AbortController();
  vi.mocked(transportFetch).mockImplementation(
    async (_url, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("cancelled", "AbortError")),
          { once: true },
        ),
      ),
  );
  const pending = backendProvider.searchAuctions!(
    0,
    { search: "slow" },
    controller.signal,
  );
  controller.abort();
  await expect(pending).rejects.toBeDefined();
  vi.mocked(transportFetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        error: { code: "upstream_unavailable", message: "Unavailable" },
      }),
      { status: 503 },
    ),
  );
  await expect(
    backendProvider.searchAuctions!(0, { search: "Hyperion" }),
  ).rejects.toMatchObject({ kind: "unavailable" });
});
