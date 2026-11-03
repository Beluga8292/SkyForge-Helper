import {
  UPGRADE_CATALOG,
  catalogItem,
  essenceMaterialId,
  materialName,
  itemTypesMatch,
} from "./catalog";

export type PriceMethod = "bazaar" | "auction" | "fixed" | "manual" | "unknown";

export type PriceConfidence = "high" | "medium" | "low" | "unknown";

export interface PriceQuote {
  unit: number | null;
  method: PriceMethod;
  confidence: PriceConfidence;
  updatedAt?: number | null;
  note?: string;
}

export type PriceResolver = (itemId: string) => PriceQuote;

export interface UpgradeState {
  stars: number;
  recombobulated: boolean;
  hotPotatoBooks: number;
  fumingPotatoBooks: number;
  gemstoneSlots: string[];
  reforge: string | null;
  enchantments: Record<string, number>;
}

export interface UpgradeTarget extends UpgradeState {
  itemId: string;
}

export interface ItemFacts {
  itemId: string;
  name: string;
  category: string | null;
  rarity: string | null;
  material?: string | null;
}

export interface UpgradeOptions {
  owned?: Record<string, number>;
  inventoryKnown?: boolean;
  prices?: PriceResolver;
  /** A purchased target-level book replaces the installed enchant; intermediate books are not needed. */
  enchantmentBooks?: "target-level";
}

export type StageKind =
  | "stars"
  | "master-stars"
  | "recombobulator"
  | "hot-potato"
  | "fuming-potato"
  | "gemstone-slot"
  | "reforge"
  | "enchantment"
  | "item-specific";

export type StageStatus = "ready" | "unknown" | "unsupported" | "installed";

export interface UpgradeMaterialRow {
  id: string;
  name: string;
  required: number;
  owned: number;
  missing: number;
  unitPrice: number | null;
  priceMethod: PriceMethod;
  priceConfidence: PriceConfidence;
  priceUpdatedAt: number | null;
  missingCost: number | null;
  assumption: "manual-only" | "none";
}

export interface UpgradeStage {
  id: string;
  kind: StageKind;
  label: string;
  current: string;
  target: string;
  status: StageStatus;
  essence: { type: string; amount: number } | null;
  materials: UpgradeMaterialRow[];
  coinFee: number | null;
  coinFeeKnown: boolean;
  knownCost: number;
  cost: number | null;
  complete: boolean;
  note: string | null;
}

export interface UpgradePlan {
  itemId: string;
  itemName: string;
  stages: UpgradeStage[];
  materials: UpgradeMaterialRow[];
  essence: Array<{ type: string; amount: number }>;
  knownCost: number;
  totalCost: number | null;
  coinFees: number;
  coinFeesKnown: boolean;
  unknownStages: number;
  pricedRows: number;
  totalRows: number;
  coverage: number;
  inventoryKnown: boolean;
  current: UpgradeState;
  target: UpgradeTarget;
}

const GEAR_CATEGORIES = new Set([
  "SWORD",
  "LONGSWORD",
  "BOW",
  "AXE",
  "PICKAXE",
  "DRILL",
  "SHOVEL",
  "FISHING ROD",
  "FISHING WEAPON",
  "FARMING TOOL",
  "GAUNTLET",
  "HELMET",
  "CHESTPLATE",
  "LEGGINGS",
  "BOOTS",
  "BELT",
  "NECKLACE",
  "BRACELET",
  "CLOAK",
  "GLOVES",
]);

export function isGearCategory(category: string | null | undefined): boolean {
  return Boolean(category && GEAR_CATEGORIES.has(category.toUpperCase()));
}

export function emptyUpgradeState(): UpgradeState {
  return {
    stars: 0,
    recombobulated: false,
    hotPotatoBooks: 0,
    fumingPotatoBooks: 0,
    gemstoneSlots: [],
    reforge: null,
    enchantments: {},
  };
}

