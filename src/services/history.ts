import { isTauriRuntime } from "@/api/transport";
import type { MarketHistoryPoint } from "@/types/app";
import { invokeDesktop } from "@/services/desktop";

const BROWSER_KEY = "sbc:market-history";

async function readBrowserHistory(): Promise<MarketHistoryPoint[]> {
  try {
    const raw = window.localStorage.getItem(BROWSER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (point): point is MarketHistoryPoint =>
        Boolean(point && typeof point === "object" && typeof (point as MarketHistoryPoint).productId === "string"),
    );
  } catch {
    return [];
  }
}

export async function recordMarketHistory(points: MarketHistoryPoint[]): Promise<void> {
  if (!points.length) return;
  await invokeDesktop<null>("history_record", { points });
  if (isTauriRuntime()) return;
  const existing = await readBrowserHistory();
  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 14;
  const merged = [...existing, ...points].filter((point) => point.ts >= cutoff);
  try {
    window.localStorage.setItem(BROWSER_KEY, JSON.stringify(merged.slice(-4000)));
  } catch {
    // best-effort
  }
}

export async function getMarketHistory(productId: string, limit = 288): Promise<MarketHistoryPoint[]> {
  const desktop = await invokeDesktop<MarketHistoryPoint[]>("history_get", { productId, limit });
  if (desktop !== null) return [...desktop].sort((a, b) => a.ts - b.ts);
  const entries = (await readBrowserHistory()).filter((point) => point.productId === productId);
  return entries.sort((a, b) => a.ts - b.ts).slice(-limit);
}

export async function getHistoryCount(): Promise<number> {
  const desktop = await invokeDesktop<number>("history_count", {});
  if (desktop !== null) return desktop;
  return (await readBrowserHistory()).length;
}

export async function clearMarketHistory(): Promise<void> {
  await invokeDesktop<null>("history_clear", {});
  if (isTauriRuntime()) return;
  window.localStorage.removeItem(BROWSER_KEY);
}
