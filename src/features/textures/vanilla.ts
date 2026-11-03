import { transportFetch } from "@/api/transport";
import {
  getVanillaMeta,
  getVanillaTextureKey,
  getVanillaTextureKeyLoose,
  isVanillaCacheReady,
  setVanillaMeta,
  storeVanillaTextures,
} from "./storage";

const VERSION_MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const VANILLA_VERSION = "1.8.9";
const CLIENT_CACHE_KEY = "sbc:mc-client-meta:1.8.9";
const MAX_CLIENT_BYTES = 32 * 1024 * 1024;

interface VersionMeta {
  clientUrl: string;
  clientSha1: string;
  clientSize: number;
}

let clientPromise: Promise<void> | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await transportFetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Texture source returned HTTP ${response.status}`);
  return (await response.json()) as T;
}

async function loadVersionMeta(): Promise<VersionMeta> {
  try {
    const cached = localStorage.getItem(CLIENT_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as VersionMeta;
      if (parsed.clientUrl && parsed.clientSize > 0) return parsed;
    }
  } catch {
    // Fall through to the network.
  }
  const manifest = await fetchJson<{
    versions: Array<{ id: string; url: string }>;
  }>(VERSION_MANIFEST);
  const version = manifest.versions.find((entry) => entry.id === VANILLA_VERSION);
  if (!version) throw new Error("Minecraft version metadata is unavailable");
  const versionJson = await fetchJson<{
    downloads?: { client?: { url?: string; sha1?: string; size?: number } };
  }>(version.url);
  const client = versionJson.downloads?.client;
  if (!client?.url || !client.size) {
    throw new Error("Minecraft client download metadata is unavailable");
  }
  const meta: VersionMeta = {
    clientUrl: client.url,
    clientSha1: client.sha1 ?? "",
    clientSize: client.size,
  };
  try {
    localStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify(meta));
  } catch {
    // Optional cache.
  }
  return meta;
}

/**
 * Hypixel items are usually referenced by modern vanilla material names while
 * the 1.8.9 client uses older texture filenames. Store both names so either
 * spelling resolves without another lookup layer.
 */
function textureAliases(name: string): string[] {
  const aliases = new Set<string>([name]);
  const add = (value: string) => aliases.add(value);
  if (name === "bow_standby") add("bow");
  if (name === "fishing_rod_uncast") add("fishing_rod");
  if (name === "book_normal") add("book");
  if (name === "book_enchanted") add("enchanted_book");
  if (name === "book_written") add("written_book");
  if (name === "book_writable") add("writable_book");
  if (name === "gold_sword") add("golden_sword");
  if (name === "wood_sword") add("wooden_sword");
  if (name.startsWith("gold_")) add(`golden_${name.slice("gold_".length)}`);
  if (name.startsWith("wood_")) add(`wooden_${name.slice("wood_".length)}`);
  if (name === "apple_golden") add("golden_apple");
  if (name === "carrot_golden") add("golden_carrot");
  if (name === "melon_speckled") add("glistering_melon");
  if (name === "potato_baked") add("baked_potato");
  if (name === "potato_poisonous") add("poisonous_potato");
  if (name === "beef_raw") add("beef");
  if (name === "beef_cooked") add("cooked_beef");
  if (name === "chicken_raw") add("chicken");
  if (name === "chicken_cooked") add("cooked_chicken");
  if (name === "porkchop_raw") add("porkchop");
  if (name === "porkchop_cooked") add("cooked_porkchop");
  if (name === "mutton_raw") add("mutton");
  if (name === "mutton_cooked") add("cooked_mutton");
  if (name === "rabbit_raw") add("rabbit");
  if (name === "rabbit_cooked") add("cooked_rabbit");
  if (name === "fish_cod_raw") {
    add("fish");
    add("raw_fish");
    add("cod");
  }
  if (name === "fish_cod_cooked") {
    add("cooked_fish");
    add("cooked_cod");
  }
  if (name === "fish_salmon_raw") add("salmon");
  if (name === "fish_salmon_cooked") add("cooked_salmon");
  if (name === "fish_clownfish_raw") add("clownfish");
  if (name === "fish_pufferfish_raw") add("pufferfish");
  if (name === "reeds") add("sugar_cane");
  if (name === "seeds_wheat") add("wheat_seeds");
  if (name === "seeds_pumpkin") add("pumpkin_seeds");
  if (name === "seeds_melon") add("melon_seeds");
  if (name === "slimeball") add("slime_ball");
  if (name === "netherbrick") add("nether_brick");
  if (name === "map_empty") add("empty_map");
  if (name === "map_filled") add("map");
  if (name === "fireworks") add("firework_rocket");
  if (name === "fireworks_charge") add("firework_star");
  if (name === "minecart_normal") add("minecart");
  if (name === "minecart_chest") add("chest_minecart");
  if (name === "minecart_furnace") add("furnace_minecart");
  if (name === "minecart_hopper") add("hopper_minecart");
  if (name === "minecart_tnt") add("tnt_minecart");
  if (name === "door_wood") add("wooden_door");
  if (name === "door_iron") add("iron_door");
  if (name === "potion_bottle_drinkable") add("potion");
  if (name === "potion_bottle_splash") add("splash_potion");
  if (name === "quartz_block_side") add("quartz_block");
  if (name === "pumpkin_face_off") add("pumpkin");
  if (name === "pumpkin_face_on") add("jack_o_lantern");
  if (name === "endframe_side") add("ender_portal_frame");
  if (name === "endframe_top") add("end_portal_frame");
  if (name === "prismarine_rough") add("prismarine");
  if (name === "prismarine_dark") add("dark_prismarine");
  if (name === "comparator") add("redstone_comparator");
  if (name === "repeater") add("redstone_repeater");
  return [...aliases];
}

function materialAliases(material: string): string[] {
  const name = material.toLowerCase().replace(/^minecraft:/, "").trim();
  if (!name) return [];
  const aliases = new Set<string>([name]);
  if (name.endsWith("_block")) aliases.add(name.slice(0, -"_block".length));
  if (name.endsWith("_barding")) {
    aliases.add(`${name.slice(0, -"_barding".length)}_horse_armor`);
  }
  if (name.endsWith("_spade")) {
    aliases.add(`${name.slice(0, -"_spade".length)}_shovel`);
  }
  if (name === "ender_portal_frame") {
    aliases.add("endframe_side");
    aliases.add("endframe_top");
  }
  if (name === "prismarine") aliases.add("prismarine_rough");
  if (name === "dark_prismarine") aliases.add("prismarine_dark");
  if (name === "redstone_comparator") aliases.add("comparator");
  if (name === "redstone_repeater") aliases.add("repeater");
  // Legacy 1.8 textures drop underscores: dead_bush -> deadbush.png.
  const compact = name.replace(/_/g, "");
  if (compact !== name) aliases.add(compact);
  if (name === "skull" || name === "player_head" || name === "head") {
    aliases.add("skull");
    aliases.add("player_head");
  }
  return [...aliases];
}

async function loadClientTextures(): Promise<void> {
  if (isVanillaCacheReady()) return;
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    const meta = await loadVersionMeta();
    const response = await transportFetch(meta.clientUrl, {
      method: "GET",
      headers: { Accept: "application/octet-stream" },
    });
    if (!response.ok) {
      throw new Error(`Minecraft client download returned HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > MAX_CLIENT_BYTES) {
      throw new Error("Minecraft client archive is unavailable or too large");
    }
    const { parseZip } = await import("./zip");
    const files = await parseZip(buffer);
    const textures = new Map<string, Uint8Array>();
    for (const [path, bytes] of files) {
      const match = /assets\/minecraft\/textures\/(?:items|item|blocks|block)\/([^/]+)\.png$/i.exec(
        path,
      );
      const rawName = match?.[1]?.toLowerCase();
      if (!rawName) continue;
      for (const name of textureAliases(rawName)) {
        if (!textures.has(name)) textures.set(name, bytes);
        const compact = name.replace(/_/g, "");
        if (compact !== name && !textures.has(compact)) textures.set(compact, bytes);
      }
    }
    if (!textures.size) throw new Error("Minecraft client archive has no textures");
    const written = await storeVanillaTextures(textures);
    await setVanillaMeta({
      version: VANILLA_VERSION,
      fetchedAt: Date.now(),
      indexSize: written,
    });
  })().catch((error) => {
    clientPromise = null;
    throw error;
  });
  return clientPromise;
}

