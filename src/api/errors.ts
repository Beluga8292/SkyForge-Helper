export type ApiErrorKind =
  | "configuration"
  | "network"
  | "timeout"
  | "aborted"
  | "auth"
  | "missing-key"
  | "rate-limit"
  | "not-found"
  | "validation"
  | "server"
  | "unavailable"
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly retryAfterMs: number | null;
  readonly url: string | null;
  readonly detail?: string;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: {
      status?: number | null;
      retryAfterMs?: number | null;
      url?: string | null;
      detail?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.url = options.url ?? null;
    this.detail = options.detail;
  }

  get isRetryable(): boolean {
    return this.kind === "network" || this.kind === "server" || this.kind === "rate-limit" || this.kind === "unavailable" || this.kind === "timeout";
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function toApiError(error: unknown, url: string | null = null): ApiError {
  if (error instanceof ApiError) return error;
  if (isAbortError(error)) return new ApiError("aborted", "Request aborted", { url });
  if (error instanceof TypeError) {
    return new ApiError("network", "Network request failed", { url, cause: error });
  }
  return new ApiError("unknown", error instanceof Error ? error.message : "Unknown error", { url, cause: error });
}

/** i18n key used by the UI to render a helpful, localized error message. */
export function errorMessageKey(error: unknown): string {
  const apiError = error instanceof ApiError ? error : toApiError(error);
  if (apiError.detail === "upstream_forbidden") return "errors.profileUnavailable";
  if (apiError.detail === "upstream_budget_unavailable") return "errors.upstreamBudgetUnavailable";
  if (apiError.detail === "backend_unavailable") return "errors.backendUnavailable";
  switch (apiError.kind) {
    case "configuration":
      return "errors.configuration";
    case "missing-key":
      return "errors.missingKey";
    case "auth":
      return "errors.auth";
    case "rate-limit":
      return "errors.rateLimit";
    case "not-found":
      return "errors.notFound";
    case "network":
      return "errors.network";
    case "timeout":
      return "errors.timeout";
    case "validation":
      return "errors.validation";
    case "unavailable":
      return "errors.unavailable";
    case "server":
      return "errors.server";
    case "aborted":
      return "errors.aborted";
    default:
      return "errors.unknown";
  }
}
