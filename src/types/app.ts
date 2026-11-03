export type Language = "ru" | "en";

export type ThemeId = "graphite" | "midnight" | "light";

export type DataSource = "demo" | "live";

export type DataMode = "backend" | "direct" | "demo";

export interface DataMeta {
  fetchedAt: number;
  cacheAgeMs: number;
  stale: boolean;
  source: string;
  snapshotId?: string | null;
  revalidateError?: string | null;
}

export interface AppSettings {
  language: Language;
  theme: ThemeId;
  /** 0.9 | 1 | 1.1 | 1.25 */
  uiScale: number;
  /** Seconds between automatic refreshes. Allowed range: 60..900. */
  refreshIntervalSec: number;
  /** Bazaar sell tax in percent. Hypixel base tax is 1.25%. */
  bazaarFeePct: number;
  /** How live data is obtained. Backend is the recommended default. */
  dataMode: DataMode;
  /** Custom backend URL. Only honoured while developerMode is enabled. */
  backendUrl: string;
  /** Derived convenience flag: true only when dataMode is "demo". */
  demoMode: boolean;
  developerMode: boolean;
  notificationsEnabled: boolean;
  watchlistAlerts: boolean;
  hideBalances: boolean;
  showItemValues: boolean;
  reducedMotion: boolean;
  lastProfile: LinkedProfile | null;
  recentSearches: string[];
}

export interface LinkedProfile {
  uuid: string;
  name: string;
  profileId: string;
  profileName?: string;
  gameMode?: string;
}

export interface DataEnvelope<T> {
  data: T;
  updatedAt: number;
  source: "network" | "cache";
  stale?: boolean;
  demo?: boolean;
  provider?: DataMode;
  meta?: DataMeta;
}

export interface CacheEntry {
  key: string;
  payload: string;
  updatedAt: number;
}

export interface CacheStats {
  entries: number;
  bytes: number;
  historyPoints: number;
  oldest: number | null;
}

export interface WatchlistEntry {
  productId: string;
  addedAt: number;
  targetPrice: number | null;
}

export interface MarketHistoryPoint {
  productId: string;
  ts: number;
  buyPrice: number;
  sellPrice: number;
  buyVolume: number;
  sellVolume: number;
}

export interface SearchHistoryEntry {
  uuid: string;
  name: string;
  lastSeen: number;
}

export interface SecretStatus {
  configured: boolean;
  storage: "os-keychain" | "session" | "none";
  hint: string | null;
}

export type ApiHealth = "unknown" | "online" | "offline" | "unauthorized" | "degraded";

export interface ApiStatusInfo {
  health: ApiHealth;
  lastChecked: number | null;
  lastError: string | null;
  latencyMs: number | null;
}
