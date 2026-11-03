import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { useConnectedProfile } from "@/hooks/usePlayer";
import { useBazaar } from "@/hooks/useBazaar";
import { useDataProvider, useDataScope } from "@/data";
import { useI18n, type TranslationKey } from "@/locales";
import {
  equipmentAdvice,
  type EquipmentPurpose,
} from "@/features/upgrades/advisor";
import { createPriceResolver } from "@/features/upgrades/calculator";
import { UPGRADE_CATALOG } from "@/features/upgrades/catalog";
import { ItemIcon } from "@/components/common/ItemIcon";
import { ItemTooltip } from "@/components/common/ItemTooltip";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, InfoNote } from "@/components/common/States";
import { LinkAccountPrompt } from "@/components/account/LinkAccountPrompt";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCoins } from "@/utils/format";

export function EquipmentAdvisorPage() {
  const { t, language } = useI18n();
  const connected = useConnectedProfile(),
    bazaar = useBazaar(),
    provider = useDataProvider(),
    scope = useDataScope();
  const [budgetText, setBudget] = useState("10000000");
  const [kindFilter, setKindFilter] = useState("all");
  const [purpose, setPurpose] = useState<EquipmentPurpose>("all");
  const budget =
    budgetText.trim() &&
    Number.isFinite(Number(budgetText)) &&
    Number(budgetText) >= 0
      ? Number(budgetText)
      : null;
  // Exact binding only: do not analyse another profile if the selected one disappears.
  const profile = connected.data?.profiles.find(
    (p) => p.id === connected.linked?.profileId,
  );
  const member = profile?.member;
  const analysis = useQuery({
    queryKey: [
      "intelligence",
      scope,
      connected.linked?.uuid,
      connected.linked?.profileId,
      true,
    ],
    queryFn: ({ signal }) =>
      provider.getIntelligence(
        connected.linked!.uuid,
        connected.linked!.profileId,
        true,
        signal,
      ),
    enabled: Boolean(connected.linked),
    staleTime: 60000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const prices = useMemo(() => {
    const resolve = createPriceResolver({
      bazaar: new Map(bazaar.quotes.map((q) => [q.productId, q.instantBuy])),
    });
    return (id: string) => ({
      ...resolve(id),
      updatedAt: bazaar.envelope?.updatedAt ?? null,
    });
  }, [bazaar.quotes, bazaar.envelope?.updatedAt]);
  const dungeonItems = useMemo(
    () =>
      new Set(
        [...bazaar.itemMap.values()]
          .filter((item) => item.dungeon_item === true)
          .map((item) => item.id),
      ),
    [bazaar.itemMap],
  );
  const stale = Boolean(connected.data?.stale || bazaar.envelope?.stale);
  const advice = useMemo(
    () =>
      equipmentAdvice({
        inventory: member?.inventory,
        member,
        prices,
        budget,
        purpose,
        stale,
        dungeonItems,
        itemMap: bazaar.itemMap,
        analysis:
          analysis.data &&
          analysis.data.uuid === connected.linked?.uuid &&
          analysis.data.profile_id === connected.linked?.profileId
            ? analysis.data
            : undefined,
      }),
    [
      member,
      prices,
      budget,
      purpose,
      stale,
      dungeonItems,
      bazaar.itemMap,
      analysis.data,
      connected.linked,
    ],
  );
  const accessories =
    analysis.data &&
    connected.linked &&
    analysis.data.profile_id === connected.linked.profileId &&
    analysis.data.uuid === connected.linked.uuid
      ? analysis.data
      : undefined;
  const money = (n: number | null) =>
    n === null ? t("advisor.unknown") : formatCoins(n, language);
  const time = (n: number | null | undefined) =>
    n
      ? new Date(n).toLocaleString(language === "ru" ? "ru-RU" : "en-US")
      : t("advisor.unknown");
  return (
    <div className="space-y-5">
      <PageHeader
        title={t("advisor.title")}
        description={t("advisor.subtitle")}
      />
      {!connected.linked ? (
        <LinkAccountPrompt redirect="/equipment" icon={Shield} />
      ) : (
        <>
          <section className="panel grid gap-4 p-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="advisor-budget">{t("advisor.budget")}</Label>
              <Input
                id="advisor-budget"
                type="number"
                min="0"
                value={budgetText}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="advisor-purpose">{t("advisor.purpose")}</Label>
              <select
                id="advisor-purpose"
                className="w-full rounded-lg border border-line bg-surface-2 p-2 text-sm"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as EquipmentPurpose)}
              >
                {(["all", "combat", "dungeons", "gathering"] as const).map(
                  (p) => (
                    <option key={p} value={p}>
                      {t(`advisor.${p}`)}
                    </option>
                  ),
                )}
              </select>
            </div>
          </section>
          <div>
            <Label htmlFor="advisor-kind">{t("advisor.kind")}</Label>
            <select
              id="advisor-kind"
              className="rounded-lg border border-line bg-surface-2 p-2 text-sm"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
            >
              {["all", "reforge", "enchantment"].map((k) => (
                <option key={k} value={k}>
                  {t(
                    k === "all"
                      ? "advisor.allUpgrades"
                      : (("advisor.reason." + k) as
                          | "advisor.reason.reforge"
                          | "advisor.reason.enchantment"),
                  )}
                </option>
              ))}
            </select>
          </div>
          <InfoNote>
            {t("advisor.alternatives")} {t("advisor.priceHint")}
          </InfoNote>
          {stale ? <InfoNote>{t("advisor.stale")}</InfoNote> : null}
          {bazaar.error ? (
            <ErrorState
              error={bazaar.error}
              compact
              onRetry={() => void bazaar.refresh()}
            />
          ) : null}
          {connected.isPending ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : connected.error ? (
            <ErrorState
              error={connected.error}
              onRetry={() => void connected.refresh()}
            />
          ) : !member?.inventory.available ? (
            <InfoNote>{t("advisor.unavailable")}</InfoNote>
          ) : (
            <>
              {member.inventory.missing.length ||
              member.inventory.truncated ||
              member.inventory.errors.length ? (
                <InfoNote>{t("advisor.partial")}</InfoNote>
              ) : null}
              {!advice.length ? (
                <EmptyState icon={Shield} title={t("advisor.empty")} />
              ) : (
                advice.map((entry) => (
                  <section className="panel p-4" key={entry.key}>
                    <div className="flex items-center gap-3">
                      <ItemTooltip item={entry.item}>
                        <span>
                          <ItemIcon {...entry.item} size="lg" />
                        </span>
                      </ItemTooltip>
                      <div>
                        <h2 className="text-base font-semibold">
                          {entry.item.name}
                        </h2>
                        <Badge variant="outline">
                          {t(
                            entry.equipped
                              ? "advisor.equipped"
                              : "advisor.carried",
                          )}
                        </Badge>
                        <p className="mt-2 text-xs text-fg-muted">
                          {t("advisor.installed", {
                            stars: entry.item.stars,
                            hpb: entry.item.hotPotatoBooks,
                            fuming: entry.item.fumingPotatoBooks,
                            recomb: t(
                              entry.item.recombobulated
                                ? "common.yes"
                                : "common.no",
                            ),
                            gems: entry.item.gemstoneSlots.length,
                          })}
                        </p>
                        <p className="text-xs text-fg-subtle">
                          {t("advisor.modifiers", {
                            reforge: entry.item.reforge ?? t("advisor.unknown"),
                            count: Object.keys(entry.item.enchantments).length,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-fg-muted">
                      <p>{t("advisor.itemRequirements")}</p>
                      {entry.requirements.length ? (
                        entry.requirements.map((r, i) => (
                          <p key={i}>
                            {r.scope ? t("advisor.dungeonScope") + " · " : ""}
                            {t(
                              ("advisor.reqType." +
                                ([
                                  "SKILL",
                                  "SLAYER",
                                  "DUNGEON_SKILL",
                                  "DUNGEON_TIER",
                                ].includes(r.type)
                                  ? r.type
                                  : "other")) as TranslationKey,
                            )}{" "}
                            {r.subject} {r.target ?? "—"} ·{" "}
                            {t(`advisor.req.${r.status}`)}
                            {r.current !== null ? ` (${r.current})` : ""}
                          </p>
                        ))
                      ) : (
                        <p>{t("advisor.requirementsNone")}</p>
                      )}
                    </div>
                    {!entry.options.some(
                      (o) => kindFilter === "all" || o.kind === kindFilter,
                    ) ? (
                      <p className="mt-3 text-sm text-fg-muted">
                        {t("advisor.noOptions")}
                      </p>
                    ) : (
                      <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        {entry.options
                          .filter(
                            (o) =>
                              kindFilter === "all" || o.kind === kindFilter,
                          )
                          .map((option) => (
                            <article
                              className="rounded-xl border border-line bg-surface-2 p-3"
                              key={option.id}
                            >
                              <p className="text-sm">
                                {t(`advisor.reason.${option.kind}`)}
                              </p>
                              <p className="text-xs text-fg-muted">
                                {option.kind === "reforge"
                                  ? option.plan.stages.find(
                                      (s) => s.kind === "reforge",
                                    )?.target
                                  : option.kind === "enchantment"
                                    ? option.plan.stages.find(
                                        (s) => s.kind === "enchantment",
                                      )?.label
                                    : ""}
                              </p>
                              <div className="my-2 text-xs">
                                {option.effects.length ? (
                                  option.effects.map((e) => (
                                    <p key={e.stat}>
                                      {t(
                                        ("advisor.stat." +
                                          e.stat) as TranslationKey,
                                      )}
                                      : {t("advisor.base")}{" "}
                                      {e.base > 0 ? "+" : ""}
                                      {e.base} · {t("advisor.delta")}{" "}
                                      {e.delta === null
                                        ? t("advisor.unknown")
                                        : (e.delta > 0 ? "+" : "") + e.delta}
                                    </p>
                                  ))
                                ) : (
                                  <p>{t("advisor.effectsUnknown")}</p>
                                )}
                                <p className="text-fg-subtle">
                                  {t("advisor.modifierLimit")}
                                </p>
                              </div>
                              <p className="mt-2 font-mono text-sm">
                                {t("advisor.cost")}:{" "}
                                {money(option.plan.totalCost)}
                              </p>
                              {option.plan.totalCost === null ? (
                                <p className="text-xs text-fg-muted">
                                  {t("advisor.known")}:{" "}
                                  {money(option.plan.knownCost)}
                                </p>
                              ) : null}
                              <Badge variant="outline">
                                {t(`advisor.${option.affordability}`)}
                              </Badge>
                              <p className="mt-2 text-xs text-fg-muted">
                                {t("advisor.materials")}
                              </p>
                              <ul className="text-xs">
                                {option.plan.materials.map((m) => (
                                  <li
                                    className="my-1 flex items-center gap-2"
                                    key={m.id}
                                  >
                                    <ItemIcon itemId={m.id} size="xs" />
                                    <span>
                                      {m.name}: {m.required} / {m.owned} /{" "}
                                      {m.missing} · {money(m.missingCost)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              <p className="text-xs text-fg-subtle">
                                {t("advisor.freshness")}:{" "}
                                {time(bazaar.envelope?.updatedAt)}
                              </p>
                              <details className="mt-2 text-xs text-fg-muted">
                                <summary>{t("advisor.change")}</summary>
                                {option.plan.stages
                                  .filter((s) => s.status !== "installed")
                                  .map((s) => (
                                    <p key={s.id}>
                                      {s.current} → {s.target}
                                      {s.essence
                                        ? ` · ${s.essence.type}: ${s.essence.amount}`
                                        : ""}
                                    </p>
                                  ))}
                                <p>{t("advisor.effect")}</p>
                                <p>{t("advisor.requirements")}</p>
                              </details>
                            </article>
                          ))}
                      </div>
                    )}
                  </section>
                ))
              )}
            </>
          )}
          <section className="panel space-y-3 p-4">
            <h2 className="font-semibold">{t("advisor.accessories")}</h2>
            <p>
              {t("advisor.mp")}:{" "}
              {accessories?.accessory_power ?? t("advisor.unknown")} ·{" "}
              {t("advisor.subset")}:{" "}
              {accessories?.accessory_power_known_subset ??
                t("advisor.unknown")}
            </p>
            <p className="text-xs text-fg-muted">{t("advisor.mpHint")}</p>
            {analysis.error ? (
              <ErrorState
                error={analysis.error}
                compact
                onRetry={() => void analysis.refetch()}
              />
            ) : analysis.isPending ? (
              <Skeleton className="h-20" />
            ) : null}
            {accessories?.accessories.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {accessories.accessories
                  .slice()
                  .sort((a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity))
                  .slice(0, 8)
                  .map((a) => (
                    <article
                      key={a.item_id}
                      className="rounded-lg border border-line p-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <ItemIcon itemId={a.item_id} />
                        <span>{a.item_id.replaceAll("_", " ")}</span>
                      </div>
                      <p>
                        {t("advisor.gain")}: {a.gain ?? t("advisor.unknown")} ·{" "}
                        {t("advisor.cost")}: {money(a.cost)}
                      </p>
                      <Badge variant="outline">
                        {t(
                          a.cost === null ||
                            budget === null ||
                            stale ||
                            accessories.stale
                            ? "advisor.unknown"
                            : a.cost <= budget
                              ? "advisor.within"
                              : "advisor.over",
                        )}
                      </Badge>
                      <p>
                        {a.requirements.join(" · ") ||
                          t("advisor.requirements")}
                      </p>
                      <p>
                        {t("advisor.freshness")}: {time(a.price_timestamp)}
                      </p>
                    </article>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-fg-muted">
                {t("advisor.accessoryEmpty")}
              </p>
            )}
          </section>
          <p className="text-xs text-fg-subtle">
            {t("advisor.recipeSource")}: {UPGRADE_CATALOG.meta.version}
          </p>
        </>
      )}
    </div>
  );
}
