import { beforeEach, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
const state = vi.hoisted(() => ({
  linked: { uuid: "player", profileId: "profile" },
  profiles: [] as unknown[],
  queries: [] as Array<{ queryKey: unknown[] }>,
}));
vi.mock("@/hooks/usePlayer", () => ({
  useConnectedProfile: () => ({
    linked: state.linked,
    data: { profiles: state.profiles },
  }),
}));
vi.mock("@/hooks/useBazaar", () => ({
  useBazaar: () => ({ itemMap: new Map(), quotes: [] }),
}));
vi.mock("@/data", () => ({
  useDataProvider: () => ({ getIntelligence: vi.fn() }),
  useDataScope: () => "test",
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (o: { queryKey: unknown[] }) => {
    state.queries.push(o);
    return {};
  },
}));
vi.mock("@/components/common/ItemIcon", () => ({ ItemIcon: () => null }));
import { DungeonPlannerPage } from "./DungeonPlannerPage";
const render = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <TooltipProvider>
        <DungeonPlannerPage />
      </TooltipProvider>
    </MemoryRouter>,
  );
beforeEach(() => {
  state.profiles = [];
  state.queries = [];
});
it("uses one scoped analysis observer for the whole build, never per slot", () => {
  const html = render();
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0]?.queryKey).toEqual([
    "intelligence",
    "test",
    "player",
    "profile",
    true,
  ]);
  expect(html).toContain("Планировщик подземелий");
  expect(html).toContain("Неполный бюджет");
});
it("does not silently use a different available profile", () => {
  state.profiles = [
    {
      id: "other",
      member: {
        uuid: "player",
        inventory: { available: true, containers: [] },
      },
    },
  ];
  expect(render()).toContain("Данные профиля неполные");
});
