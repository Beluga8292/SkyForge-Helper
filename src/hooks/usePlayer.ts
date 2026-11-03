import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { profilesResponseSchema } from "@/api/schemas";
import { ApiError } from "@/api/errors";
import { cachedProviderFetch } from "@/data/envelope-cache";
import { useDataProvider, useDataScope } from "@/data";
import { getDemoPlayer } from "@/services/demo";
import { normalizePlayerProfiles } from "@/features/player-profile/normalize";
import { useSettingsStore } from "@/stores/settings";
import type { NormalizedPlayer, NormalizedProfile } from "@/types/profile";
import type { MojangProfile, SkyBlockProfilesResponse } from "@/types/hypixel";
import type { DataEnvelope } from "@/types/app";

const FIVE_MINUTES = 5 * 60 * 1000;
const BACKEND_PROFILES_TTL = 60_000;

export function useMojangLookup(name: string | null, enabled: boolean) {
  const provider = useDataProvider();
  const scope = useDataScope();
  return useQuery<MojangProfile>({
    queryKey: ["mojang", scope, name?.toLowerCase() ?? ""],
    enabled: Boolean(name) && enabled,
    queryFn: async ({ signal }) => {
      if (!name) throw new ApiError("not-found", "Player name is empty");
      const envelope = await provider.resolveName(name, signal);
      return envelope.data;
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: (count, error) => count < 1 && error instanceof ApiError && error.kind === "network",
  });
}

export interface PlayerProfilesParams {
  uuid: string | null | undefined;
  name: string | null | undefined;
  enabled?: boolean;
}

export function usePlayerProfiles({ uuid, name, enabled = true }: PlayerProfilesParams) {
  const provider = useDataProvider();
  const scope = useDataScope();
  const forceRef = useRef(false);

  const query = useQuery<NormalizedPlayer>({
    queryKey: ["player-profiles", scope, uuid],
    enabled: enabled && Boolean(uuid) && Boolean(name),
    queryFn: async ({ signal }) => {
      if (!uuid || !name) throw new ApiError("not-found", "Player is not selected");
      const force = forceRef.current;
      forceRef.current = false;

      if (provider.isDemo) {
        return getDemoPlayer(name);
      }

      const skillsEnvelope = await provider.getSkills(signal).catch(() => undefined);
      const skills = skillsEnvelope?.data.skills;

      const envelope: DataEnvelope<SkyBlockProfilesResponse> = await cachedProviderFetch<SkyBlockProfilesResponse>({
        schema: profilesResponseSchema,
        key: `profiles:${scope}:${uuid.toLowerCase()}`,
        ttlMs: provider.id === "backend" ? BACKEND_PROFILES_TTL : FIVE_MINUTES,
        force,
        signal,
        provider: provider.id,
        fetcher: () => provider.getProfiles(uuid, signal),
      });

      signal.throwIfAborted();
      const rawProfiles = envelope.data.profiles ?? [];
      if (!rawProfiles.length) {
        return { uuid: uuid.replace(/-/g, "").toLowerCase(), name, profiles: [], fetchedAt: Date.now() };
      }

      const normalized = await normalizePlayerProfiles({
        uuid,
        name,
        profiles: rawProfiles,
        skills,
      });
      signal.throwIfAborted();
      return { ...normalized, fetchedAt: envelope.updatedAt, stale: envelope.stale };
    },
    staleTime: provider.id === "backend" ? BACKEND_PROFILES_TTL : FIVE_MINUTES,
    gcTime: 30 * 60 * 1000,
    retry: (count, error) => {
      if (!(error instanceof ApiError)) return count < 1;
      return error.isRetryable && count < 1;
    },
  });

  const refresh = async () => {
    forceRef.current = true;
    try {
      await query.refetch({ cancelRefetch: true });
    } finally {
      forceRef.current = false;
    }
  };

  return { ...query, refresh, demo: provider.isDemo };
}

export function useConnectedProfile() {
  const linked = useSettingsStore((state) => state.settings.lastProfile);
  const query = usePlayerProfiles({
    uuid: linked?.uuid,
    name: linked?.name,
    enabled: Boolean(linked),
  });

  const profile: NormalizedProfile | null = useMemo(() => {
    if (!linked || !query.data) return null;
    return (
      query.data.profiles.find((entry) => entry.id === linked.profileId) ??
      query.data.profiles.find((entry) => entry.selected) ??
      query.data.profiles[0] ??
      null
    );
  }, [linked, query.data]);

  return { ...query, linked, profile };
}

/** Utility used on the profile page to keep a stable selection across renders. */
export function useProfileSelection(player: NormalizedPlayer | undefined, linkedProfileId: string | undefined) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const appliedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!player) return;
    const key = `${player.uuid}:${linkedProfileId ?? ""}`;
    if (appliedFor.current === key) return;
    const preferred =
      player.profiles.find((profile) => profile.id === linkedProfileId)?.id ??
      player.profiles.find((profile) => profile.selected)?.id ??
      player.profiles[0]?.id ??
      null;
    setSelectedId(preferred);
    appliedFor.current = key;
  }, [player, linkedProfileId]);

  const profile = player?.profiles.find((entry) => entry.id === selectedId) ?? player?.profiles[0] ?? null;
  return { profile, selectedId, setSelectedId };
}
