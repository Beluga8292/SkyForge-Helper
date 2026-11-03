#!/usr/bin/env node
/**
 * Builds the versioned, offline upgrade catalogue used by the item upgrade
 * calculator. Requirements are taken from NotEnoughUpdates-REPO constants
 * (MIT licensed): essencecosts, gemstonecosts, reforgestones, reforges and
 * enchants. The generated file is committed so the desktop app never needs a
 * network request to calculate upgrade requirements.
 *
 * Usage: node scripts/build-upgrade-catalog.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/data/upgrades/catalog.json");
const REPO = "NotEnoughUpdates/NotEnoughUpdates-REPO";
const RAW = `https://raw.githubusercontent.com/${REPO}/master`;
const API = `https://api.github.com/repos/${REPO}`;

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { "User-Agent": "SkyBlock-Companion-catalog-builder" },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
};

const strip = (value) =>
  String(value ?? "")
    .replace(/§./g, "")
    .replace(/%%[^%]+%%/g, "")
    .trim();

const materialIds = new Set([
  "SKYBLOCK_COIN",
  "RECOMBOBULATOR_3000",
  "HOT_POTATO_BOOK",
  "FUMING_POTATO_BOOK",
  "MASTER_STAR",
]);

const [commit, essence, gemstones, reforgeStones, enchants] =
  await Promise.all([
    fetchJson(`${API}/commits/master`),
    fetchJson(`${RAW}/constants/essencecosts.json`),
    fetchJson(`${RAW}/constants/gemstonecosts.json`),
    fetchJson(`${RAW}/constants/reforgestones.json`),
    fetchJson(`${RAW}/constants/enchants.json`),
  ]);

for (const costs of [essence, gemstones]) {
  for (const rows of Object.values(costs)) {
    for (const list of Object.values(rows)) {
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        const id = String(entry).split(":")[0];
        if (id) materialIds.add(id);
      }
    }
  }
}
for (const stone of Object.values(reforgeStones)) {
  if (stone?.internalName) materialIds.add(stone.internalName);
}

const parseMaterials = (list) =>
  (Array.isArray(list) ? list : [])
    .map((entry) => {
      const [id, quantity] = String(entry).split(":");
      const count = Number(quantity);
      return id && Number.isFinite(count) && count > 0
        ? { id, count: Math.trunc(count) }
        : null;
    })
    .filter(Boolean);

const items = {};
for (const [itemId, data] of Object.entries(essence)) {
  if (!data || typeof data !== "object") continue;
  const stars = {};
  for (const [level, value] of Object.entries(data)) {
    if (/^\d+$/.test(level) && typeof value === "number") {
      stars[level] = value;
    }
  }
  const starItems = {};
  for (const [level, list] of Object.entries(data.items ?? {})) {
    const materials = parseMaterials(list);
    if (materials.length) starItems[level] = materials;
  }
  items[itemId] = {
    essenceType: data.type ?? null,
    maxStars: Math.max(0, ...Object.keys(stars).map(Number)),
    stars,
    starItems,
    gemstoneSlots: Object.fromEntries(
      Object.entries(gemstones[itemId] ?? {}).map(([slot, list]) => [
        slot,
        parseMaterials(list),
      ]),
    ),
  };
}

// Dungeon armour is converted from a base dungeon item; stars are paid on the
// base item and carry over. NEU stores the conversion recipe on the item, but
// the four Wither families share the same star table as their base item.
const aliases = {
  POWER_WITHER_HELMET: "WITHER_HELMET",
  POWER_WITHER_CHESTPLATE: "WITHER_CHESTPLATE",
  POWER_WITHER_LEGGINGS: "WITHER_LEGGINGS",
  POWER_WITHER_BOOTS: "WITHER_BOOTS",
  TANK_WITHER_HELMET: "WITHER_HELMET",
  TANK_WITHER_CHESTPLATE: "WITHER_CHESTPLATE",
  TANK_WITHER_LEGGINGS: "WITHER_LEGGINGS",
  TANK_WITHER_BOOTS: "WITHER_BOOTS",
  SPEED_WITHER_HELMET: "WITHER_HELMET",
  SPEED_WITHER_CHESTPLATE: "WITHER_CHESTPLATE",
  SPEED_WITHER_LEGGINGS: "WITHER_LEGGINGS",
  SPEED_WITHER_BOOTS: "WITHER_BOOTS",
  WISE_WITHER_HELMET: "WITHER_HELMET",
  WISE_WITHER_CHESTPLATE: "WITHER_CHESTPLATE",
  WISE_WITHER_LEGGINGS: "WITHER_LEGGINGS",
  WISE_WITHER_BOOTS: "WITHER_BOOTS",
};
for (const [itemId, base] of Object.entries(aliases)) {
  if (items[itemId] || !items[base]) continue;
  items[itemId] = { ...items[base], aliasOf: base };
}

const materialNames = {};
await Promise.all(
  [...materialIds].map(async (id) => {
    try {
      const item = await fetchJson(`${RAW}/items/${id}.json`);
      materialNames[id] = strip(item.displayname) || id;
    } catch {
      materialNames[id] = id
        .split("_")
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(" ");
    }
  }),
);

const reforgeRows = Object.values(reforgeStones)
  .map((row) => ({
    stone: row.internalName,
    name: row.reforgeName,
    itemTypes: row.itemTypes,
    rarities: row.requiredRarities ?? [],
    costs: row.reforgeCosts ?? {},
  }))
  .filter((row) => row.stone && row.name)
  .sort((a, b) => a.name.localeCompare(b.name));

const catalog = {
  meta: {
    version: `neu-${commit.sha.slice(0, 12)}`,
    generatedAt: new Date().toISOString(),
    commit: commit.sha,
    sources: [
      {
        name: "NotEnoughUpdates-REPO",
        url: `https://github.com/${REPO}`,
        license: "MIT",
        commit: commit.sha,
      },
    ],
    note:
      "Requirements are extracted from NEU constants. Unknown requirements are not invented.",
  },
  items,
  materialNames,
  reforges: reforgeRows,
  enchantPools: enchants.enchants ?? {},
  constants: {
    recombobulator: "RECOMBOBULATOR_3000",
    hotPotatoBook: "HOT_POTATO_BOOK",
    fumingPotatoBook: "FUMING_POTATO_BOOK",
    hotPotatoMax: 10,
    fumingPotatoMax: 5,
  },
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(
  `Wrote ${OUT}: ${Object.keys(items).length} items, ${reforgeRows.length} reforges, ${Object.keys(materialNames).length} material names`,
);
