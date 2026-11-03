import { it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSettingsStore } from "@/stores/settings";
import { DEFAULT_SETTINGS } from "@/services/settings";
import type { ProfileMemberStats, DecodedInventoryItem } from "@/types/profile";
const state = vi.hoisted(() => ({
  queries: [] as Array<{
    queryKey: unknown[];
    queryFn: (x: { signal: AbortSignal }) => unknown;
  }>,
  getIntelligence: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: (typeof state.queries)[number]) => {
    state.queries.push(options);
    return { data: undefined };
  },
}));
vi.mock("@/data", () => ({
  useDataProvider: () => ({ getIntelligence: state.getIntelligence }),
  useDataScope: () => "isolated",
}));
vi.mock("@/hooks/useBazaar", () => ({
  useBazaar: () => ({ quotes: [], itemMap: new Map() }),
}));
vi.mock("@/components/common/ItemIcon", () => ({
  ItemIcon: ({
    itemId,
    skullTexture,
  }: {
    itemId: string;
    skullTexture: string;
  }) => <span data-item={itemId} data-skull={skullTexture} />,
}));
// SSR normally reads Zustand's initial snapshot. Observe the explicitly selected
// test settings while retaining the actual store and sanitization implementation.
vi.mock("@/stores/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/stores/settings")>();
  function hook<T>(
    selector: (state: ReturnType<typeof actual.useSettingsStore.getState>) => T,
  ): T {
    return selector(actual.useSettingsStore.getState());
  }
  return {
    ...actual,
    useSettingsStore: Object.assign(hook, actual.useSettingsStore),
  };
});
import { InventoryPanel } from "@/pages/ProfilePage";
const item: DecodedInventoryItem = {
  slot: 0,
  itemId: "X",
  name: "Original item",
  count: 1,
  damage: 0,
  rarity: "RARE",
  category: "HELMET",
  material: "SKULL_ITEM",
  lore: ["Original lore"],
  loreLines: [],
  stars: 5,
  recombobulated: true,
  hotPotatoBooks: 10,
  fumingPotatoBooks: 5,
  reforge: "ancient",
  enchantments: { growth: 6 },
  gemstoneSlots: [],
  uuid: "instance",
  soulbound: false,
  skullTexture: "https://textures.minecraft.net/texture/test",
  extra: {},
};
const member = {
  uuid: "player",
  inventory: {
    available: true,
    reason: null,
    items: [],
    armor: [],
    containers: [
      {
        id: "main",
        location: "inv_contents",
        size: 1,
        known: true,
        slots: [item],
      },
    ],
    missing: [],
    availableContainers: 1,
    totalContainers: 1,
    totalItems: 1,
    truncated: false,
    errors: [],
  },
} as unknown as ProfileMemberStats;
beforeEach(() => {
  state.queries = [];
  state.getIntelligence.mockClear();
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS },
    hydrated: true,
  });
});
const render = (m = member) =>
  renderToStaticMarkup(
    <TooltipProvider>
      <InventoryPanel member={m} profileId="profile" />
    </TooltipProvider>,
  );
it("defaults off with no valuation observer and keeps original item texture/slot", () => {
  const html = render();
  expect(state.queries).toHaveLength(0);
  expect(html).toContain(
    'data-skull="https://textures.minecraft.net/texture/test"',
  );
  expect(html).toContain("Original item");
});
it("enables one scoped query for a large inventory, never one per slot", async () => {
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, showItemValues: true },
  });
  const large = {
    ...member,
    inventory: {
      ...member.inventory,
      containers: Array.from({ length: 10 }, (_, c) => ({
        id: `backpack-${c}`,
        location: `backpack:${c}`,
        size: 54,
        known: true,
        slots: Array.from({ length: 54 }, (_, slot) => ({ ...item, slot })),
      })),
    },
  };
  const html = render(large);
  expect(state.queries).toHaveLength(1);
  expect(html).toContain("?");
  expect(state.queries[0]!.queryKey).toEqual([
    "intelligence",
    "isolated",
    "player",
    "profile",
    true,
  ]);
  const signal = new AbortController().signal;
  await state.queries[0]!.queryFn({ signal });
  expect(state.getIntelligence).toHaveBeenCalledExactlyOnceWith(
    "player",
    "profile",
    true,
    signal,
  );
});
it("disables valuation work immediately and respects balance privacy", () => {
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, showItemValues: true, hideBalances: true },
  });
  expect(render()).toContain("Баланс скрыт");
  expect(state.queries).toHaveLength(0);
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, showItemValues: false },
  });
  render();
  expect(state.queries).toHaveLength(0);
});

it("retains the original tooltip lore and renders one Auction valuation block", async () => {
  const { ItemTooltipContent } = await import("./ItemTooltip");
  const html = renderToStaticMarkup(<ItemTooltipContent item={{
    name: "Original item", lore: ["Original lore"], count: 3,
    value: 300, estimatedValue: 300,
    valueInfo: { state: "estimated", total: 300, unit: 100,
      source: "exact_bin_listing_median", timestamp: null, confidence: "medium",
      coverage: 0.5, partial: true, tradeability: "soulbound", sellable: null, reason: "none" },
  }} />);
  expect(html).toContain("Original lore");
  expect(html.match(/Стоимость стака/g)).toHaveLength(1);
  expect(html).toContain("Auction:");
  expect(html).toContain("Soulbound");
  expect(html).not.toContain("Источник не подтверждён");
});
