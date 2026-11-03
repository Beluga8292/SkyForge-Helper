import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VIEW_HISTORY_KEY,
  readViewHistory,
  writeViewHistory,
  type ViewHistoryEntry,
} from "./useViewPlayer";

const memory = new Map<string, string>();

function installSessionStorage() {
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
      clear: () => memory.clear(),
    },
  });
}

beforeEach(() => {
  memory.clear();
  installSessionStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("View Player session isolation", () => {
  it("round-trips recent views through sessionStorage only", () => {
    const entries: ViewHistoryEntry[] = [
      { uuid: "a".repeat(32), name: "Alpha", at: 1 },
      { uuid: "b".repeat(32), name: "Bravo", at: 2 },
    ];
    writeViewHistory(entries);

    expect(VIEW_HISTORY_KEY).toBe("view-history:v1");
    expect(memory.has(VIEW_HISTORY_KEY)).toBe(true);
    expect(readViewHistory()).toEqual(entries);
  });

  it("caps the in-session history at eight entries", () => {
    writeViewHistory(
      Array.from({ length: 10 }, (_, index) => ({
        uuid: `${index}`.padStart(32, "0"),
        name: `Player${index}`,
        at: index,
      })),
    );

    const history = readViewHistory();
    expect(history).toHaveLength(8);
    expect(history.map((entry) => entry.name)).toEqual([
      "Player0",
      "Player1",
      "Player2",
      "Player3",
      "Player4",
      "Player5",
      "Player6",
      "Player7",
    ]);
  });

  it("ignores malformed history instead of throwing", () => {
    memory.set(VIEW_HISTORY_KEY, "not json");
    expect(readViewHistory()).toEqual([]);

    memory.set(VIEW_HISTORY_KEY, JSON.stringify([{ uuid: "x" }, null, { name: "y" }]));
    expect(readViewHistory()).toEqual([]);
  });

  it("does not touch localStorage, the linked account or own Networth history", () => {
    const source = readFileSync(new URL("./useViewPlayer.ts", import.meta.url), "utf8");
    expect(source).toContain("sessionStorage");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("setLinkedProfile(");
    expect(source).not.toContain("addRecentSearch(");
    expect(source).not.toContain("appendHistory(");
    expect(source).not.toContain("writeMarketSetting(");
  });
});
