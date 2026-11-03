import { create } from "zustand";
import type { ApiHealth, ApiStatusInfo } from "@/types/app";

interface ApiStatusStore extends ApiStatusInfo {
  lastErrorKind: string | null;
  setHealth: (health: ApiHealth, error?: string | null) => void;
  reportSuccess: (latencyMs: number) => void;
  reportFailure: (error: { kind: string; message: string }) => void;
  reset: () => void;
}

const initialState: ApiStatusInfo = {
  health: "unknown",
  lastChecked: null,
  lastError: null,
  latencyMs: null,
};

export const useApiStatusStore = create<ApiStatusStore>((set) => ({
  ...initialState,
  lastErrorKind: null,
  setHealth: (health, error = null) =>
    set({
      health,
      lastError: error,
      lastChecked: Date.now(),
      latencyMs: null,
    }),
  reportSuccess: (latencyMs) =>
    set({
      health: "online",
      lastChecked: Date.now(),
      lastError: null,
      lastErrorKind: null,
      latencyMs,
    }),
  reportFailure: (error) =>
    set((state) => ({
      health:
        error.kind === "auth" || error.kind === "missing-key"
          ? "unauthorized"
          : error.kind === "rate-limit" || error.kind === "unavailable"
            ? "degraded"
            : "offline",
      lastChecked: Date.now(),
      lastError: error.message,
      lastErrorKind: error.kind,
      // Keep the last measured latency on failures, it is still useful context.
      latencyMs: state.latencyMs,
    })),
  reset: () => set({ ...initialState, lastErrorKind: null }),
}));

/** Called by the API client, outside of React. */
export function reportRequestSuccess(latencyMs: number): void {
  useApiStatusStore.getState().reportSuccess(latencyMs);
}

export function reportRequestFailure(error: { kind: string; message: string }): void {
  useApiStatusStore.getState().reportFailure(error);
}
