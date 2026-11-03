import { describe, expect, it } from "vitest";
import { iconForItem, iconKindLabel } from "./icons";

describe("hand-authored item icon mapping", () => {
  it("prefers the item category when it is known", () => {
    expect(iconForItem({ itemId: "HYPERION", category: "SWORD" })).toBe("sword");
    expect(iconForItem({ category: "CHESTPLATE" })).toBe("chestplate");
    expect(iconForItem({ category: "accessory" })).toBe("accessory");
  });

  it("falls back to conservative id rules", () => {
    expect(iconForItem({ itemId: "ESSENCE_WITHER" })).toBe("essence");
    expect(iconForItem({ itemId: "FLAWLESS_JASPER_GEM" })).toBe("gem");
    expect(iconForItem({ itemId: "SKYBLOCK_COIN" })).toBe("coin");
    expect(iconForItem({ itemId: "HOT_POTATO_BOOK" })).toBe("food");
    expect(iconForItem({ itemId: "ENCHANTED_BOOK" })).toBe("book");
    expect(iconForItem({ itemId: "GREATER_BACKPACK" })).toBe("backpack");
    expect(iconForItem({ itemId: "GOLDEN_DRAGON" })).toBe("pet");
    expect(iconForItem({ itemId: "RECOMBOBULATOR_3000" })).toBe("misc");
  });

  it("uses the vanilla material as the last specific hint", () => {
    expect(iconForItem({ itemId: "UNKNOWN_ITEM", material: "DIAMOND_SWORD" })).toBe("sword");
    expect(iconForItem({ itemId: "UNKNOWN_ITEM", material: "SHULKER_BOX" })).toBe("backpack");
    expect(iconForItem({ itemId: "UNKNOWN_ITEM", material: "GLASS_BOTTLE" })).toBe("potion");
  });

  it("returns a neutral fallback for unknown items and null for empty input", () => {
    expect(iconForItem({ itemId: "TOTALLY_UNKNOWN_ITEM" })).toBe("misc");
    expect(iconForItem({ category: "SOMETHING_NEW" })).toBe("misc");
    expect(iconForItem({})).toBeNull();
  });

  it("produces stable accessibility labels", () => {
    expect(iconKindLabel("fishing-rod")).toBe("fishing rod");
    expect(iconKindLabel("sword")).toBe("sword");
    expect(iconKindLabel(null)).toBe("item");
  });
});
