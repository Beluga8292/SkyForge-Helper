import { TooltipProvider } from "@/components/ui/tooltip";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { DecodedInventoryItem, InventorySummary } from "@/types/profile";
const state = vi.hoisted(() => ({
  connected: {} as Record<string, unknown>,
  bazaar: {} as Record<string, unknown>,
  analysis: {} as Record<string, unknown>,
}));
vi.mock("@/hooks/usePlayer", () => ({
  useConnectedProfile: () => state.connected,
}));
vi.mock("@/hooks/useBazaar", () => ({ useBazaar: () => state.bazaar }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => state.analysis }));
vi.mock("@/data", () => ({
  useDataProvider: () => ({}),
  useDataScope: () => "test",
}));
vi.mock("@/components/common/ItemIcon", () => ({
  ItemIcon: ({ itemId }: { itemId: string }) => <span data-item={itemId} />,
}));
import { EquipmentAdvisorPage } from "./EquipmentAdvisorPage";
const belt: DecodedInventoryItem = {
  slot: 0,
  itemId: "ADAPTIVE_BELT",
  name: "Adaptive Belt",
  count: 1,
  damage: 0,
  rarity: "EPIC",
  category: "BELT",
  material: null,
  lore: [],
  loreLines: [],
  stars: 0,
  recombobulated: false,
  hotPotatoBooks: 0,
  fumingPotatoBooks: 0,
  reforge: null,
  enchantments: {},
  gemstoneSlots: [],
  uuid: null,
  soulbound: false,
  extra: {},
};
const inventory: InventorySummary = {
  available: true,
  reason: null,
  items: [],
  armor: [],
  containers: [
    {
      id: "equipment",
      location: "equipment_contents",
      known: true,
      size: 4,
      slots: [belt],
    },
  ],
  missing: [],
  availableContainers: 1,
  totalContainers: 1,
  totalItems: 1,
  truncated: false,
  errors: [],
};
const render = () =>
  renderToStaticMarkup(
    <TooltipProvider>
      <MemoryRouter>
        <EquipmentAdvisorPage />
      </MemoryRouter>
    </TooltipProvider>,
  );
beforeEach(() => {
  state.connected = {
    linked: { uuid: "player", profileId: "profile" },
    data: {
      profiles: [
        { id: "profile", member: { inventory, essence: { Wither: 2 } } },
      ],
    },
    refresh: vi.fn(),
  };
  state.bazaar = {
    itemMap: new Map(),
    quotes: [
      { productId: "ESSENCE_WITHER", instantBuy: 2 },
      { productId: "RECOMBOBULATOR_3000", instantBuy: 100 },
    ],
    envelope: { updatedAt: 1700000000000 },
    refresh: vi.fn(),
  };
  state.analysis = {};
});
describe("Equipment Advisor rendering", () => {
  it("renders item cards, texture hooks, material ownership and budget alternatives", () => {
    const html = render();
    expect(html).toContain("Adaptive Belt");
    expect(html).toContain('data-item="ESSENCE_WITHER"');
    expect(html).toContain("10 / 2 / 8");
    expect(html).toMatch(/16/);
    expect(html).not.toContain("NaN");
    expect(html).toContain("advisor-budget");
  });
  it("does not silently use another profile or its equipment", () => {
    state.connected = {
      ...state.connected,
      linked: { uuid: "player", profileId: "different" },
    };
    expect(render()).not.toContain("Adaptive Belt");
  });
  it("shows unavailable inventory and profile error states", () => {
    state.connected = { ...state.connected, data: { profiles: [] } };
    expect(render()).toContain("Инвентарь недоступен");
    state.connected = { ...state.connected, error: new Error("offline") };
    expect(render()).toContain("Повторить");
  });
  it("keeps partial/stale warnings with readable cards", () => {
    state.connected = {
      ...state.connected,
      data: {
        stale: true,
        profiles: [
          {
            id: "profile",
            member: {
              inventory: { ...inventory, truncated: true },
              essence: {},
            },
          },
        ],
      },
    };
    const html = render();
    expect(html).toContain("Доступны не все контейнеры");
    expect(html).toContain("Данные устарели");
    expect(html).toContain("Adaptive Belt");
  });
  it("never shows MP from another UUID even if profile id matches", () => {
    state.analysis = {
      data: {
        uuid: "different",
        profile_id: "profile",
        accessory_power: 987654,
        accessories: [],
      },
    };
    expect(render()).not.toContain("987654");
  });
});
