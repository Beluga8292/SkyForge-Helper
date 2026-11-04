import type { AuctionSearchQuery } from "@/types/hypixel";
import type { IntelligenceProvider } from "@/features/intelligence/models";
import type { MarketProvider } from "@/features/market/models";
import type { DataEnvelope, DataMode } from "@/types/app";
import type {
  AuctionsResponse,
  BazaarResponse,
  HypixelAuction,
  ItemsResourceResponse,
  MojangProfile,
  PlayerResponse,
  SkyBlockProfilesResponse,
  SkillsResourceResponse,
} from "@/types/hypixel";

export interface ServiceState {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string | null;
}

export interface BackendStatus {
  status: "ok" | "degraded";
  version: string;
  environment: string;
  services: Record<string, ServiceState>;
  cache: {
    backend?: string;
    redis_available?: boolean;
    bazaar?: {
      ready: boolean;
      age_ms: number | null;
      fetched_at: string | null;
      stale: boolean;
      backend: string;
    };
    ttls?: Record<string, number>;
  };
  rate_limit: Record<string, unknown>;
  history: Record<string, unknown>;
}

export interface HistoryPoint {
  ts: string;
  buy_price: number;
  sell_price: number;
  buy_volume: number;
  sell_volume: number;
}

export interface BazaarHistory {
  product_id: string;
  range: "1h" | "24h" | "7d" | "30d";
  interval: string;
  points: HistoryPoint[];
  note?: string | null;
  meta?: {
    fetched_at?: string;
    stale?: boolean;
    source?: string;
  };
}

/**
 * One interface for every data source. Screens never know whether the data
 * came from the server-side proxy, a BYOK direct request or the demo fixture.
 */
export interface DataProvider extends MarketProvider, IntelligenceProvider {
  readonly id: DataMode;
  readonly label: string;
  readonly isDemo: boolean;
  getBazaar(signal?: AbortSignal): Promise<DataEnvelope<BazaarResponse>>;
  getAuctions(
    page: number,
    signal?: AbortSignal,
  ): Promise<DataEnvelope<AuctionsResponse>>;
  searchAuctions?(
    page: number,
    query: AuctionSearchQuery,
    signal?: AbortSignal,
  ): Promise<DataEnvelope<AuctionsResponse>>;
  getAuction(
    id: string,
    signal?: AbortSignal,
  ): Promise<DataEnvelope<HypixelAuction>>;
  getPlayer(
    uuid: string,
    signal?: AbortSignal,
  ): Promise<DataEnvelope<PlayerResponse>>;
  getProfiles(
    uuid: string,
    signal?: AbortSignal,
  ): Promise<DataEnvelope<SkyBlockProfilesResponse>>;
  resolveName(
    name: string,
    signal?: AbortSignal,
  ): Promise<DataEnvelope<MojangProfile>>;
  getItems(signal?: AbortSignal): Promise<DataEnvelope<ItemsResourceResponse>>;
  getSkills(
    signal?: AbortSignal,
  ): Promise<DataEnvelope<SkillsResourceResponse>>;
  getHistory(
    productId: string,
    range: "1h" | "24h" | "7d" | "30d",
    signal?: AbortSignal,
  ): Promise<BazaarHistory | null>;
}
