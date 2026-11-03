import {
  computeUpgradePlan,
  type PriceResolver,
  type UpgradeState,
  type ItemFacts,
  type UpgradeMaterialRow,
} from "@/features/upgrades/calculator";
export interface UpgradeChange {
  key: string;
  facts: ItemFacts;
  current: UpgradeState;
  target: UpgradeState;
}
export interface Purchase {
  key: string;
  itemId: string;
  quantity: number;
  owned: boolean;
}
/** Aggregate a basket, not independent Advisor net costs. The existing calculator
 * generates gross stages with no stock credit; one shared ledger applies stock. */
export function totalBuildBudget(input: {
  changes: UpgradeChange[];
  purchases: Purchase[];
  owned: Record<string, number>;
  prices: PriceResolver;
  budget: number | null;
  unknown?: number;
  stale?: boolean;
}) {
  let unknown = input.unknown ?? 0,
    fees = 0,
    purchaseCost = 0;
  const targets = new Map<string, UpgradeChange>();
  for (const change of input.changes) {
    const prev = targets.get(change.key);
    if (!prev) {
      targets.set(change.key, {
        ...change,
        target: {
          ...change.target,
          enchantments: { ...change.target.enchantments },
        },
      });
      continue;
    }
    if (
      prev.facts.itemId !== change.facts.itemId ||
      JSON.stringify(prev.current) !== JSON.stringify(change.current)
    ) {
      unknown++;
      continue;
    }
    const a = prev.target,
      b = change.target;
    if (
      a.reforge &&
      b.reforge &&
      a.reforge !== b.reforge &&
      a.reforge !== prev.current.reforge &&
      b.reforge !== prev.current.reforge
    ) {
      unknown++;
      continue;
    }
    prev.target = {
      stars: Math.max(a.stars, b.stars),
      hotPotatoBooks: Math.max(a.hotPotatoBooks, b.hotPotatoBooks),
      fumingPotatoBooks: Math.max(a.fumingPotatoBooks, b.fumingPotatoBooks),
      recombobulated: a.recombobulated || b.recombobulated,
      gemstoneSlots: [...new Set([...a.gemstoneSlots, ...b.gemstoneSlots])],
      reforge: b.reforge !== prev.current.reforge ? b.reforge : a.reforge,
      enchantments: Object.fromEntries(
        [
          ...new Set([
            ...Object.keys(a.enchantments),
            ...Object.keys(b.enchantments),
          ]),
        ].map((k) => [
          k,
          Math.max(a.enchantments[k] ?? 0, b.enchantments[k] ?? 0),
        ]),
      ),
    };
  }
  const required = new Map<string, UpgradeMaterialRow>();
  for (const change of targets.values()) {
    const plan = computeUpgradePlan(
      change.facts,
      change.current,
      change.target,
      {
        owned: {},
        prices: input.prices,
        inventoryKnown: true,
        enchantmentBooks: "target-level",
      },
    );
    for (const stage of plan.stages) {
      if (stage.status === "installed") continue;
      if (stage.status === "unknown" || stage.status === "unsupported")
        unknown++;
      if (stage.coinFee === null) unknown++;
      else fees += stage.coinFee;
      for (const m of stage.materials) {
        const old = required.get(m.id);
        required.set(m.id, {
          ...m,
          required: (old?.required ?? 0) + m.required,
        });
      }
    }
  }
  const materials = [...required.values()]
    .map((m) => {
      const stock = input.owned[m.id];
      const owned =
        Number.isFinite(stock) && stock! >= 0 ? Math.floor(stock!) : 0;
      const missing = Math.max(0, m.required - owned);
      const q = input.prices(m.id);
      const unit =
        q.unit !== null && Number.isFinite(q.unit) && q.unit >= 0
          ? q.unit
          : null;
      const cost = missing === 0 ? 0 : unit === null ? null : unit * missing;
      if (cost === null) unknown++;
      return {
        ...m,
        owned,
        missing,
        unitPrice: unit,
        missingCost: cost,
        priceMethod: q.method,
        priceConfidence: q.confidence,
        priceUpdatedAt: q.updatedAt ?? null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const seen = new Set<string>();
  for (const p of input.purchases) {
    if (seen.has(p.key)) continue;
    seen.add(p.key);
    if (p.owned) continue;
    if (!Number.isSafeInteger(p.quantity) || p.quantity < 1) {
      unknown++;
      continue;
    }
    const q = input.prices(p.itemId);
    if (q.unit === null || !Number.isFinite(q.unit) || q.unit < 0) unknown++;
    else purchaseCost += q.unit * p.quantity;
  }
  const upgradeCost =
      fees + materials.reduce((n, m) => n + (m.missingCost ?? 0), 0),
    total = purchaseCost + upgradeCost;
  const valid =
    input.budget !== null && Number.isFinite(input.budget) && input.budget >= 0;
  const status =
    valid && total > input.budget!
      ? "OVER"
      : !valid
        ? "UNKNOWN"
        : unknown || input.stale
          ? "PARTIAL"
          : "WITHIN";
  return {
    purchaseCost,
    upgradeCost,
    total,
    unknown,
    materials,
    fees,
    status,
    remaining:
      status === "WITHIN" || (status === "OVER" && !unknown && !input.stale)
        ? input.budget! - total
        : null,
  };
}
