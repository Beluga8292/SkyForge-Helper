import { describe, expect, it } from "vitest";
import {
  itemIdCandidates,
  materialCandidates,
  nameCandidates,
} from "./aliases";

describe("texture alias candidates", () => {
  it("keeps the exact item id first and adds legacy suffixes and aliases", () => {
    expect(itemIdCandidates("ENCHANTED_CARROT_ITEM")[0]).toBe(
      "ENCHANTED_CARROT_ITEM",
    );
    expect(itemIdCandidates("ENCHANTED_CARROT_ITEM")).toContain(
      "ENCHANTED_CARROT_ITEM".slice(0, -"_ITEM".length),
    );
    expect(itemIdCandidates("ENCHANTED_CARROT")).toContain(
      "ENCHANTED_CARROT_ITEM",
    );
    expect(itemIdCandidates("minecraft:HYPERION")).toEqual(["HYPERION"]);
    expect(itemIdCandidates(null)).toEqual([]);
  });

  it("strips legacy metadata suffixes from item ids", () => {
    expect(itemIdCandidates("PRISMARINE:1")).toEqual(["PRISMARINE"]);
    expect(itemIdCandidates("minecraft:WOOL:14")).toEqual(["WOOL"]);
  });

  it("normalizes raw fish and pork naming", () => {
    expect(itemIdCandidates("RAW_FISH")).toContain("FISH");
    expect(itemIdCandidates("PORK")).toContain("PORKCHOP");
  });

  it("strips formatting, brackets and roman level suffixes from display names", () => {
    expect(nameCandidates("§6Hyperion")).toEqual(["HYPERION"]);
    expect(nameCandidates("◆ Jerry Rune III")).toContain("JERRY_RUNE");
    expect(nameCandidates(null)).toEqual([]);
  });

  it("falls back from an unknown item id to a recognizable vanilla shape", () => {
    expect(materialCandidates("SKULL_ITEM", "MYSTERY_PICKAXE")).toContain(
      "iron_pickaxe",
    );
    expect(materialCandidates("BARRIER", "TERMINATOR")).toContain("bow");
    expect(materialCandidates("LEATHER_BOOTS", "SHADOW_ASSASSIN_BOOTS")).toContain(
      "leather_boots",
    );
  });

  it("maps legacy vanilla material spellings", () => {
    expect(materialCandidates("NETHERITE_SWORD", "NETHERITE_SWORD")).toContain(
      "diamond_sword",
    );
    expect(materialCandidates("skull", "CUSTOM_HEAD")).toContain("player_head");
  });
});
