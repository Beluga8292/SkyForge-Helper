import { apiRequest } from "@/api/client";
import { mojangProfileSchema } from "@/api/schemas";
import type { MojangProfile } from "@/types/hypixel";

const MOJANG_BASE = "https://api.mojang.com";

/**
 * Mojang's profile endpoint is the canonical public name → UUID lookup and
 * requires no Microsoft/Minecraft credentials.
 */
export function resolveMojangProfile(name: string, signal?: AbortSignal): Promise<MojangProfile> {
  return apiRequest({
    url: `${MOJANG_BASE}/users/profiles/minecraft/${encodeURIComponent(name)}`,
    schema: mojangProfileSchema,
    signal,
    timeoutMs: 15_000,
    maxRetries: 1,
    label: "mojang-profile",
    trackStatus: false,
  });
}
