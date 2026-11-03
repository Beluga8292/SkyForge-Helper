import { localIntelligenceProvider } from "@/features/intelligence/provider";
import { localMarketProvider } from "@/features/market/local-provider";
import { ApiError } from "@/api/errors";
import {
  fetchAuctions,
  fetchBazaar,
  fetchItemsResource,
  fetchPlayer,
  fetchPlayerProfiles,
  fetchSkillsResource,
} from "@/api/hypixel/client";
import { resolveMojangProfile } from "@/api/mojang/client";
import { getApiKey } from "@/services/secrets";
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
import type { DataProvider } from "@/data/types";

function envelope<T>(data: T) {
  return {
    data,
    updatedAt: Date.now(),
    source: "network" as const,
    provider: "direct" as const,
  };
}

async function requireApiKey(): Promise<string> {
  const key = await getApiKey();
  if (!key) {
    throw new ApiError("missing-key", "Hypixel API key is not configured", {
      url: null,
    });
  }
  return key;
}

/**
 * BYOK fallback for local development and personal use. It talks straight to
 * Hypixel from the desktop client; the server-side secret is never involved.
 */
export const directProvider: DataProvider = {
  ...localIntelligenceProvider(() => directProvider),
  ...localMarketProvider(() => directProvider),
  id: "direct",
  label: "Direct Hypixel API (BYOK)",
  isDemo: false,

  async getBazaar(signal) {
    return envelope(await fetchBazaar(signal));
  },

  async getAuctions(page, signal) {
    return envelope(await fetchAuctions(page, signal));
  },

  async getAuction() {
    throw new ApiError("not-found", "Auction details require Backend mode", {
      url: null,
    });
  },

  async getPlayer(uuid, signal) {
    return envelope(await fetchPlayer(uuid, await requireApiKey(), signal));
  },

  async getProfiles(uuid, signal) {
    return envelope(
      await fetchPlayerProfiles(uuid, await requireApiKey(), signal),
    );
  },

  async resolveName(name, signal) {
    return envelope(await resolveMojangProfile(name, signal));
  },

  async getItems(signal) {
    return envelope(await fetchItemsResource(signal));
  },

  async getSkills(signal) {
    return envelope(await fetchSkillsResource(signal));
  },

  async getHistory() {
    return null;
  },
};

export type {
  AuctionsResponse,
  BazaarResponse,
  HypixelAuction,
  ItemsResourceResponse,
  MojangProfile,
  PlayerResponse,
  SkyBlockProfilesResponse,
  SkillsResourceResponse,
};