export function normalizeState(
  input: Partial<UpgradeState> | null | undefined,
): UpgradeState {
  const base = emptyUpgradeState();
  if (!input) return base;
  return {
    stars: clampInt(input.stars ?? 0, 0, 10),
    recombobulated: Boolean(input.recombobulated),
    hotPotatoBooks: clampInt(input.hotPotatoBooks ?? 0, 0, 10),
    fumingPotatoBooks: clampInt(input.fumingPotatoBooks ?? 0, 0, 5),
    gemstoneSlots: Array.isArray(input.gemstoneSlots)
      ? [
          ...new Set(
            input.gemstoneSlots.filter((entry) => typeof entry === "string"),
          ),
        ].slice(0, 12)
      : [],
    reforge: typeof input.reforge === "string" ? input.reforge : null,
    enchantments:
      input.enchantments && typeof input.enchantments === "object"
        ? Object.fromEntries(
            Object.entries(input.enchantments)
              .filter(
                ([, level]) =>
                  typeof level === "number" && Number.isFinite(level),
              )
              .map(([id, level]) => [id, clampInt(level, 0, 10)]),
          )
        : {},
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(
    max,
    Math.max(min, Math.trunc(Number.isFinite(value) ? value : min)),
  );
}

export function unknownPrice(note = "no_verified_price"): PriceQuote {
  return { unit: null, method: "unknown", confidence: "unknown", note };
}

export function createPriceResolver(input: {
  bazaar?: Map<string, number> | Record<string, number>;
  auction?: Map<
    string,
    { unit: number; confidence?: PriceConfidence; updatedAt?: number | null }
  >;
  manual?: Record<string, number>;
}): PriceResolver {
  const manual = input.manual ?? {};
  const bazaar =
    input.bazaar instanceof Map
      ? input.bazaar
      : new Map(Object.entries(input.bazaar ?? {}));
  const auction = input.auction ?? new Map();
  return (itemId: string) => {
    if (itemId === "SKYBLOCK_COIN") {
      return { unit: 1, method: "fixed", confidence: "high" };
    }
    const manualPrice = manual[itemId];
    if (
      typeof manualPrice === "number" &&
      Number.isFinite(manualPrice) &&
      manualPrice >= 0
    ) {
      return {
        unit: manualPrice,
        method: "manual",
        confidence: "low",
        note: "user_assumption",
      };
    }
    const bazaarPrice = bazaar.get(itemId);
    if (
      typeof bazaarPrice === "number" &&
      Number.isFinite(bazaarPrice) &&
      bazaarPrice > 0
    ) {
      return {
        unit: bazaarPrice,
        method: "bazaar",
        confidence: "medium",
        note: "bazaar_visible_ask",
      };
    }
    const auctionPrice = auction.get(itemId);
    if (
      auctionPrice &&
      Number.isFinite(auctionPrice.unit) &&
      auctionPrice.unit > 0
    ) {
      return {
        unit: auctionPrice.unit,
        method: "auction",
        confidence: auctionPrice.confidence ?? "low",
        updatedAt: auctionPrice.updatedAt ?? null,
        note: "bin_reference_not_sale",
      };
    }
    return unknownPrice();
  };
}

function materialRows(
  requirements: Array<{ id: string; count: number }>,
  options: UpgradeOptions,
): UpgradeMaterialRow[] {
  const ownedMap = options.owned ?? {};
  const prices = options.prices ?? unknownPrice;
  return requirements.map((requirement) => {
    const owned = Math.max(0, Math.trunc(ownedMap[requirement.id] ?? 0));
    const missing = Math.max(0, requirement.count - owned);
    const quote = prices(requirement.id);
    return {
      id: requirement.id,
      name: materialName(requirement.id),
      required: requirement.count,
      owned,
      missing,
      unitPrice: quote.unit,
      priceMethod: quote.method,
      priceConfidence: quote.confidence,
      priceUpdatedAt: quote.updatedAt ?? null,
      missingCost:
        missing === 0 ? 0 : quote.unit === null ? null : quote.unit * missing,
      assumption: options.inventoryKnown === false ? "manual-only" : "none",
    };
  });
}

function splitCoins(requirements: Array<{ id: string; count: number }>): {
  items: Array<{ id: string; count: number }>;
  coins: number | null;
} {
  let coins: number | null = null;
  const items: Array<{ id: string; count: number }> = [];
  for (const requirement of requirements) {
    if (requirement.id === "SKYBLOCK_COIN") {
      coins = (coins ?? 0) + requirement.count;
    } else {
      items.push(requirement);
    }
  }
  return { items, coins };
}

function stageCost(
  materials: UpgradeMaterialRow[],
  coinFee: number | null,
): { knownCost: number; cost: number | null; complete: boolean } {
  let knownCost = 0;
  let complete = true;
  for (const material of materials) {
    if (material.missingCost === null) {
      complete = false;
    } else {
      knownCost += material.missingCost;
    }
  }
  if (coinFee === null) complete = false;
  else knownCost += coinFee;
  return { knownCost, cost: complete ? knownCost : null, complete };
}

function makeStage(input: {
  id: string;
  kind: StageKind;
  label: string;
  current: string;
  target: string;
  status?: StageStatus;
  essence?: { type: string; amount: number } | null;
  requirements?: Array<{ id: string; count: number }>;
  coinFee?: number | null;
  note?: string | null;
  options: UpgradeOptions;
}): UpgradeStage {
  const split = splitCoins(input.requirements ?? []);
  const explicitFee = input.coinFee;
  // A stage with an explicit requirement list but no coin line has a known
  // zero coin fee. A missing requirement list means the fee is unverified.
  const implicitFee =
    input.requirements === undefined ? null : (split.coins ?? 0);
  const coinFee =
    explicitFee === undefined
      ? implicitFee
      : split.coins === null
        ? explicitFee
        : explicitFee === null
          ? null
          : explicitFee + split.coins;
  const materials = materialRows(split.items, input.options);
  const cost = stageCost(materials, coinFee);
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    current: input.current,
    target: input.target,
    status: input.status ?? "ready",
    essence: input.essence ?? null,
    materials,
    coinFee,
    coinFeeKnown: coinFee !== null,
    knownCost: cost.knownCost,
    cost: cost.cost,
    complete: cost.complete,
    note: input.note ?? null,
  };
}

