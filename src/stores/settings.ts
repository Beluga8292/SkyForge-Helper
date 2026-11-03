import { useApiStatusStore } from "@/stores/api-status";
import { create } from "zustand";
import type { AppSettings, LinkedProfile } from "@/types/app";
import { DEFAULT_SETTINGS, clearPersistedSettings, loadSettings, persistSettings, sanitizeSettings } from "@/services/settings";

interface SettingsStore {
  settings: AppSettings;
  hydrated: boolean;
  saving: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => void;
  setLinkedProfile: (profile: LinkedProfile | null) => void;
  addRecentSearch: (name: string) => void;
  reset: () => Promise<void>;
}

let saveTimer: number | null = null;
let applyScheduled = false;

export function applyAppearance(settings: AppSettings): void {
  if (typeof document === "undefined") return;
  if (applyScheduled) return;
  applyScheduled = true;
  window.requestAnimationFrame(() => {
    applyScheduled = false;
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.lang = settings.language;
    root.style.setProperty("--ui-scale", String(settings.uiScale));
    root.dataset.reducedMotion = String(settings.reducedMotion);
  });
}

function scheduleSave(get: () => AppSettings): void {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void persistSettings(get());
  }, 250);
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  hydrated: false,
  saving: false,
  error: null,

  hydrate: async () => {
    try {
      const settings = await loadSettings();
      set({ settings, hydrated: true, error: null });
      applyAppearance(settings);
    } catch (error) {
      set({ settings: { ...DEFAULT_SETTINGS }, hydrated: true, error: error instanceof Error ? error.message : "Failed to load settings" });
      applyAppearance(DEFAULT_SETTINGS);
    }
  },

  update: (patch) => {
    const next = sanitizeSettings({ ...get().settings, ...patch,
      ...(patch.dataMode ? { demoMode: patch.dataMode === "demo" } : patch.demoMode !== undefined ? { dataMode: patch.demoMode ? "demo" : "backend" } : {}),
    });
    const previous = get().settings;
    if (previous.dataMode !== next.dataMode || previous.backendUrl !== next.backendUrl || previous.developerMode !== next.developerMode) {
      useApiStatusStore.getState().reset();
    }
    set({ settings: next, saving: true });
    applyAppearance(next);
    scheduleSave(() => get().settings);
    window.setTimeout(() => set({ saving: false }), 300);
  },

  setLinkedProfile: (profile) => {
    get().update({ lastProfile: profile });
  },

  addRecentSearch: (name) => {
    const clean = name.trim();
    if (!clean) return;
    const current = get().settings.recentSearches;
    const next = [clean, ...current.filter((entry) => entry.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
    get().update({ recentSearches: next });
  },

  reset: async () => {
    if (saveTimer) window.clearTimeout(saveTimer);
    await clearPersistedSettings();
    set({ settings: { ...DEFAULT_SETTINGS }, hydrated: true, saving: false, error: null });
    applyAppearance(DEFAULT_SETTINGS);
  },
}));

/** Non-reactive helpers for services and API hooks. */
export function getSettings(): AppSettings {
  return useSettingsStore.getState().settings;
}

export function isDemoMode(): boolean {
  return useSettingsStore.getState().settings.demoMode;
}
