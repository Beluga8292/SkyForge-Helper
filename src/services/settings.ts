import { RELEASE_BUILD } from "@/version";
import { isTauriRuntime } from "@/api/transport";
import { normalizeBackendUrl } from "@/data/backend-url";
import type { AppSettings } from "@/types/app";
import { clamp } from "@/utils/cn";
import { invokeDesktop } from "@/services/desktop";

const SETTINGS_KEY = "sbc:settings";

export const DEFAULT_SETTINGS: AppSettings = {
  language: "ru",
  theme: "graphite",
  uiScale: 1,
  refreshIntervalSec: 120,
  bazaarFeePct: 1.25,
  dataMode: "backend",
  backendUrl: "",
  demoMode: false,
  developerMode: false,
  notificationsEnabled: true,
  watchlistAlerts: true,
  hideBalances: false,
  showItemValues: false,
  reducedMotion: false,
  lastProfile: null,
  recentSearches: [],
};

const THEMES = new Set(["graphite", "midnight", "light"]);
const LANGUAGES = new Set(["ru", "en"]);
const SCALES = [0.9, 1, 1.1, 1.25];
const DATA_MODES = new Set(["backend", "direct", "demo"]);

export function sanitizeSettings(input: unknown): AppSettings {
  const raw = input && typeof input === "object" ? (input as Partial<AppSettings>) : {};
  const refresh = typeof raw.refreshIntervalSec === "number" ? clamp(raw.refreshIntervalSec, 60, 900) : DEFAULT_SETTINGS.refreshIntervalSec;
  const fee = typeof raw.bazaarFeePct === "number" ? clamp(raw.bazaarFeePct, 0, 10) : DEFAULT_SETTINGS.bazaarFeePct;
  const scale = typeof raw.uiScale === "number" && SCALES.includes(raw.uiScale) ? raw.uiScale : DEFAULT_SETTINGS.uiScale;
  const lastProfile =
    raw.lastProfile &&
    typeof raw.lastProfile === "object" &&
    typeof raw.lastProfile.uuid === "string" &&
    typeof raw.lastProfile.name === "string" &&
    typeof raw.lastProfile.profileId === "string"
      ? {
          uuid: raw.lastProfile.uuid,
          name: raw.lastProfile.name,
          profileId: raw.lastProfile.profileId,
          profileName: typeof raw.lastProfile.profileName === "string" ? raw.lastProfile.profileName : undefined,
          gameMode: typeof raw.lastProfile.gameMode === "string" ? raw.lastProfile.gameMode : undefined,
        }
      : null;

  const dataMode = (
    raw.dataMode && DATA_MODES.has(raw.dataMode)
      ? raw.dataMode
      : raw.demoMode
        ? "demo"
        : "backend"
  ) as AppSettings["dataMode"];

  return {
    language: raw.language && LANGUAGES.has(raw.language) ? raw.language : DEFAULT_SETTINGS.language,
    theme: raw.theme && THEMES.has(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
    uiScale: scale,
    refreshIntervalSec: Math.round(refresh),
    bazaarFeePct: Number(fee.toFixed(3)),
    dataMode,
    backendUrl: typeof raw.backendUrl === "string" ? normalizeBackendUrl(raw.backendUrl.slice(0, 300)) ?? "" : "",
    demoMode: dataMode === "demo",
    developerMode: !RELEASE_BUILD && Boolean(raw.developerMode),
    notificationsEnabled: raw.notificationsEnabled !== false,
    watchlistAlerts: raw.watchlistAlerts !== false,
    hideBalances: Boolean(raw.hideBalances),
    showItemValues: raw.showItemValues === true,
    reducedMotion: Boolean(raw.reducedMotion),
    lastProfile,
    recentSearches: Array.isArray(raw.recentSearches)
      ? raw.recentSearches.filter((entry): entry is string => typeof entry === "string").slice(0, 8)
      : [],
  };
}

/**
 * Settings are persisted as a single versioned JSON document. In the desktop
 * app it lives in SQLite (`settings` table), in the browser preview in
 * localStorage. API keys are never stored here — see services/secrets.ts.
 */
export async function loadSettings(): Promise<AppSettings> {
  const desktop = await invokeDesktop<string | null>("settings_get", { key: SETTINGS_KEY });
  if (desktop !== null) {
    try {
      return sanitizeSettings(JSON.parse(desktop));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function persistSettings(settings: AppSettings): Promise<void> {
  const payload = JSON.stringify(settings);
  await invokeDesktop<null>("settings_set", { key: SETTINGS_KEY, value: payload });
  if (isTauriRuntime()) return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, payload);
  } catch {
    // Settings are non-critical; the UI keeps working in memory.
  }
}

export async function clearPersistedSettings(): Promise<void> {
  await invokeDesktop<null>("settings_delete", { key: SETTINGS_KEY });
  if (isTauriRuntime()) return;
  window.localStorage.removeItem(SETTINGS_KEY);
}
