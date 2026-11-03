import { prettifyItemId } from "@/utils/item-name";
import { DEVELOPER_TOOLS_ENABLED } from "@/version";
import { useSettingsStore } from "@/stores/settings";
import { useMemo, useState, type ReactNode } from "react";
import { Brain, RefreshCw, ArrowRight, Plus, Target } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useIntelligence } from "@/hooks/useIntelligence";
import { useI18n, type TranslationKey } from "@/locales";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarketNumber } from "@/components/common/MarketNumber";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, InfoNote } from "@/components/common/States";
import { LinkAccountPrompt } from "@/components/account/LinkAccountPrompt";
import { openLinkAccount } from "@/stores/account-dialog";
import {
  rank,
  optimizeAccessories,
  goalProgress,
  goalSchema,
  appendHistory,
  slayerPlan,
  slayerMix,
  type Goal,
} from "@/features/intelligence/planning";
import { rules } from "@/features/intelligence/engine";
import type { Metric, Recommendation } from "@/features/intelligence/models";
import { formatCompact } from "@/utils/format";
import { toast } from "sonner";
const tabs = [
  "overview",
  "advisor",
  "accessories",
  "dungeons",
  "slayers",
  "pets",
  "networth",
  "goals",
] as const;
const fmt = (n: number | null | undefined) =>
  n == null ? "—" : formatCompact(n);
const selectClass =
  "h-9 rounded-lg border border-line bg-bg-elevated px-2 text-sm text-fg";
