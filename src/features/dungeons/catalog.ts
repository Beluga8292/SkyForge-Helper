/** Versioned role/floor facts, not a meta ranking or purchase catalog.
 * Runtime Hypixel registry supplies item categories and requirements. */
export const DUNGEON_SOURCE = {
  version: "2026-11-03",
  url: "https://hypixelskyblock.minecraft.wiki/w/The_Catacombs",
  upgrades: "src/data/upgrades/catalog.json (NEU commit-pinned)",
};
export const CLASSES = ["berserk", "mage", "archer", "tank", "healer"] as const;
export type DungeonClass = (typeof CLASSES)[number];
export const FLOORS = [
  "E",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "M7",
] as const;
export type Floor = (typeof FLOORS)[number];
// Conflicting current/historical F5/F6 thresholds deliberately not guessed.
export const CATA: Record<string, number | null> = {
  E: 0,
  F1: 1,
  F2: 3,
  F3: 5,
  F4: 9,
  F5: null,
  F6: null,
  F7: 24,
};
export const ROLES: Record<
  DungeonClass,
  { categories: string[]; statKeys: string[] }
> = {
  berserk: {
    categories: ["SWORD", "LONGSWORD"],
    statKeys: ["damage", "strength", "crit_damage"],
  },
  mage: {
    categories: ["SWORD", "LONGSWORD"],
    statKeys: ["intelligence", "ability_damage"],
  },
  archer: {
    categories: ["BOW"],
    statKeys: ["damage", "crit_damage", "attack_speed"],
  },
  tank: { categories: ["SWORD", "LONGSWORD"], statKeys: ["health", "defense"] },
  healer: {
    categories: ["SWORD", "LONGSWORD"],
    statKeys: ["mending", "vitality", "health"],
  },
};
export const ARMOR_SLOTS = [
  "HELMET",
  "CHESTPLATE",
  "LEGGINGS",
  "BOOTS",
] as const;
export const EQUIPMENT_SLOTS = [
  "NECKLACE",
  "CLOAK",
  "BELT",
  "BRACELET",
] as const;
