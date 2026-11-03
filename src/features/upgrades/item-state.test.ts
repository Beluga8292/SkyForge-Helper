import { describe, expect, it } from "vitest";
import type {
  DecodedInventoryItem,
  InventoryContainer,
  InventorySummary,
} from "@/types/profile";
import {
  allInventoryItems,
  factsFromItem,
  findInventoryItem,
  itemUpgradeSummary,
  ownedMaterials,
  upgradeCandidates,
  upgradeItemState,
  upgradeStateFromItem,
} from "./item-state";

function item(overrides: Partial<DecodedInventoryItem> = {}): DecodedInventoryItem {
  return {
    slot: 0,
    itemId: "HYPERION",
    name: "Hyperion",
    count: 1,
    damage: 0,
    rarity: "LEGENDARY",
    category: "SWORD",
    material: "GOLDEN_SWORD",
    lore: [],
    loreLines: [],
    stars: 0,
    recombobulated: false,
    hotPotatoBooks: 0,
    fumingPotatoBooks: 0,
    reforge: null,
    enchantments: {},
    gemstoneSlots: [],
    uuid: null,
    soulbound: false,
    extra: {},
    ...overrides,
  };
}

function inventory(
  containers: InventoryContainer[],
  overrides: Partial<InventorySummary> = {},
): InventorySummary {
  return {
    available: true,
    reason: null,
    items: [],
    armor: [],
    containers,
    missing: [],
    availableContainers: containers.length,
    totalContainers: containers.length,
    totalItems: containers.reduce(
      (total, container) => total + container.slots.filter(Boolean).length,
      0,
    ),
    truncated: false,
    errors: [],
    ...overrides,
  };
}

function container(
  id: string,
  location: string,
  slots: Array<DecodedInventoryItem | null>,
): InventoryContainer {
  return { id, location, size: slots.length, slots, known: true };
}

describe("upgrade item state", () => {
  it("extracts facts and upgrade state from decoded inventory items", () => {
    const decoded = item({
      stars: 4,
      recombobulated: true,
      hotPotatoBooks: 10,
      fumingPotatoBooks: 2,
      reforge: "DRAGON_CLAW",
      enchantments: { critical: 6 },
      gemstoneSlots: ["COMBAT_0", "COMBAT_0"],
    });

    expect(factsFromItem(decoded)).toEqual({
      itemId: "HYPERION",
      name: "Hyperion",
      category: "SWORD",
      rarity: "LEGENDARY",
      material: "GOLDEN_SWORD",
    });
    expect(upgradeStateFromItem(decoded)).toEqual({
      stars: 4,
      recombobulated: true,
      hotPotatoBooks: 10,
      fumingPotatoBooks: 2,
      reforge: "DRAGON_CLAW",
      enchantments: { critical: 6 },
      gemstoneSlots: ["COMBAT_0"],
    });
    expect(upgradeItemState(decoded).state.stars).toBe(4);
  });

  it("walks every container, de-duplicates slot mirrors and falls back to legacy arrays", () => {
    const a = item({ slot: 0, itemId: "HYPERION" });
    const b = item({ slot: 1, itemId: "ENCHANTED_DIAMOND", category: null });
    const mirrored = item({ slot: 0, itemId: "HYPERION" });

    const full = inventory([
      container("main", "inv_contents", [a, b]),
      container("mirror", "inv_contents", [mirrored]),
    ]);
    expect(allInventoryItems(full).map((entry) => entry.itemId)).toEqual([
      "HYPERION",
      "ENCHANTED_DIAMOND",
    ]);

    const legacy = inventory([], { items: [a], armor: [b] });
    expect(allInventoryItems(legacy).map((entry) => entry.itemId)).toEqual([
      "ENCHANTED_DIAMOND",
      "HYPERION",
    ]);

    const unavailable = inventory([], { available: false });
    expect(allInventoryItems(unavailable)).toEqual([]);
  });

  it("returns only gear candidates sorted by stars and name", () => {
    const sword = item({ itemId: "HYPERION", name: "Hyperion", stars: 2 });
    const chestplate = item({
      itemId: "WITHER_CHESTPLATE",
      name: "Wither Chestplate",
      category: "CHESTPLATE",
      stars: 5,
    });
    const material = item({
      itemId: "ENCHANTED_DIAMOND",
      name: "Enchanted Diamond",
      category: null,
      rarity: "UNCOMMON",
    });

    const candidates = upgradeCandidates(
      inventory([container("main", "inv_contents", [sword, chestplate, material])]),
    );
    expect(candidates.map((entry) => entry.itemId)).toEqual([
      "WITHER_CHESTPLATE",
      "HYPERION",
    ]);
    expect(
      findInventoryItem(
        inventory([container("main", "inv_contents", [sword])]),
        "HYPERION",
      )?.name,
    ).toBe("Hyperion");
    expect(
      findInventoryItem(inventory([container("main", "inv_contents", [sword])]), "TERMINATOR"),
    ).toBeNull();
  });

  it("aggregates owned materials from slot counts and essence currencies", () => {
    const inventorySummary = inventory([
      container("main", "inv_contents", [
        item({ slot: 0, itemId: "HOT_POTATO_BOOK", count: 7, category: null }),
        item({ slot: 1, itemId: "HOT_POTATO_BOOK", count: 3, category: null }),
      ]),
    ]);

    expect(
      ownedMaterials(inventorySummary, {
        essence: { WITHER: 1200, CRIMSON: 0, DRAGON: 45.9 },
      }),
    ).toEqual({
      HOT_POTATO_BOOK: 10,
      ESSENCE_WITHER: 1200,
      ESSENCE_DRAGON: 45,
    });
  });

  it("summarises only verified upgrade fields", () => {
    expect(
      itemUpgradeSummary(
        item({
          stars: 5,
          recombobulated: true,
          hotPotatoBooks: 10,
          fumingPotatoBooks: 2,
          reforge: "DRAGON_CLAW",
          gemstoneSlots: ["COMBAT_0"],
        }),
      ),
    ).toEqual([
      "5★",
      "Recombobulated",
      "HPB 10/10",
      "Fuming 2/5",
      "Reforge: DRAGON_CLAW",
      "Gems: 1",
    ]);
  });
});
