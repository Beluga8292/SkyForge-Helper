import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useDataScope } from "@/data";
import { useMojangLookup, usePlayerProfiles, useProfileSelection } from "@/hooks/usePlayer";
import { useSettingsStore } from "@/stores/settings";
import { ApiError } from "@/api/errors";
import { normalizeUuid } from "@/utils/validation";

export const VIEW_HISTORY_KEY = "view-history:v1";
const HISTORY_LIMIT = 8;

export interface ViewHistoryEntry {
  uuid: string;
  name: string;
  at: number;
}

export function readViewHistory(): ViewHistoryEntry[] {
  if (typeof window === "undefined" || !window.sessionStorage) return [];
  try {
    const raw = window.sessionStorage.getItem(VIEW_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is ViewHistoryEntry =>
          Boolean(entry) &&
          typeof entry === "object" &&
          typeof (entry as ViewHistoryEntry).uuid === "string" &&
          typeof (entry as ViewHistoryEntry).name === "string",
      )
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function writeViewHistory(entries: ViewHistoryEntry[]) {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(VIEW_HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Session storage can be unavailable in hardened webviews; the view still works.
  }
}

/**
 * Isolated reader for another player's public profile.
 *
 * It intentionally never touches `setLinkedProfile`, recent searches, goals,
 * progression preferences or Networth history. Its only persistence is an
 * in-session list of recently viewed players.
 */
export function useViewPlayer(target: {
  name?: string | null;
  uuid?: string | null;
}) {
  const provider = useDataProvider();
  const scope = useDataScope();
  const linked = useSettingsStore((state) => state.settings.lastProfile);

  const name = target.name?.trim() || null;
  const uuid = target.uuid?.trim() ? normalizeUuid(target.uuid) : null;

  const lookup = useMojangLookup(name, Boolean(name) && !uuid);
  const playerLookup = useQuery<{ id: string; name: string }>({
    queryKey: ["view-player", scope, uuid],
    enabled: Boolean(uuid) && !name,
    queryFn: async ({ signal }) => {
      const envelope = await provider.getPlayer(uuid!, signal);
      const display = envelope.data.player?.displayname;
      if (!display) throw new ApiError("not-found", "Player not found");
      return { id: uuid!, name: display };
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 0,
  });

  const effectiveUuid = lookup.data?.id ?? uuid ?? null;
  const effectiveName = lookup.data?.name ?? playerLookup.data?.name ?? null;

  const [memberUuid, setMemberUuid] = useState<string | null>(null);
  const appliedFor = useRef<string | null>(null);
  useEffect(() => {
    if (appliedFor.current === effectiveUuid) return;
    appliedFor.current = effectiveUuid;
    setMemberUuid(null);
  }, [effectiveUuid]);

  const activeUuid = memberUuid ?? effectiveUuid;
  const enabled =
    Boolean(activeUuid) && Boolean(effectiveName) && (Boolean(lookup.data) || Boolean(uuid));

  const player = usePlayerProfiles({
    uuid: activeUuid,
    name: effectiveName,
    enabled,
  });
  const selection = useProfileSelection(player.data, undefined);

  const [history, setHistory] = useState<ViewHistoryEntry[]>(() => readViewHistory());
  const recordedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!effectiveUuid || !effectiveName) return;
    const key = `${effectiveUuid}:${effectiveName}`;
    if (recordedFor.current === key) return;
    recordedFor.current = key;
    setHistory((previous) => {
      const next = [
        { uuid: effectiveUuid, name: effectiveName, at: Date.now() },
        ...previous.filter((entry) => entry.uuid !== effectiveUuid),
      ].slice(0, HISTORY_LIMIT);
      writeViewHistory(next);
      return next;
    });
  }, [effectiveUuid, effectiveName]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    writeViewHistory([]);
  }, []);

  const isOwn = Boolean(
    linked &&
      effectiveUuid &&
      normalizeUuid(linked.uuid) === normalizeUuid(effectiveUuid),
  );

  const coopMembers = selection.profile?.coopMembers ?? [];
  const activeMember = useMemo(
    () =>
      coopMembers.find(
        (entry) => normalizeUuid(entry.uuid) === normalizeUuid(activeUuid ?? ""),
      ) ?? null,
    [coopMembers, activeUuid],
  );

  return {
    linked,
    lookup,
    playerLookup,
    player,
    profile: selection.profile,
    selectedProfileId: selection.selectedId,
    setSelectedProfileId: selection.setSelectedId,
    activeUuid,
    setActiveUuid: setMemberUuid,
    effectiveUuid,
    effectiveName,
    activeMember,
    coopMembers,
    isOwn,
    history,
    clearHistory,
    enabled,
    demo: player.demo,
    error: lookup.error ?? playerLookup.error ?? player.error,
    isLoading:
      (Boolean(name) && !uuid && lookup.isPending) ||
      (Boolean(uuid) && !name && playerLookup.isPending) ||
      (player.isPending && enabled),
  };
}
