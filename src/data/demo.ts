import demoResources from "@/features/intelligence/demo-resources.json";
import { localIntelligenceProvider } from "@/features/intelligence/provider";
import { localMarketProvider } from "@/features/market/local-provider";
import { ApiError } from "@/api/errors";
import { getDemoAuctions, getDemoBazaar } from "@/services/demo";
import type { DataProvider } from "@/data/types";

const DEMO_UUID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

/** Adding a tiny delay keeps skeleton states visible while demo mode is active. */
const wait = (ms: number) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, ms));

/**
 * Fully isolated fixtures. Demo data is never written to the API cache, market
 * history, watchlist alerts or any backend endpoint.
 */
export const demoProvider: DataProvider = {
  ...localIntelligenceProvider(() => demoProvider),
  ...localMarketProvider(() => demoProvider),
  id: "demo",
  label: "Demo data (isolated)",
  isDemo: true,

  async getBazaar() {
    await wait(120);
    return {
      data: getDemoBazaar(),
      updatedAt: Date.now(),
      source: "network",
      demo: true,
      provider: "demo",
    };
  },

  async getAuctions(page) {
    await wait(80);
    return {
      data: getDemoAuctions(page),
      updatedAt: Date.now(),
      source: "network",
      demo: true,
      provider: "demo",
    };
  },

  async getAuction() {
    throw new ApiError("not-found", "Demo auction details are not available", {
      url: null,
    });
  },

  async getPlayer() {
    throw new ApiError(
      "not-found",
      "Demo player data is loaded through the demo profile adapter",
      { url: null },
    );
  },

  async getProfiles() {
    throw new ApiError(
      "not-found",
      "Demo player data is loaded through the demo profile adapter",
      { url: null },
    );
  },

  async resolveName(name) {
    return {
      data: { id: DEMO_UUID, name },
      updatedAt: Date.now(),
      source: "network",
      demo: true,
      provider: "demo",
    };
  },

  async getItems() {
    return {
      data: { success: true, items: demoResources.items },
      updatedAt: Date.now(),
      source: "network",
      demo: true,
      provider: "demo",
    };
  },

  async getSkills() {
    return {
      data: { success: true, skills: demoResources.skills },
      updatedAt: Date.now(),
      source: "network",
      demo: true,
      provider: "demo",
    };
  },

  async getHistory() {
    return null;
  },
};

export { DEMO_UUID };
