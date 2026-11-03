import type { QueryClient } from "@tanstack/react-query";

const MEMBER_SELECTION_PREFIX = "sbc:member:";

/**
 * Drop only the transient UI caches that belong to one Minecraft account.
 * Persisted goals, Networth history and upgrade plans stay untouched because
 * they are keyed by UUID + profile id in local storage.
 */
export function clearTransientAccountCaches(
  queryClient: QueryClient,
  uuid: string | null | undefined,
): void {
  if (!uuid) return;
  const needle = uuid.toLowerCase();
  queryClient.removeQueries({
    predicate: (query) =>
      query.queryKey.some(
        (part) =>
          typeof part === "string" && part.toLowerCase().includes(needle),
      ),
  });
  try {
    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith(MEMBER_SELECTION_PREFIX)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Session storage is optional.
  }
}
