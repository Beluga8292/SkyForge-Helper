import type { AuctionSearchQuery } from "@/types/hypixel";
import { DEVELOPER_TOOLS_ENABLED } from "@/version";
import { analysisSchema, parseAnalysis } from "@/features/intelligence/models";
import {
  flipPageSchema,
  analyticsSchema,
  auctionPageSchema,
  overviewSchema,
  valuationResponseSchema,
} from "@/features/market/models";
import { normalizeBackendUrl } from "@/data/backend-url";
import { z } from "zod";
import { ApiError } from "@/api/errors";
import { parseRetryAfter } from "@/api/rate-limit";
import { isTauriRuntime, transportFetch } from "@/api/transport";
import {
  reportRequestFailure,
  reportRequestSuccess,
} from "@/stores/api-status";
import { getSettings } from "@/stores/settings";
import type { AppSettings, DataEnvelope } from "@/types/app";
import type {
  AuctionsResponse,
  BazaarResponse,
  HypixelAuction,
  ItemsResourceResponse,
  MojangProfile,
  PlayerResponse,
  SkyBlockProfilesResponse,
  SkillsResourceResponse,
} from "@/types/hypixel";
import {
  auctionSchema,
  bazaarResponseSchema,
  itemsResourceSchema,
  mojangProfileSchema,
  playerResponseSchema,
  profilesResponseSchema,
  skillsResourceSchema,
} from "@/api/schemas";
import type { BackendStatus, BazaarHistory, DataProvider } from "@/data/types";

/** Compile-time production endpoint. Override at build time with VITE_BACKEND_URL. */
export const PRODUCTION_BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim() || "";

const DEFAULT_TIMEOUT = 20_000;

const backendMetaSchema = z
  .object({
    fetched_at: z.string().optional(),
    cache_age_ms: z.number().optional(),
    stale: z.boolean().optional(),
    source: z.string().optional(),
    snapshot_id: z.string().nullable().optional(),
    revalidate_error: z.string().nullable().optional(),
  })
  .passthrough();

const backendAuctionsSchema = z
  .object({
    success: z.boolean(),
    page: z.number(),
    page_size: z.number(),
    total_pages: z.number(),
    total_auctions: z.number(),
    filtered_total: z.number().optional(),
    lastUpdated: z.number().nullable().optional(),
    search_version: z.number().optional(),
    snapshot_complete: z.boolean().nullable().optional(),
    snapshot_pages: z.number().optional(),
    identity_indexed: z.number().optional(),
    categories: z.array(z.string()).optional(),
    auctions: z.array(auctionSchema),
    meta: backendMetaSchema.optional(),
  })
  .passthrough();

const backendAuctionSchema = z
  .object({
    success: z.boolean(),
    auction: auctionSchema,
    meta: backendMetaSchema.optional(),
  })
  .passthrough();

const statusSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    version: z.string(),
    environment: z.string(),
    services: z.record(
      z.string(),
      z.object({
        status: z.enum(["ok", "degraded", "unavailable", "not_configured"]),
        detail: z.string().nullable().optional(),
      }),
    ),
    cache: z.record(z.string(), z.unknown()),
    rate_limit: z.record(z.string(), z.unknown()).optional(),
    history: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const historySchema = z
  .object({
    product_id: z.string(),
    range: z.enum(["1h", "24h", "7d", "30d"]),
    interval: z.string(),
    points: z.array(
      z.object({
        ts: z.string(),
        buy_price: z.number(),
        sell_price: z.number(),
        buy_volume: z.number(),
        sell_volume: z.number(),
      }),
    ),
    note: z.string().nullable().optional(),
    meta: backendMetaSchema.optional(),
  })
  .passthrough();

const ERROR_KINDS: Record<string, ApiError["kind"]> = {
  hypixel_key_missing: "configuration",
  backend_misconfigured: "unavailable",
  upstream_auth: "auth",
  upstream_forbidden: "auth",
  upstream_rate_limited: "rate-limit",
  backend_rate_limited: "rate-limit",
  upstream_timeout: "timeout",
  upstream_unavailable: "unavailable",
  upstream_budget_unavailable: "unavailable",
  upstream_invalid_response: "validation",
  not_found: "not-found",
  validation_error: "validation",
  cache_unavailable: "unavailable",
  database_unavailable: "unavailable",
};

