import {
  baseStatComparison,
  VERIFIED_ITEMS,
} from "@/features/dungeons/replacements";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnectedProfile } from "@/hooks/usePlayer";
import { useBazaar } from "@/hooks/useBazaar";
import { useDataProvider, useDataScope } from "@/data";
import { useI18n, type TranslationKey } from "@/locales";
import {
  CLASSES,
  FLOORS,
  DUNGEON_SOURCE,
  type DungeonClass,
  type Floor,
} from "@/features/dungeons/catalog";
import { buildDungeonPlan, type Strategy } from "@/features/dungeons/planner";
import { saveDungeonPlan, loadDungeonPlan } from "@/features/dungeons/storage";
import { createPriceResolver } from "@/features/upgrades/calculator";
import {
  inventoryValueIndex,
  inventoryItemValue,
} from "@/features/inventory/values";
import { ItemSlot } from "@/components/common/ItemSlot";
import { ItemDetails } from "@/components/common/ItemDetails";
import type { ItemTooltipData } from "@/components/common/ItemTooltip";
import { PageHeader } from "@/components/common/PageHeader";
import { LinkAccountPrompt } from "@/components/account/LinkAccountPrompt";
import { Input } from "@/components/ui/input";
import { formatCoins } from "@/utils/format";
import type { ProfileMemberStats } from "@/types/profile";

