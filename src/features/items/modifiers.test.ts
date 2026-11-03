import { describe, expect, it } from "vitest";
import {
  getItemRegistryEntry,
  getItemRegistryEntryByName,
  listRegistryMaterials,
  setItemRegistry,
} from "@/features/items/registry";
import { assetToTooltip, readEnchantments, readGemstones } from "@/features/items/modifiers";

describe("item registry", () => {
  setItemRegistry([
    {
      id: "HYPERION",
      name: "Hyperion",
      material: "IRON_SWORD",
      category: "SWORD",
      tier: "LEGENDARY",
    },
    {
      id: "NECRON_CHESTPLATE",
      name: "Necron's Chestplate",
      material: "LEATHER_CHESTPLATE",
      category: "CHESTPLATE",
      tier: "LEGENDARY",
    },
  ]);

  it("resolves by SkyBlock item id", () => {
    expect(getItemRegistryEntry("hyperion")).toMatchObject({
      id: "HYPERION",
      material: "IRON_SWORD",
      category: "SWORD",
    });
  });

  it("resolves by display name and ignores formatting codes", () => {
    expect(getItemRegistryEntryByName("§6Hyperion")).toMatchObject({ id: "HYPERION" });
    expect(getItemRegistryEntryByName("Necron's Chestplate")).toMatchObject({
      id: "NECRON_CHESTPLATE",
    });
  });

  it("lists unique materials for vanilla warm-up", () => {
    expect(listRegistryMaterials().sort()).toEqual([
      "IRON_SWORD",
      "LEATHER_CHESTPLATE",
    ]);
  });
});

describe("item modifier normalisation", () => {
  it("maps raw ExtraAttributes into tooltip fields", () => {
    const item = assetToTooltip({
      itemId: "HYPERION",
      name: "Hyperion",
      rarity: "MYTHIC",
      count: 1,
      modifiers: {
        enchantments: { ultimate_wither_eyes: 5, sharpness: 7 },
        gems: { JASPER_0: "PERFECT" },
        dungeon_item_level: 7,
        hot_potato_count: 15,
        rarity_upgrades: 1,
        reforge: "Heroic",
      },
      soulbound: true,
      value: 1_500_000_000,
      method: "auction",
      location: "inventory",
    });
    expect(item).toMatchObject({
      itemId: "HYPERION",
      stars: 5,
      masterStars: 2,
      recombobulated: true,
      hotPotatoBooks: 10,
      fumingPotatoBooks: 5,
      reforge: "Heroic",
      soulbound: true,
      value: 1_500_000_000,
      location: "inventory",
    });
    expect(item.enchantments).toEqual({ ultimate_wither_eyes: 5, sharpness: 7 });
    expect(item.gemstoneSlots).toEqual(["JASPER_0: PERFECT"]);
  });

  it("keeps unknown values null instead of zero", () => {
    const item = assetToTooltip({
      itemId: "MYSTERY",
      name: "Mystery",
      modifiers: null,
      value: null,
      method: "unknown",
    });
    expect(item.value).toBeNull();
    expect(item.stars).toBe(0);
    expect(item.enchantments).toEqual({});
  });

  it("ignores malformed enchantment and gemstone values", () => {
    expect(readEnchantments({ enchantments: { bad: "x", good: 3 } })).toEqual({ good: 3 });
    expect(readGemstones({ gems: ["FINE", { quality: "PERFECT" }, null] })).toEqual([
      "FINE",
      "PERFECT",
    ]);
  });
});
