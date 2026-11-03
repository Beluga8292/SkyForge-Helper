import { decodeAuctionIdentity, valueAuctions } from "./auction-engine";
import type { HypixelAuction } from "@/types/hypixel";
self.onmessage = async (event: MessageEvent<HypixelAuction[]>) => {
  try {
    if (typeof DecompressionStream === "undefined")
      throw new Error("Gzip unavailable");
    const items = [];
    for (const raw of event.data.slice(0, 1000))
      items.push({ raw, identity: await decodeAuctionIdentity(raw) });
    self.postMessage({ items: valueAuctions(items) });
  } catch {
    self.postMessage({ error: "Auction analysis failed" });
  }
};
