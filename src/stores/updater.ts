import { create } from "zustand";
import type { TranslationKey } from "@/locales";
import {
  checkForUpdate,
  downloadUpdate,
  installUpdate,
  relaunchApp,
  updaterAvailable,
  type UpdateDetails,
} from "@/services/updater";

export type UpdaterPhase =
  | "unsupported"
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "downloading"
  | "ready"
  | "installing"
  | "error";

interface UpdaterStore {
  phase: UpdaterPhase;
  info: UpdateDetails | null;
  downloaded: number;
  total: number | null;
  errorKey: TranslationKey | null;
  dismissed: boolean;
  lastCheckedAt: number | null;
  check: (manual?: boolean) => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
}

export const useUpdaterStore = create<UpdaterStore>((set, get) => ({
  phase: updaterAvailable() ? "idle" : "unsupported",
  info: null,
  downloaded: 0,
  total: null,
  errorKey: null,
  dismissed: false,
  lastCheckedAt: null,

  check: async () => {
    const { phase } = get();
    if (phase === "checking" || phase === "downloading" || phase === "installing") return;
    if (!updaterAvailable()) {
      set({ phase: "unsupported" });
      return;
    }
    set({ phase: "checking", errorKey: null });
    try {
      const info = await checkForUpdate();
      set({
        phase: info ? "available" : "current",
        info,
        dismissed: false,
        lastCheckedAt: Date.now(),
      });
    } catch {
      set({ phase: "error", errorKey: "update.error" });
    }
  },

  download: async () => {
    if (get().phase !== "available") return;
    set({ phase: "downloading", downloaded: 0, total: null, dismissed: false, errorKey: null });
    try {
      await downloadUpdate(({ downloaded, total }) => set({ downloaded, total }));
      // Re-open the dialog so the user explicitly confirms the restart.
      set({ phase: "ready", dismissed: false });
    } catch {
      set({ phase: "error", errorKey: "update.downloadError" });
    }
  },

  install: async () => {
    if (get().phase !== "ready") return;
    set({ phase: "installing", errorKey: null });
    try {
      await installUpdate();
      await relaunchApp();
    } catch {
      set({ phase: "error", errorKey: "update.installError" });
    }
  },

  dismiss: () => set({ dismissed: true }),
}));