export { normalizeBackendUrl } from "@/data/backend-url";

/**
 * Production always uses the compiled-in trusted endpoint. A custom URL is
 * honoured only when the user explicitly enabled developer mode.
 */
export function resolveBackendUrl(
  settings: AppSettings,
  developerTools = DEVELOPER_TOOLS_ENABLED,
): string {
  if (developerTools && settings.developerMode) {
    const custom = normalizeBackendUrl(settings.backendUrl);
    if (custom) return custom;
  }
  if (import.meta.env.DEV)
    return isTauriRuntime() ? "http://127.0.0.1:8000" : "/backend";
  return normalizeBackendUrl(PRODUCTION_BACKEND_URL) ?? "";
}

export function backendUrlLabel(settings: AppSettings): string {
  const url = resolveBackendUrl(settings);
  if (!url) return "";
  return url.startsWith("/") ? `${window.location.origin}${url}` : url;
}

// FastAPI emits null for absent optional fields; the existing desktop models
// use undefined. Preserve meaningful empty player/profile responses.
function adaptBackendPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(adaptBackendPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, child]) =>
            child !== null || key === "player" || key === "profiles",
        )
        .map(([key, child]) => [key, adaptBackendPayload(child)]),
    );
  }
  return value;
}

interface BackendRequestOptions<T> {
  path: string;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
  timeoutMs?: number;
  trackStatus?: boolean;
  /** Optional tolerant parser applied before schema validation. */
  parse?: (value: unknown) => T;
}

