import rules from "./rules.json";
import type { Analysis, Metric, Pet, Asset, Recommendation } from "./models";
import { decodeBase64GzipNbt } from "@/utils/nbt";
export { rules };
export const object = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
export const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
export const number = (x: unknown): number | null =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1e18 ? x : null;
const string = (x: unknown): string | null =>
  typeof x === "string" ? x : null;
export const families: Record<string, string> = Object.fromEntries(
  rules.families.flatMap((f) => f.map((id) => [id, f[0]!])),
);
for (const [canonical, aliases] of Object.entries(rules.aliases))
  for (const alias of aliases)
    families[alias] = families[canonical] ?? canonical;
export function milestone(
  id: string,
  category: string,
  x: unknown,
  table: number[],
  source: string,
): Metric {
  const xp = number(x);
  const base: Metric = {
    id,
    category,
    value: xp,
    level: null,
    target: null,
    remaining: null,
    progress: null,
    state: xp === null ? "unknown" : "not_supported",
    source,
    scope: "member",
  };
  if (xp === null || !table.length) return base;
  let level = 0;
  for (let i = 0; i < table.length; i++) if (xp >= table[i]!) level = i;
  const target = table[level + 1] ?? null,
    previous = table[level] ?? 0;
  return {
    ...base,
    level,
    target,
    remaining: target === null ? null : Math.max(0, target - xp),
    progress:
      target === null
        ? 1
        : Math.max(0, Math.min(1, (xp - previous) / (target - previous))),
    state: "known",
  };
}
export function petProgress(raw: Record<string, unknown>): Pet {
  const type = string(raw.type) ?? "UNKNOWN",
    rarity = string(raw.tier),
    xp = number(raw.exp);
  const special = object((rules.custom_pets as Record<string, unknown>)[type]);
  const offset =
    (object(special.rarity_offset) as Record<string, number>)[rarity ?? ""] ??
    (rules.pet_offsets as Record<string, number>)[rarity ?? ""];
  let steps =
    offset === undefined ? [] : rules.pet_levels.slice(offset, offset + 99);
  const custom = (
    rules.custom_pets as unknown as Record<
      string,
      { type: number; pet_levels: number[]; max_level: number }
    >
  )[type];
  if (custom?.pet_levels)
    steps = (
      custom.type === 1 ? [...steps, ...custom.pet_levels] : custom.pet_levels
    ).slice(0, custom.max_level - 1);
  if (number(special.xp_multiplier) !== null)
    steps = steps.map((v) => v * number(special.xp_multiplier)!);
  const table = [0];
  for (const step of steps) table.push(table[table.length - 1]! + step);
  const m = milestone(
    type,
    "pets",
    xp,
    steps.length ? table : [],
    "pets_data.pets",
  );
  return {
    type,
    rarity,
    xp,
    level: m.level === null ? null : m.level + 1,
    next_xp: m.target,
    remaining: m.remaining,
    progress: m.progress,
    held_item: string(raw.heldItem),
    active: typeof raw.active === "boolean" ? raw.active : null,
    state: m.state,
  };
}
export function power(id: string, rarity: string | null): number | null {
  if (id.includes("ABICASE") || id === "RIFT_PRISM") return null;
  const v = (rules.power as Record<string, number>)[rarity ?? ""];
  return v === undefined ? null : v * (id === "HEGEMONY_ARTIFACT" ? 2 : 1);
}
export async function decodeInventory(
  blob: unknown,
  location: string,
  items: Record<string, Record<string, unknown>>,
): Promise<Asset[]> {
  if (typeof blob !== "string" || blob.length > 2 * 1024 * 1024)
    throw Error("oversized_nbt");
  const root = await decodeBase64GzipNbt(blob, 2 * 1024 * 1024);
  if (!Array.isArray(root.i)) throw Error("missing_inventory_list");
  const entries = list(root.i);
  if (entries.length > 1000) throw Error("oversized_inventory");
  return entries.flatMap((raw, slot) => {
    const item = object(raw),
      tag = object(item.tag),
      extra = object(tag.ExtraAttributes),
      id = string(extra.id);
    if (!id) {
      if (Object.keys(item).length) throw Error("unidentified_item");
      return [];
    }
    const count = number(item.Count);
    if (count === null || !Number.isInteger(count) || count < 1 || count > 64)
      throw Error("invalid_item_count");
    const meta = items[id] ?? {};
    let rarity = string(meta.tier);
    const lore = list(object(tag.display).Lore).slice(-4).reverse();
    for (const line of lore) {
      const clean = String(line).replace(/§./g, "");
      const found = Object.keys(rules.power)
        .reverse()
        .find((r) => clean.startsWith(r.replaceAll("_", " ")));
      if (found) {
        rarity = found;
        break;
      }
    }
    return [
      {
        key: `${location}:${slot}`,
        item_id: id,
        name: string(meta.name) ?? id,
        location,
        category: string(meta.category),
        count,
        rarity,
        modifiers: Object.fromEntries(
          Object.entries(extra).filter(
            ([k]) =>
              !["id", "uuid", "timestamp", "originTag", "spawnedFor"].includes(
                k,
              ),
          ),
        ),
        uuid: string(extra.uuid),
        match_key: null,
        soulbound: Boolean(
          extra.donated_museum || extra.soulbound || meta.soulbound,
        ),
        value: null,
        method: "unknown",
        confidence: "insufficient",
        price_timestamp: null,
      },
    ];
  });
}
export async function normalizeProfile(
  profile: Record<string, unknown>,
  uuid: string,
  skills: Record<string, unknown>,
  items: Record<string, Record<string, unknown>>,
  fetchedAt: number,
  source: string,
  stale = false,
): Promise<Analysis> {
  uuid = uuid.replaceAll("-", "").toLowerCase();
  const members = object(profile.members),
    entry = Object.entries(members).find(
      ([id]) => id.replaceAll("-", "").toLowerCase() === uuid,
    ),
    member = object(entry?.[1]);
  if (!entry || object(member.profile).deletion_notice)
    throw Error("Profile member unavailable");
  const metrics: Metric[] = [],
    completeness: Analysis["completeness"] = {},
    warnings: string[] = [],
    assets: Asset[] = [];
  const xp = object(object(member.player_data).experience);
  completeness.skills = Object.keys(xp).length ? "known" : "unknown";
  for (const [raw, value] of Object.entries(xp).sort()) {
    const id = raw.replace(/^SKILL_/, ""),
      rows = list(object(skills[id]).levels)
        .map(object)
        .sort((a, b) => (number(a.level) ?? 0) - (number(b.level) ?? 0));
    metrics.push(
      milestone(
        id,
        "skills",
        value,
        rows.length
          ? [
              0,
              ...rows
                .map((r) => number(r.totalExpRequired))
                .filter((n): n is number => n !== null),
            ]
          : [],
        "player_data.experience + resources.skills",
      ),
    );
  }
  const sx = number(object(member.leveling).experience);
  metrics.push(
    milestone(
      "skyblock",
      "general",
      sx,
      sx !== null && sx < 1e7
        ? Array.from({ length: Math.floor(sx / 100) + 2 }, (_, i) => i * 100)
        : [],
      "leveling.experience /100",
    ),
  );
  const bosses = object(object(member.slayer).slayer_bosses);
  completeness.slayers = Object.keys(bosses).length ? "known" : "unknown";
  for (const [id, b] of Object.entries(bosses).sort())
    metrics.push(
      milestone(
        id,
        "slayer",
        object(b).xp,
        (rules.slayer_xp as Record<string, number[]>)[id] ?? [],
        "slayer.slayer_bosses + rules",
      ),
    );
  const d = object(member.dungeons),
    types = object(d.dungeon_types),
    cata = object(types.catacombs);
  completeness.dungeons = Object.keys(cata).length ? "known" : "unknown";
  metrics.push(
    milestone(
      "catacombs",
      "dungeons",
      cata.experience,
      rules.catacombs,
      "dungeons.dungeon_types.catacombs",
    ),
  );
  for (const [id, raw] of Object.entries(object(d.player_classes)).sort())
    metrics.push(
      milestone(
        id,
        "classes",
        object(raw).experience,
        rules.catacombs,
        "dungeons.player_classes",
      ),
    );
  for (const [id, value] of Object.entries(object(member.collection)).sort())
    metrics.push({
      ...milestone(id, "collections", value, [], "member.collection"),
      state: number(value) !== null ? "known" : "unknown",
    });
  const coop = Object.keys(members).length > 1,
    purse = number(object(member.currencies).coin_purse),
    bank = number(object(profile.banking).balance);
  metrics.push(
    {
      ...milestone("purse", "economy", purse, [], "currencies.coin_purse"),
      state: purse === null ? "unknown" : "known",
    },
    {
      ...milestone("bank", "economy", bank, [], "profile.banking.balance"),
      state: bank === null ? "private" : "known",
      scope: coop ? "shared" : "member",
    },
  );
  const inv = object(member.inventory),
    locations: Record<string, unknown> = Object.fromEntries(
      [
        "inv_contents",
        "inv_armor",
        "equipment_contents",
        "ender_chest_contents",
        "wardrobe_contents",
      ].map((k) => [k, inv[k]]),
    );
  locations.accessory_bag =
    object(inv.bag_contents).talisman_bag ?? inv.talisman_bag;
  const backpacks = object(inv.backpack_contents);
  for (const [key, raw] of Object.entries(backpacks).sort().slice(0, 16))
    locations[`backpack:${key}`] = raw;
  if (Object.keys(backpacks).length > 16)
    warnings.push("storage_truncated_16_bags");
  for (const [key, raw] of Object.entries(locations)) {
    const blob = object(raw).data;
    completeness[key] = blob === undefined ? "private" : "unknown";
    if (blob === undefined) continue;
    try {
      assets.push(...(await decodeInventory(blob, key, items)));
      completeness[key] = "known";
    } catch {
      completeness[key] = "invalid";
      warnings.push(`invalid_nbt:${key}`);
    }
  }
  const seen = new Set<string>();
  const unique = assets.filter((a) => {
    if (!a.uuid) return true;
    if (seen.has(a.uuid)) return false;
    seen.add(a.uuid);
    return true;
  });
  completeness.storage =
    "backpack_contents" in inv
      ? Object.keys(backpacks).length <= 16 &&
        Object.keys(backpacks).every(
          (k) => completeness[`backpack:${k}`] === "known",
        )
        ? "known"
        : "unknown"
      : "private";
  completeness.museum = "not_supported";
  const petsRaw = object(member.pets_data).pets;
  completeness.pets = Array.isArray(petsRaw) ? "known" : "unknown";
  const crafted = object(member.player_data).crafted_generators;
  const out: Analysis = {
    schema_version: "1",
    rules_version: rules.version,
    uuid,
    profile_id: String(profile.profile_id),
    username: null,
    profile_name: string(profile.cute_name),
    profile_type: string(profile.game_mode) ?? "normal",
    coop,
    first_join: number(object(member.profile).first_join),
    last_save: number(member.last_save),
    fetched_at: fetchedAt,
    stale,
    demo: source === "demo",
    source,
    completeness,
    metrics,
    assets: unique,
    pets: list(petsRaw)
      .slice(0, 500)
      .map((r) => petProgress(object(r))),
    recommendations: [],
    accessory_power: null,
    accessory_power_known_subset: null,
    accessories: [],
    networth: {
      personal_liquid: purse,
      shared_bank: coop ? bank : null,
      tradable: null,
      untradeable_count: 0,
      unknown_count: 0,
      priced_count: 0,
      coverage: null,
      known_total: null,
      complete: false,
    },
    warnings,
    selected_class: string(d.selected_dungeon_class),
    floors: Object.fromEntries(
      Object.entries(object(cata.tier_completions)).filter(
        ([, v]) => number(v) !== null,
      ),
    ) as Record<string, number>,
    minions: Array.isArray(crafted)
      ? crafted.filter((v): v is string => typeof v === "string").slice(0, 1000)
      : null,
  };
  out.recommendations = recommend(out);
  return out;
}
export function recommend(out: Analysis): Recommendation[] {
  const result: Recommendation[] = out.metrics
    .filter(
      (m) =>
        ["skills", "slayer", "dungeons", "classes", "general"].includes(
          m.category,
        ) &&
        m.state === "known" &&
        m.target !== null,
    )
    .map((m) => ({
      id: `next:${m.category}:${m.id}`,
      category: m.category,
      subject: m.id,
      current: m.value,
      target: m.target,
      remaining: m.remaining,
      score: 40 + 40 * (m.progress ?? 0),
      status: "available",
      requirements: [],
      dependencies: [],
      cost: null,
      effort: null,
      confidence: "medium",
      source: m.source,
      reason: "next_verified_xp_milestone",
    }));
  const cata = out.metrics.find((m) => m.id === "catacombs");
  rules.floor_levels.forEach((level, floor) => {
    if (!floor || (out.floors[String(floor)] ?? 0) > 0) return;
    const prior = (out.floors[String(floor - 1)] ?? 0) > 0,
      ready =
        cata?.level !== null &&
        cata?.level !== undefined &&
        cata.level >= level &&
        prior;
    result.push({
      id: `floor:${floor}`,
      category: "dungeons",
      subject: `catacombs_floor_${floor}`,
      current: cata?.level ?? null,
      target: level,
      remaining: null,
      score: ready ? 65 : 20,
      status: ready ? "available" : "locked",
      requirements: [`catacombs>=${level}`, `floor:${floor - 1}`],
      dependencies: prior ? [] : [`floor:${floor - 1}`],
      cost: null,
      effort: null,
      confidence: "medium",
      source: "rules.floor_levels + tier_completions",
      reason: "floor_unlock_is_not_readiness",
    });
  });
  for (const r of result) {
    const m = out.metrics.find(
      (m) => m.category === r.category && m.id === r.subject,
    );
    if (
      m?.category === "skills" &&
      ["FARMING", "TAMING"].includes(m.id) &&
      (m.level ?? 0) >= 50
    ) {
      r.status = "missing_data";
      r.requirements.push("individual_level_cap_unverified");
    }
  }
  out.warnings.push("skill_levels_are_xp_derived_individual_caps_unverified");
  return result.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function enrichLocal(
  out: Analysis,
  items: Record<string, Record<string, unknown>>,
  products: Record<string, unknown> = {},
  timestamp: number | null = null,
): Analysis {
  const own: Record<string, number> = {};
  let unknown = false;
  for (const a of out.assets) {
    if (a.location === "accessory_bag") {
      const f = families[a.item_id],
        v = power(a.item_id, a.rarity);
      if (!f || v === null) unknown = true;
      else own[f] = Math.max(own[f] ?? 0, v);
    }
    if (!a.soulbound && !Object.keys(a.modifiers).length) {
      const bids = list(object(products[a.item_id]).sell_summary)
        .map(object)
        .sort(
          (a, b) =>
            (number(b.pricePerUnit) ?? 0) - (number(a.pricePerUnit) ?? 0),
        );
      let left = a.count,
        total = 0;
      for (const b of bids) {
        const price = number(b.pricePerUnit),
          amount = number(b.amount);
        if (price === null || amount === null || price <= 0) continue;
        const take = Math.min(left, amount);
        total += take * price;
        left -= take;
        if (left <= 0) break;
      }
      if (left <= 0) {
        a.value = total;
        a.method = "bazaar_visible_bid";
        a.confidence = "medium";
        a.price_timestamp = timestamp;
      }
    }
  }
  const bag = out.completeness.accessory_bag === "known";
  out.accessory_power_known_subset = bag
    ? Object.values(own).reduce((a, b) => a + b, 0)
    : null;
  out.accessory_power =
    bag && !unknown ? out.accessory_power_known_subset : null;
  if (unknown) out.warnings.push("accessory_power_partial_catalogue");
  const ownedIds = new Set(
    out.assets
      .filter((a) => a.location === "accessory_bag")
      .map((a) => a.item_id),
  );
  out.accessories = [];
  if (bag)
    for (const family of rules.families)
      for (const id of family) {
        const meta = items[id];
        if (!meta || meta.category !== "ACCESSORY" || ownedIds.has(id))
          continue;
        const v = power(id, string(meta.tier)),
          gain = v === null ? null : Math.max(0, v - (own[family[0]!] ?? 0));
        if (gain !== null && gain <= 0) continue;
        const asks = list(object(products[id]).buy_summary)
          .map(object)
          .filter(
            (r) =>
              (number(r.pricePerUnit) ?? 0) > 0 && (number(r.amount) ?? 0) >= 1,
          )
          .sort((a, b) => number(a.pricePerUnit)! - number(b.pricePerUnit)!);
        const cost =
          !meta.soulbound &&
          !["ironman", "stranded", "bingo"].includes(out.profile_type ?? "")
            ? number(asks[0]?.pricePerUnit)
            : null;
        out.accessories.push({
          item_id: id,
          family: family[0]!,
          rarity: string(meta.tier),
          gain,
          cost,
          coins_per_point: cost !== null && gain ? cost / gain : null,
          method: cost !== null ? "bazaar_visible_ask" : "unknown",
          confidence: cost !== null ? "medium" : "insufficient",
          requirements: list(meta.requirements).map((r) => JSON.stringify(r)),
          price_timestamp: cost !== null ? timestamp : null,
        });
      }
  const priced = out.assets.filter((a) => a.value !== null),
    purse = out.metrics.find((m) => m.id === "purse")?.value ?? null,
    bank = out.metrics.find((m) => m.id === "bank")?.value ?? null,
    liquid =
      !out.coop && purse !== null && bank !== null ? purse + bank : purse;
  out.networth = {
    personal_liquid: liquid,
    shared_bank: out.coop ? bank : null,
    tradable: priced.length
      ? priced.reduce((n, a) => n + a.value!, 0)
      : out.assets.length
        ? null
        : 0,
    untradeable_count: out.assets.filter((a) => a.soulbound).length,
    unknown_count:
      out.assets.filter((a) => a.value === null && !a.soulbound).length +
      out.pets.length,
    priced_count: priced.length,
    coverage:
      out.assets.length + out.pets.length
        ? priced.length / (out.assets.length + out.pets.length)
        : null,
    known_total:
      priced.length || liquid !== null
        ? priced.reduce((n, a) => n + a.value!, 0) + (liquid ?? 0)
        : null,
    complete: false,
  };
  out.warnings.push(
    "networth_partial_not_earnings",
    out.coop ? "shared_bank_excluded" : "inventory_coverage_not_total_wealth",
  );
  out.recommendations.push(...gearCandidates(out, items));
  return out;
}

export function gearCandidates(
  out: Analysis,
  items: Record<string, Record<string, unknown>>,
): Recommendation[] {
  const roles: Record<string, string[]> = {
    archer: ["JUJU_SHORTBOW"],
    mage: ["WITHER_GOGGLES"],
    berserk: ["FLOWER_OF_TRUTH"],
    tank: ["WITHER_CHESTPLATE"],
    healer: ["NECROMANCER_SWORD"],
  };
  const owned = new Set(out.assets.map((a) => a.item_id)),
    cata = out.metrics.find((m) => m.id === "catacombs")?.level ?? null,
    result: Recommendation[] = [];
  for (const [role, ids] of Object.entries(roles))
    for (const id of ids) {
      const meta = items[id];
      if (!meta || owned.has(id)) continue;
      let missing = false;
      const requirements: string[] = [];
      for (const raw of [
        ...list(meta.requirements),
        ...list(meta.catacombs_requirements),
      ]) {
        const r = object(raw);
        let known = false,
          met = false;
        if (r.type === "DUNGEON_TIER") {
          known = out.completeness.dungeons === "known";
          met = (out.floors[String(r.tier)] ?? 0) > 0;
        } else if (r.type === "DUNGEON_SKILL") {
          known = cata !== null;
          met = known && cata! >= (number(r.level) ?? 0);
        } else if (r.type === "SLAYER") {
          const level =
            out.metrics.find(
              (m) => m.category === "slayer" && m.id === r.slayer_boss_type,
            )?.level ?? null;
          known = level !== null;
          met = known && level! >= (number(r.level) ?? 0);
        } else missing = true;
        if (!known) missing = true;
        if (!met) requirements.push(JSON.stringify(r));
      }
      const inventory =
        out.completeness.inv_contents === "known" &&
        out.completeness.inv_armor === "known";
      result.push({
        id: `gear:${role}:${id}`,
        category: `gear:${role}`,
        subject: id,
        current: null,
        target: null,
        remaining: null,
        score: 45,
        status:
          missing || !inventory
            ? "missing_data"
            : requirements.length
              ? "locked"
              : "available",
        requirements,
        dependencies: requirements,
        cost: null,
        effort: null,
        confidence: "low",
        source: "resources.items.requirements + catacombs_requirements",
        reason: "role_candidate_not_dps_upgrade",
      });
    }
  return result;
}
