import { beforeEach, describe, expect, it, vi } from "vitest";

const meta = {
  name: "FurfSky Reborn",
  importedAt: 1,
  itemCount: 2,
  materialCount: 1,
  textureCount: 3,
  unresolvedItems: 0,
  source: "furfsky" as const,
};

vi.mock("./storage", () => ({
  initTextureCache: vi.fn(async () => undefined),
  getPackMeta: vi.fn(() => meta),
  getItemTextureKey: vi.fn((id: string) => {
    if (id === "HYPERION") return "item:hyperion";
    if (id === "ENCHANTED_CARROT") return "item:enchanted_carrot";
    return null;
  }),
  getMaterialTextureKey: vi.fn((material: string) =>
    material === "iron_sword" ? "material:iron_sword" : null,
  ),
  getVanillaTextureKey: vi.fn((material: string) =>
    material === "diamond" ? "vanilla:diamond" : null,
  ),
  getVanillaTextureKeyLoose: vi.fn(() => null),
  getTextureUrl: vi.fn(async (key: string) => `blob:${key}`),
  storeTexture: vi.fn(async () => undefined),
  clearPack: vi.fn(async () => undefined),
  importPack: vi.fn(async () => meta),
}));

vi.mock("./vanilla", () => ({
  resolveVanillaMaterial: vi.fn(async (material: string) => {
    if (material === "gold_ingot") return "vanilla:gold_ingot";
    if (material === "iron_pickaxe") return "vanilla:iron_pickaxe";
    return null;
  }),
}));

vi.mock("@/api/transport", () => ({ transportFetch: vi.fn() }));
import { transportFetch } from "@/api/transport";
import { getTextureUrl, storeTexture } from "./storage";
import { resolveItemTexture } from "./resolver";

describe("texture resolver priority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers a pack item texture over material textures", async () => {
    const result = await resolveItemTexture({
      itemId: "HYPERION",
      material: "iron_sword",
    });
    expect(result).toMatchObject({ key: "item:hyperion", source: "furfsky" });
  });

  it("falls back to a pack material texture for unknown item ids", async () => {
    const result = await resolveItemTexture({
      itemId: "SOME_UNKNOWN_ITEM_A",
      material: "iron_sword",
    });
    expect(result).toMatchObject({ key: "material:iron_sword", source: "furfsky" });
  });

  it("falls back to a cached vanilla texture", async () => {
    const result = await resolveItemTexture({ material: "diamond" });
    expect(result).toMatchObject({ key: "vanilla:diamond", source: "vanilla" });
  });

  it("fetches a vanilla texture lazily when it is not cached", async () => {
    const result = await resolveItemTexture({ material: "gold_ingot" });
    expect(result).toMatchObject({ key: "vanilla:gold_ingot", source: "vanilla" });
  });

  it("returns null when no texture source matches", async () => {
    const result = await resolveItemTexture({
      itemId: "NO_TEXTURE_ANYWHERE",
      material: "barrier",
    });
    expect(result).toBeNull();
  });

  it("resolves legacy item-id aliases without a registry hint", async () => {
    const result = await resolveItemTexture({
      itemId: "ENCHANTED_CARROT_ITEM",
    });
    expect(result).toMatchObject({
      key: "item:enchanted_carrot",
      source: "furfsky",
    });
  });

  it("prefers a real skull texture over pack materials and vanilla", async () => {
    const hash = "a".repeat(64);
    const result = await resolveItemTexture({
      itemId: "CUSTOM_HEAD_ITEM",
      material: "iron_sword",
      skullTexture: `https://textures.minecraft.net/texture/${hash}`,
    });
    expect(result).toMatchObject({
      key: `skinface:${hash}`,
      source: "skull",
    });
  });

  it("uses the display name only as a weak pack fallback", async () => {
    const result = await resolveItemTexture({
      itemId: "SOMETHING_NOT_IN_THE_PACK",
      name: "Hyperion",
      material: "iron_sword",
    });
    expect(result).toMatchObject({ key: "item:hyperion", source: "furfsky" });
  });

  it("uses a generic vanilla shape for an unknown item id", async () => {
    const result = await resolveItemTexture({
      itemId: "MYSTERY_PICKAXE",
      material: "barrier",
    });
    expect(result).toMatchObject({
      key: "vanilla:iron_pickaxe",
      source: "vanilla",
    });
  });
});


it("coalesces one skull hash across different auction items without revoking their shared image", async () => {
  const original = vi.mocked(getTextureUrl).getMockImplementation();
  let stored = false;
  vi.mocked(getTextureUrl).mockImplementation(async key => key.startsWith("skinface:") ? (stored ? "blob:shared-skin" : null) : `blob:${key}`);
  vi.mocked(storeTexture).mockImplementation(async () => { stored = true; });
  vi.mocked(transportFetch).mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  const hash = "b".repeat(64);
  try {
    const results = await Promise.all([
      resolveItemTexture({ itemId: "UNKNOWN_HEAD_A", skullTexture: hash }),
      resolveItemTexture({ itemId: "UNKNOWN_HEAD_B", skullTexture: `http://textures.minecraft.net/texture/${hash}` }),
    ]);
    expect(results.map(r => r?.url)).toEqual(["blob:shared-skin", "blob:shared-skin"]);
    expect(transportFetch).toHaveBeenCalledTimes(1);
    expect(storeTexture).toHaveBeenCalledTimes(1);
  } finally {
    vi.mocked(getTextureUrl).mockImplementation(original!);
    vi.mocked(storeTexture).mockImplementation(async () => undefined);
  }
});
