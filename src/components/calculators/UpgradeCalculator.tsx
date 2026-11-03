import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  Coins,
  Gem,
  Hammer,
  Info,
  Layers,
  Package,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/locales";
import { useBazaar } from "@/hooks/useBazaar";
import { useConnectedProfile } from "@/hooks/usePlayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";
import {
  Progress,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/controls";
import { ItemIcon } from "@/components/common/ItemIcon";
import { RarityBadge } from "@/components/common/ItemVisuals";
import { EmptyState, InfoNote, StaleNote } from "@/components/common/States";
import { cn } from "@/utils/cn";
import { formatCoins, formatCompact, formatNumber } from "@/utils/format";
import {
  UPGRADE_CATALOG,
  catalogItem,
  enchantmentsFor,
  gemstoneSlotKeys,
  materialName,
  reforgesFor,
} from "@/features/upgrades/catalog";
import {
  computeUpgradePlan,
  createPriceResolver,
  emptyUpgradeState,
  normalizeState,
  type StageKind,
  type UpgradePlan,
  type UpgradeState,
} from "@/features/upgrades/calculator";
import {
  findInventoryItem,
  ownedMaterials,
  upgradeCandidates,
} from "@/features/upgrades/item-state";
import { readMarketSetting, writeMarketSetting } from "@/features/market/storage";

type SavedPlan = {
  id: string;
  itemId: string;
  itemName: string;
  current: UpgradeState;
  target: UpgradeState;
  budget: number;
  savedAt: number;
};

const CATALOG_IDS = Object.keys(UPGRADE_CATALOG.items).sort((a, b) =>
  materialName(a).localeCompare(materialName(b)),
);

function parseNumber(value: string): number {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function UpgradeCalculator() {
  const { t, language } = useI18n();
  const bazaar = useBazaar();
  const connected = useConnectedProfile();
  const member = connected.profile?.member ?? null;
  const inventory = member?.inventory ?? null;

  const candidates = useMemo(() => upgradeCandidates(inventory), [inventory]);
  const [selectedId, setSelectedId] = useState<string>(() => candidates[0]?.itemId ?? CATALOG_IDS[0] ?? "");
  const ownedItem = useMemo(
    () => findInventoryItem(inventory, selectedId),
    [inventory, selectedId],
  );

  const [search, setSearch] = useState("");
  const [current, setCurrent] = useState<UpgradeState>(emptyUpgradeState());
  const [target, setTarget] = useState<UpgradeState>(emptyUpgradeState());
  const [budget, setBudget] = useState("50000000");
  const [manualPrices, setManualPrices] = useState<Record<string, string>>({});
  const [enchantToAdd, setEnchantToAdd] = useState("");
  const [enchantLevel, setEnchantLevel] = useState("5");
  const [saved, setSaved] = useState<SavedPlan[]>([]);
  const [tab, setTab] = useState<"plan" | "materials" | "paths">("plan");

  const itemMeta = bazaar.itemMap.get(selectedId);
  const catalog = catalogItem(selectedId);
  const facts = useMemo(
    () => ({
      itemId: selectedId,
      name: ownedItem?.name ?? itemMeta?.name ?? materialName(selectedId),
      category: ownedItem?.category ?? itemMeta?.category ?? null,
      rarity: ownedItem?.rarity ?? itemMeta?.tier ?? null,
      material: ownedItem?.material ?? itemMeta?.material ?? null,
    }),
    [selectedId, ownedItem, itemMeta],
  );

  // Reset current/target when the selected item changes.
  useEffect(() => {
    const item = findInventoryItem(inventory, selectedId);
    const nextCurrent = item
      ? normalizeState({
          stars: item.stars,
          recombobulated: item.recombobulated,
          hotPotatoBooks: item.hotPotatoBooks,
          fumingPotatoBooks: item.fumingPotatoBooks,
          gemstoneSlots: item.gemstoneSlots,
          reforge: item.reforge,
          enchantments: item.enchantments,
        })
      : emptyUpgradeState();
    setCurrent(nextCurrent);
    setTarget({
      ...nextCurrent,
      stars: Math.min(10, nextCurrent.stars + 1),
      recombobulated: true,
      hotPotatoBooks: Math.max(nextCurrent.hotPotatoBooks, 10),
      fumingPotatoBooks: Math.max(nextCurrent.fumingPotatoBooks, 5),
    });
    setEnchantToAdd("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ownedItem?.uuid, ownedItem?.stars]);

  const prices = useMemo(() => {
    const bazaarPrices = new Map<string, number>();
    for (const quote of bazaar.quotes) {
      if (quote.instantBuy > 0) bazaarPrices.set(quote.productId, quote.instantBuy);
    }
    const manual = Object.fromEntries(
      Object.entries(manualPrices)
        .map(([id, value]) => [id, parseNumber(value)] as const)
        .filter(([, value]) => value > 0),
    );
    return createPriceResolver({ bazaar: bazaarPrices, manual });
  }, [bazaar.quotes, manualPrices]);

  const owned = useMemo(() => ownedMaterials(inventory, member), [inventory, member]);

  const plan = useMemo(
    () =>
      computeUpgradePlan(facts, current, target, {
        owned,
        inventoryKnown: Boolean(inventory?.available),
        prices,
      }),
    [facts, current, target, owned, inventory, prices],
  );

  const starsOnly = useMemo(
    () =>
      computeUpgradePlan(facts, current, { stars: target.stars }, {
        owned,
        inventoryKnown: Boolean(inventory?.available),
        prices,
      }),
    [facts, current, target.stars, owned, inventory, prices],
  );

  const corePlan = useMemo(
    () =>
      computeUpgradePlan(
        facts,
        current,
        {
          stars: target.stars,
          recombobulated: target.recombobulated,
          hotPotatoBooks: target.hotPotatoBooks,
          fumingPotatoBooks: target.fumingPotatoBooks,
        },
        { owned, inventoryKnown: Boolean(inventory?.available), prices },
      ),
    [facts, current, target, owned, inventory, prices],
  );

  const budgetValue = parseNumber(budget);
  const remaining = budgetValue - plan.knownCost;
  const fits = plan.totalCost !== null && plan.totalCost <= budgetValue;

  const savedKey = `upgrade-plans:v1:${connected.linked?.uuid ?? "local"}:${connected.linked?.profileId ?? "none"}`;
  useEffect(() => {
    let live = true;
    void readMarketSetting(savedKey)
      .then((raw) => {
        if (!live || !Array.isArray(raw)) return;
        setSaved(
          (raw as SavedPlan[]).filter(
            (entry) => entry && typeof entry.itemId === "string" && entry.target,
          ),
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [savedKey]);

  const savePlan = () => {
    const entry: SavedPlan = {
      id: crypto.randomUUID(),
      itemId: facts.itemId,
      itemName: facts.name,
      current,
      target,
      budget: budgetValue,
      savedAt: Date.now(),
    };
    const next = [entry, ...saved].slice(0, 20);
    setSaved(next);
    void writeMarketSetting(savedKey, next)
      .then(() => toast.success(t("upgrade.planSaved")))
      .catch(() => toast.error(t("upgrade.planSaveError")));
  };

  const loadPlan = (entry: SavedPlan) => {
    setSelectedId(entry.itemId);
    setCurrent(normalizeState(entry.current));
    setTarget(normalizeState(entry.target));
    setBudget(String(entry.budget));
  };

  const removePlan = (id: string) => {
    const next = saved.filter((entry) => entry.id !== id);
    setSaved(next);
    void writeMarketSetting(savedKey, next).catch(() => {});
  };

  const reset = () => {
    const item = findInventoryItem(inventory, selectedId);
    const next = item
      ? normalizeState({
          stars: item.stars,
          recombobulated: item.recombobulated,
          hotPotatoBooks: item.hotPotatoBooks,
          fumingPotatoBooks: item.fumingPotatoBooks,
          gemstoneSlots: item.gemstoneSlots,
          reforge: item.reforge,
          enchantments: item.enchantments,
        })
      : emptyUpgradeState();
    setCurrent(next);
    setTarget({
      ...next,
      stars: Math.min(10, next.stars + 1),
      recombobulated: true,
      hotPotatoBooks: Math.max(next.hotPotatoBooks, 10),
      fumingPotatoBooks: Math.max(next.fumingPotatoBooks, 5),
    });
    setManualPrices({});
  };

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? CATALOG_IDS.filter(
          (id) =>
            id.toLowerCase().includes(query) ||
            materialName(id).toLowerCase().includes(query),
        )
      : CATALOG_IDS;
    return list.slice(0, 80);
  }, [search]);

  const gemSlots = gemstoneSlotKeys(selectedId);
  const reforgeOptions = useMemo(
    () => reforgesFor(facts.category, facts.rarity),
    [facts.category, facts.rarity],
  );
  const enchantOptions = useMemo(
    () => enchantmentsFor(facts.category),
    [facts.category],
  );
  const targetEnchantments = Object.entries(target.enchantments).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const unknownMaterials = plan.materials.filter(
    (material) => material.missing > 0 && material.missingCost === null,
  );

  const updateTarget = (patch: Partial<UpgradeState>) =>
    setTarget((previous) => normalizeState({ ...previous, ...patch }));
  const updateCurrent = (patch: Partial<UpgradeState>) =>
    setCurrent((previous) => normalizeState({ ...previous, ...patch }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <Hammer className="size-4 text-violet" />
            <h2 className="text-[14px] font-semibold text-fg">{t("upgrade.title")}</h2>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{t("upgrade.desc")}</p>

          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="upgrade-search">{t("upgrade.selectItem")}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
                <Input
                  id="upgrade-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={facts.name}
                  className="pl-8"
                />
              </div>
              <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-line bg-bg-elevated/50 p-1">
                {filteredCatalog.map((id) => {
                  const meta = bazaar.itemMap.get(id);
                  const item = findInventoryItem(inventory, id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedId(id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-surface-2",
                        id === selectedId && "bg-violet-soft",
                      )}
                    >
                      <ItemIcon
                        itemId={id}
                        name={item?.name ?? meta?.name ?? materialName(id)}
                        category={item?.category ?? meta?.category}
                        material={item?.material ?? meta?.material}
                        rarity={item?.rarity ?? meta?.tier}
                        size="xs"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10.5px] font-medium text-fg">
                          {item?.name ?? meta?.name ?? materialName(id)}
                        </span>
                        <span className="block truncate font-mono text-[8.5px] text-fg-subtle">
                          {id}
                        </span>
                      </span>
                      {item ? <Badge variant="green">{t("upgrade.owned")}</Badge> : null}
                    </button>
                  );
                })}
                {!filteredCatalog.length ? (
                  <p className="px-2 py-3 text-center text-[10px] text-fg-subtle">
                    {t("bazaar.noResults")}
                  </p>
                ) : null}
              </div>
              <FieldHint>
                {catalog
                  ? t("upgrade.catalogNote", {
                      count: Object.keys(UPGRADE_CATALOG.items).length,
                    })
                  : t("upgrade.noCatalogData")}
              </FieldHint>
            </div>

            <div className="rounded-xl border border-line bg-surface-2/30 p-3">
              <div className="flex items-center gap-2.5">
                <ItemIcon
                  itemId={facts.itemId}
                  name={facts.name}
                  category={facts.category}
                  material={facts.material}
                  rarity={facts.rarity}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-fg">{facts.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <RarityBadge tier={facts.rarity} />
                    <span className="font-mono text-[9px] text-fg-subtle">{facts.itemId}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[9.5px] text-fg-subtle">
                {catalog ? (
                  <Badge variant="outline">
                    {t("upgrade.essence", { type: catalog.essenceType ?? "—" })}
                  </Badge>
                ) : null}
                <Badge variant="outline">
                  {t("upgrade.maxStars", { count: catalog?.maxStars ?? 5 })}
                </Badge>
                {ownedItem ? <Badge variant="green">{t("upgrade.loadedFromInventory")}</Badge> : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label={t("upgrade.currentStars")}
                value={current.stars}
                min={0}
                max={10}
                onChange={(value) => updateCurrent({ stars: value })}
              />
              <NumberField
                label={t("upgrade.targetStars")}
                value={target.stars}
                min={0}
                max={10}
                onChange={(value) => updateTarget({ stars: value })}
              />
              <NumberField
                label={t("upgrade.currentHpb")}
                value={current.hotPotatoBooks}
                min={0}
                max={10}
                onChange={(value) => updateCurrent({ hotPotatoBooks: value })}
              />
              <NumberField
                label={t("upgrade.targetHpb")}
                value={target.hotPotatoBooks}
                min={0}
                max={10}
                onChange={(value) => updateTarget({ hotPotatoBooks: value })}
              />
              <NumberField
                label={t("upgrade.currentFuming")}
                value={current.fumingPotatoBooks}
                min={0}
                max={5}
                onChange={(value) => updateCurrent({ fumingPotatoBooks: value })}
              />
              <NumberField
                label={t("upgrade.targetFuming")}
                value={target.fumingPotatoBooks}
                min={0}
                max={5}
                onChange={(value) => updateTarget({ fumingPotatoBooks: value })}
              />
            </div>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/30 px-3 py-2 text-[11px] text-fg-muted">
              <span>{t("upgrade.recombobulated")}</span>
              <Switch
                checked={target.recombobulated}
                onCheckedChange={(checked) => updateTarget({ recombobulated: checked })}
              />
            </label>

            <div>
              <Label htmlFor="upgrade-reforge">{t("upgrade.reforge")}</Label>
              <select
                id="upgrade-reforge"
                value={target.reforge ?? ""}
                onChange={(event) => updateTarget({ reforge: event.target.value || null })}
                className="h-9 w-full rounded-lg border border-line-strong bg-bg-elevated px-2 text-sm text-fg"
              >
                <option value="">{t("upgrade.noReforge")}</option>
                {reforgeOptions.map((row) => (
                  <option key={row.stone} value={row.stone}>
                    {row.name} ({row.stone})
                  </option>
                ))}
              </select>
            </div>

            {gemSlots.length ? (
              <div>
                <Label>{t("upgrade.gemstoneSlots")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {gemSlots.map((slot) => {
                    const checked = target.gemstoneSlots.includes(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() =>
                          updateTarget({
                            gemstoneSlots: checked
                              ? target.gemstoneSlots.filter((entry) => entry !== slot)
                              : [...target.gemstoneSlots, slot],
                          })
                        }
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-colors",
                          checked
                            ? "border-violet/35 bg-violet-soft text-violet"
                            : "border-line text-fg-muted hover:border-line-strong",
                        )}
                      >
                        <Gem className="size-3" /> {slot}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div>
              <Label>{t("upgrade.enchantments")}</Label>
              <div className="flex gap-1.5">
                <select
                  value={enchantToAdd}
                  onChange={(event) => setEnchantToAdd(event.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-bg-elevated px-2 text-[11px] text-fg"
                >
                  <option value="">{t("upgrade.addEnchantment")}</option>
                  {enchantOptions.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
                <Input
                  value={enchantLevel}
                  onChange={(event) => setEnchantLevel(event.target.value)}
                  inputMode="numeric"
                  className="h-9 w-14"
                  aria-label={t("upgrade.level")}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9"
                  disabled={!enchantToAdd}
                  onClick={() => {
                    if (!enchantToAdd) return;
                    updateTarget({
                      enchantments: {
                        ...target.enchantments,
                        [enchantToAdd]: clamp(parseNumber(enchantLevel), 1, 10),
                      },
                    });
                    setEnchantToAdd("");
                  }}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              {targetEnchantments.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {targetEnchantments.map(([id, level]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        updateTarget({
                          enchantments: Object.fromEntries(
                            Object.entries(target.enchantments).filter(([key]) => key !== id),
                          ),
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2/40 px-1.5 py-0.5 text-[9.5px] text-fg-muted hover:border-red/30 hover:text-red"
                    >
                      {id} {level} <Trash2 className="size-2.5" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <Label htmlFor="upgrade-budget">{t("upgrade.budget")}</Label>
              <Input
                id="upgrade-budget"
                value={budget}
                inputMode="decimal"
                onChange={(event) => setBudget(event.target.value)}
              />
              <FieldHint>
                {plan.totalCost === null
                  ? t("upgrade.insufficient")
                  : fits
                    ? t("upgrade.fitsBudget")
                    : t("upgrade.overBudget", { value: formatCoins(Math.abs(remaining), language) })}
              </FieldHint>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={reset}>
                <RotateCcw className="size-3.5" /> {t("calculators.reset")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  updateTarget({
                    stars: catalog?.maxStars ?? 5,
                    recombobulated: true,
                    hotPotatoBooks: 10,
                    fumingPotatoBooks: 5,
                    gemstoneSlots: gemSlots,
                  })
                }
              >
                <Wand2 className="size-3.5" /> {t("upgrade.maxPreset")}
              </Button>
              <Button size="sm" onClick={savePlan}>
                <Save className="size-3.5" /> {t("upgrade.savePlan")}
              </Button>
            </div>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <p className="text-[9.5px] uppercase tracking-[0.1em] text-fg-subtle">
                {t("upgrade.totalKnown")}
              </p>
              <p className="mt-1 font-mono text-[26px] font-semibold tracking-[-0.03em] text-fg">
                {formatCoins(plan.knownCost, language)}
              </p>
              <p className="mt-0.5 text-[10px] text-fg-subtle">
                {plan.totalCost === null
                  ? t("upgrade.insufficient")
                  : t("upgrade.totalComplete", { value: formatCoins(plan.totalCost, language) })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={plan.unknownStages ? "amber" : "green"}>
                {plan.unknownStages
                  ? t("upgrade.unknownStages", { count: plan.unknownStages })
                  : t("upgrade.allKnown")}
              </Badge>
              <Badge variant="outline">
                {t("upgrade.coverage", { value: `${Math.round(plan.coverage * 100)}%` })}
              </Badge>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void bazaar.refresh()}
                disabled={bazaar.isFetching}
              >
                <TrendingUp className="size-3.5" /> {t("common.refresh")}
              </Button>
            </div>
          </div>

          {bazaar.envelope?.stale ? <StaleNote updatedAt={bazaar.envelope.updatedAt} /> : null}

          <div className="grid grid-cols-2 gap-2.5 p-5 sm:grid-cols-4">
            <Stat label={t("upgrade.stages")} value={String(plan.stages.length)} />
            <Stat label={t("upgrade.essenceTotal")} value={formatCompact(plan.essence.reduce((sum, row) => sum + row.amount, 0))} />
            <Stat label={t("upgrade.coinFees")} value={plan.coinFeesKnown ? formatCoins(plan.coinFees, language) : t("upgrade.insufficient")} />
            <Stat label={t("upgrade.remainingBudget")} value={formatCoins(remaining, language)} tone={remaining >= 0 ? "green" : "red"} />
          </div>

          <div className="px-5 pb-2">
            <Progress value={plan.coverage * 100} indicatorClassName={plan.coverage === 1 ? "bg-green" : "bg-amber"} />
            <p className="mt-1 text-[9.5px] text-fg-subtle">{t("upgrade.coverageNote")}</p>
          </div>

          <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
            <div className="px-5">
              <TabsList className="w-full overflow-x-auto">
                <TabsTrigger value="plan">
                  <Layers className="size-3.5" /> {t("upgrade.tab.plan")}
                </TabsTrigger>
                <TabsTrigger value="materials">
                  <Package className="size-3.5" /> {t("upgrade.tab.materials")}
                </TabsTrigger>
                <TabsTrigger value="paths">
                  <TrendingUp className="size-3.5" /> {t("upgrade.tab.paths")}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="plan" className="focus:outline-none">
              <div className="space-y-2 p-5">
                {plan.stages.map((stage) => (
                  <article
                    key={stage.id}
                    className={cn(
                      "rounded-xl border p-3",
                      stage.status === "unknown" || stage.status === "unsupported"
                        ? "border-amber/25 bg-amber/[0.03]"
                        : stage.status === "installed"
                          ? "border-line bg-surface-2/20"
                          : "border-line bg-surface-2/30",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <StageIcon kind={stage.kind} />
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-medium text-fg">{stage.label}</p>
                          <p className="mt-0.5 text-[10px] text-fg-subtle">
                            {stage.current} <ArrowRight className="inline size-2.5" /> {stage.target}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StageStatusBadge status={stage.status} />
                        <span className="font-mono text-[11px] text-fg-muted">
                          {stage.cost === null ? t("upgrade.insufficient") : formatCoins(stage.cost, language)}
                        </span>
                      </div>
                    </div>
                    {stage.essence ? (
                      <p className="mt-2 flex items-center gap-1.5 text-[10px] text-fg-muted">
                        <Sparkles className="size-3 text-violet" />
                        {t("upgrade.essenceLine", {
                          amount: formatNumber(stage.essence.amount),
                          type: stage.essence.type,
                        })}
                      </p>
                    ) : null}
                    {stage.materials.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {stage.materials.map((material) => (
                          <span
                            key={material.id}
                            className="inline-flex items-center gap-1 rounded-md border border-line bg-bg-elevated/50 px-1.5 py-0.5 text-[9px] text-fg-muted"
                          >
                            {material.name} ×{material.required}
                            {material.missing !== material.required ? (
                              <span className="text-fg-subtle">
                                ({t("upgrade.missingShort", { count: material.missing })})
                              </span>
                            ) : null}
                            {material.missingCost === null ? (
                              <span className="text-amber">{t("upgrade.insufficientShort")}</span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {stage.note ? (
                      <p className="mt-2 flex items-start gap-1.5 text-[9.5px] text-fg-subtle">
                        <Info className="mt-0.5 size-3 shrink-0" />
                        {stage.note === "already_installed"
                          ? t("upgrade.alreadyInstalled")
                          : stage.note === "master_star_requirements_unverified" ||
                              stage.note === "star_requirements_unverified" ||
                              stage.note === "gemstone_slot_requirements_unverified" ||
                              stage.note === "reforge_requirements_unverified"
                            ? t("upgrade.insufficient")
                            : stage.note.replaceAll("_", " ")}
                      </p>
                    ) : null}
                  </article>
                ))}
                {!plan.stages.length ? (
                  <EmptyState icon={Check} title={t("upgrade.nothingToDo")} description={t("upgrade.nothingToDoDesc")} />
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="materials" className="focus:outline-none">
              <div className="p-5">
                {plan.materials.length ? (
                  <div className="overflow-x-auto rounded-xl border border-line">
                    <table className="w-full text-left text-[10.5px]">
                      <thead className="bg-surface-2/40 text-fg-subtle">
                        <tr>
                          <th className="p-2.5">{t("upgrade.material")}</th>
                          <th className="p-2.5 text-right">{t("upgrade.required")}</th>
                          <th className="p-2.5 text-right">{t("upgrade.ownedShort")}</th>
                          <th className="p-2.5 text-right">{t("upgrade.missing")}</th>
                          <th className="p-2.5 text-right">{t("upgrade.unitPrice")}</th>
                          <th className="p-2.5 text-right">{t("upgrade.cost")}</th>
                          <th className="p-2.5">{t("upgrade.manualPrice")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.materials.map((material) => (
                          <tr key={material.id} className="border-t border-line">
                            <td className="p-2.5">
                              <div className="flex items-center gap-2">
                                <ItemIcon itemId={material.id} name={material.name} size="xs" />
                                <span>
                                  <span className="block text-fg">{material.name}</span>
                                  <span className="block font-mono text-[8.5px] text-fg-subtle">{material.id}</span>
                                </span>
                              </div>
                            </td>
                            <td className="p-2.5 text-right font-mono text-fg-muted">{formatNumber(material.required)}</td>
                            <td className="p-2.5 text-right font-mono text-fg-muted">{formatNumber(material.owned)}</td>
                            <td className="p-2.5 text-right font-mono text-fg">{formatNumber(material.missing)}</td>
                            <td className="p-2.5 text-right font-mono text-fg-muted">
                              {material.unitPrice === null ? t("upgrade.insufficientShort") : formatCoins(material.unitPrice, language)}
                              <span className="block text-[8px] text-fg-subtle">{material.priceMethod}</span>
                            </td>
                            <td className="p-2.5 text-right font-mono text-fg-muted">
                              {material.missingCost === null ? "—" : formatCoins(material.missingCost, language)}
                            </td>
                            <td className="p-2.5">
                              <Input
                                value={manualPrices[material.id] ?? ""}
                                onChange={(event) =>
                                  setManualPrices((previous) => ({
                                    ...previous,
                                    [material.id]: event.target.value,
                                  }))
                                }
                                placeholder={t("upgrade.manualPlaceholder")}
                                className="h-7 w-24 text-[10px]"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Package} title={t("upgrade.noMaterials")} description={t("upgrade.noMaterialsDesc")} />
                )}

                {unknownMaterials.length ? (
                  <InfoNote className="mt-3">
                    <span className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" />
                      {t("upgrade.unknownMaterialsNote", { count: unknownMaterials.length })}
                    </span>
                  </InfoNote>
                ) : null}

                <div className="mt-4 grid gap-2 rounded-xl border border-line bg-bg-elevated/40 p-4 text-[11px] text-fg-muted sm:grid-cols-2">
                  <p className="flex items-center justify-between gap-2">
                    <span>{t("upgrade.essenceTotal")}</span>
                    <span className="font-mono text-fg">
                      {plan.essence.map((row) => `${row.type}: ${formatNumber(row.amount)}`).join(" · ") || "—"}
                    </span>
                  </p>
                  <p className="flex items-center justify-between gap-2">
                    <span>{t("upgrade.coinFees")}</span>
                    <span className="font-mono text-fg">
                      {plan.coinFeesKnown ? formatCoins(plan.coinFees, language) : t("upgrade.insufficient")}
                    </span>
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="paths" className="focus:outline-none">
              <div className="space-y-4 p-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <PlanVariantCard
                    title={t("upgrade.path.stars")}
                    description={t("upgrade.path.starsDesc")}
                    plan={starsOnly}
                    active
                    onSelect={() => updateTarget({ ...emptyUpgradeState(), stars: target.stars })}
                  />
                  <PlanVariantCard
                    title={t("upgrade.path.core")}
                    description={t("upgrade.path.coreDesc")}
                    plan={corePlan}
                    onSelect={() =>
                      updateTarget({
                        stars: target.stars,
                        recombobulated: target.recombobulated,
                        hotPotatoBooks: target.hotPotatoBooks,
                        fumingPotatoBooks: target.fumingPotatoBooks,
                      })
                    }
                  />
                  <PlanVariantCard
                    title={t("upgrade.path.full")}
                    description={t("upgrade.path.fullDesc")}
                    plan={plan}
                    onSelect={() => setTab("plan")}
                  />
                </div>

                <div className="rounded-xl border border-line bg-surface-2/30 p-4">
                  <h3 className="flex items-center gap-2 text-[12px] font-semibold text-fg">
                    <TrendingUp className="size-3.5 text-violet" /> {t("upgrade.cumulative")}
                  </h3>
                  <div className="mt-3 space-y-2">
                    {plan.stages
                      .filter((stage) => stage.status !== "installed")
                      .map((stage, index, rows) => {
                        const cumulative = rows
                          .slice(0, index + 1)
                          .reduce((sum, entry) => sum + (entry.cost ?? entry.knownCost), 0);
                        return (
                          <div key={stage.id} className="flex items-center gap-2">
                            <span className="w-6 shrink-0 text-center font-mono text-[9px] text-fg-subtle">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2 text-[10px]">
                                <span className="truncate text-fg-muted">{stage.label}</span>
                                <span className="shrink-0 font-mono text-fg-subtle">
                                  +{stage.cost === null ? t("upgrade.insufficientShort") : formatCoins(stage.cost, language)}
                                </span>
                              </div>
                              <Progress
                                value={budgetValue > 0 ? Math.min(100, (cumulative / budgetValue) * 100) : 0}
                                className="mt-1 h-1"
                                indicatorClassName={cumulative <= budgetValue ? "bg-violet" : "bg-red"}
                              />
                            </div>
                            <span className="w-16 shrink-0 text-right font-mono text-[9.5px] text-fg-muted">
                              {formatCoins(cumulative, language)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-surface-2/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-[12px] font-semibold text-fg">
                      <BookOpen className="size-3.5 text-violet" /> {t("upgrade.savedPlans")}
                    </h3>
                    <span className="text-[10px] text-fg-subtle">{saved.length}/20</span>
                  </div>
                  {saved.length ? (
                    <div className="mt-3 space-y-1.5">
                      {saved.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center gap-2 rounded-lg border border-line bg-bg-elevated/40 px-2.5 py-1.5"
                        >
                          <ItemIcon itemId={entry.itemId} name={entry.itemName} size="xs" />
                          <button
                            type="button"
                            onClick={() => loadPlan(entry)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block truncate text-[10.5px] text-fg">{entry.itemName}</span>
                            <span className="block text-[8.5px] text-fg-subtle">
                              {entry.current.stars}★ → {entry.target.stars}★ · {formatCoins(entry.budget, language)}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removePlan(entry.id)}
                            className="rounded p-1 text-fg-subtle hover:bg-surface-2 hover:text-red"
                            aria-label={t("common.delete")}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[10.5px] text-fg-subtle">{t("upgrade.noSavedPlans")}</p>
                  )}
                </div>

                <InfoNote>{t("upgrade.disclaimer")}</InfoNote>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label className="mb-1 text-[10px]">{label}</Label>
      <Input
        value={String(value)}
        inputMode="numeric"
        onChange={(event) => onChange(clamp(parseNumber(event.target.value), min, max))}
        className="h-8 text-[11px]"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/30 px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-[0.08em] text-fg-subtle">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-mono text-[14px] font-semibold",
          tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-fg",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StageIcon({ kind }: { kind: StageKind }) {
  switch (kind) {
    case "stars":
    case "master-stars":
      return <Star className="mt-0.5 size-3.5 shrink-0 text-amber" />;
    case "recombobulator":
      return <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-pink-300" />;
    case "hot-potato":
    case "fuming-potato":
      return <Coins className="mt-0.5 size-3.5 shrink-0 text-amber" />;
    case "gemstone-slot":
      return <Gem className="mt-0.5 size-3.5 shrink-0 text-cyan" />;
    case "reforge":
      return <Hammer className="mt-0.5 size-3.5 shrink-0 text-violet" />;
    case "enchantment":
      return <BookOpen className="mt-0.5 size-3.5 shrink-0 text-blue" />;
    default:
      return <Layers className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />;
  }
}

function StageStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const variant =
    status === "ready" ? "green" : status === "installed" ? "outline" : "amber";
  const label =
    status === "ready"
      ? t("upgrade.status.ready")
      : status === "installed"
        ? t("upgrade.status.installed")
        : status === "unsupported"
          ? t("upgrade.status.unsupported")
          : t("upgrade.status.unknown");
  return <Badge variant={variant}>{label}</Badge>;
}

function PlanVariantCard({
  title,
  description,
  plan,
  active,
  onSelect,
}: {
  title: string;
  description: string;
  plan: UpgradePlan;
  active?: boolean;
  onSelect: () => void;
}) {
  const { t, language } = useI18n();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-3 text-left transition-colors",
        active ? "border-violet/35 bg-violet-soft" : "border-line bg-surface-2/30 hover:border-line-strong",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-fg">{title}</span>
        {active ? <Badge variant="violet">{t("upgrade.active")}</Badge> : null}
      </div>
      <p className="mt-1 text-[9.5px] text-fg-subtle">{description}</p>
      <p className="mt-2 font-mono text-[15px] font-semibold text-fg">
        {formatCoins(plan.knownCost, language)}
      </p>
      <p className="text-[9px] text-fg-subtle">
        {plan.totalCost === null
          ? t("upgrade.insufficient")
          : t("upgrade.coverage", { value: `${Math.round(plan.coverage * 100)}%` })}
      </p>
    </button>
  );
}
