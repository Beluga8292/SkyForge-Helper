import type { ZodType } from "zod";
import { ApiError, isAbortError, toApiError } from "@/api/errors";
import { authenticatedLimiter, parseRetryAfter, publicLimiter } from "@/api/rate-limit";
import { transportFetch } from "@/api/transport";
import { reportRequestFailure, reportRequestSuccess } from "@/stores/api-status";
import { sleep } from "@/utils/cn";

export interface ApiRequestOptions<T> {
  url: string;
  schema: ZodType<T>;
  signal?: AbortSignal;
  apiKey?: string | null;
  authenticated?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  label?: string;
  /** Mojang lookups must not affect the Hypixel API health indicator. */
  trackStatus?: boolean;
}

const DEFAULT_TIMEOUT = 20_000;
const MAX_RETRIES = 2;

export async function apiRequest<T>(options: ApiRequestOptions<T>): Promise<T> {
  const {
    url,
    schema,
    signal,
    apiKey,
    authenticated = false,
    timeoutMs = DEFAULT_TIMEOUT,
    maxRetries = MAX_RETRIES,
    trackStatus = true,
  } = options;

  if (authenticated && !apiKey) {
    throw new ApiError("missing-key", "Hypixel API key is not configured", { url });
  }

  let attempt = 0;
  while (true) {
    if (signal?.aborted) throw new ApiError("aborted", "Request aborted", { url });
    const controller = new AbortController();
    const cleanup = linkSignals(controller, signal);
    const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);
    const startedAt = performance.now();

    try {
      const limiter = authenticated ? authenticatedLimiter : publicLimiter;
      await limiter.acquire(signal);

      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "SkyBlockCompanion/0.1 (Tauri desktop client)",
      };
      if (authenticated && apiKey) headers["API-Key"] = apiKey;

      const response = await transportFetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      if (response.status === 429) {
        const retryAfter = parseRetryAfter(response.headers.get("Retry-After")) ?? 5_000;
        limiter.noteRateLimit(retryAfter);
        const retryHeader = response.headers.get("RateLimit-Reset");
        const resetMs = retryHeader ? Number(retryHeader) * 1000 : retryAfter;
        if (attempt < maxRetries) {
          attempt += 1;
          await sleep(Math.min(15_000, Math.max(1_000, resetMs)), signal);
          continue;
        }
        throw new ApiError("rate-limit", "Hypixel rate limit reached", { status: 429, retryAfterMs: resetMs, url });
      }

      if (response.status === 401 || response.status === 403) {
        throw new ApiError("auth", "Hypixel rejected the API key", { status: response.status, url });
      }

      if (response.status === 404) {
        throw new ApiError("not-found", "Resource not found", { status: 404, url });
      }

      if (response.status === 503) {
        if (attempt < maxRetries) {
          attempt += 1;
          await sleep(1_500 * attempt, signal);
          continue;
        }
        throw new ApiError("unavailable", "Hypixel API is temporarily unavailable", { status: 503, url });
      }

      if (!response.ok) {
        if (response.status >= 500 && attempt < maxRetries) {
          attempt += 1;
          await sleep(800 * 2 ** attempt, signal);
          continue;
        }
        throw new ApiError("server", `Hypixel API responded with HTTP ${response.status}`, { status: response.status, url });
      }

      const text = await response.text();
      if (response.status === 204 || !text.trim()) {
        throw new ApiError("not-found", "The API returned an empty response", { status: response.status, url });
      }
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch (error) {
        throw new ApiError("validation", "The API returned malformed JSON", { status: response.status, url, cause: error });
      }

      // Hypixel wraps most responses in { success, cause? }; surface the cause.
      if (json && typeof json === "object" && "success" in json && (json as { success?: unknown }).success === false) {
        const cause = (json as { cause?: unknown }).cause;
        const causeText = typeof cause === "string" ? cause : "Request was rejected";
        const kind = /key/i.test(causeText) ? "auth" : "server";
        throw new ApiError(kind, causeText, { status: response.status, url, detail: causeText });
      }

      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        const detail = parsed.error.issues
          .slice(0, 4)
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join("; ");
        throw new ApiError("validation", "Hypixel response failed schema validation", {
          status: response.status,
          url,
          detail,
          cause: parsed.error,
        });
      }

      if (trackStatus) reportRequestSuccess(Math.round(performance.now() - startedAt));
      return parsed.data;
    } catch (error) {
      if (isAbortError(error) || error instanceof ApiError) {
        if (trackStatus && error instanceof ApiError && error.kind !== "aborted") reportRequestFailure(error);
        throw error;
      }
      const apiError = toApiError(error, url);
      if (apiError.kind === "network" && attempt < maxRetries) {
        attempt += 1;
        await sleep(600 * 2 ** attempt, signal);
        continue;
      }
      reportRequestFailure(apiError);
      throw apiError;
    } finally {
      clearTimeout(timer);
      cleanup();
    }
  }
}

function linkSignals(controller: AbortController, external?: AbortSignal): () => void {
  if (!external) return () => undefined;
  if (external.aborted) {
    controller.abort(external.reason);
    return () => undefined;
  }
  const onAbort = () => controller.abort(external.reason);
  external.addEventListener("abort", onAbort, { once: true });
  return () => external.removeEventListener("abort", onAbort);
}
