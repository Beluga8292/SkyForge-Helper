import { totalBuildBudget } from "./budget";
import { replacementCandidates } from "./replacements";
import { ownedMaterials, factsFromItem } from "@/features/upgrades/item-state";
import type { Analysis } from "@/features/intelligence/models";
import type { HypixelItem } from "@/types/hypixel";
import type { DecodedInventoryItem, ProfileMemberStats } from "@/types/profile";
import {
  equipmentAdvice,
  type AdvisedItem,
  type AdvisorOption,
} from "@/features/upgrades/advisor";
import type { PriceResolver } from "@/features/upgrades/calculator";
import {
  ARMOR_SLOTS,
  EQUIPMENT_SLOTS,
  ROLES,
  CATA,
  type Floor,
  type DungeonClass,
} from "./catalog";
export type Strategy = "current" | "minimal" | "balanced" | "alternative";
export type Status = "met" | "unmet" | "unknown";
export interface Gate {
  subject: string;
  target: number | null;
  current: number | null;
  status: Status;
}
export function floorRequirements(floor: Floor, a?: Analysis): Gate[] {
  const metric = (id: string) => {
    const m = a?.metrics.find(
      (m) => m.id.toLowerCase() === id && m.state === "known",
    );
    return m?.level ?? null;
  };
  const level = (
    subject: string,
    target: number | null,
    current: number | null,
  ): Gate => ({
    subject,
    target,
    current,
    status:
      target === null || current === null
        ? "unknown"
        : current >= target
          ? "met"
          : "unmet",
  });
  const gates = [
    level("combat", 15, metric("combat")),
    level("catacombs", CATA[floor] ?? null, metric("catacombs")),
  ];
  if (floor !== "E") {
    const previous = floor.startsWith("M")
      ? null
      : String(Number(floor.slice(1)) - 1);
    const n = previous === null ? null : (a?.floors[previous] ?? null);
    gates.push({
      subject: previous === null ? "master" : `completion:${previous}`,
      target: 1,
      current: n,
      status: n === null ? "unknown" : n > 0 ? "met" : "unmet",
    });
  }
  return gates;
}
export interface BuildRow {
  slot: string;
  current: DecodedInventoryItem | null;
  chosen: AdvisedItem | null;
  action: "keep" | "upgrade" | "replace" | "missing" | "unknown";
  option: AdvisorOption | null;
  availability: Status;
  purchase?: boolean;
  selectedOptions?: AdvisorOption[];
}
export function buildDungeonPlan(input: {
  uuid: string;
  profileId: string;
  member?: ProfileMemberStats | null;
  analysis?: Analysis;
  itemMap: ReadonlyMap<string, HypixelItem>;
  prices: PriceResolver;
  dungeonClass: DungeonClass;
  floor: Floor;
  budget: number | null;
  strategy: Strategy;
  stale?: boolean;
  upgradeSelection?: string[];
}) {
  const { member, itemMap, dungeonClass, floor, budget, strategy } = input;
  const matches = (a: string, b: string) =>
    a.replaceAll("-", "").toLowerCase() === b.replaceAll("-", "").toLowerCase();
  const memberSafe = member && matches(member.uuid, input.uuid) ? member : null;
  const analysis =
    input.analysis &&
    matches(input.analysis.uuid, input.uuid) &&
    matches(input.analysis.profile_id, input.profileId)
      ? input.analysis
      : undefined;
  const inv = memberSafe?.inventory;
  const complete = Boolean(
    inv?.available &&
    !inv.missing.length &&
    !inv.errors.length &&
    !inv.truncated &&
    inv.containers.every((c) => c.known),
  );
  const dungeonItems = new Set(
    [...itemMap.values()]
      .filter((x) => x.dungeon_item === true)
      .map((x) => x.id),
  );
  // Reuse Advisor for storage too via a view, without changing original containers,
  // decoding NBT or changing what Advisor itself calls equipped.
  const eligible = inv?.containers
    .filter((c) => c.known)
    .map((c) => ({ ...c, location: "inv_contents" }));
  // Advisor excludes stored armor in inv_contents; classify each existing slot in
  // this view by category, preserving stable identity for matching below.
  const view = eligible?.flatMap((c) =>
    c.slots.flatMap((item, n) => {
      if (!item) return [];
      const category = (
        item.category ??
        itemMap.get(item.itemId)?.category ??
        ""
      ).toUpperCase();
      return [
        {
          ...c,
          id: `${c.id}/${n}`,
          location: (ARMOR_SLOTS as readonly string[]).includes(category)
            ? "inv_armor"
            : (EQUIPMENT_SLOTS as readonly string[]).includes(category) ||
                category === "GLOVES"
              ? "equipment_contents"
              : "inv_contents",
          slots: [item],
        },
      ];
    }),
  );
  const advice = equipmentAdvice({
    inventory: inv ? { ...inv, containers: view ?? [] } : undefined,
    member: memberSafe,
    itemMap,
    analysis,
    prices: input.prices,
    budget,
    purpose: "combat",
    dungeonItems,
    stale: input.stale,
  });
  const all =
    inv?.containers
      .filter((c) => c.known)
      .flatMap((c) =>
        c.slots.flatMap((item) =>
          item ? [{ item, location: c.location }] : [],
        ),
      ) ?? [];
  const slotFor = (item: DecodedInventoryItem) =>
    (item.category ?? itemMap.get(item.itemId)?.category ?? "").toUpperCase();
  const currentFor = (slot: string) =>
    all.find(({ item, location }) =>
      slot === "weapon"
        ? location === "inv_contents" &&
          ROLES[dungeonClass].categories.includes(slotFor(item))
        : ["inv_armor", "equipment_contents"].includes(location) &&
          (slotFor(item) === slot ||
            (slot === "BRACELET" && slotFor(item) === "GLOVES")),
    )?.item ?? null;
  const same = (a: DecodedInventoryItem, b: DecodedInventoryItem) =>
    a === b ||
    Boolean(a.uuid && a.uuid === b.uuid) ||
    (a.itemId === b.itemId && a.slot === b.slot && a.extra === b.extra);
  const availability = (a: AdvisedItem): Status =>
    !itemMap.has(a.item.itemId) ||
    a.requirements.some((r) => r.status === "unknown")
      ? "unknown"
      : a.requirements.some((r) => r.status === "unmet")
        ? "unmet"
        : "met";
  const rows: BuildRow[] = [...ARMOR_SLOTS, ...EQUIPMENT_SLOTS, "weapon"].map(
    (slot) => {
      const current = currentFor(slot);
      const candidates = advice.filter((a) =>
        slot === "weapon"
          ? ROLES[dungeonClass].categories.includes(slotFor(a.item))
          : slotFor(a.item) === slot ||
            (slot === "BRACELET" && slotFor(a.item) === "GLOVES"),
      );
      // No numerical effectiveness score: current first, then owned role-relevant
      // metadata candidates. Mage requires an actual ability/intelligence stat;
      // Tank/Healer weapons are utility candidates, never claimed optimal DPS.
      const roleCandidates = candidates.filter(
        (a) =>
          slot !== "weapon" ||
          dungeonClass !== "mage" ||
          Number(
            (
              itemMap.get(a.item.itemId)?.stats as
                Record<string, number> | undefined
            )?.WEAPON_ABILITY_DAMAGE ?? 0,
          ) > 0,
      );
      const existing = roleCandidates.find(
        (a) => current && same(a.item, current),
      );
      const chosen =
        strategy === "alternative"
          ? null
          : strategy === "current" || strategy === "minimal"
            ? (existing ?? null)
            : (existing ??
              roleCandidates.find(
                (a) =>
                  availability(a) === "met" && dungeonItems.has(a.item.itemId),
              ) ??
              null);
      return {
        slot,
        current,
        chosen,
        action: chosen
          ? current && same(chosen.item, current)
            ? "keep"
            : "replace"
          : complete
            ? "missing"
            : "unknown",
        option: null,
        availability: chosen ? availability(chosen) : "unknown",
      };
    },
  );
  if (
    strategy === "balanced" ||
    (strategy === "alternative" && dungeonClass === "berserk")
  ) {
    for (const row of rows) {
      const candidates = replacementCandidates(
        row.slot,
        dungeonClass,
        itemMap,
        analysis,
      );
      // Preferences describe sourced role templates, not a DPS/EHP score.
      if (row.slot === "weapon" && dungeonClass === "berserk")
        candidates.sort(
          (a, b) =>
            Number(
              b.item.itemId ===
                (strategy === "alternative" ? "LIVID_DAGGER" : "SHADOW_FURY"),
            ) -
            Number(
              a.item.itemId ===
                (strategy === "alternative" ? "LIVID_DAGGER" : "SHADOW_FURY"),
            ),
        );
      const currentCandidate = candidates.find(
        (c) => c.item.itemId === row.current?.itemId,
      );
      const candidate =
        strategy === "balanced" && currentCandidate
          ? currentCandidate
          : (candidates.find((c) => availability(c) === "met") ??
            candidates[0]);
      if (!candidate) continue;
      const owned =
        advice.find(
          (a) =>
            a.item.itemId === candidate.item.itemId &&
            row.current &&
            same(a.item, row.current) &&
            availability(a) === "met",
        ) ??
        advice.find(
          (a) =>
            a.item.itemId === candidate.item.itemId &&
            availability(a) === "met",
        );
      row.chosen = owned ?? candidate;
      row.availability = availability(row.chosen);
      row.purchase = !owned && row.availability === "met";
      row.action =
        row.availability !== "met"
          ? "unknown"
          : row.current?.itemId === row.chosen.item.itemId
            ? "keep"
            : "replace";
    }
  }
  const selectedChanges = [];
  let automaticUsed = false;
  for (const row of rows) {
    if (
      !row.chosen ||
      row.availability !== "met" ||
      row.purchase ||
      strategy === "current" ||
      floor.startsWith("M")
    )
      continue;
    const available = row.chosen.options.filter((o) =>
      ["stars", "potato", "fuming", "recombobulator"].includes(o.kind),
    );
    const options = input.upgradeSelection
      ? available.filter((o) => input.upgradeSelection!.includes(o.id))
      : strategy === "minimal"
        ? automaticUsed
          ? []
          : available
              .filter(
                (o) =>
                  o.plan.totalCost !== null &&
                  budget !== null &&
                  o.plan.totalCost <= budget,
              )
              .slice(0, 1)
        : available.filter((o) => o.kind === "stars" || o.kind === "potato");
    if (options.length) automaticUsed = true;
    row.selectedOptions = options;
    row.option = options[0] ?? null;
    if (options.length) row.action = "upgrade";
    for (const o of options)
      selectedChanges.push({
        key: row.chosen.key,
        facts: factsFromItem(row.chosen.item),
        current: o.plan.current,
        target: o.plan.target,
      });
  }
  const stockUuids = new Set<string>();
  const scopedInventory = inv
    ? {
        ...inv,
        items: [],
        armor: [],
        containers: inv.containers
          .filter((c) => c.known)
          .map((c) => ({
            ...c,
            slots: c.slots.map((item) => {
              if (!item?.uuid) return item;
              const id = item.uuid.replaceAll("-", "").toLowerCase();
              if (stockUuids.has(id)) return null;
              stockUuids.add(id);
              return item;
            }),
          })),
      }
    : undefined;
  const basket = totalBuildBudget({
    changes: selectedChanges,
    purchases: rows.flatMap((r) =>
      r.purchase && r.chosen
        ? [
            {
              key: r.slot,
              itemId: r.chosen.item.itemId,
              quantity: 1,
              owned: false,
            },
          ]
        : [],
    ),
    owned: ownedMaterials(scopedInventory, memberSafe),
    prices: input.prices,
    budget,
    unknown:
      rows.filter((r) => !r.chosen || r.availability !== "met").length +
      (!complete || floor.startsWith("M") ? 1 : 0),
    stale: input.stale,
  });
  const knownCost = basket.total,
    unknown = basket.unknown,
    partialBudget = basket.status === "PARTIAL" || basket.status === "UNKNOWN";
  return {
    rows,
    complete,
    analysis,
    requirements: floorRequirements(floor, analysis),
    supported: !floor.startsWith("M"),
    knownCost,
    unknown,
    partialBudget,
    remaining: basket.remaining,
    basket,
    advice,
  };
}
