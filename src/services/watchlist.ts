import { isTauriRuntime } from "@/api/transport";
import type { CacheStats, WatchlistEntry } from "@/types/app";
import { invokeDesktop } from "@/services/desktop";

const WATCHLIST_KEY = "sbc:watchlist";

async function readBrowserWatchlist(): Promise<WatchlistEntry[]> {
  try {
    const raw = window.localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWatchlistEntry);
  } catch {
    return [];
  }
}

function isWatchlistEntry(value: unknown): value is WatchlistEntry {
  return Boolean(value && typeof value === "object" && typeof (value as WatchlistEntry).productId === "string");
}

async function writeBrowserWatchlist(entries: WatchlistEntry[]): Promise<void> {
  window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(entries));
}

export async function listWatchlist(): Promise<WatchlistEntry[]> {
  const desktop = await invokeDesktop<WatchlistEntry[]>("watchlist_list", {});
  if (desktop !== null) return desktop;
  return readBrowserWatchlist();
}

export async function addToWatchlist(productId: string, targetPrice: number | null = null): Promise<WatchlistEntry[]> {
  const entry: WatchlistEntry = { productId, addedAt: Date.now(), targetPrice };
  await invokeDesktop<null>("watchlist_add", { productId, addedAt: entry.addedAt, targetPrice });
  if (isTauriRuntime()) return listWatchlist();
  const entries = await readBrowserWatchlist();
  const next = [entry, ...entries.filter((item) => item.productId !== productId)];
  await writeBrowserWatchlist(next);
  return next;
}

export async function removeFromWatchlist(productId: string): Promise<WatchlistEntry[]> {
  await invokeDesktop<null>("watchlist_remove", { productId });
  if (isTauriRuntime()) return listWatchlist();
  const next = (await readBrowserWatchlist()).filter((entry) => entry.productId !== productId);
  await writeBrowserWatchlist(next);
  return next;
}

export async function setWatchlistTarget(productId: string, targetPrice: number | null): Promise<WatchlistEntry[]> {
  await invokeDesktop<null>("watchlist_set_target", { productId, targetPrice });
  if (isTauriRuntime()) return listWatchlist();
  const entries = await readBrowserWatchlist();
  const next = entries.map((entry) => (entry.productId === productId ? { ...entry, targetPrice } : entry));
  await writeBrowserWatchlist(next);
  return next;
}

export async function clearAllLocalData(): Promise<CacheStats> {
  const desktop = await invokeDesktop<CacheStats>("cache_clear", {});
  if (desktop !== null) return desktop;
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith("sbc:")) keys.push(key);
  }
  for (const key of keys) window.localStorage.removeItem(key);
  return { entries: 0, bytes: 0, historyPoints: 0, oldest: null };
}
