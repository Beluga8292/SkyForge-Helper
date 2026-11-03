import { invokeDesktop } from "@/services/desktop";
import { isTauriRuntime } from "@/api/transport";
import { z } from "zod";
import { CLASSES, FLOORS } from "./catalog";
const schema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  uuid: z.string().min(1),
  profileId: z.string().min(1),
  dungeonClass: z.enum(CLASSES),
  floor: z.enum(FLOORS),
  budget: z.number().finite().nonnegative().nullable(),
  strategy: z.enum(["current", "minimal", "balanced", "alternative"]),
  selectedBuild: z
    .array(
      z.object({
        slot: z.string(),
        itemId: z.string(),
        uuid: z.string().nullable(),
      }),
    )
    .max(9),
  plannedUpgrades: z
    .array(z.object({ slot: z.string(), optionId: z.string() }))
    .max(100),
  budgetSnapshot: z
    .object({
      total: z.number().finite().nonnegative(),
      unknown: z.number().int().nonnegative(),
      status: z.enum(["WITHIN", "OVER", "PARTIAL", "UNKNOWN"]),
    })
    .optional(),
  upgradeSelection: z.array(z.string()).max(100).optional(),
  timestamp: z.number().finite().nonnegative(),
});
export type SavedDungeonPlan = z.infer<typeof schema>;
const clean = (s: string) => s.replaceAll("-", "").toLowerCase();
const key = (uuid: string, profile: string) =>
  `sbc:dungeons:v1:${encodeURIComponent(clean(uuid))}:${encodeURIComponent(clean(profile))}`;
export async function saveDungeonPlan(value: SavedDungeonPlan) {
  const plan = schema.parse(value),
    k = key(plan.uuid, plan.profileId),
    data = JSON.stringify(plan);
  if (isTauriRuntime())
    await invokeDesktop("settings_set", { key: k, value: data });
  else window.localStorage.setItem(k, data);
}
export async function loadDungeonPlan(
  uuid: string,
  profileId: string,
): Promise<SavedDungeonPlan | null> {
  const k = key(uuid, profileId);
  const raw = isTauriRuntime()
    ? await invokeDesktop<string | null>("settings_get", { key: k })
    : window.localStorage.getItem(k);
  if (!raw) return null;
  try {
    const p = schema.parse(JSON.parse(raw));
    return clean(p.uuid) === clean(uuid) &&
      clean(p.profileId) === clean(profileId)
      ? p
      : null;
  } catch {
    return null;
  }
}
