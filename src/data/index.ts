import { DEVELOPER_TOOLS_ENABLED } from "@/version";
import { useMemo } from "react";
import { useSettingsStore } from "@/stores/settings";
import { backendProvider, resolveBackendUrl } from "@/data/backend";
import { directProvider } from "@/data/direct";
import { demoProvider } from "@/data/demo";
import type { DataProvider } from "@/data/types";
import type { AppSettings, DataMode } from "@/types/app";

export const DATA_PROVIDERS: Record<DataMode, DataProvider> = {
  backend: backendProvider,
  direct: directProvider,
  demo: demoProvider,
};

export function resolveDataMode(
  settings: AppSettings,
  developerTools = DEVELOPER_TOOLS_ENABLED,
): DataMode {
  if (!developerTools) return "backend";
  if (settings.demoMode) return "demo";
  return settings.dataMode;
}

export function providerForMode(mode: DataMode): DataProvider {
  return DATA_PROVIDERS[mode];
}

export function useDataProvider(): DataProvider {
  const mode = useSettingsStore((state) => resolveDataMode(state.settings));
  return useMemo(() => providerForMode(mode), [mode]);
}

export { backendProvider, directProvider, demoProvider };
export type { DataProvider };

/** Include the actual source in every query and persisted-cache key. */
export function useDataScope(): string {
  const settings = useSettingsStore((state) => state.settings);
  const mode = resolveDataMode(settings);
  return mode === "backend" ? `backend:${resolveBackendUrl(settings)}` : mode;
}
