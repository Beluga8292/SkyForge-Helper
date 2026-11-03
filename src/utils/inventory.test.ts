import { describe, expect, it } from "vitest";
import { INVENTORY_FIXTURE_BASE64 } from "@/utils/__fixtures__/inventory-fixture";
import { decodeInventoryBlob, extractDisplayName, stripMinecraftFormatting } from "@/utils/inventory";
import { decodeBase64GzipNbt, NbtError } from "@/utils/nbt";

describe("Hypixel inventory decoder", () => {
  it("decodes the gzipped NBT fixture and skips empty slots", async () => {
    const result = await decodeInventoryBlob(INVENTORY_FIXTURE_BASE64);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      slot: 0,
      itemId: "HYPERION",
      name: "Hyperion",
      count: 1,
    });
    expect(result.items[1]).toMatchObject({
      slot: 1,
      itemId: "ENCHANTED_DIAMOND",
      name: "Enchanted Diamond",
      count: 64,
    });
  });

  it("returns an empty inventory for an empty blob", async () => {
    await expect(decodeInventoryBlob(undefined)).resolves.toEqual({ items: [], armor: [] });
  });

  it("rejects invalid base64 instead of returning invented data", async () => {
    await expect(decodeBase64GzipNbt("not a base64 payload!!")).rejects.toBeInstanceOf(NbtError);
  });

  it("strips legacy formatting and flattens JSON text components", () => {
    expect(stripMinecraftFormatting("§6§lHyperion")).toBe("Hyperion");
    expect(extractDisplayName('{"text":"Enchanted","extra":[{"text":" Diamond"}]}')).toBe("Enchanted Diamond");
  });
});