async function backendRequest<T>({
  path,
  schema,
  signal,
  timeoutMs = DEFAULT_TIMEOUT,
  trackStatus = true,
  parse,
}: BackendRequestOptions<T>): Promise<T> {
  const settings = getSettings();
  const base = resolveBackendUrl(settings);
  if (!base)
    throw new ApiError("configuration", "Backend endpoint is not configured");
  signal?.throwIfAborted();
  const url = `${base}/api/v1${path}`;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Timeout", "TimeoutError")),
    timeoutMs,
  );
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  const startedAt = performance.now();
  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : null;

  try {
    const response = await transportFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "SkyBlockCompanion/0.2 (Tauri desktop client)",
        ...(requestId ? { "X-Request-ID": requestId } : {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      const code = body?.error?.code ?? "http_error";
      const kind =
        ERROR_KINDS[code] ??
        (response.status === 404
          ? "not-found"
          : response.status === 429
            ? "rate-limit"
            : response.status >= 500
              ? "network"
              : "server");
      const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
      const error = new ApiError(
        kind,
        body?.error?.message ??
          `SkyForge Helper backend responded with HTTP ${response.status}`,
        {
          status: response.status,
          retryAfterMs: retryAfter ?? undefined,
          url,
          detail:
            code === "http_error" && response.status >= 500
              ? "backend_unavailable"
              : code,
        },
      );
      throw error;
    }

    const json = await response.json().catch((cause: unknown) => {
      throw new ApiError("validation", "The backend returned malformed JSON", {
        url,
        cause,
      });
    });
    const payload =
      path.startsWith("/market/") || path.startsWith("/intelligence/")
        ? json
        : adaptBackendPayload(json);
    if (parse) {
      try {
        const data = parse(payload);
        controller.signal.throwIfAborted();
        if (trackStatus)
          reportRequestSuccess(Math.round(performance.now() - startedAt));
        return data;
      } catch (cause) {
        const detail =
          cause instanceof z.ZodError
            ? cause.issues
                .slice(0, 4)
                .map(
                  (issue) =>
                    `${issue.path.join(".") || "root"}: ${issue.message}`,
                )
                .join("; ")
            : cause instanceof Error
              ? cause.message
              : "unexpected analysis shape";
        throw new ApiError(
          "validation",
          "The backend response failed schema validation",
          { url, detail, cause },
        );
      }
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .slice(0, 4)
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; ");
      throw new ApiError(
        "validation",
        "The backend response failed schema validation",
        { url, detail, cause: parsed.error },
      );
    }
    controller.signal.throwIfAborted();
    if (trackStatus)
      reportRequestSuccess(Math.round(performance.now() - startedAt));
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) {
      if (trackStatus && !signal?.aborted) reportRequestFailure(error);
      throw error;
    }
    if (controller.signal.aborted) {
      throw new ApiError(
        signal?.aborted ? "aborted" : "timeout",
        signal?.aborted ? "Request aborted" : "Backend request timed out",
        { url, cause: error },
      );
    }
    const apiError = new ApiError(
      "network",
      "SkyForge Helper backend is unreachable",
      { url, cause: error, detail: "backend_unavailable" },
    );
    if (trackStatus) reportRequestFailure(apiError);
    throw apiError;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function envelope<T>(
  data: T,
  meta: z.infer<typeof backendMetaSchema> | undefined,
  provider: "backend" = "backend",
): DataEnvelope<T> {
  const fetchedAt = meta?.fetched_at ? Date.parse(meta.fetched_at) : Date.now();
  const updatedAt = Number.isFinite(fetchedAt) ? fetchedAt : Date.now();
  return {
    data,
    updatedAt,
    source:
      meta?.source === "cache" || meta?.source === "memory"
        ? "cache"
        : "network",
    stale: Boolean(meta?.stale),
    provider,
    meta: {
      fetchedAt: updatedAt,
      cacheAgeMs: meta?.cache_age_ms ?? Math.max(0, Date.now() - updatedAt),
      stale: Boolean(meta?.stale),
      source: meta?.source ?? "upstream",
      snapshotId: meta?.snapshot_id ?? null,
      revalidateError: meta?.revalidate_error ?? null,
    },
  };
}

export const backendProvider: DataProvider = {
  async getIntelligence(uuid, profileId, market = false, signal) {
    return backendRequest({
      path: `/intelligence/players/${encodeURIComponent(uuid)}/profiles/${encodeURIComponent(profileId)}/overview?market=${market}`,
      schema: analysisSchema,
      parse: parseAnalysis,
      signal,
      timeoutMs: 90000,
    });
  },
  async getFlips(params, signal) {
    return backendRequest({
      path: `/market/bazaar/flips?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`,
      schema: flipPageSchema,
      signal,
    });
  },
  async getAnalytics(id, range, quantity, tax, signal, mode = "order") {
    return backendRequest({
      path: `/market/bazaar/${encodeURIComponent(id)}/analytics?range=${range}&quantity=${quantity}&tax_pct=${tax}&mode=${mode}`,
      schema: analyticsSchema,
      signal,
    });
  },
  async getAuctionOpportunities(params, signal) {
    return backendRequest({
      path: `/market/auctions/opportunities?${new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => [k, String(v)]),
      )}`,
      schema: auctionPageSchema,
      signal,
      timeoutMs: 60000,
    });
  },
  async getAuctionValuation(id, signal) {
    return backendRequest({
      path: `/market/auctions/${encodeURIComponent(id)}/valuation`,
      schema: valuationResponseSchema,
      signal,
      timeoutMs: 60000,
    });
  },
  async getMarketOverview(tax, signal) {
    return backendRequest({
      path: `/market/overview?tax_pct=${tax}`,
      schema: overviewSchema,
      signal,
    });
  },
  id: "backend",
  label: "SkyForge Helper Cloud",
  isDemo: false,

  async getBazaar(signal) {
    const payload = await backendRequest({
      path: "/bazaar",
      schema: bazaarResponseSchema,
      signal,
    });
    return envelope(
      payload as BazaarResponse,
      (payload as { meta?: z.infer<typeof backendMetaSchema> }).meta,
    );
  },

  async getAuctions(page, signal) {
    const payload = await backendRequest({
      path: `/auctions?page=${Math.max(0, Math.floor(page))}&page_size=50`,
      schema: backendAuctionsSchema,
      signal,
    });
    const mapped: AuctionsResponse = {
      success: payload.success,
      page: payload.page,
      totalPages: payload.total_pages,
      totalAuctions: payload.total_auctions,
      auctions: payload.auctions,
    };
    return envelope(mapped, payload.meta);
  },

  async searchAuctions(page, query: AuctionSearchQuery, signal) {
    const params = new URLSearchParams({
      page: String(Math.max(0, Math.floor(page))),
      page_size: "50",
      sort: query.sort ?? "ending_soon",
    });
    if (query.search?.trim()) params.set("search", query.search.trim());
    if (query.auctionType === "bin") params.set("bin_only", "true");
    if (query.auctionType) params.set("auction_type", query.auctionType);
    if (query.rarity) params.set("rarity", query.rarity);
    if (query.category) params.set("category", query.category);
    if (query.minPrice !== undefined)
      params.set("min_price", String(query.minPrice));
    if (query.maxPrice !== undefined)
      params.set("max_price", String(query.maxPrice));
    if (query.endingWithin !== undefined)
      params.set("ending_within", String(query.endingWithin));
    const payload = await backendRequest({
      path: `/auctions?${params}`,
      schema: backendAuctionsSchema,
      signal,
    });
    if (
      payload.filtered_total === undefined ||
      (!payload.search_version &&
        (query.auctionType === "auction" ||
          query.rarity ||
          query.category ||
          query.minPrice !== undefined ||
          query.maxPrice !== undefined ||
          query.endingWithin !== undefined))
    ) {
      throw new ApiError(
        "unavailable",
        "Auction filters require a backend update",
        { detail: "auction_search_update_required" },
      );
    }
    return envelope(
      {
        success: payload.success,
        page: payload.page,
        totalPages: payload.total_pages,
        totalAuctions: payload.total_auctions,
        lastUpdated: payload.lastUpdated ?? undefined,
        filteredTotal: payload.filtered_total,
        snapshotComplete: payload.snapshot_complete,
        snapshotPages: payload.snapshot_pages,
        identityIndexed: payload.identity_indexed,
        categories: payload.categories,
        searchVersion: payload.search_version,
        auctions: payload.auctions,
      },
      payload.meta,
    );
  },

  async getAuction(id, signal) {
    const payload = await backendRequest({
      path: `/auctions/${encodeURIComponent(id)}`,
      schema: backendAuctionSchema,
      signal,
    });
    return envelope(payload.auction as HypixelAuction, payload.meta);
  },

  async getPlayer(uuid, signal) {
    const payload = await backendRequest({
      path: `/players/${encodeURIComponent(uuid)}`,
      schema: playerResponseSchema,
      signal,
    });
    return envelope(
      payload as PlayerResponse,
      (payload as { meta?: z.infer<typeof backendMetaSchema> }).meta,
    );
  },

  async getProfiles(uuid, signal) {
    const payload = await backendRequest({
      path: `/players/${encodeURIComponent(uuid)}/profiles`,
      schema: profilesResponseSchema,
      signal,
    });
    return envelope(
      payload as SkyBlockProfilesResponse,
      (payload as { meta?: z.infer<typeof backendMetaSchema> }).meta,
    );
  },

  async resolveName(name, signal) {
    const payload = await backendRequest({
      path: `/mojang/${encodeURIComponent(name)}`,
      schema: mojangProfileSchema,
      signal,
    });
    return {
      data: payload as MojangProfile,
      updatedAt: Date.now(),
      source: "network",
      provider: "backend",
    };
  },

  async getItems(signal) {
    const payload = await backendRequest({
      path: "/resources/items",
      schema: itemsResourceSchema,
      signal,
    });
    return envelope(
      payload as ItemsResourceResponse,
      (payload as { meta?: z.infer<typeof backendMetaSchema> }).meta,
    );
  },

  async getSkills(signal) {
    const payload = await backendRequest({
      path: "/resources/skills",
      schema: skillsResourceSchema,
      signal,
    });
    return envelope(
      payload as SkillsResourceResponse,
      (payload as { meta?: z.infer<typeof backendMetaSchema> }).meta,
    );
  },

  async getHistory(productId, range, signal) {
    const payload = await backendRequest({
      path: `/bazaar/${encodeURIComponent(productId)}/history?range=${range}`,
      schema: historySchema,
      signal,
    });
    return payload as BazaarHistory;
  },
};

export async function fetchBackendStatus(
  signal?: AbortSignal,
): Promise<BackendStatus> {
  const payload = await backendRequest({
    path: "/status",
    schema: statusSchema,
    signal,
    trackStatus: false,
  });
  return payload as unknown as BackendStatus;
}
