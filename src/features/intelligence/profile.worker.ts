import { normalizeProfile, enrichLocal } from "./engine";
self.onmessage = async (event: MessageEvent) => {
  try {
    const p = event.data;
    const out = await normalizeProfile(
      p.profile,
      p.uuid,
      p.skills,
      p.items,
      p.fetchedAt,
      p.source,
      p.stale,
    );
    self.postMessage({
      data: enrichLocal(out, p.items, p.products, p.timestamp),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "analysis_failed",
    });
  }
};
