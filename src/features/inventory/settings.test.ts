import { it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  persistSettings,
  sanitizeSettings,
} from "@/services/settings";
vi.mock("@/services/desktop", () => ({
  invokeDesktop: vi.fn(async () => null),
}));
afterEach(() => vi.unstubAllGlobals());
it("defaults off for existing settings and sanitizes only literal boolean opt-in", () => {
  expect(DEFAULT_SETTINGS.showItemValues).toBe(false);
  expect(sanitizeSettings({}).showItemValues).toBe(false);
  expect(sanitizeSettings({ showItemValues: "true" }).showItemValues).toBe(
    false,
  );
  expect(sanitizeSettings({ showItemValues: true }).showItemValues).toBe(true);
});
it("round-trips through existing settings storage without replacing account binding", async () => {
  const memory = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    },
  });
  const linked = {
    uuid: "same-player",
    name: "Player",
    profileId: "same-profile",
  };
  await persistSettings({
    ...DEFAULT_SETTINGS,
    lastProfile: linked,
    showItemValues: true,
  });
  const settings = await loadSettings();
  expect(settings.showItemValues).toBe(true);
  expect(settings.lastProfile).toEqual(linked);
  expect(memory.size).toBe(1);
});