function unsupportedStage(input: {
  id: string;
  kind: StageKind;
  label: string;
  current: string;
  target: string;
  note: string;
}): UpgradeStage {
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    current: input.current,
    target: input.target,
    status: "unsupported",
    essence: null,
    materials: [],
    coinFee: null,
    coinFeeKnown: false,
    knownCost: 0,
    cost: null,
    complete: false,
    note: input.note,
  };
}

export function computeUpgradePlan(
  facts: ItemFacts,
  currentInput: Partial<UpgradeState> | null | undefined,
  targetInput: Partial<UpgradeTarget>,
  options: UpgradeOptions = {},
): UpgradePlan {
  const current = normalizeState(currentInput);
  const target = { ...normalizeState(targetInput), itemId: facts.itemId };
  const catalog = catalogItem(facts.itemId);
  const stages: UpgradeStage[] = [];

  // Owned materials are consumed stage by stage. Without this, the same
  // essence stack would be credited to every star level at once.
  const ownedRemaining: Record<string, number> = { ...(options.owned ?? {}) };
  options.owned = ownedRemaining;
  const pushStage = (stage: UpgradeStage) => {
    stages.splice(stages.length, 0, stage);
    for (const material of stage.materials) {
      const available = ownedRemaining[material.id] ?? 0;
      const used = Math.min(available, material.required);
      ownedRemaining[material.id] = Math.max(0, available - used);
    }
  };

  if (target.stars > current.stars) {
    for (let level = current.stars + 1; level <= target.stars; level += 1) {
      const kind: StageKind = level > 5 ? "master-stars" : "stars";
      if (!catalog || catalog.stars[String(level)] === undefined) {
        pushStage({
          ...unsupportedStage({
            id: `star:${level}`,
            kind,
            label: level > 5 ? "Master Star" : `Dungeon Star ${level}`,
            current: String(level - 1),
            target: String(level),
            note:
              level > 5
                ? "master_star_requirements_unverified"
                : "star_requirements_unverified",
          }),
          status: "unknown",
        });
        continue;
      }
      const essenceType = catalog.essenceType ?? "Unknown";
      const essenceAmount = catalog.stars[String(level)]!;
      const requirements: Array<{ id: string; count: number }> = [
        ...(catalog.essenceType
          ? [{ id: essenceMaterialId(essenceType), count: essenceAmount }]
          : []),
        ...(catalog.starItems[String(level)] ?? []),
      ];
      pushStage(
        makeStage({
          id: `star:${level}`,
          kind,
          label: level > 5 ? `Master Star ${level}` : `Dungeon Star ${level}`,
          current: String(level - 1),
          target: String(level),
          essence: {
            type: essenceType,
            amount: essenceAmount,
          },
          requirements,
          options,
          note: level > 5 ? "crimson_star_level" : null,
        }),
      );
    }
  } else {
    pushStage({
      ...unsupportedStage({
        id: "stars:installed",
        kind: "stars",
        label: "Dungeon Stars",
        current: String(current.stars),
        target: String(target.stars),
        note: "already_installed",
      }),
      status: "installed",
    });
  }

  if (target.recombobulated && !current.recombobulated) {
    if (
      facts.rarity &&
      ["SPECIAL", "VERY_SPECIAL"].includes(facts.rarity.toUpperCase())
    ) {
      pushStage(
        unsupportedStage({
          id: "recombobulator",
          kind: "recombobulator",
          label: "Recombobulator 3000",
          current: "No",
          target: "Yes",
          note: "item_cannot_be_recombobulated",
        }),
      );
    } else {
      pushStage(
        makeStage({
          id: "recombobulator",
          kind: "recombobulator",
          label: "Recombobulator 3000",
          current: "No",
          target: "Yes",
          requirements: [{ id: "RECOMBOBULATOR_3000", count: 1 }],
          options,
        }),
      );
    }
  } else if (current.recombobulated) {
    pushStage({
      ...unsupportedStage({
        id: "recombobulator",
        kind: "recombobulator",
        label: "Recombobulator 3000",
        current: "Yes",
        target: "Yes",
        note: "already_installed",
      }),
      status: "installed",
    });
  }

  const targetHpb = clampInt(target.hotPotatoBooks, 0, 10);
  const currentHpb = clampInt(current.hotPotatoBooks, 0, 10);
  const fumingTarget = clampInt(target.fumingPotatoBooks, 0, 5);
  const currentFuming = clampInt(current.fumingPotatoBooks, 0, 5);

  if (!isGearCategory(facts.category)) {
    if (targetHpb > currentHpb || fumingTarget > currentFuming) {
      pushStage(
        unsupportedStage({
          id: "potato",
          kind: "hot-potato",
          label: "Hot Potato Books",
          current: String(currentHpb),
          target: String(Math.max(targetHpb, 10)),
          note: "item_does_not_support_potato_books",
        }),
      );
    }
  } else {
    let hpbFrom = currentHpb;
    if (fumingTarget > 0 && currentHpb < 10) {
      pushStage(
        makeStage({
          id: "potato:required",
          kind: "hot-potato",
          label: "Hot Potato Books (required for Fuming)",
          current: String(currentHpb),
          target: "10",
          requirements: [{ id: "HOT_POTATO_BOOK", count: 10 - currentHpb }],
          options,
          note: "fuming_requires_ten_hot_potato_books",
        }),
      );
      hpbFrom = 10;
    }
    if (targetHpb > hpbFrom) {
      pushStage(
        makeStage({
          id: "potato",
          kind: "hot-potato",
          label: "Hot Potato Books",
          current: String(hpbFrom),
          target: String(targetHpb),
          requirements: [{ id: "HOT_POTATO_BOOK", count: targetHpb - hpbFrom }],
          options,
        }),
      );
    }
    if (fumingTarget > currentFuming) {
      pushStage(
        makeStage({
          id: "fuming",
          kind: "fuming-potato",
          label: "Fuming Potato Books",
          current: String(currentFuming),
          target: String(fumingTarget),
          requirements: [
            { id: "FUMING_POTATO_BOOK", count: fumingTarget - currentFuming },
          ],
          options,
        }),
      );
    }
  }

  for (const slot of target.gemstoneSlots) {
    if (current.gemstoneSlots.includes(slot)) {
      pushStage({
        ...unsupportedStage({
          id: `gem:${slot}`,
          kind: "gemstone-slot",
          label: `Gemstone Slot ${slot}`,
          current: "Unlocked",
          target: "Unlocked",
          note: "already_installed",
        }),
        status: "installed",
      });
      continue;
    }
    const requirements = catalog?.gemstoneSlots[slot];
    if (!requirements) {
      pushStage({
        ...unsupportedStage({
          id: `gem:${slot}`,
          kind: "gemstone-slot",
          label: `Gemstone Slot ${slot}`,
          current: "Locked",
          target: "Unlocked",
          note: "gemstone_slot_requirements_unverified",
        }),
        status: "unknown",
      });
      continue;
    }
    pushStage(
      makeStage({
        id: `gem:${slot}`,
        kind: "gemstone-slot",
        label: `Gemstone Slot ${slot}`,
        current: "Locked",
        target: "Unlocked",
        requirements,
        options,
      }),
    );
  }

  if (target.reforge && target.reforge !== current.reforge) {
    const row = UPGRADE_CATALOG.reforges.find(
      (entry) => entry.stone === target.reforge,
    );
    if (!row || !facts.rarity) {
      pushStage({
        ...unsupportedStage({
          id: "reforge",
          kind: "reforge",
          label: "Reforge",
          current: current.reforge ?? "None",
          target: target.reforge,
          note: "reforge_requirements_unverified",
        }),
        status: "unknown",
      });
    } else if (
      !itemTypesMatch(row.itemTypes, facts.category, facts.itemId) ||
      (row.rarities.length &&
        !row.rarities.includes(facts.rarity.toUpperCase()))
    ) {
      pushStage(
        unsupportedStage({
          id: "reforge",
          kind: "reforge",
          label: "Reforge",
          current: current.reforge ?? "None",
          target: row.name,
          note: "reforge_not_applicable_to_item_type",
        }),
      );
    } else {
      const fee = row.costs[facts.rarity.toUpperCase()] ?? null;
      pushStage(
        makeStage({
          id: "reforge",
          kind: "reforge",
          label: `Reforge: ${row.name}`,
          current: current.reforge ?? "None",
          target: row.name,
          requirements: [{ id: row.stone, count: 1 }],
          coinFee: fee,
          options,
        }),
      );
    }
  }

  for (const [enchantId, level] of Object.entries(target.enchantments)) {
    const currentLevel = current.enchantments[enchantId] ?? 0;
    if (level <= currentLevel) continue;
    const pool = facts.category ? enchantPool(facts.category) : [];
    if (pool.length && !pool.includes(enchantId)) {
      pushStage(
        unsupportedStage({
          id: `enchant:${enchantId}`,
          kind: "enchantment",
          label: `Enchantment: ${enchantId}`,
          current: String(currentLevel),
          target: String(level),
          note: "enchantment_not_applicable_to_item_type",
        }),
      );
      continue;
    }
    const requirements = [];
    for (
      let next =
        options.enchantmentBooks === "target-level" ? level : currentLevel + 1;
      next <= level;
      next += 1
    ) {
      requirements.push({
        id: `ENCHANTMENT_${enchantId.toUpperCase()}_${next}`,
        count: 1,
      });
    }
    pushStage(
      makeStage({
        id: `enchant:${enchantId}`,
        kind: "enchantment",
        label: `Enchantment: ${enchantId}`,
        current: String(currentLevel),
        target: String(level),
        requirements,
        options,
        note: "one_book_per_target_level",
      }),
    );
  }

  const materialMap = new Map<string, UpgradeMaterialRow>();
  const essenceMap = new Map<string, number>();
  let knownCost = 0;
  let coinFees = 0;
  let coinFeesKnown = true;
  let unknownStages = 0;
  let pricedRows = 0;
  let totalRows = 0;
  let allComplete = true;

  for (const stage of stages) {
    if (stage.status === "installed") continue;
    if (stage.status === "unknown" || stage.status === "unsupported") {
      unknownStages += 1;
      allComplete = false;
    } else if (stage.status === "ready" && !stage.complete) {
      unknownStages += 1;
      allComplete = false;
    }
    knownCost += stage.knownCost;
    if (stage.coinFee === null) coinFeesKnown = false;
    else coinFees += stage.coinFee;
    if (stage.essence) {
      essenceMap.set(
        stage.essence.type,
        (essenceMap.get(stage.essence.type) ?? 0) + stage.essence.amount,
      );
    }
    for (const material of stage.materials) {
      totalRows += 1;
      if (material.missingCost !== null) pricedRows += 1;
      const existing = materialMap.get(material.id);
      if (existing) {
        existing.required += material.required;
        existing.owned = Math.max(existing.owned, material.owned);
        existing.missing += material.missing;
        existing.missingCost =
          existing.missingCost === null || material.missingCost === null
            ? null
            : existing.missingCost + material.missingCost;
      } else {
        materialMap.set(material.id, { ...material });
      }
    }
  }

  return {
    itemId: facts.itemId,
    itemName: facts.name,
    stages,
    materials: [...materialMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    essence: [...essenceMap.entries()]
      .map(([type, amount]) => ({ type, amount }))
      .sort((a, b) => a.type.localeCompare(b.type)),
    knownCost,
    totalCost: allComplete ? knownCost : null,
    coinFees,
    coinFeesKnown,
    unknownStages,
    pricedRows,
    totalRows,
    coverage: totalRows ? pricedRows / totalRows : 0,
    inventoryKnown: options.inventoryKnown !== false,
    current,
    target,
  };
}

function enchantPool(category: string): string[] {
  return UPGRADE_CATALOG.enchantPools[category.toUpperCase()] ?? [];
}

export function essenceName(type: string): string {
  return `${type} Essence`;
}

export function stageKindLabel(kind: StageKind): string {
  switch (kind) {
    case "stars":
      return "Dungeon Stars";
    case "master-stars":
      return "Master Stars";
    case "recombobulator":
      return "Recombobulator";
    case "hot-potato":
      return "Hot Potato Books";
    case "fuming-potato":
      return "Fuming Potato Books";
    case "gemstone-slot":
      return "Gemstone Slot";
    case "reforge":
      return "Reforge";
    case "enchantment":
      return "Enchantment";
    case "item-specific":
      return "Item-specific upgrade";
  }
}

export function essenceId(type: string): string {
  return essenceMaterialId(type);
}

export function planMaterialsText(plan: UpgradePlan): string {
  const lines = [
    `${plan.itemName} (${plan.itemId})`,
    `Stars: ${plan.current.stars} → ${plan.target.stars}`,
    "",
  ];
  for (const essence of plan.essence) {
    lines.push(`${essenceName(essence.type)}: ${essence.amount}`);
  }
  for (const material of plan.materials) {
    lines.push(`${material.name} (${material.id}): ${material.missing}`);
  }
  if (plan.coinFeesKnown && plan.coinFees > 0) {
    lines.push(`Coin fees: ${plan.coinFees}`);
  }
  return lines.join("\n");
}
