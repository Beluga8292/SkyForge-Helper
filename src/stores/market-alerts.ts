import { create } from "zustand";
import {
  evaluateRules,
  ruleSchema,
  type AlertRule,
  type AlertEvent,
  type AlertSnapshot,
} from "@/features/market/alerts";
import {
  readMarketSetting,
  writeMarketSetting,
} from "@/features/market/storage";
import { z } from "zod";
const persisted = z.object({
  rules: z.array(ruleSchema).max(100),
  events: z
    .array(
      z.object({
        id: z.string(),
        ruleId: z.string(),
        productId: z.string(),
        kind: ruleSchema.shape.kind,
        value: z.number().finite(),
        ts: z.number(),
        snapshot: z.string(),
      }),
    )
    .max(200),
});
interface Store {
  rules: AlertRule[];
  events: AlertEvent[];
  hydrated: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  save: (rule: AlertRule) => void;
  remove: (id: string) => void;
  evaluate: (snapshot: AlertSnapshot) => AlertEvent[];
}
let writes = Promise.resolve();
function persist(rules: AlertRule[], events: AlertEvent[]) {
  writes = writes
    .catch(() => {})
    .then(() => writeMarketSetting("alerts:v1", { rules, events }))
    .catch(() => {
      useMarketAlerts.setState({ error: "Alert state could not be saved" });
    });
}
export const useMarketAlerts = create<Store>((set, get) => ({
  rules: [],
  events: [],
  hydrated: false,
  error: null,
  hydrate: async () => {
    try {
      const result = persisted.safeParse(await readMarketSetting("alerts:v1"));
      set({ ...(result.success ? result.data : {}), hydrated: true });
    } catch {
      set({ hydrated: true, error: "Alert state could not be loaded" });
    }
  },
  save: (rule) => {
    const parsed = ruleSchema.parse(rule);
    const rules = [
      ...get().rules.filter((r) => r.id !== rule.id),
      parsed,
    ].slice(-100);
    set({ rules, error: null });
    persist(rules, get().events);
  },
  remove: (id) => {
    const rules = get().rules.filter((r) => r.id !== id);
    set({ rules });
    persist(rules, get().events);
  },
  evaluate: (snapshot) => {
    if (!get().hydrated || snapshot.demo || snapshot.stale) return [];
    const previous = get().rules;
    const result = evaluateRules(previous, snapshot, Date.now());
    const changed = result.rules.some((r, i) => r !== previous[i]);
    if (!changed && !result.events.length) return [];
    const events = [...result.events, ...get().events].slice(0, 200);
    set({ rules: result.rules, events });
    persist(result.rules, events);
    return result.events;
  },
}));
