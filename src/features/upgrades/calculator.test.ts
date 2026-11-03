import { describe, expect, it } from "vitest";
import {
  computeUpgradePlan,
  createPriceResolver,
  emptyUpgradeState,
  type ItemFacts,
} from "./calculator";

const hyperion: ItemFacts = {
  itemId: "HYPERION",
  name: "Hyperion",
  category: "SWORD",
  rarity: "LEGENDARY",
};

const witherChestplate: ItemFacts = {
  itemId: "WITHER_CHESTPLATE",
  name: "Wither Chestplate",
  category: "CHESTPLATE",
  rarity: "LEGENDARY",
};

const essencePrices = createPriceResolver({
  bazaar: { ESSENCE_WITHER: 100 },
});

describe("upgrade calculator", () => {
  it("prices every dungeon star and the coin fees from the verified catalogue", () => {
    const plan = computeUpgradePlan(
      hyperion,
      emptyUpgradeState(),
      { stars: 5 },
      { prices: essencePrices },
    );

    expect(plan.stages.map((stage) => stage.kind)).toEqual([
      "stars",
      "stars",
      "stars",
      "stars",
      "stars",
    ]);
    expect(plan.essence).toEqual([{ type: "Wither", amount: 3350 }]);
    expect(plan.coinFees).toBe(35000);
    expect(plan.coinFeesKnown).toBe(true);
    // 3350 essence × 100 + 10k + 25k coins.
    expect(plan.knownCost).toBe(370000);
    expect(plan.totalCost).toBe(370000);
    expect(plan.unknownStages).toBe(0);
    expect(plan.coverage).toBe(1);
    expect(plan.materials.find((row) => row.id === "ESSENCE_WITHER")).toMatchObject({
      required: 3350,
      owned: 0,
      missing: 3350,
      unitPrice: 100,
      missingCost: 335000,
      priceMethod: "bazaar",
    });
  });

  it("consumes owned essence stage by stage instead of crediting it to every star", () => {
    const plan = computeUpgradePlan(
      hyperion,
      emptyUpgradeState(),
      { stars: 5 },
      { prices: essencePrices, owned: { ESSENCE_WITHER: 1000 } },
    );

    const essence = plan.materials.find((row) => row.id === "ESSENCE_WITHER");
    // 150 + 300 + 500 are covered, 900 and 1500 are not.
    expect(essence).toMatchObject({
      required: 3350,
      owned: 1000,
      missing: 2350,
      missingCost: 235000,
    });
    expect(plan.knownCost).toBe(270000);
    expect(plan.totalCost).toBe(270000);
  });

  it("keeps unverified master stars unknown instead of inventing costs", () => {
    const plan = computeUpgradePlan(
      hyperion,
      { stars: 5 },
      { stars: 10 },
      { prices: essencePrices },
    );

    const masterStars = plan.stages.filter((stage) => stage.kind === "master-stars");
    expect(masterStars).toHaveLength(5);
    expect(masterStars.every((stage) => stage.status === "unknown")).toBe(true);
    expect(masterStars[0]?.note).toBe("master_star_requirements_unverified");
    expect(plan.unknownStages).toBe(5);
    expect(plan.totalCost).toBeNull();
  });

  it("adds the Recombobulator as a priced requirement", () => {
    const plan = computeUpgradePlan(
      hyperion,
      emptyUpgradeState(),
      { recombobulated: true },
      {
        prices: createPriceResolver({
          bazaar: { RECOMBOBULATOR_3000: 5_000_000 },
        }),
      },
    );

    const stage = plan.stages.find((entry) => entry.kind === "recombobulator");
    expect(stage).toMatchObject({
      status: "ready",
      coinFee: 0,
      coinFeeKnown: true,
      knownCost: 5_000_000,
      complete: true,
    });
    expect(plan.materials).toEqual([
      expect.objectContaining({
        id: "RECOMBOBULATOR_3000",
        required: 1,
        missingCost: 5_000_000,
      }),
    ]);
    expect(plan.totalCost).toBe(5_000_000);
  });

  it("refuses to recombobulate SPECIAL items", () => {
    const plan = computeUpgradePlan(
      { ...hyperion, rarity: "SPECIAL" },
      emptyUpgradeState(),
      { recombobulated: true },
      { prices: essencePrices },
    );

    const stage = plan.stages.find((entry) => entry.kind === "recombobulator");
    expect(stage?.status).toBe("unsupported");
    expect(stage?.note).toBe("item_cannot_be_recombobulated");
    expect(plan.totalCost).toBeNull();
  });

  it("prices a reforge stone plus the verified reforge fee", () => {
    const plan = computeUpgradePlan(
      hyperion,
      emptyUpgradeState(),
      { reforge: "DRAGON_CLAW" },
      {
        prices: createPriceResolver({
          bazaar: { DRAGON_CLAW: 1_000_000 },
        }),
      },
    );

    const stage = plan.stages.find((entry) => entry.kind === "reforge");
    expect(stage).toMatchObject({
      label: "Reforge: Fabled",
      coinFee: 100000,
      coinFeeKnown: true,
      knownCost: 1_100_000,
      complete: true,
    });
    expect(plan.coinFees).toBe(100000);
    expect(plan.totalCost).toBe(1_100_000);
  });

  it("marks gemstone slots without verified requirements as unknown", () => {
    const plan = computeUpgradePlan(
      witherChestplate,
      emptyUpgradeState(),
      { gemstoneSlots: ["COMBAT_0"] },
      { prices: essencePrices },
    );

    const stage = plan.stages.find((entry) => entry.kind === "gemstone-slot");
    expect(stage?.status).toBe("unknown");
    expect(stage?.note).toBe("gemstone_slot_requirements_unverified");
    expect(plan.totalCost).toBeNull();
  });

  it("uses the verified gemstone slot recipe when the catalogue has one", () => {
    const plan = computeUpgradePlan(
      hyperion,
      emptyUpgradeState(),
      { gemstoneSlots: ["SAPPHIRE_0"] },
      {
        prices: createPriceResolver({
          bazaar: {
            FLAWLESS_SAPPHIRE_GEM: 2_000_000,
          },
        }),
      },
    );

    const stage = plan.stages.find((entry) => entry.kind === "gemstone-slot");
    expect(stage).toMatchObject({
      status: "ready",
      coinFee: 250000,
      knownCost: 8_250_000,
      complete: true,
    });
  });

  it("requires ten Hot Potato Books before Fuming Potato Books", () => {
    const plan = computeUpgradePlan(
      witherChestplate,
      emptyUpgradeState(),
      { fumingPotatoBooks: 1 },
      {
        prices: createPriceResolver({
          bazaar: { HOT_POTATO_BOOK: 1000, FUMING_POTATO_BOOK: 5000 },
        }),
      },
    );

    expect(plan.stages.find((entry) => entry.id === "potato:required")).toMatchObject({
      kind: "hot-potato",
      target: "10",
      complete: true,
      knownCost: 10000,
    });
    expect(plan.stages.find((entry) => entry.kind === "fuming-potato")).toMatchObject({
      current: "0",
      target: "1",
      knownCost: 5000,
    });
    expect(plan.materials.find((row) => row.id === "HOT_POTATO_BOOK")?.required).toBe(10);
    expect(plan.materials.find((row) => row.id === "FUMING_POTATO_BOOK")?.required).toBe(1);
    expect(plan.totalCost).toBe(15000);
  });

  it("prices one enchantment book per target level", () => {
    const plan = computeUpgradePlan(
      hyperion,
      emptyUpgradeState(),
      { enchantments: { critical: 2 } },
      {
        prices: createPriceResolver({
          bazaar: {
            ENCHANTMENT_CRITICAL_1: 1000,
            ENCHANTMENT_CRITICAL_2: 2000,
          },
        }),
      },
    );

    const stage = plan.stages.find((entry) => entry.kind === "enchantment");
    expect(stage).toMatchObject({
      current: "0",
      target: "2",
      coinFee: 0,
      coinFeeKnown: true,
      knownCost: 3000,
      complete: true,
    });
    expect(stage?.note).toBe("one_book_per_target_level");
  });

  it("rejects enchantments that do not apply to the item type", () => {
    const plan = computeUpgradePlan(
      hyperion,
      emptyUpgradeState(),
      { enchantments: { feather_falling: 5 } },
      { prices: essencePrices },
    );

    const stage = plan.stages.find((entry) => entry.kind === "enchantment");
    expect(stage?.status).toBe("unsupported");
    expect(stage?.note).toBe("enchantment_not_applicable_to_item_type");
    expect(plan.totalCost).toBeNull();
  });

  it("never invents prices when no verified source is available", () => {
    const plan = computeUpgradePlan(
      hyperion,
      emptyUpgradeState(),
      { stars: 5 },
      { prices: createPriceResolver({}) },
    );

    expect(plan.pricedRows).toBe(0);
    expect(plan.totalRows).toBe(5);
    expect(plan.coverage).toBe(0);
    expect(plan.materials.every((row) => row.missingCost === null)).toBe(true);
    expect(plan.totalCost).toBeNull();
    expect(plan.unknownStages).toBe(5);
  });
});
