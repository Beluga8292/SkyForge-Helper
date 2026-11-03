/**
 * Safe, static texture aliases.
 *
 * These are intentionally conservative: they only cover known Hypixel/vanilla
 * naming differences and generic vanilla shapes. A wrong but recognizable
 * vanilla silhouette is preferable to a generic SVG placeholder, but the exact
 * FurfSky/skull texture always wins.
 */

const ITEM_ALIASES: Record<string, string[]> = {
  ASPECT_OF_THE_END: ["ASPECT_OF_THE_END", "ASPECT_OF_THE_END_SWORD"],
  ASPECT_OF_THE_DRAGONS: ["ASPECT_OF_THE_DRAGONS", "ASPECT_OF_THE_DRAGON"],
  ENCHANTED_CARROT: ["ENCHANTED_CARROT", "ENCHANTED_CARROT_ITEM"],
  ENCHANTED_POTATO: ["ENCHANTED_POTATO", "ENCHANTED_POTATO_ITEM"],
  ENCHANTED_LAPIS_LAZULI: [
    "ENCHANTED_LAPIS_LAZULI",
    "ENCHANTED_LAPIS_LAZULI_BLOCK",
  ],
  ENCHANTED_GOLD: ["ENCHANTED_GOLD", "ENCHANTED_GOLD_INGOT"],
  ENCHANTED_IRON: ["ENCHANTED_IRON", "ENCHANTED_IRON_INGOT"],
  ENCHANTED_DIAMOND: ["ENCHANTED_DIAMOND", "ENCHANTED_DIAMOND_BLOCK"],
  ENCHANTED_EMERALD: ["ENCHANTED_EMERALD", "ENCHANTED_EMERALD_BLOCK"],
  ENCHANTED_REDSTONE: ["ENCHANTED_REDSTONE", "ENCHANTED_REDSTONE_BLOCK"],
  ENCHANTED_QUARTZ: ["ENCHANTED_QUARTZ", "ENCHANTED_QUARTZ_BLOCK"],
  ENCHANTED_COAL: ["ENCHANTED_COAL", "ENCHANTED_COAL_BLOCK"],
  ENCHANTED_GLOWSTONE: ["ENCHANTED_GLOWSTONE", "ENCHANTED_GLOWSTONE_DUST"],
  ENCHANTED_SNOW: ["ENCHANTED_SNOW", "ENCHANTED_SNOW_BLOCK"],
  ENCHANTED_ICE: ["ENCHANTED_ICE", "ENCHANTED_PACKED_ICE"],
  RAINBOW_ENCHANTMENT: ["RAINBOW_ENCHANTMENT", "ENCHANTED_BOOK"],
};

const LEGACY_SUFFIXES = ["_ITEM", "_BLOCK"];

const VANILLA_MATERIAL_ALIASES: Record<string, string[]> = {
  skull: ["player_head", "skull"],
  player_head: ["skull", "player_head"],
  head: ["skull", "player_head"],
  enchanted_book: ["book", "enchanted_book"],
  written_book: ["book"],
  filled_map: ["map"],
  iron_bars: ["iron_bars"],
  netherite_ingot: ["iron_ingot"],
  netherite_scrap: ["iron_ingot"],
  netherite_block: ["iron_block"],
  netherite_helmet: ["diamond_helmet"],
  netherite_chestplate: ["diamond_chestplate"],
  netherite_leggings: ["diamond_leggings"],
  netherite_boots: ["diamond_boots"],
  netherite_sword: ["diamond_sword"],
  netherite_axe: ["diamond_axe"],
  netherite_pickaxe: ["diamond_pickaxe"],
  netherite_shovel: ["diamond_shovel"],
  netherite_hoe: ["diamond_hoe"],
};

/** Item ids that need a generic vanilla silhouette when the pack has no match. */
const ITEM_MATERIAL_FALLBACKS: Record<string, string> = {
  HYPERION: "iron_sword",
  VALKYRIE: "iron_sword",
  SCYLLA: "iron_sword",
  ASTRAEA: "iron_sword",
  TERMINATOR: "bow",
  JUJU_SHORTBOW: "bow",
  LAST_BREATH: "bow",
  ARTISANAL_SHORTBOW: "bow",
  RUNAANS_BOW: "bow",
  MAGMA_BOW: "bow",
  EXPLOSIVE_BOW: "bow",
  HURRICANE_BOW: "bow",
  END_STONE_BOW: "bow",
  SLAYER_BOW: "bow",
  ASPECT_OF_THE_END: "diamond_sword",
  ASPECT_OF_THE_DRAGONS: "diamond_sword",
  YETI_SWORD: "iron_sword",
  LEAPING_SWORD: "golden_sword",
  SILK_EDGE_SWORD: "golden_sword",
  ROGUE_SWORD: "golden_sword",
  NECRON_HELMET: "diamond_helmet",
  NECRON_CHESTPLATE: "diamond_chestplate",
  NECRON_LEGGINGS: "diamond_leggings",
  NECRON_BOOTS: "diamond_boots",
  STORM_HELMET: "diamond_helmet",
  STORM_CHESTPLATE: "diamond_chestplate",
  STORM_LEGGINGS: "diamond_leggings",
  STORM_BOOTS: "diamond_boots",
  GOLDOR_HELMET: "golden_helmet",
  GOLDOR_CHESTPLATE: "golden_chestplate",
  GOLDOR_LEGGINGS: "golden_leggings",
  GOLDOR_BOOTS: "golden_boots",
  CRIMSON_HELMET: "leather_helmet",
  CRIMSON_CHESTPLATE: "leather_chestplate",
  CRIMSON_LEGGINGS: "leather_leggings",
  CRIMSON_BOOTS: "leather_boots",
  FROZEN_BLAZE_HELMET: "leather_helmet",
  FROZEN_BLAZE_CHESTPLATE: "leather_chestplate",
  FROZEN_BLAZE_LEGGINGS: "leather_leggings",
  FROZEN_BLAZE_BOOTS: "leather_boots",
  TERROR_HELMET: "leather_helmet",
  TERROR_CHESTPLATE: "leather_chestplate",
  TERROR_LEGGINGS: "leather_leggings",
  TERROR_BOOTS: "leather_boots",
  GEMSTONE_GAUNTLET: "golden_chestplate",
  SOUL_WEAVER: "leather_chestplate",
  LEATHER_CHESTPLATE: "leather_chestplate",
  GOLDEN_DRAGON: "dragon_egg",
  ENDER_DRAGON: "dragon_egg",
  WITHER_SKELETON: "skull",
  ZOMBIE: "skull",
};

