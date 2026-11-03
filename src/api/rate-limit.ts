import { ApiError } from "@/api/errors";

/**
 * Client-side leaky bucket. Hypixel limits keys per 5 minute window and also
 * exposes per-minute RateLimit headers. We stay well below the documented
 * default (120 req/min) and only throttle authenticated requests.
 */
class RateLimiter {
  private timestamps: number[] = [];
  private blockedUntil = 0;
  private waiters: Array<() => void> = [];
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async acquire(signal?: AbortSignal): Promise<void> {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const now = Date.now();
      if (now < this.blockedUntil) {
        await this.wait(this.blockedUntil - now, signal);
        continue;
      }

      this.timestamps = this.timestamps.filter((ts) => now - ts < this.windowMs);
      if (this.timestamps.length < this.limit) {
        this.timestamps.push(now);
        return;
      }

      const oldest = this.timestamps[0] ?? now;
      const waitMs = Math.max(50, oldest + this.windowMs - now);
      await this.wait(waitMs, signal);
    }
  }

  noteRateLimit(retryAfterMs: number): void {
    this.blockedUntil = Math.max(this.blockedUntil, Date.now() + Math.max(1_000, retryAfterMs));
    this.wakeAll();
  }

  get remaining(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((ts) => now - ts < this.windowMs);
    return Math.max(0, this.limit - this.timestamps.length);
  }

  private wait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve();
      };
      const onAbort = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      const timer = window.setTimeout(finish, ms);
      this.waiters.push(finish);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  private wakeAll(): void {
    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) waiter();
  }
}

export const authenticatedLimiter = new RateLimiter(100, 60_000);
export const publicLimiter = new RateLimiter(150, 60_000);

export function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

export function rateLimitError(message: string, retryAfterMs: number, url: string, status = 429): ApiError {
  return new ApiError("rate-limit", message, { status, retryAfterMs, url });
}
