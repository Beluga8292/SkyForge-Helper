import { describe, expect, it } from "vitest";
import {
  LORE_COLOR_HEX,
  parseLore,
  parseLoreLine,
  plainLore,
  rarityFromLore,
  stripMinecraftFormatting,
} from "./item-lore";

describe("Minecraft lore parser", () => {
  it("strips legacy formatting codes", () => {
    expect(stripMinecraftFormatting("§6§lHyperion")).toBe("Hyperion");
    expect(stripMinecraftFormatting("§7Damage: §c+260")).toBe("Damage: +260");
  });

  it("parses legacy colour and style codes into segments", () => {
    const line = parseLoreLine("§6§lHyperion §7✪");
    expect(line.text).toBe("Hyperion ✪");
    expect(line.segments).toEqual([
      {
        text: "Hyperion ",
        color: "gold",
        bold: true,
        italic: false,
        underlined: false,
        strikethrough: false,
      },
      {
        text: "✪",
        color: "gray",
        bold: false,
        italic: false,
        underlined: false,
        strikethrough: false,
      },
    ]);
    expect(LORE_COLOR_HEX.gold).toBe("#ffaa00");
  });

  it("resets style after §r", () => {
    const line = parseLoreLine("§cRed §rPlain");
    expect(line.text).toBe("Red Plain");
    expect(line.segments[0]).toMatchObject({ text: "Red ", color: "red" });
    expect(line.segments[1]).toMatchObject({
      text: "Plain",
      color: null,
      bold: false,
    });
  });

  it("flattens JSON text components including nested extras", () => {
    const line = parseLoreLine(
      '{"text":"Hello ","color":"red","extra":[{"text":"World","bold":true}]}',
    );
    expect(line.text).toBe("Hello World");
    expect(line.segments).toEqual([
      {
        text: "Hello ",
        color: "red",
        bold: false,
        italic: false,
        underlined: false,
        strikethrough: false,
      },
      {
        text: "World",
        color: "red",
        bold: true,
        italic: false,
        underlined: false,
        strikethrough: false,
      },
    ]);
  });

  it("falls back to legacy parsing for malformed JSON", () => {
    const line = parseLoreLine("{not json} §aGreen");
    expect(line.text).toBe("{not json} Green");
    expect(line.segments.some((segment) => segment.color === "green")).toBe(true);
  });

  it("parses lore arrays and ignores non-string entries", () => {
    const raw = ["§7Line one", 42, null, '{"text":"Line two"}'] as never;
    expect(plainLore(raw)).toEqual(["Line one", "Line two"]);
    expect(parseLore(raw)).toHaveLength(2);
    expect(parseLore(undefined)).toEqual([]);
  });

  it("detects the rarity line from the last four lines", () => {
    expect(rarityFromLore(["§7Stats", "§6§lLEGENDARY SWORD"])).toBe("LEGENDARY");
    expect(rarityFromLore(["§5§lEPIC"])).toBe("EPIC");
    expect(rarityFromLore(["§c§lVERY SPECIAL"])).toBe("VERY_SPECIAL");
    expect(rarityFromLore(["Just a line"])).toBeNull();
  });
});