function normalizedId(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/^MINECRAFT:/, "")
    .split(":")[0]!
    .trim();
}

/**
 * Alternative pack item keys for an exact SkyBlock id. Deduplicated and
 * ordered: the exact id is always first.
 */
export function itemIdCandidates(itemId: string | null | undefined): string[] {
  if (!itemId) return [];
  const id = normalizedId(itemId);
  if (!id) return [];
  const candidates = new Set<string>([id]);
  for (const alias of ITEM_ALIASES[id] ?? []) candidates.add(alias);
  for (const suffix of LEGACY_SUFFIXES) {
    if (id.endsWith(suffix) && id.length > suffix.length) {
      candidates.add(id.slice(0, -suffix.length));
    }
  }
  // Hypixel uses FISH/RAW_FISH and PORK/PORKCHOP interchangeably.
  if (id === "RAW_FISH") candidates.add("FISH");
  if (id === "FISH") candidates.add("RAW_FISH");
  if (id === "PORK") candidates.add("PORKCHOP");
  if (id === "PORKCHOP") candidates.add("PORK");
  return [...candidates];
}

/** Weak display-name heuristic, used only after an exact id/skull match. */
export function nameCandidates(name: string | null | undefined): string[] {
  if (!name) return [];
  const cleaned = name
    .replace(/§[0-9a-fk-or]/gi, "")
    .replace(/\[[^\]]*\]/g, " ")
    .trim();
  if (!cleaned) return [];
  const words = cleaned
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];
  const base = words.join("_").toUpperCase();
  const candidates = new Set<string>([base]);
  const roman = new Set(["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]);
  if (words.length > 1 && roman.has(words[words.length - 1]!.toUpperCase())) {
    candidates.add(words.slice(0, -1).join("_").toUpperCase());
  }
  for (const suffix of LEGACY_SUFFIXES) {
    if (base.endsWith(suffix)) candidates.add(base.slice(0, -suffix.length));
  }
  return [...candidates];
}

function shapeFallback(itemId: string | null | undefined): string | null {
  if (!itemId) return null;
  const id = normalizedId(itemId);
  if (ITEM_MATERIAL_FALLBACKS[id]) return ITEM_MATERIAL_FALLBACKS[id];
  if (id.endsWith("_HELMET")) return "iron_helmet";
  if (id.endsWith("_CHESTPLATE")) return "iron_chestplate";
  if (id.endsWith("_LEGGINGS")) return "iron_leggings";
  if (id.endsWith("_BOOTS")) return "iron_boots";
  if (id.endsWith("_SWORD")) return "iron_sword";
  if (id.endsWith("_AXE")) return "iron_axe";
  if (id.endsWith("_PICKAXE")) return "iron_pickaxe";
  if (id.endsWith("_SHOVEL")) return "iron_shovel";
  if (id.endsWith("_HOE")) return "iron_hoe";
  if (id.endsWith("_BOW") || id.includes("_BOW_")) return "bow";
  if (id.endsWith("_ROD") || id.includes("FISHING_ROD")) return "fishing_rod";
  if (id.endsWith("_GEM") || id.includes("GEMSTONE")) return "diamond";
  if (id.endsWith("_MINION") || id.includes("_MINION_")) return "player_head";
  return null;
}

/**
 * Ordered material candidates: the registry/upstream material first, then a
 * generic vanilla shape for the item id, then known vanilla aliases.
 */
export function materialCandidates(
  material: string | null | undefined,
  itemId: string | null | undefined,
): string[] {
  const ordered: string[] = [];
  const push = (value: string | null | undefined) => {
    if (!value) return;
    const normalized = value.toLowerCase().replace(/^minecraft:/, "").trim();
    if (normalized && !ordered.includes(normalized)) ordered.push(normalized);
  };
  push(material);
  push(shapeFallback(itemId));
  for (const entry of [...ordered]) {
    for (const alias of VANILLA_MATERIAL_ALIASES[entry] ?? []) push(alias);
  }
  return ordered;
}
