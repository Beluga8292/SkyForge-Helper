import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useDataScope } from "@/data";
import { useSettingsStore } from "@/stores/settings";
import { z } from "zod";
import {
  preferencesSchema,
  defaultPreferences,
  goalSchema,
  historySchema,
  updateGoals,
  type Preferences,
  type Goal,
} from "@/features/intelligence/planning";
import {
  readMarketSetting,
  writeMarketSetting,
} from "@/features/market/storage";
import { notifyMarket } from "@/features/market/notifications";
import { toast } from "sonner";
import { useI18n } from "@/locales";
const savedSchema = z.object({
  version: z.literal(1),
  preferences: preferencesSchema,
  goals: z.array(goalSchema).max(200),
  history: historySchema,
});
export function useIntelligence(options: { defaultMarket?: boolean } = {}) {
  const linked = useSettingsStore((s) => s.settings.lastProfile),
    provider = useDataProvider(),
    scope = useDataScope(),
    { t } = useI18n();
  const key = `intelligence:v1:${scope}:${linked?.uuid ?? ""}:${linked?.profileId ?? ""}`;
  const [market, setMarket] = useState(options.defaultMarket ?? false),
    [preferences, setPreferences] = useState<Preferences>(defaultPreferences),
    [goals, setGoals] = useState<Goal[]>([]),
    [history, setHistory] = useState<z.infer<typeof historySchema>>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(false);
  const queue = useRef(Promise.resolve()),
    loadedKey = useRef<string | null>(null);
  const query = useQuery({
    queryKey: ["intelligence", scope, linked?.uuid, linked?.profileId, market],
    queryFn: ({ signal }) =>
      provider.getIntelligence(linked!.uuid, linked!.profileId, market, signal),
    enabled: Boolean(linked),
    staleTime: 60000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    let active = true;
    loadedKey.current = null;
    setLoaded(false);
    setGoals([]);
    setHistory([]);
    setPreferences(defaultPreferences);
    setError(false);
    void readMarketSetting(key)
      .then((raw) => {
        if (!active) return;
        loadedKey.current = key;
        const result = savedSchema.safeParse(raw);
        if (result.success) {
          setPreferences(result.data.preferences);
          setGoals(result.data.goals);
          setHistory(result.data.history);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (active) {
          loadedKey.current = key;
          setLoaded(true);
          setError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => {
    if (!loaded || loadedKey.current !== key) return;
    const data = { version: 1 as const, preferences, goals, history };
    queue.current = queue.current
      .catch(() => {})
      .then(() => writeMarketSetting(key, data))
      .catch(() => setError(true));
  }, [key, loaded, preferences, goals, history]);
  useEffect(() => {
    if (!loaded || loadedKey.current !== key || !query.data) return;
    const result = updateGoals(goals, query.data);
    if (!result.completed.length) return;
    setGoals(result.goals);
    if (useSettingsStore.getState().settings.notificationsEnabled)
      for (const g of result.completed)
        if (g.notify) {
          toast(t("intel.goalCompleted"), { description: g.subject });
          void notifyMarket(t("intel.goalCompleted"), g.subject).catch(
            () => {},
          );
        }
  }, [loaded, query.data, goals, t]);
  return {
    linked,
    unlink: () => useSettingsStore.getState().setLinkedProfile(null),
    query,
    preferences,
    setPreferences,
    goals,
    setGoals,
    history,
    setHistory,
    loaded,
    error,
    market,
    setMarket,
  };
}