function candidates(material: string): string[] {
  return materialAliases(material);
}

export async function resolveVanillaMaterial(material: string): Promise<string | null> {
  const existing =
    getVanillaTextureKey(material) ?? getVanillaTextureKeyLoose(material);
  if (existing) return existing;
  await loadClientTextures();
  for (const candidate of candidates(material)) {
    const key =
      getVanillaTextureKey(candidate) ?? getVanillaTextureKeyLoose(candidate);
    if (key) return key;
  }
  return null;
}

export async function warmVanillaMaterials(
  materials: Iterable<string>,
  concurrency = 4,
): Promise<{ loaded: number; missing: number; failed: number }> {
  const unique = [...new Set([...materials].map((value) => value.toLowerCase()).filter(Boolean))];
  let loaded = 0;
  let missing = 0;
  let failed = 0;
  // Load the archive once; then all candidates resolve from IndexedDB memory.
  try {
    await loadClientTextures();
  } catch {
    // Fall through: the per-material loop reports the failure.
  }
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, async () => {
    while (cursor < unique.length) {
      const material = unique[cursor++];
      if (!material) continue;
      try {
        const key = await resolveVanillaMaterial(material);
        if (key) loaded += 1;
        else missing += 1;
      } catch {
        failed += 1;
      }
    }
  });
  await Promise.all(workers);
  return { loaded, missing, failed };
}

export async function vanillaStatus(): Promise<{ ready: boolean; count: number }> {
  const meta = await getVanillaMeta();
  return { ready: Boolean(meta), count: meta?.indexSize ?? 0 };
}

export const VANILLA_TEXTURE_VERSION = VANILLA_VERSION;
