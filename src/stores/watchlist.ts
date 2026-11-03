import { create } from "zustand";
import type { WatchlistEntry } from "@/types/app";
import {
  addToWatchlist,
  listWatchlist,
  removeFromWatchlist,
  setWatchlistTarget,
} from "@/services/watchlist";

interface WatchlistStore {
  entries: WatchlistEntry[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  toggle: (productId: string) => Promise<boolean>;
  remove: (productId: string) => Promise<void>;
  setTarget: (productId: string, target: number | null) => Promise<void>;
  isWatched: (productId: string) => boolean;
}

export const useWatchlistStore = create<WatchlistStore>((set, get) => ({
  entries: [],
  loaded: false,
  loading: false,
  error: null,

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const entries = await listWatchlist();
      set({ entries, loaded: true, loading: false });
    } catch (error) {
      set({ loading: false, loaded: true, error: error instanceof Error ? error.message : "Failed to load watchlist" });
    }
  },

  toggle: async (productId) => {
    const exists = get().entries.some((entry) => entry.productId === productId);
    try {
      if (exists) {
        const entries = await removeFromWatchlist(productId);
        set({ entries });
        return false;
      }
      const entries = await addToWatchlist(productId, null);
      set({ entries });
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Watchlist update failed" });
      throw error;
    }
  },

  remove: async (productId) => {
    const entries = await removeFromWatchlist(productId);
    set({ entries });
  },

  setTarget: async (productId, target) => {
    const entries = await setWatchlistTarget(productId, target);
    set({ entries });
  },

  isWatched: (productId) => get().entries.some((entry) => entry.productId === productId),
}));
