import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Backpack,
  Boxes,
  Coins,
  Landmark,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n, type TranslationKey } from "@/locales";
import { useDataProvider, useDataScope } from "@/data";
import { useViewPlayer } from "@/hooks/useViewPlayer";
import { useSettingsStore } from "@/stores/settings";
import { ApiError } from "@/api/errors";
import {
  isValidUuid,
  normalizeUuid,
  validateMinecraftName,
} from "@/utils/validation";
import {
  formatCoins,
  formatCompact,
  formatDateTime,
  timeAgo,
} from "@/utils/format";
import { buildNetworth } from "@/features/networth/engine";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { NetworthBreakdownView } from "@/components/networth/NetworthBreakdown";
import {
  ApiKeyNotice,
  EmptyState,
  ErrorState,
  InfoNote,
  StaleNote,
} from "@/components/common/States";
import {
  DungeonsPanel,
  InventoryPanel,
  PetsPanel,
  SkillsPanel,
  SlayersPanel,
} from "@/pages/ProfilePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/common/CopyButton";
import { cn } from "@/utils/cn";
import type { NormalizedProfile } from "@/types/profile";

export function ViewPlayerPage() {
  const { t, language } = useI18n();
  const [params, setParams] = useSearchParams();
  const raw = params.get("name") ?? params.get("uuid") ?? "";
  const rawIsUuid = isValidUuid(raw);
  const nameValidation = validateMinecraftName(raw);
  const queryName =
    !rawIsUuid && nameValidation.valid ? nameValidation.value : null;
  const queryUuid = rawIsUuid ? normalizeUuid(raw) : null;

  const [input, setInput] = useState(raw);
  useEffect(() => setInput(raw), [raw]);

  const view = useViewPlayer({ name: queryName, uuid: queryUuid });
  const settings = useSettingsStore((state) => state.settings);
  const hide = settings.hideBalances;

  const [tab, setTab] = useState<
    "overview" | "inventory" | "pets" | "networth"
  >("overview");

  const provider = useDataProvider();
  const scope = useDataScope();
  const profile = view.profile;
  const analysis = useQuery({
    queryKey: ["view-networth", scope, view.activeUuid, profile?.id, "market"],
    enabled: Boolean(view.activeUuid && profile && tab === "networth"),
    queryFn: ({ signal }) =>
      provider.getIntelligence(view.activeUuid!, profile!.id, true, signal),
    staleTime: 60_000,
    retry: 0,
    refetchOnWindowFocus: false,
  });
  const breakdown = useMemo(
    () => (analysis.data ? buildNetworth(analysis.data) : null),
    [analysis.data],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    if (isValidUuid(value)) {
      setParams({ uuid: normalizeUuid(value) });
      return;
    }
    const result = validateMinecraftName(value);
    if (!result.valid) {
      toast.error(t("view.invalid"));
      return;
    }
    setParams({ name: result.value });
  };

  const notFound =
    (view.lookup.error instanceof ApiError &&
      view.lookup.error.kind === "not-found") ||
    (view.playerLookup.error instanceof ApiError &&
      view.playerLookup.error.kind === "not-found");
  const missingKey =
    provider.id === "direct" &&
    view.error instanceof ApiError &&
    view.error.kind === "missing-key";
  const demo = view.player.demo;

  return (
    <div className="animate-[fade-up_260ms_ease-out]">
      <PageHeader
        eyebrow={
          <>
            <UserRound className="size-3" /> {t("nav.section.view")}
          </>
        }
        title={t("view.title")}
        description={t("view.subtitle")}
        actions={
          <>
            <Badge variant="outline">
              <Lock className="size-3" /> {t("view.readOnly")}
            </Badge>
            <Button asChild size="sm" variant="secondary">
              <Link to="/profile">
                <ArrowLeft className="size-3.5" /> {t("view.ownProfile")}
              </Link>
            </Button>
          </>
        }
      />

      <InfoNote className="mb-4">
        <span className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-green" />
          <span>
            <b className="font-medium text-fg-muted">
              {t("view.isolationTitle")}.
            </b>{" "}
            {t("view.isolationDesc")}
          </span>
        </span>
      </InfoNote>

      <form onSubmit={submit} className="panel mb-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="view-player">{t("view.searchLabel")}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <Input
                id="view-player"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={t("view.placeholder")}
                autoComplete="off"
                spellCheck={false}
                className="h-11 pl-9 text-[13px]"
              />
            </div>
          </div>
          <Button type="submit" size="lg" disabled={view.isLoading}>
            <Search className="size-4" />
            {t("view.searchButton")}
          </Button>
          {raw ? (
            <Button
              type="button"
              size="lg"
              variant="ghost"
              onClick={() => {
                setInput("");
                setParams({});
              }}
            >
              {t("view.clear")}
            </Button>
          ) : null}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10.5px] text-fg-subtle">{t("view.searchHint")}</p>
          {rawIsUuid ? (
            <Badge variant="outline">{t("view.usingUuid")}</Badge>
          ) : null}
        </div>

        {view.history.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
            <span className="text-[10px] text-fg-subtle">
              {t("view.history")}:
            </span>
            {view.history.map((entry) => (
              <button
                key={entry.uuid}
                type="button"
                onClick={() => setParams({ uuid: entry.uuid })}
                className="rounded-md border border-line bg-surface-2/50 px-1.5 py-0.5 text-[10px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
              >
                {entry.name}
              </button>
            ))}
            <button
              type="button"
              onClick={view.clearHistory}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-fg-subtle hover:text-red"
            >
              <Trash2 className="size-3" /> {t("view.historyClear")}
            </button>
          </div>
        ) : null}
      </form>

      {!raw ? (
        <section className="panel">
          <EmptyState
            icon={UserRound}
            title={t("view.title")}
            description={t("view.isolationDesc")}
          />
        </section>
      ) : !rawIsUuid && !nameValidation.valid ? (
        <section className="panel">
          <EmptyState
            icon={AlertTriangle}
            title={t("view.invalid")}
            description={t("view.searchHint")}
          />
        </section>
      ) : view.isLoading ? (
        <ProfileSkeleton />
      ) : notFound ? (
        <section className="panel">
          <EmptyState
            icon={UserRound}
            title={t("view.notFound")}
            description={t("view.notFoundDesc", { name: raw })}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setInput("");
                  setParams({});
                }}
              >
                {t("view.clear")}
              </Button>
            }
          />
        </section>
      ) : view.error ? (
        <section className="panel">
          {missingKey ? (
            <div className="p-5">
              <ApiKeyNotice />
            </div>
          ) : (
            <ErrorState
              error={view.error}
              onRetry={() => void view.player.refetch()}
              title={t("view.loadError")}
            />
          )}
        </section>
      ) : !view.player.data?.profiles.length || !profile ? (
        <section className="panel">
          <EmptyState
            icon={Boxes}
            title={t("view.noProfiles")}
            description={t("view.noProfilesDesc")}
          />
        </section>
      ) : (
        <>
          <section className="panel relative mb-5 overflow-hidden">
            <div className="hero-mesh absolute inset-x-0 top-0 h-32 opacity-80" />
            <div className="relative p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl border border-cyan/30 bg-gradient-to-br from-cyan/40 to-violet/20 text-[26px] font-semibold uppercase text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                  {(view.effectiveName ?? raw).slice(0, 1)}
                  <span className="absolute -bottom-1.5 -right-1.5 rounded-md border border-cyan/30 bg-surface px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan">
                    LV {profile.member?.skyblockLevel ?? "?"}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-fg">
                      {view.effectiveName ?? raw}
                    </h2>
                    <Badge
                      variant={
                        profile.gameMode === "normal" ? "default" : "violet"
                      }
                    >
                      {t(`profile.${profile.gameMode}` as TranslationKey)}
                    </Badge>
                    {profile.isCoop ? (
                      <Badge variant="cyan">
                        {t("profile.coopMembers", {
                          count: profile.coopMemberCount,
                        })}
                      </Badge>
                    ) : null}
                    {view.isOwn ? (
                      <Badge variant="amber">{t("view.ownProfile")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("view.readOnly")}</Badge>
                    )}
                    {demo ? (
                      <Badge variant="amber">{t("common.demo")}</Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-subtle">
                    <span className="font-mono text-[10.5px]">
                      {(view.activeUuid ?? "").slice(0, 8)}…
                    </span>
                    <CopyButton
                      value={view.activeUuid ?? ""}
                      className="size-5"
                      label={t("view.copyUuid")}
                    />
                    {profile.lastSave ? (
                      <span>
                        {t("view.lastSave")}:{" "}
                        {formatDateTime(profile.lastSave, language)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/profile">
                        <ArrowLeft className="size-3.5" /> {t("view.backToOwn")}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void view.player.refetch()}
                      disabled={view.player.isFetching || demo}
                    >
                      <RefreshCw
                        className={cn(
                          "size-3.5",
                          view.player.isFetching && "animate-spin",
                        )}
                      />
                      {t("view.refresh")}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-cyan/20 bg-cyan/[0.04] px-3 py-2 text-[10px] leading-relaxed text-cyan/90">
                {t("view.banner")}
              </div>
            </div>

            {view.coopMembers.length > 1 ? (
              <div className="border-t border-line bg-bg-elevated/40 px-5 py-3">
                <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">
                  {t("view.selectMember")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {view.coopMembers.map((member) => {
                    const active =
                      normalizeUuid(member.uuid) ===
                      normalizeUuid(view.activeUuid ?? "");
                    return (
                      <button
                        key={member.uuid}
                        type="button"
                        onClick={() => view.setActiveUuid(member.uuid)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[10.5px] transition-colors",
                          active
                            ? "border-cyan/35 bg-cyan/10 text-cyan"
                            : "border-line bg-surface-2/40 text-fg-muted hover:border-line-strong",
                        )}
                      >
                        <span className="flex size-6 items-center justify-center rounded-md border border-line-strong text-[9px] font-bold">
                          {member.uuid.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-mono">
                          {member.uuid.slice(0, 8)}…
                        </span>
                        {member.isTarget ? (
                          <Badge variant="outline">
                            {t("view.targetMember")}
                          </Badge>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[9.5px] text-fg-subtle">
                  {t("view.memberUuid")}:{" "}
                  <span className="font-mono">{view.activeUuid}</span>
                </p>
              </div>
            ) : null}

            {view.player.data.profiles.length > 1 ? (
              <div className="border-t border-line bg-bg-elevated/40 px-5 py-3">
                <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">
                  {t("view.selectProfile")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {view.player.data.profiles.map((entry) => (
                    <ViewProfileChip
                      key={entry.id}
                      profile={entry}
                      active={entry.id === profile.id}
                      onClick={() => view.setSelectedProfileId(entry.id)}
                      language={language}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {view.player.data.stale ? (
            <StaleNote updatedAt={view.player.data.fetchedAt} />
          ) : null}

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label={t("view.level")}
              value={profile.member?.skyblockLevel ?? "—"}
              hint={`${Math.round((profile.member?.skyblockLevelProgress ?? 0) * 100)}% ${t("profile.nextLevel").toLowerCase()}`}
              icon={Sparkles}
              tone="violet"
              unavailable={!profile.member}
            />
            <StatCard
              label={t("profile.purse")}
              value={
                hide ? "•••" : formatCoins(profile.member?.purse, language)
              }
              hint={t("networth.liquid")}
              icon={Coins}
              tone="amber"
              unavailable={profile.member?.purse == null}
            />
            <StatCard
              label={t("profile.bank")}
              value={hide ? "•••" : formatCoins(profile.member?.bank, language)}
              hint={t("networth.shared")}
              icon={Landmark}
              tone="cyan"
              unavailable={profile.member?.bank == null}
            />
            <StatCard
              label={t("profile.skillAverage")}
              value={profile.member?.skillAverage?.toFixed(2) ?? "—"}
              hint={t("view.skills")}
              icon={TrendingUp}
              tone="green"
              unavailable={profile.member?.skillAverage == null}
            />
            <StatCard
              label={t("profile.catacombs")}
              value={
                profile.member?.dungeons
                  ? t("profile.levelShort", {
                      level: profile.member.dungeons.catacombsLevel,
                    })
                  : "—"
              }
              hint={t("view.dungeons")}
              icon={Swords}
              tone="red"
              unavailable={!profile.member?.dungeons}
            />
            <StatCard
              label={t("profile.slayers")}
              value={
                profile.member
                  ? formatCompact(profile.member.slayerTotalXp ?? 0)
                  : "—"
              }
              hint={t("profile.xp")}
              icon={Target}
              tone="neutral"
              unavailable={!profile.member?.slayers.length}
            />
          </div>

          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as typeof tab)}
          >
            <TabsList className="mb-4 flex w-full overflow-x-auto sm:w-auto">
              <TabsTrigger value="overview">
                <Sparkles className="size-3.5" /> {t("view.overview")}
              </TabsTrigger>
              <TabsTrigger value="inventory">
                <Backpack className="size-3.5" /> {t("view.inventory")}
                {profile.member?.inventory.available &&
                profile.member.inventory.totalItems ? (
                  <span className="text-fg-subtle">
                    {profile.member.inventory.totalItems}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="pets">
                <Target className="size-3.5" /> {t("view.pets")}
              </TabsTrigger>
              <TabsTrigger value="networth">
                <Landmark className="size-3.5" /> {t("view.networth")}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="overview"
              className="space-y-5 focus:outline-none"
            >
              <SkillsPanel member={profile.member} />
              <div className="grid gap-5 xl:grid-cols-2">
                <SlayersPanel member={profile.member} />
                <DungeonsPanel member={profile.member} />
              </div>
              <InfoNote>{t("view.isolationDesc")}</InfoNote>
            </TabsContent>

            <TabsContent
              value="inventory"
              className="space-y-4 focus:outline-none"
            >
              <InfoNote>{t("view.inventoryNote")}</InfoNote>
              <InventoryPanel member={profile.member} profileId={profile.id} />
            </TabsContent>

            <TabsContent value="pets" className="focus:outline-none">
              <PetsPanel member={profile.member} />
            </TabsContent>

            <TabsContent
              value="networth"
              className="space-y-4 focus:outline-none"
            >
              <InfoNote>{t("networth.viewOnlyNote")}</InfoNote>
              {analysis.isPending ? (
                <div className="space-y-4">
                  <Skeleton className="h-28 rounded-2xl" />
                  <Skeleton className="h-64 rounded-2xl" />
                </div>
              ) : analysis.error ? (
                <section className="panel">
                  <ErrorState
                    error={analysis.error}
                    onRetry={() => void analysis.refetch()}
                    title={t("networth.error")}
                  />
                </section>
              ) : analysis.data && breakdown ? (
                <NetworthBreakdownView
                  analysis={analysis.data}
                  breakdown={breakdown}
                  hideBalances={hide}
                  viewOnly
                  showHistory
                  history={[]}
                />
              ) : null}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function ViewProfileChip({
  profile,
  active,
  onClick,
  language,
}: {
  profile: NormalizedProfile;
  active: boolean;
  onClick: () => void;
  language: "ru" | "en";
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors",
        active
          ? "border-cyan/35 bg-cyan/10"
          : "border-line bg-surface-2/40 hover:border-line-strong",
      )}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-lg border text-[10px] font-bold",
          active
            ? "border-cyan/30 text-cyan"
            : "border-line-strong text-fg-subtle",
        )}
      >
        {profile.cuteName?.slice(0, 1).toUpperCase() ?? "P"}
      </span>
      <span>
        <span className="block text-[11.5px] font-medium text-fg">
          {profile.cuteName ?? t("profile.current")}
        </span>
        <span className="block text-[9.5px] text-fg-subtle">
          {t(`profile.${profile.gameMode}` as TranslationKey)} ·{" "}
          {profile.member
            ? t("profile.levelShort", {
                level: profile.member.skyblockLevel ?? "—",
              })
            : "—"}
          {profile.lastSave ? ` · ${timeAgo(profile.lastSave, language)}` : ""}
        </span>
      </span>
      {active ? <span className="ml-1 size-1.5 rounded-full bg-cyan" /> : null}
    </button>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <div className="panel p-6">
        <div className="flex gap-4">
          <Skeleton className="size-16 rounded-2xl" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-72" />
            <Skeleton className="h-8 w-56" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="panel p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-7 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