export function IntelligencePage() {
  const h = useIntelligence(),
    { t, language } = useI18n(),
    [tab, setTab] = useState<(typeof tabs)[number]>("overview"),
    [assetPage, setAssetPage] = useState(0),
    [edit, setEdit] = useState<Goal | null>(null);
  const developer = useSettingsStore(
    (s) => DEVELOPER_TOOLS_ENABLED && s.settings.developerMode,
  );
  const hideBalances = useSettingsStore((s) => s.settings.hideBalances);
  const coins = (v: number | null | undefined) =>
    hideBalances ? "••••" : fmt(v);
  const a = h.query.data,
    p = h.preferences;
  const ranked = useMemo(() => rank(a?.recommendations ?? [], p), [a, p]),
    plan = useMemo(
      () => optimizeAccessories(a?.accessories ?? [], p.budget),
      [a, p.budget],
    );
  const title = (key: string) => t(`intel.${key}` as TranslationKey);
  const add = (r: Recommendation) => {
    if (!a) return;
    let category: Goal["category"] = "general",
      subject = r.subject,
      target = 1;
    if (r.id.startsWith("next:")) {
      category =
        r.category === "classes"
          ? "dungeons"
          : (r.category as Goal["category"]);
      const metric = a.metrics.find(
        (m) => m.category === r.category && m.id === r.subject,
      );
      if (r.category === "classes") return;
      target = (metric?.level ?? 0) + 1;
    } else if (r.id.startsWith("accessory:")) category = "obtain";
    else if (r.id.startsWith("floor:")) {
      category = "floor";
      subject = r.id.split(":")[1]!;
    } else return;
    setEdit({
      id: crypto.randomUUID(),
      category,
      subject,
      target,
      status: "planned",
      manual: false,
      notify: false,
      createdAt: Date.now(),
      completedAt: null,
      lastSnapshot: null,
    });
    setTab("goals");
  };
  const cards = (rows: typeof ranked) =>
    rows.length ? (
      <div className="grid gap-3 xl:grid-cols-2">
        {rows.slice(0, 60).map((r) => (
          <article className="panel p-4" key={r.id}>
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="break-words font-semibold">
                {prettifyItemId(r.subject)}
              </h3>
              <Badge variant={r.status === "available" ? "green" : "amber"}>
                {title(r.status)}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-fg-muted">{title(r.reason)}</p>
            {a && !a.networth.complete && (
              <p className="mt-2 text-xs text-amber">
                {title("recommendationPartial")}
              </p>
            )}
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Datum label={title("current")} value={fmt(r.current)} />
              <Datum label={title("target")} value={fmt(r.target)} />
              <Datum label={title("cost")} value={fmt(r.cost)} />
            </dl>
            {developer && (
              <p className="mt-3 text-xs text-fg-subtle">
                {title("source")}: {r.source} · {title("confidence")}:{" "}
                {r.confidence}
              </p>
            )}
            {developer && (
              <details className="mt-2 text-xs">
                <summary>{title("reason")}</summary>
                <p>
                  {title("ranking")}:{" "}
                  {Object.values(r.ranking)
                    .map((v) => v.toFixed(1))
                    .join(" / ")}
                </p>
                <p>
                  {title("requirements")}:{" "}
                  {[...new Set([...r.requirements, ...r.dependencies])].join(
                    " · ",
                  ) || "—"}
                </p>
              </details>
            )}
            {!r.category.startsWith("gear:") && r.category !== "classes" && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => add(r)}
                disabled={!h.loaded}
              >
                <Plus className="size-3" />
                {title("add")}
              </Button>
            )}
          </article>
        ))}
      </div>
    ) : (
      <p className="panel p-5 text-fg-muted">{title("noRows")}</p>
    );
  const metrics = (rows: Metric[]) =>
    rows.length ? (
      <div className="overflow-auto panel">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "subject",
                "current",
                "level",
                "target",
                "remaining",
                "progress",
                "state",
              ].map((k) => (
                <th className="p-3" key={k}>
                  {title(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 150).map((m) => (
              <tr
                className="border-t border-line"
                key={`${m.category}:${m.id}`}
              >
                <td className="p-3">
                  <span>{prettifyItemId(m.id)}</span>
                  {developer && (
                    <p className="text-[10px] text-fg-subtle">{m.source}</p>
                  )}
                </td>
                <td className="p-3">
                  {m.category === "economy" ? coins(m.value) : fmt(m.value)}
                </td>
                <td className="p-3">{fmt(m.level)}</td>
                <td className="p-3">{fmt(m.target)}</td>
                <td className="p-3">{fmt(m.remaining)}</td>
                <td className="min-w-24 p-3">
                  {m.progress === null ? (
                    "—"
                  ) : (
                    <>
                      <Progress value={m.progress * 100} />
                      {(m.progress * 100).toFixed(1)}%
                    </>
                  )}
                </td>
                <td className="p-3">
                  {title(m.state)}
                  {m.scope === "shared" ? ` · ${title("shared")}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="panel p-5">{title("noRows")}</p>
    );
  const preferences = (
    <section className="panel mb-4 p-4">
      <h2 className="mb-3 font-semibold">{title("preferences")}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <span className="text-xs text-fg-muted">{title("activities")}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              "combat",
              "dungeons",
              "mining",
              "farming",
              "fishing",
              "money",
              "general",
            ].map((v) => (
              <label key={v} className="text-sm">
                <input
                  type="checkbox"
                  checked={p.activities.includes(v)}
                  onChange={(e) =>
                    h.setPreferences({
                      ...p,
                      activities: e.target.checked
                        ? [...p.activities, v]
                        : p.activities.filter((x) => x !== v),
                    })
                  }
                />{" "}
                {title(v)}
              </label>
            ))}
          </div>
        </div>
        <MarketNumber
          label={title("budget")}
          value={p.budget}
          min={0}
          max={1e15}
          onChange={(budget) => h.setPreferences({ ...p, budget })}
        />
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={p.avoidExpensive}
              onChange={(e) =>
                h.setPreferences({ ...p, avoidExpensive: e.target.checked })
              }
            />
            {title("avoidExpensive")}
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            {title("horizon")}
            <select
              className={selectClass}
              value={p.horizon}
              onChange={(e) =>
                h.setPreferences({
                  ...p,
                  horizon: e.target.value as "short" | "long",
                })
              }
            >
              <option value="short">{title("short")}</option>
              <option value="long">{title("long")}</option>
            </select>
          </label>
        </div>
      </div>
    </section>
  );
  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <Brain className="size-3" />
            Player Intelligence
          </>
        }
        title={title("title")}
        description={title("subtitle")}
        actions={
          <>
            {!h.linked ? (
              <Button
                variant="secondary"
                onClick={() =>
                  openLinkAccount({ mode: "link", redirect: "/intelligence" })
                }
              >
                {title("connect")}
                <ArrowRight className="size-3" />
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  disabled={h.query.isFetching}
                  onClick={() => void h.query.refetch()}
                >
                  <RefreshCw className="size-3" />
                  {title("refresh")}
                </Button>
                <Button
                  disabled={h.query.isFetching}
                  onClick={() => {
                    if (h.market) void h.query.refetch();
                    else h.setMarket(true);
                  }}
                >
                  {title("market")}
                </Button>
              </>
            )}
          </>
        }
      />
      {!h.linked ? (
        <LinkAccountPrompt redirect="/intelligence" icon={Brain} />
      ) : h.query.isPending ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : h.query.error ? (
        <ErrorState
          error={h.query.error}
          onRetry={() => void h.query.refetch()}
        />
      ) : a ? (
        <>
          <section className="panel mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h2 className="font-semibold">
                {h.linked.name} · {a.profile_name ?? h.linked.profileName ?? ""}
              </h2>
              <p className="mt-1 text-xs text-fg-subtle">
                {developer && (
                  <>
                    {a.uuid} · {a.profile_type} ·{" "}
                  </>
                )}
                {a.coop ? title("shared") : title("member")}
              </p>
            </div>
            <div className="text-right text-xs">
              <Badge variant={a.demo || a.stale ? "amber" : "outline"}>
                {a.demo
                  ? "DEMO"
                  : a.stale
                    ? t("market.stale")
                    : t("market.fresh")}
              </Badge>
              <p className="mt-1">
                {title("freshness")}:{" "}
                {new Date(a.fetched_at).toLocaleString(language)}
              </p>
              {developer && (
                <p>
                  {title("rules")}: {a.rules_version}
                </p>
              )}
            </div>
          </section>
          <InfoNote>{title("capNote")}</InfoNote>
          {a.warnings.includes("storage_truncated_16_bags") && (
            <InfoNote>{title("storageBound")}</InfoNote>
          )}
          {h.error && <InfoNote>{title("storageError")}</InfoNote>}
          <nav
            className="mb-4 flex flex-wrap gap-2"
            role="tablist"
            aria-label={title("title")}
          >
            {tabs.map((v) => (
              <button
                className={`rounded-lg border px-3 py-2 text-sm ${v === tab ? "border-violet bg-violet-soft text-violet" : "border-line text-fg-muted"}`}
                role="tab"
                aria-selected={v === tab}
                key={v}
                onClick={() => setTab(v)}
              >
                {title(v)}
              </button>
            ))}
          </nav>
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <DatumBox
                  label={title("partialTotal")}
                  value={coins(a.networth.known_total)}
                />
                <DatumBox
                  label={title("power")}
                  value={fmt(a.accessory_power)}
                />
                <DatumBox
                  label={title("profileAge")}
                  value={
                    a.first_join
                      ? new Date(a.first_join).toLocaleDateString(language)
                      : "—"
                  }
                />
                <DatumBox
                  label={title("lastSave")}
                  value={
                    a.last_save
                      ? new Date(a.last_save).toLocaleString(language)
                      : "—"
                  }
                />
              </div>
              <h2 className="font-semibold">{title("advisor")}</h2>
              {cards(ranked.slice(0, 4))}
              <h2 className="font-semibold">{title("overview")}</h2>
              {metrics(a.metrics.filter((m) => m.category !== "collections"))}
              <section className="panel p-4">
                <h3>{title("state")}</h3>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {Object.entries(a.completeness).map(([k, v]) => (
                    <p className="text-sm text-fg-muted" key={k}>
                      {title(k)}: {title(v)}
                    </p>
                  ))}
                </div>
                {developer && (
                  <p className="mt-3 text-sm">
                    {title("minions")}: {a.minions?.join(", ") ?? "—"}
                  </p>
                )}
                {developer && (
                  <p className="mt-2 text-xs text-fg-subtle">
                    {title("rawUnknown")}
                  </p>
                )}
              </section>
              {metrics(a.metrics.filter((m) => m.category === "collections"))}
            </div>
          )}
          {tab === "advisor" && (
            <>
              {preferences}
              {cards(ranked)}
            </>
          )}
          {tab === "accessories" && (
            <>
              <InfoNote>{title("catalogue")}</InfoNote>
              {a.completeness.accessory_bag !== "known" && (
                <InfoNote>{title("private")}</InfoNote>
              )}
              <div className="my-4 grid gap-3 md:grid-cols-2">
                <DatumBox
                  label={title("power")}
                  value={fmt(a.accessory_power)}
                />
                <DatumBox
                  label={title("subset")}
                  value={fmt(a.accessory_power_known_subset)}
                />
              </div>
              {preferences}
              <section className="panel mb-4 p-4">
                <h2>{title("optimize")}</h2>
                <p className="mt-2 text-violet">
                  {plan.exact ? title("exact") : title("heuristic")} ·{" "}
                  {title("cost")}: {fmt(plan.cost)} · +{plan.gain}{" "}
                  {title("power")}
                </p>
                <p className="mt-2 text-sm">{plan.items.join(" · ") || "—"}</p>
                <p className="mt-2 text-xs text-fg-muted">
                  {title("planNote")}
                </p>
              </section>
              <div className="grid gap-3 md:grid-cols-3">
                {[...a.accessories]
                  .sort(
                    (x, y) =>
                      (x.coins_per_point ?? Infinity) -
                        (y.coins_per_point ?? Infinity) ||
                      x.item_id.localeCompare(y.item_id),
                  )
                  .slice(0, 90)
                  .map((c) => (
                    <article className="panel p-4" key={c.item_id}>
                      <h3 className="break-words font-semibold">
                        {prettifyItemId(c.item_id)}
                      </h3>
                      <p className="text-xs text-fg-subtle">
                        {c.family} · {c.rarity ?? "—"}
                      </p>
                      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <Datum label={title("gain")} value={fmt(c.gain)} />
                        <Datum label={title("cost")} value={fmt(c.cost)} />
                        <Datum
                          label={title("coinsPerPoint")}
                          value={fmt(c.coins_per_point)}
                        />
                      </dl>
                      {developer && (
                        <p className="mt-2 text-xs">
                          {title("method")}: {c.method} · {c.confidence}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-fg-muted">
                        {c.requirements.join(" · ")}
                      </p>
                      <Button
                        size="sm"
                        className="mt-3"
                        variant="secondary"
                        onClick={() =>
                          add({
                            id: `accessory:${c.item_id}`,
                            category: "accessories",
                            subject: c.item_id,
                          } as Recommendation)
                        }
                      >
                        {title("add")}
                      </Button>
                    </article>
                  ))}
              </div>
            </>
          )}
          {tab === "dungeons" && (
            <div className="space-y-4">
              {metrics(
                a.metrics.filter(
                  (m) => m.category === "dungeons" || m.category === "classes",
                ),
              )}
              <section className="panel p-4">
                <h2>{title("completions")}</h2>
                <p className="mt-2 text-sm">
                  {Object.entries(a.floors)
                    .map(([f, n]) => `${title("floor")} ${f}: ${n}`)
                    .join(" · ") || title("unknown")}
                </p>
              </section>
              <label className="flex items-center gap-3 text-sm">
                {title("class")}
                <select
                  className={selectClass}
                  value={p.dungeonClass}
                  onChange={(e) =>
                    h.setPreferences({
                      ...p,
                      dungeonClass: e.target.value as typeof p.dungeonClass,
                    })
                  }
                >
                  {["archer", "berserk", "mage", "healer", "tank"].map((v) => (
                    <option key={v} value={v}>
                      {["archer", "mage", "healer", "berserk", "tank"].includes(
                        v,
                      )
                        ? v
                        : title(v)}
                    </option>
                  ))}
                </select>
              </label>
              {cards(
                ranked.filter(
                  (r) =>
                    r.category === `gear:${p.dungeonClass}` ||
                    r.id.startsWith("floor:"),
                ),
              )}
              <h2>{title("gear")}</h2>
              <div className="grid gap-2 md:grid-cols-3">
                {a.assets
                  .filter(
                    (i) =>
                      ["inv_armor", "equipment_contents"].includes(
                        i.location,
                      ) ||
                      (i.location === "inv_contents" &&
                        ["SWORD", "BOW", "WAND"].includes(i.category ?? "")),
                  )
                  .slice(0, 40)
                  .map((i) => (
                    <p className="panel p-3 text-sm" key={i.key}>
                      {i.name} · {i.location} · {i.rarity ?? "—"}
                    </p>
                  ))}
              </div>
              {a.completeness.inv_contents !== "known" && (
                <InfoNote>{title("private")}</InfoNote>
              )}
            </div>
          )}
          {tab === "slayers" && (
            <div className="space-y-4">
              {metrics(a.metrics.filter((m) => m.category === "slayer"))}
              {a.metrics
                .filter((m) => m.category === "slayer" && m.value !== null)
                .map((m) => (
                  <SlayerScenario key={m.id} metric={m} />
                ))}
              {cards(ranked.filter((r) => r.category === "slayer"))}
            </div>
          )}
          {tab === "pets" && (
            <>
              <InfoNote>{title("petNote")}</InfoNote>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {a.pets.map((pet, i) => (
                  <article className="panel p-4" key={`${pet.type}:${i}`}>
                    <h3 className="font-semibold">
                      {pet.type} · {pet.rarity ?? "—"}
                    </h3>
                    <p className="mt-2 text-sm">
                      {title("level")}: {fmt(pet.level)} · {title("xp")}:{" "}
                      {fmt(pet.xp)}
                    </p>
                    <p className="mt-2 text-sm">
                      {title("remaining")}: {fmt(pet.remaining)}
                    </p>
                    <p className="mt-2 text-xs">
                      {title("heldItem")}: {pet.held_item ?? "—"} ·{" "}
                      {title("active")}:{" "}
                      {pet.active === null ? "—" : pet.active ? "✓" : "—"}
                    </p>
                    {pet.progress !== null && (
                      <Progress className="mt-3" value={pet.progress * 100} />
                    )}
                  </article>
                ))}
              </div>
              {!a.pets.length && <InfoNote>{title("noRows")}</InfoNote>}
            </>
          )}
          {tab === "networth" && (
            <div className="space-y-4">
              <InfoNote>{title("networthNote")}</InfoNote>
              {!a.networth.complete && (
                <InfoNote>{title("partialWarning")}</InfoNote>
              )}
              <div className="grid gap-3 md:grid-cols-4">
                <DatumBox
                  label={title("partialTotal")}
                  value={coins(a.networth.known_total)}
                />
                <DatumBox
                  label={title("liquid")}
                  value={coins(a.networth.personal_liquid)}
                />
                <DatumBox
                  label={title("bank")}
                  value={coins(a.networth.shared_bank)}
                />
                <DatumBox
                  label={title("coverage")}
                  value={
                    a.networth.coverage === null
                      ? "—"
                      : `${(a.networth.coverage * 100).toFixed(1)}%`
                  }
                />
              </div>
              <p>
                {title("unknownAssets")}: {a.networth.unknown_count}
              </p>
              <Button
                disabled={a.demo || a.stale || !h.loaded}
                onClick={() => {
                  h.setHistory(appendHistory(h.history, a));
                  toast(title("saved"));
                }}
              >
                {title("saveSnapshot")}
              </Button>
              <section className="panel p-4">
                <h2>{title("history")}</h2>
                {h.history.length && !hideBalances ? (
                  <>
                    <div className="h-56">
                      <ResponsiveContainer>
                        <LineChart data={h.history}>
                          <XAxis
                            dataKey="at"
                            tickFormatter={(v) =>
                              new Date(Number(v)).toLocaleDateString(language)
                            }
                          />
                          <YAxis tickFormatter={(v) => fmt(Number(v))} />
                          <Tooltip
                            labelFormatter={(v) =>
                              new Date(Number(v)).toLocaleString(language)
                            }
                          />
                          <Line
                            dataKey="total"
                            stroke="var(--violet)"
                            connectNulls={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {h.history.slice(-10).map((s) => (
                      <p className="text-xs text-fg-muted" key={s.at}>
                        {new Date(s.at).toLocaleString(language)} ·{" "}
                        {fmt(s.total)} · {title("coverage")}:{" "}
                        {s.coverage === null
                          ? "—"
                          : `${(s.coverage * 100).toFixed(1)}%`}{" "}
                        · {title("unknownAssets")}: {s.unknown}
                      </p>
                    ))}
                  </>
                ) : (
                  <p className="mt-3 text-sm text-fg-muted">
                    {title("noHistory")}
                  </p>
                )}
              </section>
              <div className="grid gap-3 md:grid-cols-3">
                {a.assets
                  .slice(assetPage * 30, (assetPage + 1) * 30)
                  .map((i) => (
                    <article className="panel p-4 text-sm" key={i.key}>
                      <h3>
                        {i.name} ×{i.count}
                      </h3>
                      <p className="mt-2">
                        {title("location")}: {i.location}
                      </p>
                      <p>
                        {title("cost")}: {fmt(i.value)}
                        {i.soulbound ? ` · ${title("untradeable")}` : ""}
                      </p>
                      <p className="text-xs text-fg-muted">
                        {developer && (
                          <>
                            {i.method} · {i.confidence} ·{" "}
                          </>
                        )}
                        {i.price_timestamp
                          ? new Date(i.price_timestamp).toLocaleString(language)
                          : "—"}
                      </p>
                    </article>
                  ))}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  disabled={!assetPage}
                  onClick={() => setAssetPage(assetPage - 1)}
                >
                  {t("common.prev")}
                </Button>
                <Button
                  variant="secondary"
                  disabled={(assetPage + 1) * 30 >= a.assets.length}
                  onClick={() => setAssetPage(assetPage + 1)}
                >
                  {t("common.next")}
                </Button>
              </div>
            </div>
          )}
          {tab === "goals" && (
            <div className="space-y-4">
              <InfoNote>
                {title("goalNote")} {title("notifications")}
              </InfoNote>
              <Button
                disabled={!h.loaded}
                onClick={() =>
                  setEdit({
                    id: crypto.randomUUID(),
                    category: "skills",
                    subject: "MINING",
                    target: 10,
                    status: "planned",
                    manual: false,
                    notify: false,
                    createdAt: Date.now(),
                    completedAt: null,
                    lastSnapshot: null,
                  })
                }
              >
                <Target className="size-3" />
                {title("createGoal")}
              </Button>
              {edit && (
                <form
                  className="panel grid gap-3 p-4 md:grid-cols-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const result = goalSchema.safeParse(edit);
                    if (!result.success) return;
                    h.setGoals(
                      [
                        ...h.goals.filter((g) => g.id !== edit.id),
                        result.data,
                      ].slice(-200),
                    );
                    setEdit(null);
                  }}
                >
                  <label className="text-sm">
                    {title("category")}
                    <select
                      className={`${selectClass} mt-2 w-full`}
                      value={edit.category}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          category: e.target.value as Goal["category"],
                        })
                      }
                    >
                      {[
                        "skills",
                        "slayer",
                        "dungeons",
                        "general",
                        "accessories",
                        "economy",
                        "obtain",
                        "floor",
                      ].map((v) => (
                        <option key={v} value={v}>
                          {[
                            "archer",
                            "mage",
                            "healer",
                            "berserk",
                            "tank",
                          ].includes(v)
                            ? v
                            : title(v)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    {title("subject")}
                    <Input
                      className="mt-2"
                      required
                      maxLength={96}
                      value={edit.subject}
                      onChange={(e) =>
                        setEdit({ ...edit, subject: e.target.value })
                      }
                    />
                  </label>
                  <MarketNumber
                    label={title("goalTarget")}
                    value={edit.target}
                    min={0}
                    max={1e18}
                    onChange={(target) => setEdit({ ...edit, target })}
                  />
                  <label className="text-sm">
                    <input
                      type="checkbox"
                      checked={edit.notify}
                      onChange={(e) =>
                        setEdit({ ...edit, notify: e.target.checked })
                      }
                    />{" "}
                    {title("notify")}
                  </label>
                  <Button type="submit">{title("save")}</Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setEdit(null)}
                  >
                    {title("cancel")}
                  </Button>
                </form>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {h.goals.map((g) => {
                  const progress = goalProgress(g, a);
                  return (
                    <article className="panel p-4" key={g.id}>
                      <h3 className="font-semibold">
                        {g.subject} → {fmt(g.target)}
                      </h3>
                      <p className="my-2 text-sm">
                        {title("current")}:{" "}
                        {g.category === "economy"
                          ? coins(progress.current)
                          : fmt(progress.current)}{" "}
                        · {title(g.status)}
                      </p>
                      {progress.progress !== null && (
                        <Progress value={progress.progress * 100} />
                      )}
                      <p className="mt-2 text-xs text-fg-muted">
                        {g.status === "completed"
                          ? title(g.manual ? "manual" : "auto")
                          : title("member")}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <select
                          aria-label={`${g.subject} ${title("state")}`}
                          className={selectClass}
                          value={g.status}
                          onChange={(e) =>
                            h.setGoals(
                              h.goals.map((v) =>
                                v.id === g.id
                                  ? {
                                      ...v,
                                      status: e.target.value as Goal["status"],
                                      manual: e.target.value === "completed",
                                      completedAt:
                                        e.target.value === "completed"
                                          ? Date.now()
                                          : null,
                                    }
                                  : v,
                              ),
                            )
                          }
                        >
                          {[
                            "planned",
                            "in_progress",
                            "completed",
                            "paused",
                          ].map((v) => (
                            <option key={v} value={v}>
                              {title(v)}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEdit(g)}
                        >
                          {title("edit")}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            h.setGoals(h.goals.filter((v) => v.id !== g.id))
                          }
                        >
                          {title("delete")}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
function Datum({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-1 font-mono">{value}</dd>
    </div>
  );
}
function DatumBox(p: { label: string; value: ReactNode }) {
  return (
    <section className="panel p-4">
      <dl>
        <Datum {...p} />
      </dl>
    </section>
  );
}
function SlayerScenario({ metric: m }: { metric: Metric }) {
  const { t } = useI18n(),
    [target, setTarget] = useState((m.level ?? 0) + 1),
    [tier, setTier] = useState(1),
    [fee, setFee] = useState(100),
    [bonus, setBonus] = useState(0);
  const result = slayerPlan(m.id, m.value ?? 0, target, tier, fee, bonus),
    mix = slayerMix(
      m.id,
      result?.remaining ?? 0,
      rules.slayer_fees.map((v, i) => (i === tier - 1 ? fee : v)),
    ),
    max = (rules.slayer_xp as Record<string, number[]>)[m.id]?.length;
  return (
    <section className="panel p-4">
      <h3>{m.id}</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <MarketNumber
          label={t("intel.slayerTarget")}
          value={target}
          min={1}
          max={Math.max(1, (max ?? 1) - 1)}
          integer
          onChange={setTarget}
        />
        <MarketNumber
          label={t("intel.tier")}
          value={tier}
          min={1}
          max={(rules.slayer_tiers as Record<string, number>)[m.id] ?? 1}
          integer
          onChange={setTier}
        />
        <MarketNumber
          label={t("intel.fee")}
          value={fee}
          min={0}
          max={1e9}
          onChange={setFee}
        />
        <MarketNumber
          label={t("intel.bonus")}
          value={bonus}
          min={0}
          max={1000}
          onChange={setBonus}
        />
      </div>
      <p className="mt-2 text-xs text-fg-muted">
        {t("intel.fees")}:{" "}
        {rules.slayer_fees
          .map((v, i) => `T${i + 1}: ${fmt(i === tier - 1 ? fee : v)}`)
          .join(" / ")}
      </p>
      <p className="mt-3 text-sm">
        {t("intel.runs")}: {fmt(result?.runs)} · {t("intel.cost")}:{" "}
        {fmt(result?.cost)} · XP/run: {fmt(result?.reward)}
      </p>
      <p className="mt-2 text-xs text-fg-muted">
        {mix
          ? `${mix.exact ? t("intel.exact") : t("intel.heuristic")} · ${mix.runs.map((n, i) => `T${i + 1}: ${n}`).join(" / ")} · ${t("intel.cost")}: ${fmt(mix.cost)} (XP bonus 0%)`
          : "—"}
      </p>
      <p className="mt-2 text-xs text-fg-muted">{t("intel.slayerNote")}</p>
    </section>
  );
}
