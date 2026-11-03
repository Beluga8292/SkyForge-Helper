import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/api/errors";
import { fetchBackendStatus, backendUrlLabel } from "@/data/backend";
import { useDataProvider } from "@/data";
import { useApiStatusStore } from "@/stores/api-status";
import { useSettingsStore } from "@/stores/settings";
import type { BackendStatus, ServiceState } from "@/data/types";
import type { DataMode } from "@/types/app";

export type ConnectionHealth = "checking" | "connected" | "degraded" | "offline" | "misconfigured" | "direct" | "demo";

export interface ConnectionService {
  id: string;
  state: ServiceState["status"];
  detail?: string | null;
}

export interface ConnectionInfo {
  version?: string;
  mode: DataMode;
  modeLabel: string;
  endpoint: string | null;
  health: ConnectionHealth;
  lastSuccessAt: number | null;
  cacheAgeMs: number | null;
  services: ConnectionService[];
  error: ApiError | null;
  isRefreshing: boolean;
  refresh: () => void;
}

const SERVICE_ORDER = ["hypixel_api", "bazaar_cache", "auction_snapshot", "database", "redis"];

function toServices(status: BackendStatus | undefined): ConnectionService[] {
  if (!status) return [];
  return SERVICE_ORDER.filter((id) => status.services[id]).map((id) => ({
    id,
    state: status.services[id]!.status,
    detail: status.services[id]!.detail ?? null,
  }));
}

export function useConnectionStatus(): ConnectionInfo {
  const settings = useSettingsStore((state) => state.settings);
  const provider = useDataProvider();
  const directHealth = useApiStatusStore((state) => state.health);
  const directChecked = useApiStatusStore((state) => state.lastChecked);
  const directError = useApiStatusStore((state) => state.lastError);

  const statusQuery = useQuery<BackendStatus>({
    queryKey: ["backend-status", settings.backendUrl, settings.developerMode, settings.dataMode],
    queryFn: ({ signal }) => fetchBackendStatus(signal),
    enabled: provider.id === "backend",
    retry: false,
    refetchInterval: provider.id === "backend" ? 60_000 : false,
    staleTime: 30_000,
  });

  const refresh = () => {
    if (provider.id === "backend") void statusQuery.refetch();
  };

  if (provider.id === "demo") {
    return {
      mode: "demo",
      modeLabel: provider.label,
      endpoint: null,
      health: "demo",
      lastSuccessAt: null,
      cacheAgeMs: null,
      services: [],
      error: null,
      isRefreshing: false,
      refresh,
    };
  }

  if (provider.id === "direct") {
    return {
      mode: "direct",
      modeLabel: provider.label,
      endpoint: null,
      health: directHealth === "offline" ? "offline" : directHealth === "unauthorized" ? "misconfigured" : "direct",
      lastSuccessAt: directHealth === "online" ? directChecked : null,
      cacheAgeMs: null,
      services: [],
      error: directError ? new ApiError("unknown", directError) : null,
      isRefreshing: false,
      refresh,
    };
  }

  const error = statusQuery.error instanceof ApiError ? statusQuery.error : statusQuery.error ? new ApiError("unknown", String(statusQuery.error)) : null;
  let health: ConnectionHealth = "checking";
  if (error) {
    health = error.kind === "configuration" || error.kind === "missing-key" || error.kind === "auth" ? "misconfigured" : "offline";
  } else if (statusQuery.data) {
    health = statusQuery.data.status === "ok" ? "connected" : "degraded";
  }

  const bazaar = statusQuery.data?.cache.bazaar;
  return {
    version: statusQuery.data?.version,
    mode: "backend",
    modeLabel: provider.label,
    endpoint: backendUrlLabel(settings),
    health,
    lastSuccessAt: bazaar?.fetched_at ? Date.parse(bazaar.fetched_at) : null,
    cacheAgeMs: bazaar?.fetched_at && Number.isFinite(Date.parse(bazaar.fetched_at)) ? Math.max(0, Date.now() - Date.parse(bazaar.fetched_at)) : typeof bazaar?.age_ms === "number" ? bazaar.age_ms + Math.max(0, Date.now() - statusQuery.dataUpdatedAt) : null,
    services: toServices(statusQuery.data),
    error,
    isRefreshing: statusQuery.isFetching,
    refresh,
  };
}
