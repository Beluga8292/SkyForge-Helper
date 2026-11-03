import { describe, expect, it } from "vitest";
import type { HypixelAuction } from "@/types/hypixel";
import { AUCTION_SKULL_BLOB } from "./__fixtures__/auction-blob";
import { decodeAuctionVisual } from "./auction-visual";

function auction(item_bytes: unknown): HypixelAuction {
  return {
    uuid: "0123456789abcdef0123456789abcdef",
    item_name: "Basketball Minion Skin",
    item_bytes,
  } as unknown as HypixelAuction;
}

describe("auction NBT visual decoding", () => {
  it("reads the authoritative SkyBlock id and the custom head texture", async () => {
    await expect(decodeAuctionVisual(auction(AUCTION_SKULL_BLOB))).resolves.toMatchObject({
      itemId: "BASKETBALL_PERSONALITY",
      skullTexture:
        "http://textures.minecraft.net/texture/cd3fe0a9540e604f1249e16c105cda45812b203707cf93fe66fba5119e387883",
    });
  });

  it("returns empty data for a missing or undecodable blob instead of guessing", async () => {
    await expect(decodeAuctionVisual(auction(undefined))).resolves.toEqual({
      itemId: null,
      skullTexture: null,
    });
    await expect(decodeAuctionVisual(auction("not-base64!!"))).resolves.toEqual({
      itemId: null,
      skullTexture: null,
    });
  });

  it("returns the same decoded result for repeated blobs", async () => {
    const first = await decodeAuctionVisual(auction(AUCTION_SKULL_BLOB));
    const second = await decodeAuctionVisual(auction(AUCTION_SKULL_BLOB));
    expect(second).toEqual(first);
  });
});
