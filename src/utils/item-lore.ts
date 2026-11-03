import type { NbtValue } from "@/utils/nbt";

const COLOR_CODE_REGEX = /§[0-9a-fk-or]/gi;

export function stripMinecraftFormatting(value: string): string {
  return value.replace(COLOR_CODE_REGEX, "").trim();
}

export interface LoreSegment {
  text: string;
  color: string | null;
  bold: boolean;
  italic: boolean;
  underlined: boolean;
  strikethrough: boolean;
}

export interface LoreLine {
  /** Plain text with all Minecraft formatting removed. */
  text: string;
  segments: LoreSegment[];
}

const LEGACY_COLORS: Record<string, string> = {
  "0": "black",
  "1": "dark_blue",
  "2": "dark_green",
  "3": "dark_aqua",
  "4": "dark_red",
  "5": "dark_purple",
  "6": "gold",
  "7": "gray",
  "8": "dark_gray",
  "9": "blue",
  a: "green",
  b: "aqua",
  c: "red",
  d: "light_purple",
  e: "yellow",
  f: "white",
};

const COLOR_ALIASES: Record<string, string> = {
  dark_blue: "dark_blue",
  dark_green: "dark_green",
  dark_aqua: "dark_aqua",
  dark_red: "dark_red",
  dark_purple: "dark_purple",
  dark_gray: "dark_gray",
  light_purple: "light_purple",
  reset: "white",
  black: "black",
  darkblue: "dark_blue",
  darkgreen: "dark_green",
  darkaqua: "dark_aqua",
  darkred: "dark_red",
  darkpurple: "dark_purple",
  darkgray: "dark_gray",
  lightpurple: "light_purple",
  gray: "gray",
  grey: "gray",
  white: "white",
  yellow: "yellow",
  gold: "gold",
  red: "red",
  green: "green",
  aqua: "aqua",
  blue: "blue",
};

export const LORE_COLOR_HEX: Record<string, string> = {
  black: "#000000",
  dark_blue: "#0000aa",
  dark_green: "#00aa00",
  dark_aqua: "#00aaaa",
  dark_red: "#aa0000",
  dark_purple: "#aa00aa",
  gold: "#ffaa00",
  gray: "#aaaaaa",
  dark_gray: "#555555",
  blue: "#5555ff",
  green: "#55ff55",
  aqua: "#55ffff",
  red: "#ff5555",
  light_purple: "#ff55ff",
  yellow: "#ffff55",
  white: "#ffffff",
};

function emptySegment(style: Partial<LoreSegment> = {}): LoreSegment {
  return {
    text: "",
    color: null,
    bold: false,
    italic: false,
    underlined: false,
    strikethrough: false,
    ...style,
  };
}

function normalizeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase().replace(/^§/, "");
  if (LEGACY_COLORS[key]) return LEGACY_COLORS[key];
  return COLOR_ALIASES[key] ?? null;
}

function parseLegacy(line: string): LoreSegment[] {
  const segments: LoreSegment[] = [];
  let current = emptySegment();
  let index = 0;

  const flush = () => {
    if (current.text) segments.push(current);
    current = { ...current, text: "" };
  };

  while (index < line.length) {
    const char = line[index];
    if (char === "§" && index + 1 < line.length) {
      const code = line[index + 1]!.toLowerCase();
      index += 2;
      if (LEGACY_COLORS[code]) {
        flush();
        current.color = LEGACY_COLORS[code]!;
        current.bold = false;
        current.italic = false;
        current.underlined = false;
        current.strikethrough = false;
      } else if (code === "l") {
        current.bold = true;
      } else if (code === "o") {
        current.italic = true;
      } else if (code === "n") {
        current.underlined = true;
      } else if (code === "m") {
        current.strikethrough = true;
      } else if (code === "r") {
        flush();
        current = emptySegment();
      }
      continue;
    }
    current.text += char;
    index += 1;
  }
  flush();
  return segments.length ? segments : [emptySegment({ text: stripMinecraftFormatting(line) })];
}

function componentSegments(value: unknown, inherited: Partial<LoreSegment> = {}): LoreSegment[] {
  if (typeof value === "string") return [emptySegment({ ...inherited, text: value })];
  if (Array.isArray(value)) return value.flatMap((entry) => componentSegments(entry, inherited));
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const style: Partial<LoreSegment> = {
    ...inherited,
    color: normalizeColor(record.color) ?? inherited.color ?? null,
    bold: typeof record.bold === "boolean" ? record.bold : (inherited.bold ?? false),
    italic:
      typeof record.italic === "boolean" ? record.italic : (inherited.italic ?? false),
    underlined:
      typeof record.underlined === "boolean"
        ? record.underlined
        : (inherited.underlined ?? false),
    strikethrough:
      typeof record.strikethrough === "boolean"
        ? record.strikethrough
        : (inherited.strikethrough ?? false),
  };

  const ownText =
    typeof record.text === "string"
      ? record.text
      : typeof record.translate === "string"
        ? record.translate
        : "";
  const own = ownText ? [emptySegment({ ...style, text: ownText })] : [];
  const extra = Array.isArray(record.extra)
    ? record.extra.flatMap((entry) => componentSegments(entry, style))
    : [];
  return [...own, ...extra];
}

function parseJsonLine(line: string): LoreSegment[] | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    const segments = componentSegments(parsed);
    return segments.length ? segments : null;
  } catch {
    return null;
  }
}

export function parseLoreLine(line: string): LoreLine {
  const trimmed = line.trim();
  const segments =
    trimmed.startsWith("{") || trimmed.startsWith("[")
      ? parseJsonLine(trimmed) ?? parseLegacy(line)
      : parseLegacy(line);
  return {
    text: segments.map((segment) => segment.text).join(""),
    segments: segments.filter((segment) => segment.text.length > 0),
  };
}

export function parseLore(raw: NbtValue | string[] | undefined): LoreLine[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => parseLoreLine(entry));
}

export function plainLore(raw: NbtValue | string[] | undefined): string[] {
  return parseLore(raw).map((line) => line.text);
}

/** Detects the rarity line Hypixel appends to item lore. */
export function rarityFromLore(lines: string[]): string | null {
  const names = [
    "VERY_SPECIAL",
    "SPECIAL",
    "DIVINE",
    "MYTHIC",
    "LEGENDARY",
    "EPIC",
    "RARE",
    "UNCOMMON",
    "COMMON",
  ];
  for (const line of lines.slice(-4).reverse()) {
    const clean = stripMinecraftFormatting(line).trim().toUpperCase();
    const found = names.find(
      (name) => clean.startsWith(name.replace("_", " ")) || clean.startsWith(name),
    );
    if (found) return found;
  }
  return null;
}
