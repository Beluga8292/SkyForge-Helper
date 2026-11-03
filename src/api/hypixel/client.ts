import { apiRequest } from "@/api/client";
import {
  auctionsResponseSchema,
  bazaarResponseSchema,
  itemsResourceSchema,
  playerResponseSchema,
  profilesResponseSchema,
  skillsResourceSchema,
} from "@/api/schemas";
import type {
  AuctionsResponse,
  BazaarResponse,
  ItemsResourceResponse,
  PlayerResponse,
  SkyBlockProfilesResponse,
  SkillsResourceResponse,
} from "@/types/hypixel";

export const HYPIXEL_API_BASE = "https://api.hypixel.net/v2";

export function fetchBazaar(signal?: AbortSignal): Promise<BazaarResponse> {
  return apiRequest({
    url: `${HYPIXEL_API_BASE}/skyblock/bazaar`,
    schema: bazaarResponseSchema,
    signal,
    label: "bazaar",
  });
}

export function fetchAuctions(page: number, signal?: AbortSignal): Promise<AuctionsResponse> {
  return apiRequest({
    url: `${HYPIXEL_API_BASE}/skyblock/auctions?page=${Math.max(0, Math.floor(page))}`,
    schema: auctionsResponseSchema,
    signal,
    label: "auctions",
  });
}

export function fetchPlayerProfiles(uuid: string, apiKey: string, signal?: AbortSignal): Promise<SkyBlockProfilesResponse> {
  return apiRequest({
    url: `${HYPIXEL_API_BASE}/skyblock/profiles?uuid=${encodeURIComponent(uuid)}`,
    schema: profilesResponseSchema,
    apiKey,
    authenticated: true,
    signal,
    label: "profiles",
  });
}

export function fetchPlayer(uuid: string, apiKey: string, signal?: AbortSignal): Promise<PlayerResponse> {
  return apiRequest({
    url: `${HYPIXEL_API_BASE}/player?uuid=${encodeURIComponent(uuid)}`,
    schema: playerResponseSchema,
    apiKey,
    authenticated: true,
    signal,
    label: "player",
  });
}

export function fetchSkillsResource(signal?: AbortSignal): Promise<SkillsResourceResponse> {
  return apiRequest({
    url: `${HYPIXEL_API_BASE}/resources/skyblock/skills`,
    schema: skillsResourceSchema,
    signal,
    timeoutMs: 25_000,
    label: "skills-resource",
  });
}

export function fetchItemsResource(signal?: AbortSignal): Promise<ItemsResourceResponse> {
  return apiRequest({
    url: `${HYPIXEL_API_BASE}/resources/skyblock/items`,
    schema: itemsResourceSchema,
    signal,
    timeoutMs: 35_000,
    label: "items-resource",
  });
}

/**
 * A missing/invalid key is reported by `/player` as HTTP 403 before any UUID
 * lookup matters. The chosen UUID belongs to a well-known account that does not
 * play Hypixel, so a valid key deterministically returns `player: null`.
 */
const TEST_UUID = "069a79f444e94726a5befca90e38aaf5";

export async function verifyApiKey(apiKey: string, signal?: AbortSignal): Promise<boolean> {
  const response = await fetchPlayer(TEST_UUID, apiKey, signal);
  return response.success === true;
}
