import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { DEFAULT_SETTINGS } from "@/services/settings";
import { normalizeBackendUrl, resolveBackendUrl } from "@/data/backend";
import { cachedProviderFetch } from "@/data/envelope-cache";
import { resolveDataMode, providerForMode } from "@/data";
import { demoProvider } from "@/data/demo";
import { directProvider } from "@/data/direct";

vi.mock("@/services/cache", () => ({
  readCache: vi.fn(),
  writeCache: vi.fn(),
}));

vi.mock("@/services/secrets", () => ({
  getApiKey: vi.fn(),
}));

import { readCache, writeCache } from "@/services/cache";
import { getApiKey } from "@/services/secrets";

const settings = { ...DEFAULT_SETTINGS, dataMode: "backend" as const, backendUrl: "" };

describe("data provider selection", () => {
  it("ignores persisted demo and direct flags in a user build without changing settings", () => {
    const old = { ...settings, dataMode: "demo" as const, demoMode: true };
    expect(resolveDataMode(old, false)).toBe("backend");
    expect(resolveDataMode({ ...old, dataMode: "direct", demoMode: false }, false)).toBe("backend");
    expect(old.demoMode).toBe(true);
  });

  it("uses backend mode by default", () => {
    expect(resolveDataMode(settings)).toBe("backend");
    expect(providerForMode("backend").id).toBe("backend");
  });

  it("keeps demo mode isolated even if a stale live mode is stored", () => {
    expect(resolveDataMode({ ...settings, demoMode: true }, true)).toBe("demo");
    expect(providerForMode("demo").isDemo).toBe(true);
  });

  it("returns demo payloads marked as demo and never touches the live providers", async () => {
    const envelope = await demoProvider.getBazaar();
    expect(envelope.demo).toBe(true);
    expect(envelope.provider).toBe("demo");
    expect(envelope.data.products).toBeTruthy();
    expect(demoProvider.getBazaar).not.toBe(providerForMode("backend").getBazaar);
  });
});

describe("backend URL policy", () => {
  it("only accepts HTTPS or loopback HTTP URLs", () => {
    expect(normalizeBackendUrl("https://api.example.com/")).toBe("https://api.example.com");
    expect(normalizeBackendUrl("http://127.0.0.1:8000/")).toBe("http://127.0.0.1:8000");
    expect(normalizeBackendUrl("http://localhost:8000")).toBe("http://localhost:8000");
    expect(normalizeBackendUrl("http://evil.example.com")).toBeNull();
    expect(normalizeBackendUrl("javascript:alert(1)")).toBeNull();
  });

  it("ignores a custom URL unless developer mode is enabled", () => {
    const custom = { ...settings, backendUrl: "https://custom.example.com", developerMode: false };
    const dev = { ...custom, developerMode: true };
    expect(resolveBackendUrl(custom, true)).toBe("/backend");
    expect(resolveBackendUrl(dev, true)).toBe("https://custom.example.com");
    expect(resolveBackendUrl(dev, false)).toBe("/backend");
  });
});

describe("backend disconnected fallback", () => {
  beforeEach(() => {
    vi.mocked(readCache).mockReset();
    vi.mocked(writeCache).mockReset();
  });

  it("returns the last persisted value marked stale when the backend is offline", async () => {
    vi.mocked(readCache).mockResolvedValue({ data: { success: true, products: {} }, payload: "{}", updatedAt: Date.now() - 60_000 });
    const envelope = await cachedProviderFetch({
      key: "bazaar:backend",
      ttlMs: 15_000,
      provider: "backend",
      fetcher: async () => {
        throw new ApiError("network", "backend offline");
      },
    });
    expect(envelope.source).toBe("cache");
    expect(envelope.stale).toBe(true);
    expect(envelope.meta?.stale).toBe(true);
    expect(envelope.data).toEqual({ success: true, products: {} });
  });

  it("does not invent data when the backend is offline and nothing is cached", async () => {
    vi.mocked(readCache).mockResolvedValue(null);
    await expect(
      cachedProviderFetch({
        key: "bazaar:backend",
        ttlMs: 15_000,
        provider: "backend",
        fetcher: async () => {
          throw new ApiError("network", "backend offline");
        },
      }),
    ).rejects.toMatchObject({ kind: "network" });
    expect(writeCache).not.toHaveBeenCalled();
  });

  it("serves a fresh persisted value without calling the backend", async () => {
    const updatedAt = Date.now() - 1_000;
    vi.mocked(readCache).mockResolvedValue({ data: { success: true, products: {} }, payload: "{}", updatedAt });
    const fetcher = vi.fn();
    const envelope = await cachedProviderFetch({
      key: "bazaar:backend",
      ttlMs: 15_000,
      provider: "backend",
      fetcher,
    });
    expect(envelope.source).toBe("cache");
    expect(envelope.stale).toBeFalsy();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("direct mode fallback", () => {
  it("reports a missing BYOK key instead of pretending the profile loaded", async () => {
    vi.mocked(getApiKey).mockResolvedValue(null);
    await expect(directProvider.getProfiles("0123456789abcdef0123456789abcdef")).rejects.toMatchObject({
      kind: "missing-key",
    });
  });
});

describe("provider cancellation and freshness", () => {
  beforeEach(() => { vi.mocked(readCache).mockReset(); vi.mocked(writeCache).mockReset(); });

  it("never persists an old request after provider cancellation", async () => {
    vi.mocked(readCache).mockResolvedValue(null);
    const controller = new AbortController();
    let complete!: (value: { data: object; updatedAt: number; source: "network" }) => void;
    const pending = cachedProviderFetch({ key: "old-backend", provider: "backend", ttlMs: 1000, signal: controller.signal,
      fetcher: () => new Promise<{ data: object; updatedAt: number; source: "network" }>((resolve) => { complete = resolve; }), });
    await Promise.resolve();
    controller.abort();
    complete({ data: {}, updatedAt: Date.now(), source: "network" });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(writeCache).not.toHaveBeenCalled();
  });

  it("does not relabel stale upstream data as a fresh persisted cache", async () => {
    vi.mocked(readCache).mockResolvedValue(null);
    const result = await cachedProviderFetch({ key: "stale", provider: "backend", ttlMs: 1000,
      fetcher: async () => ({ data: {}, updatedAt: Date.now(), source: "network", stale: true }), });
    expect(result.stale).toBe(true);
    expect(writeCache).not.toHaveBeenCalled();
  });

  it("rejects credentials, fragments and query strings in endpoints", () => {
    expect(normalizeBackendUrl("https://user:secret@example.com")).toBeNull();
    expect(normalizeBackendUrl("https://example.com?key=secret")).toBeNull();
    expect(normalizeBackendUrl("https://example.com#path")).toBeNull();
  });
});

describe("production endpoint configuration", () => {
  it("has no invented endpoint when production is not configured", () => {
    vi.stubEnv("DEV", false);
    try { expect(resolveBackendUrl({ ...settings, developerMode: false })).toBe(""); }
    finally { vi.unstubAllEnvs(); }
  });
});