export function DungeonPlannerPage() {
  const connected = useConnectedProfile();
  if (!connected.linked) return <LinkAccountPrompt />;
  const profile = connected.data?.profiles.find(
    (p) => p.id === connected.linked!.profileId,
  );
  return (
    <Planner
      key={`${connected.linked.uuid}:${connected.linked.profileId}`}
      uuid={connected.linked.uuid}
      profileId={connected.linked.profileId}
      member={profile?.member}
      profileStale={Boolean(connected.data?.stale)}
    />
  );
}
function Planner({
  uuid,
  profileId,
  member,
  profileStale,
}: {
  uuid: string;
  profileId: string;
  member?: ProfileMemberStats | null;
  profileStale: boolean;
}) {
  const { t, language } = useI18n(),
    provider = useDataProvider(),
    scope = useDataScope(),
    bazaar = useBazaar();
  const [dungeonClass, setClass] = useState<DungeonClass>("berserk"),
    [floor, setFloor] = useState<Floor>("F1"),
    [budgetText, setBudget] = useState("10000000"),
    [strategy, setStrategy] = useState<Strategy>("minimal"),
    [message, setMessage] = useState<TranslationKey | null>(null),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<ItemTooltipData | null>(null);
  const [upgradeSelection, setUpgradeSelection] = useState<
    string[] | undefined
  >();
  const budget =
    budgetText.trim() &&
    Number.isFinite(Number(budgetText)) &&
    Number(budgetText) >= 0
      ? Number(budgetText)
      : null;
  const query = useQuery({
    queryKey: ["intelligence", scope, uuid, profileId, true],
    queryFn: ({ signal }) =>
      provider.getIntelligence(uuid, profileId, true, signal),
    enabled: Boolean(uuid && profileId),
    staleTime: 60000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const stale =
    profileStale ||
    Boolean(
      query.error ||
      query.data?.stale ||
      bazaar.error ||
      bazaar.envelope?.stale,
    );
  const prices = useMemo(() => {
    const resolve = createPriceResolver({
      bazaar: new Map(bazaar.quotes.map((q) => [q.productId, q.instantBuy])),
    });
    return (id: string) => ({
      ...resolve(id),
      updatedAt: bazaar.envelope?.updatedAt ?? null,
    });
  }, [bazaar.quotes, bazaar.envelope?.updatedAt]);
  const plan = useMemo(
    () =>
      buildDungeonPlan({
        uuid,
        profileId,
        member,
        analysis: query.data,
        itemMap: bazaar.itemMap,
        prices,
        dungeonClass,
        floor,
        budget,
        strategy,
        stale,
        upgradeSelection,
      }),
    [
      uuid,
      profileId,
      member,
      query.data,
      bazaar.itemMap,
      prices,
      dungeonClass,
      floor,
      budget,
      strategy,
      stale,
      upgradeSelection,
    ],
  );
  const valuation = useMemo(
    () =>
      inventoryValueIndex(
        plan.analysis,
        uuid,
        profileId,
        new Map(
          bazaar.quotes.map((q) => [
            q.productId,
            q.instantSell > 0 ? q.instantSell : q.instantBuy,
          ]),
        ),
        bazaar.envelope?.updatedAt ?? null,
      ),
    [plan.analysis, uuid, profileId, bazaar.quotes, bazaar.envelope?.updatedAt],
  );
  const coin = (n: number | null) =>
    n === null ? t("dp.unknown") : formatCoins(n, language);
  const text = (key: string) => t(key as TranslationKey);
  const save = async () => {
    setBusy(true);
    try {
      await saveDungeonPlan({
        schemaVersion: 2,
        budgetSnapshot: {
          total: plan.basket.total,
          unknown: plan.basket.unknown,
          status: plan.basket.status as
            "WITHIN" | "OVER" | "PARTIAL" | "UNKNOWN",
        },
        upgradeSelection: plan.rows.flatMap((r) =>
          (r.selectedOptions ?? []).map((o) => o.id),
        ),
        uuid,
        profileId,
        dungeonClass,
        floor,
        budget,
        strategy,
        selectedBuild: plan.rows.flatMap((r) =>
          r.chosen
            ? [
                {
                  slot: r.slot,
                  itemId: r.chosen.item.itemId,
                  uuid: r.chosen.item.uuid,
                },
              ]
            : [],
        ),
        plannedUpgrades: plan.rows.flatMap((r) =>
          (r.selectedOptions ?? []).map((o) => ({
            slot: r.slot,
            optionId: o.id,
          })),
        ),
        timestamp: Date.now(),
      });
      setMessage("dp.saved");
    } catch {
      setMessage("dp.error");
    } finally {
      setBusy(false);
    }
  };
  const load = async () => {
    setBusy(true);
    try {
      const p = await loadDungeonPlan(uuid, profileId);
      if (!p) {
        setMessage("dp.notFound");
        return;
      }
      setClass(p.dungeonClass);
      setFloor(p.floor);
      setBudget(p.budget === null ? "" : String(p.budget));
      setStrategy(p.strategy);
      setUpgradeSelection(p.upgradeSelection);
      setSelected(null);
      setMessage("dp.loaded");
    } catch {
      setMessage("dp.error");
    } finally {
      setBusy(false);
    }
  };
  const activePet = member?.pets.find((p) => p.active);
  return (
    <>
      <PageHeader title={t("dp.title")} description={t("dp.subtitle")} />
      <div className="mb-5 grid gap-3 rounded-xl border border-line bg-bg-elevated p-4 md:grid-cols-4">
        <label className="text-xs">
          {t("dp.class")}
          <select
            aria-label={t("dp.class")}
            className="mt-1 w-full rounded border border-line bg-bg p-2"
            value={dungeonClass}
            onChange={(e) => {
              setClass(e.target.value as DungeonClass);
              if (strategy === "alternative" && e.target.value !== "berserk")
                setStrategy("balanced");
              setUpgradeSelection(undefined);
              setSelected(null);
            }}
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {text(`dp.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          {t("dp.floor")}
          <select
            aria-label={t("dp.floor")}
            className="mt-1 w-full rounded border border-line bg-bg p-2"
            value={floor}
            onChange={(e) => setFloor(e.target.value as Floor)}
          >
            {FLOORS.map((f) => (
              <option key={f} value={f}>
                {f === "E" ? (language === "ru" ? "Вход" : "Entrance") : f}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          {t("dp.budget")}
          <Input
            aria-label={t("dp.budget")}
            inputMode="decimal"
            value={budgetText}
            onChange={(e) => setBudget(e.target.value)}
          />
        </label>
        <label className="text-xs">
          {t("dp.strategy")}
          <select
            aria-label={t("dp.strategy")}
            className="mt-1 w-full rounded border border-line bg-bg p-2"
            value={strategy}
            onChange={(e) => {
              setStrategy(e.target.value as Strategy);
              setUpgradeSelection(undefined);
            }}
          >
            {(["current", "minimal", "balanced", "alternative"] as const).map(
              (s) => (
                <option
                  key={s}
                  value={s}
                  disabled={s === "alternative" && dungeonClass !== "berserk"}
                >
                  {text(`dp.${s}`)}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      <p className="mb-3 text-sm text-fg-muted">
        {text(`dp.role.${dungeonClass}`)}
      </p>
      {plan.rows.some((r) => !r.chosen || r.availability !== "met") && (
        <p className="mb-3 text-xs text-amber">{t("dp.partialBuild")}</p>
      )}
      {!plan.complete && (
        <p role="status" className="mb-3 text-xs text-amber">
          {t("dp.partial")}
        </p>
      )}
      {stale && (
        <p role="alert" className="mb-3 text-xs text-amber">
          {t("dp.stale")}
        </p>
      )}
      {!plan.supported && (
        <p role="alert" className="mb-3 text-xs text-amber">
          {t("dp.unsupported")}
        </p>
      )}
      {(floor === "F5" || floor === "F6") && (
        <p className="mb-3 text-xs text-amber">{t("dp.conflict")}</p>
      )}
      <p className="mb-3 text-xs text-fg-muted">{t("dp.verifiedCatalog")}</p>
      <section className="mb-4 rounded-xl border border-line p-4">
        <h2 className="mb-2 text-sm font-semibold">{t("dp.requirements")}</h2>
        {plan.requirements.map((r) => (
          <p key={r.subject} className="text-xs leading-6">
            {r.subject.startsWith("completion:")
              ? `${t("dp.completion")} ${r.subject.split(":")[1]}`
              : text(`dp.${r.subject}`)}
            : {coin(r.current)} / {coin(r.target)} — {text(`dp.${r.status}`)}
          </p>
        ))}
        <p className="mt-2 text-xs">
          {t("dp.classLevel")}:{" "}
          {member?.dungeons?.classes.find(
            (c) => c.id.toLowerCase() === dungeonClass,
          )?.level ?? t("dp.unknown")}{" "}
          · {t("dp.power")}: {plan.analysis?.accessory_power ?? t("dp.unknown")}{" "}
          · {t("dp.pet")}: {activePet?.name ?? t("dp.unknown")}
        </p>
      </section>
      <p className="mb-3 text-xs text-fg-muted">{t("dp.weaponScope")}</p>
      <div className="mb-3 grid grid-cols-2 gap-4 text-sm font-semibold">
        <h2>{t("dp.current")}</h2>
        <h2>{t("dp.recommended")}</h2>
      </div>
      <div className="space-y-3">
        {plan.rows.map((row) => (
          <section key={row.slot} className="rounded-xl border border-line p-3">
            <h3 className="mb-2 text-xs font-semibold">
              {text(`dp.${row.slot}`)}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[row.current, row.chosen?.item ?? null].map((item, i) => {
                const location = member?.inventory.containers.find(
                  (c) =>
                    c.known &&
                    c.slots.some(
                      (s) =>
                        s &&
                        (s === item ||
                          Boolean(item?.uuid && s.uuid === item.uuid) ||
                          s.extra === item?.extra),
                    ),
                )?.location;
                const tooltip: ItemTooltipData | null = item
                  ? {
                      ...item,
                      valueInfo: location
                        ? inventoryItemValue(
                            item,
                            location,
                            valuation,
                            bazaar.itemMap.get(item.itemId),
                          )
                        : undefined,
                    }
                  : null;
                return (
                  <div key={i} className="min-w-0 text-xs text-fg-muted">
                    {tooltip ? (
                      <>
                        <div className="mb-4 w-12">
                          <ItemSlot
                            item={tooltip}
                            onClick={() => setSelected(tooltip)}
                          />
                        </div>
                        <p>{item!.name}</p>
                        <p>
                          {item!.rarity ?? t("dp.unknown")} ·{" "}
                          {t(
                            i === 1 && row.purchase
                              ? "dp.purchase"
                              : i === 1 && row.chosen?.location === "catalog"
                                ? "dp.unknown"
                                : "dp.owned",
                          )}
                        </p>
                        <p>
                          {t("dp.upgrades")}: {item!.stars}★ ·{" "}
                          {item!.reforge ?? t("dp.unknown")} · HPB{" "}
                          {item!.hotPotatoBooks} / 10 · Fuming{" "}
                          {item!.fumingPotatoBooks} / 5
                        </p>
                      </>
                    ) : (
                      <p>
                        {text(
                          `dp.${row.action === "missing" ? "missing" : "unknown"}`,
                        )}
                      </p>
                    )}
                    {i === 1 && (
                      <>
                        <p className="mt-2 text-fg">
                          {text(`dp.${row.action}`)} · {t("dp.available")}:{" "}
                          {text(`dp.${row.availability}`)}
                        </p>
                        <p>
                          {t("dp.reason")}:{" "}
                          {t(
                            !row.chosen
                              ? "dp.unknown"
                              : row.option
                                ? "dp.reasonUpgrade"
                                : row.action === "replace"
                                  ? row.purchase
                                    ? "dp.reasonPurchase"
                                    : "dp.reasonReplace"
                                  : "dp.reasonOwned",
                          )}
                        </p>
                        {row.chosen && (
                          <>
                            <p>
                              {t("dp.itemCost")}:{" "}
                              {row.chosen.location === "catalog"
                                ? coin(prices(row.chosen.item.itemId).unit)
                                : row.selectedOptions?.length
                                  ? t("dp.sharedStock")
                                  : "0"}
                            </p>
                            <p>{t("dp.baseStats")}</p>
                            {baseStatComparison(
                              row.current?.itemId,
                              row.chosen.item.itemId,
                              bazaar.itemMap,
                            ).map((v) => (
                              <p key={v.stat}>
                                {text(`dp.stat.${v.stat}`)}:{" "}
                                {v.before ?? t("dp.unknown")} → {v.after}
                              </p>
                            ))}
                          </>
                        )}
                        {row.chosen?.requirements.map((r, n) => (
                          <p key={n}>
                            {t("dp.requirements")}:{" "}
                            {r.subject.startsWith("catacombs:")
                              ? t("dp.completion")
                              : r.subject === "catacombs"
                                ? t("dp.catacombs")
                                : r.subject === "combat"
                                  ? t("dp.combat")
                                  : r.subject || t("dp.unknown")}{" "}
                            {r.target ?? "?"} — {text(`dp.${r.status}`)}
                          </p>
                        ))}
                        {!row.purchase &&
                          row.chosen &&
                          strategy !== "current" &&
                          row.availability === "met" &&
                          row.chosen.options
                            .filter((o) =>
                              [
                                "stars",
                                "potato",
                                "fuming",
                                "recombobulator",
                              ].includes(o.kind),
                            )
                            .map((o) => (
                              <label
                                key={o.id}
                                className="mt-2 flex items-center gap-2"
                              >
                                <input
                                  type="checkbox"
                                  disabled={!plan.supported}
                                  checked={Boolean(
                                    row.selectedOptions?.some(
                                      (x) => x.id === o.id,
                                    ),
                                  )}
                                  onChange={(e) => {
                                    const selectedIds =
                                      upgradeSelection ??
                                      plan.rows.flatMap((r) =>
                                        (r.selectedOptions ?? []).map(
                                          (x) => x.id,
                                        ),
                                      );
                                    setUpgradeSelection(
                                      e.target.checked
                                        ? [...new Set([...selectedIds, o.id])]
                                        : selectedIds.filter(
                                            (id) => id !== o.id,
                                          ),
                                    );
                                  }}
                                />
                                {text(`dp.kind.${o.kind}`)}
                              </label>
                            ))}
                        {row.chosen?.location === "catalog" && (
                          <p>{t("dp.baseVariant")}</p>
                        )}
                        {row.selectedOptions?.map((o) => (
                          <p key={o.id}>
                            {t("dp.next")}: {text(`dp.kind.${o.kind}`)} ·{" "}
                            {t("dp.sharedStock")}
                          </p>
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <section className="my-4 space-y-2 rounded-xl border border-line p-4 text-xs">
        <h2 className="text-sm font-semibold">
          {text(`dp.budget.${plan.basket.status}`)}
        </h2>
        <p>
          {t("dp.purchaseCost")}: {coin(plan.basket.purchaseCost)}
        </p>
        <p>
          {t("dp.upgradeCost")}: {coin(plan.basket.upgradeCost)}
        </p>
        <p>
          {t("dp.knownCost")}: {coin(plan.basket.total)}
        </p>
        <p>
          {t("dp.unknownCost")}: {plan.basket.unknown}
        </p>
        <p>
          {t("dp.remaining")}: {coin(plan.basket.remaining)}
        </p>
        <p>{t("dp.materials")}</p>
        <p>{t("dp.costSource")}</p>
        {plan.basket.materials.map((m) => (
          <p key={m.id}>
            {m.name}: {m.required} / {m.owned} / {m.missing} ·{" "}
            {coin(m.missingCost)} · {text(`dp.price.${m.priceMethod}`)} ·{" "}
            {t("invValue.time")}:{" "}
            {m.priceUpdatedAt === null
              ? t("dp.unknown")
              : new Date(m.priceUpdatedAt).toLocaleString(
                  language === "ru" ? "ru-RU" : "en-US",
                )}
          </p>
        ))}
        <p>{t("dp.noSale")}</p>
        <h2 className="pt-2 text-sm font-semibold">{t("dp.actions")}</h2>
        <ol className="list-inside list-decimal space-y-2">
          <li>{t("dp.actionReq")}</li>
          <li>{t("dp.actionReview")}</li>
          {plan.rows.some((r) => r.purchase) && <li>{t("dp.actionBuy")}</li>}
          <li>
            {t(
              plan.rows.some((r) => r.option)
                ? "dp.actionUpgrade"
                : "dp.noAction",
            )}
          </li>
        </ol>
        <p>{t("dp.confidence")}</p>
      </section>
      <div className="mb-3 flex gap-3">
        <button
          disabled={busy || !member}
          className="rounded bg-violet/20 px-4 py-2 text-sm disabled:opacity-50"
          onClick={save}
        >
          {t("dp.save")}
        </button>
        <button
          disabled={busy}
          className="rounded border border-line px-4 py-2 text-sm"
          onClick={load}
        >
          {t("dp.load")}
        </button>
      </div>
      {message && (
        <p role="status" className="mb-3 text-xs">
          {t(message)}
        </p>
      )}
      <p className="text-xs text-fg-subtle">
        {t("dp.source")}:{" "}
        <a href={DUNGEON_SOURCE.url} target="_blank" rel="noreferrer">
          Catacombs · {DUNGEON_SOURCE.version}
        </a>{" "}
        ·{" "}
        <a href={VERIFIED_ITEMS.source} target="_blank" rel="noreferrer">
          Hypixel Resources · {VERIFIED_ITEMS.version}
        </a>{" "}
        ·{" "}
        <a href={VERIFIED_ITEMS.neuSource} target="_blank" rel="noreferrer">
          NEU
        </a>
      </p>
      <ItemDetails
        item={selected}
        open={Boolean(selected)}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
      />
    </>
  );
}
