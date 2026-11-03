import { describe, expect, it } from "vitest";
import { dictionaries } from "@/locales";
import { ru } from "@/locales/ru";
import { en } from "@/locales/en";
import { stage7En, stage7Ru } from "@/locales/stage7";
import { stage8En, stage8Ru } from "@/locales/stage8";

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1] ?? "")
    .sort();
}

describe("RU/EN localisation parity", () => {
  it("has exactly the same keys in both dictionaries", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
    expect(Object.keys(dictionaries.en).sort()).toEqual(
      Object.keys(dictionaries.ru).sort(),
    );
  });

  it("has no empty translations", () => {
    for (const [key, value] of Object.entries(ru)) {
      expect(value.trim(), `ru.${key}`).not.toBe("");
    }
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), `en.${key}`).not.toBe("");
    }
  });

  it("keeps interpolation variables identical", () => {
    for (const key of Object.keys(ru) as Array<keyof typeof ru>) {
      expect(placeholders(en[key]), `en.${key}`).toEqual(
        placeholders(ru[key]),
      );
    }
  });

  it("ships every STAGE 7 key in both languages", () => {
    const keys = Object.keys(stage7Ru) as Array<keyof typeof stage7Ru>;
    expect(keys.length).toBeGreaterThan(100);
    expect(Object.keys(stage7En).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(ru[key], `ru.${key}`).toBeTruthy();
      expect(en[key], `en.${key}`).toBeTruthy();
    }
  });

  it("ships every STAGE 7.4 key in both languages", () => {
    const keys = Object.keys(stage8Ru) as Array<keyof typeof stage8Ru>;
    expect(keys.length).toBeGreaterThan(40);
    expect(Object.keys(stage8En).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(ru[key], `ru.${key}`).toBeTruthy();
      expect(en[key], `en.${key}`).toBeTruthy();
    }
  });

  it("covers the required navigation, upgrade and inventory strings", () => {
    const required = [
      "nav.section.account",
      "nav.section.view",
      "nav.networth",
      "nav.viewPlayer",
      "calculators.tabs.upgrade",
      "upgrade.title",
      "networth.title",
      "inventory.title",
      "view.title",
    ] as const;
    for (const key of required) {
      expect(ru[key], `ru.${key}`).toBeTruthy();
      expect(en[key], `en.${key}`).toBeTruthy();
    }
  });
});
