import demoInventory from "./demo-inventory.json";
import type { DataProvider } from "@/data/types";
import { ApiError } from "@/api/errors";
import { analysisSchema, parseAnalysis, type IntelligenceProvider } from "./models";
import { getDemoPlayer } from "@/services/demo";
export function demoProfile(uuid: string, profileId: string) {
  const p = getDemoPlayer("CompanionDemo").profiles[0]!,
    m = p.member!;
  return {
    profile_id: profileId,
    cute_name: p.cuteName,
    game_mode: p.gameMode,
    members: {
      [uuid]: {
        inventory: {
          inv_contents: { data: demoInventory.inventory },
          inv_armor: { data: demoInventory.empty },
          equipment_contents: { data: demoInventory.empty },
          bag_contents: { talisman_bag: { data: demoInventory.bag } },
        },
        profile: { first_join: m.firstJoin },
        last_save: m.lastSave,
        leveling: { experience: m.skyblockXp },
        currencies: { coin_purse: m.purse },
        player_data: {
          experience: Object.fromEntries(
            m.skills.map((s) => [`SKILL_${s.id}`, s.xp]),
          ),
          crafted_generators: ["COBBLESTONE_1"],
        },
        slayer: {
          slayer_bosses: Object.fromEntries(
            m.slayers.map((s) => [s.id, { xp: s.xp }]),
          ),
        },
        dungeons: {
          dungeon_types: {
            catacombs: {
              experience: m.dungeons?.catacombsXp,
              tier_completions: { "0": 10, "1": 20, "2": 10 },
            },
          },
          player_classes: { mage: { experience: 3100000 } },
          selected_dungeon_class: "mage",
        },
        pets_data: {
          pets: m.pets.map((p) => ({
            type: p.type,
            tier: p.tier,
            exp: p.xp,
            active: p.active,
            heldItem: p.heldItem,
          })),
        },
        collection: Object.fromEntries(
          m.collections.map((c) => [c.id, c.amount]),
        ),
      },
    },
    banking: { balance: m.bank },
  };
}
function workerAnalysis(payload: unknown, signal?: AbortSignal) {
  return new Promise<ReturnType<typeof analysisSchema.parse>>(
    (resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      if (typeof Worker === "undefined") {
        reject(
          new ApiError(
            "unavailable",
            "Profile analysis requires Web Worker support",
          ),
        );
        return;
      }
      const worker = new Worker(
        new URL("./profile.worker.ts", import.meta.url),
        { type: "module" },
      );
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        worker.terminate();
      };
      const abort = () => {
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new ApiError("timeout", "Profile analysis exceeded 15s"));
      }, 15000);
      signal?.addEventListener("abort", abort, { once: true });
      worker.onerror = () => {
        cleanup();
        reject(new ApiError("validation", "Profile worker failed"));
      };
      worker.onmessage = (event) => {
        cleanup();
        try {
          if (event.data.error) throw Error(event.data.error);
          resolve(parseAnalysis(event.data.data));
        } catch (error) {
          reject(error);
        }
      };
      worker.postMessage(payload);
    },
  );
}
export function localIntelligenceProvider(
  get: () => DataProvider,
): IntelligenceProvider {
  let cached: {
    key: string;
    expires: number;
    value: ReturnType<typeof analysisSchema.parse>;
  } | null = null;
  return {
    async getIntelligence(uuid, profileId, market = false, signal) {
      signal?.throwIfAborted();
      const p = get(),
        key = `${uuid}:${profileId}:${market}`;
      if (cached?.key === key && cached.expires > Date.now())
        return structuredClone(cached.value);
      const profiles = p.isDemo ? null : await p.getProfiles(uuid, signal);
      signal?.throwIfAborted();
      const profile = p.isDemo
        ? demoProfile(uuid, profileId)
        : profiles?.data.profiles?.find(
            (v) =>
              v.profile_id?.replaceAll("-", "") ===
              profileId.replaceAll("-", ""),
          );
      if (!profile) throw new ApiError("not-found", "Profile unavailable");
      const [skills, items, bazaar] = await Promise.all([
        p.getSkills(signal).catch(() => null),
        p.getItems(signal).catch(() => null),
        market ? p.getBazaar(signal).catch(() => null) : null,
      ]);
      signal?.throwIfAborted();
      const fresh =
        bazaar &&
        !bazaar.stale &&
        Date.now() - (bazaar.data.lastUpdated ?? 0) <= 120000;
      const out = await workerAnalysis(
        {
          profile,
          uuid,
          skills: skills?.data.skills ?? {},
          items: Object.fromEntries(
            (items?.data.items ?? []).map((i) => [i.id, i]),
          ),
          products: fresh ? bazaar.data.products : {},
          timestamp: fresh ? bazaar.data.lastUpdated : null,
          fetchedAt: profiles?.updatedAt ?? Date.now(),
          source: p.id,
          stale: profiles?.stale ?? false,
        },
        signal,
      );
      if (market && p.isDemo)
        for (const c of out.accessories) {
          c.cost = 1000 + (out.accessories.indexOf(c) + 1) * 2500;
          c.coins_per_point = c.gain ? c.cost / c.gain : null;
          c.method = "demo_synthetic";
          c.confidence = "demo";
          c.price_timestamp = out.fetched_at;
        }
      if (market && !p.isDemo)
        out.warnings.push("direct_auction_valuation_unavailable");
      cached = { key, expires: Date.now() + 60000, value: out };
      return structuredClone(out);
    },
  };
}
