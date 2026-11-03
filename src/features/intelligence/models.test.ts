import { describe, expect, it } from "vitest";
import { analysisSchema, parseAnalysis } from "./models";

const validAsset = {
  key: "inv_contents:0",
  item_id: "HYPERION",
  name: "Hyperion",
  location: "inv_contents",
  category: "SWORD",
  count: 1,
  rarity: "LEGENDARY",
  modifiers: {},
  uuid: null,
  match_key: null,
  soulbound: false,
  value: 1_000,
  method: "bazaar_visible_ask",
  confidence: "medium",
  price_timestamp: null,
};

function payload(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "1",
    rules_version: "test",
    uuid: "0123456789abcdef0123456789abcdef",
    profile_id: "abcdefabcdefabcdefabcdefabcdefab",
    username: "Tester",
    profile_name: "Apple",
    profile_type: "normal",
    coop: false,
    first_join: null,
    last_save: null,
    fetched_at: 1_700_000_000_000,
    stale: false,
    demo: false,
    source: "test",
    completeness: { inv_contents: "known" },
    metrics: [],
    assets: [validAsset],
    pets: [],
    recommendations: [],
    accessory_power: null,
    accessory_power_known_subset: null,
    accessories: [],
    networth: {
      personal_liquid: null,
      shared_bank: null,
      tradable: null,
      untradeable_count: 0,
      unknown_count: 0,
      priced_count: 0,
      coverage: null,
      known_total: null,
      complete: false,
    },
    warnings: ["upstream_warning"],
    selected_class: null,
    floors: {},
    minions: null,
    ...overrides,
  };
}

describe("tolerant analysis parsing", () => {
  it("drops malformed assets without discarding the valid ones", () => {
    const analysis = parseAnalysis(
      payload({
        assets: [
          validAsset,
          { key: "broken", location: "inv_contents" },
          {
            key: "recoverable",
            item_id: "RECOVERED_ITEM",
            location: "inv_contents",
            count: "not-a-number",
            modifiers: null,
            value: "not-a-number",
          },
        ],
        pets: [{ rarity: "LEGENDARY" }],
      }),
    );

    expect(analysis.assets).toHaveLength(2);
    expect(analysis.assets.map((entry) => entry.item_id)).toEqual([
      "HYPERION",
      "RECOVERED_ITEM",
    ]);
    expect(analysis.assets[1]).toMatchObject({
      name: "RECOVERED_ITEM",
      count: 1,
      modifiers: {},
      value: null,
    });
    expect(analysis.integrity).toMatchObject({
      invalidAssets: 1,
      recoveredAssets: 1,
      invalidPets: 1,
    });
    expect(analysis.warnings).toEqual(["upstream_warning"]);
  });

  it("keeps a malformed price unknown instead of turning it into zero", () => {
    const analysis = parseAnalysis(
      payload({
        assets: [{ ...validAsset, value: "0" }],
      }),
    );
    expect(analysis.assets[0]?.value).toBeNull();
  });

  it("still rejects a payload without the required top-level contract", () => {
    expect(() => analysisSchema.parse({ schema_version: "1" })).toThrow();
    expect(() => parseAnalysis({ schema_version: "1" })).toThrow();
    expect(() => parseAnalysis(null)).toThrow();
  });
});
