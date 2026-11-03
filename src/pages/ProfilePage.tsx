import { InventoryValues } from "@/components/common/InventoryValues";
import type { InventoryValue } from "@/features/inventory/values";
import { Switch } from "@/components/ui/controls";
import { DEVELOPER_TOOLS_ENABLED } from "@/version";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  AlertTriangle,
  ArrowLeftRight,
  Backpack,
  Boxes,
  Coins,
  Landmark,
  PawPrint,
  RefreshCw,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { useI18n, type TranslationKey } from "@/locales";
import { useSettingsStore } from "@/stores/settings";
import { openLinkAccount } from "@/stores/account-dialog";
import {
  useMojangLookup,
  usePlayerProfiles,
  useProfileSelection,
} from "@/hooks/usePlayer";
import { ApiError, errorMessageKey } from "@/api/errors";
import { validateMinecraftName } from "@/utils/validation";
import {
  formatCoins,
  formatCompact,
  formatDateTime,
  formatNumber,
  timeAgo,
} from "@/utils/format";
import type {
  InventoryContainer,
  NormalizedProfile,
  ProfileMemberStats,
} from "@/types/profile";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import {
  StaleNote,
  ApiKeyNotice,
  DemoNote,
  EmptyState,
  ErrorState,
  InfoNote,
} from "@/components/common/States";
import { ItemGlyph, RarityBadge } from "@/components/common/ItemVisuals";
import { ItemSlot } from "@/components/common/ItemSlot";
import { ItemDetails } from "@/components/common/ItemDetails";
import type { ItemTooltipData } from "@/components/common/ItemTooltip";
import { CopyButton } from "@/components/common/CopyButton";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { LinkAccountPrompt } from "@/components/account/LinkAccountPrompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";

export function ProfilePage() {
  const { t, language } = useI18n();
  const [params, setParams] = useSearchParams();
  const rawName = params.get("name") ?? "";
  const ownMode = rawName.length === 0;
  const legacyValidation = validateMinecraftName(rawName);
  const legacyName =
    !ownMode && legacyValidation.valid ? legacyValidation.value : null;

  const settings = useSettingsStore((state) => state.settings);
  const setLinkedProfile = useSettingsStore((state) => state.setLinkedProfile);
  const linked = settings.lastProfile;
  const hide = settings.hideBalances;

  const mojang = useMojangLookup(legacyName, Boolean(legacyName));
  const player = usePlayerProfiles(
    ownMode
      ? { uuid: linked?.uuid, name: linked?.name, enabled: Boolean(linked) }
      : {
          uuid: mojang.data?.id,
          name: mojang.data?.name,
          enabled: Boolean(mojang.data),
        },
  );
  const {
    profile: baseProfile,
    selectedId,
    setSelectedId,
  } = useProfileSelection(player.data, ownMode ? linked?.profileId : undefined);

  // Switching SkyBlock profiles on your own account updates the single shared
  // linked-account state, so every personal section follows the choice.
  useEffect(() => {
    if (!ownMode || !linked || !player.data || !selectedId) return;
    if (selectedId === linked.profileId) return;
    const next = player.data.profiles.find((entry) => entry.id === selectedId);
    if (!next) return;
    setLinkedProfile({
      ...linked,
      profileId: next.id,
      profileName: next.cuteName ?? undefined,
      gameMode: next.gameMode,
    });
  }, [ownMode, linked, player.data, selectedId, setLinkedProfile]);

  // Co-op member selection is remembered per account + SkyBlock profile.
  const memberStorageKey =
    ownMode && linked && baseProfile
      ? `sbc:member:${linked.uuid.toLowerCase()}:${baseProfile.id}`
      : null;
  const [selectedMemberUuid, setSelectedMemberUuid] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!memberStorageKey) {
      setSelectedMemberUuid(null);
      return;
    }
    try {
      setSelectedMemberUuid(window.localStorage.getItem(memberStorageKey));
    } catch {
      setSelectedMemberUuid(null);
    }
  }, [memberStorageKey]);

  const chooseMember = (uuid: string | null) => {
    setSelectedMemberUuid(uuid);
    if (!memberStorageKey) return;
    try {
      if (uuid) window.localStorage.setItem(memberStorageKey, uuid);
      else window.localStorage.removeItem(memberStorageKey);
    } catch {
      // Persisting the selection is best-effort.
    }
  };

  const activeMember =
    baseProfile?.members?.find((entry) => entry.uuid === selectedMemberUuid)
      ?.member ??
    baseProfile?.member ??
    null;
  const profile = baseProfile ? { ...baseProfile, member: activeMember } : null;

  const notFound =
    mojang.error instanceof ApiError && mojang.error.kind === "not-found";
  const missingKey = player.error
    ? errorMessageKey(player.error) === "errors.missingKey"
    : false;

  return (
    <div className="animate-[fade-up_260ms_ease-out]">
      <Link
        className="mb-3 inline-flex items-center gap-2 text-sm text-violet"
        to="/intelligence"
      >
        {t("intel.title")} <ArrowRight className="size-3" />
      </Link>
      <PageHeader
        eyebrow={
          <>
            <UserRound className="size-3" /> {t("profile.title")}
          </>
        }
        title={t("profile.title")}
        description={t("profile.subtitle")}
        actions={
          ownMode && linked ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                openLinkAccount({ mode: "switch", redirect: "/profile" })
              }
            >
              <ArrowLeftRight className="size-3.5" />
              {t("account.switch")}
            </Button>
          ) : !ownMode ? (
            <Button asChild size="sm" variant="secondary">
              <Link to="/profile">
                <UserRound className="size-3.5" />
                {t("nav.profile")}
              </Link>
            </Button>
          ) : null
        }
      />

      {player.data?.stale ? (
        <StaleNote updatedAt={player.data.fetchedAt} />
      ) : null}

      {ownMode && !linked ? (
        <LinkAccountPrompt redirect="/profile" icon={UserRound} />
      ) : !ownMode && !legacyValidation.valid ? (
        <section className="panel">
          <EmptyState
            icon={AlertTriangle}
            title={t("profile.searchHint")}
            description={t("profile.placeholder")}
          />
        </section>
      ) : !ownMode && mojang.isPending ? (
        <ProfileSkeleton />
      ) : !ownMode && notFound ? (
        <section className="panel">
          <EmptyState
            icon={UserRound}
            title={t("profile.notFound")}
            description={t("profile.notFoundDesc", { name: rawName })}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setParams({})}
              >
                {t("common.reset")}
              </Button>
            }
          />
        </section>
      ) : !ownMode && mojang.error ? (
        <section className="panel">
          <ErrorState
            error={mojang.error}
            onRetry={() => void mojang.refetch()}
            title={t("profile.loadError")}
          />
        </section>
      ) : player.isPending ? (
        <ProfileSkeleton />
      ) : player.error ? (
        <section className="panel">
          {missingKey ? (
            <div className="p-5">
              <ApiKeyNotice />
              <div className="mt-4">
                <InfoNote>{t("profile.apiKeyHint")}</InfoNote>
              </div>
            </div>
          ) : (
            <ErrorState
              error={player.error}
              onRetry={() => void player.refresh()}
              title={t("profile.loadError")}
            />
          )}
        </section>
      ) : !player.data?.profiles.length || !profile ? (
        <section className="panel">
          <EmptyState
            icon={Boxes}
            title={t("profile.noProfiles")}
            description={t("profile.noProfilesDesc")}
          />
        </section>
      ) : (
        <>
          <section className="panel relative mb-5 overflow-hidden">
            <div className="hero-mesh absolute inset-x-0 top-0 h-32 opacity-80" />
            <div className="relative p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="relative flex size-16 shrink-0 items-center justify-center">
                  <PlayerAvatar
                    uuid={player.data.uuid}
                    name={player.data.name}
                    size={64}
                    rounded="rounded-2xl"
                    className="border-violet/30 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                  />
                  <span className="absolute -bottom-1.5 -right-1.5 rounded-md border border-violet/30 bg-surface px-1.5 py-0.5 font-mono text-[9px] font-bold text-violet">
                    LV {profile.member?.skyblockLevel ?? "?"}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-fg">
                      {player.data.name}
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
                    {profile.selected ? (
                      <Badge variant="green">{t("profile.selected")}</Badge>
                    ) : null}
                    {player.demo ? (
                      <Badge variant="amber">{t("common.demo")}</Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-subtle">
                    {DEVELOPER_TOOLS_ENABLED && (
                      <>
                        <span className="font-mono text-[10.5px]">
                          {player.data.uuid.replace(/-/g, "").slice(0, 8)}…
                        </span>
                        <CopyButton
                          value={player.data.uuid}
                          className="size-5"
                          label={t("profile.copyUuid")}
                        />
                      </>
                    )}
                    {profile.lastSave ? (
                      <span>
                        {t("profile.lastUpdate", {
                          time: formatDateTime(profile.lastSave, language),
                        })}
                      </span>
                    ) : null}
                    {profile.member?.firstJoin ? (
                      <span>
                        {t("profile.memberSince")}{" "}
                        {new Date(profile.member.firstJoin).getUTCFullYear()}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/progression">
                        <TrendingUp className="size-3.5" />{" "}
                        {t("profile.viewProgression")}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void player.refresh()}
                      disabled={player.isFetching || player.demo}
                    >
                      <RefreshCw
                        className={cn(
                          "size-3.5",
                          player.isFetching && "animate-spin",
                        )}
                      />
                      {t("profile.refreshProfile")}
                    </Button>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end">
                  <LevelRing
                    level={profile.member?.skyblockLevel ?? null}
                    progress={profile.member?.skyblockLevelProgress ?? 0}
                  />
                  <div className="text-right">
                    <p className="text-[9.5px] uppercase tracking-[0.1em] text-fg-subtle">
                      {t("profile.skyblockXp")}
                    </p>
                    <p className="font-mono text-[12px] text-fg-muted">
                      {profile.member?.skyblockXp?.toLocaleString(
                        language === "ru" ? "ru-RU" : "en-US",
                      ) ?? "—"}
                    </p>
                    <p className="mt-0.5 text-[9.5px] text-fg-subtle">
                      {t("profile.levelFormula")}
                    </p>
                  </div>
                </div>
              </div>

              {player.demo ? (
                <DemoNote className="mt-4">{t("profile.demoNote")}</DemoNote>
              ) : null}
            </div>

            {player.data.profiles.length > 1 ? (
              <div className="border-t border-line bg-bg-elevated/40 px-5 py-3">
                <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">
                  {t("profile.chooseProfile")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {player.data.profiles.map((entry) => (
                    <ProfileChip
                      key={entry.id}
                      profile={entry}
                      active={entry.id === profile.id}
                      onClick={() => setSelectedId(entry.id)}
                      language={language}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {profile.members && profile.members.length > 1 ? (
              <div className="border-t border-line bg-bg-elevated/40 px-5 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">
                    {t("profile.coopMember")}
                  </p>
                  <p className="text-[9px] text-fg-subtle">
                    {t("profile.memberReadOnly")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.members.map((entry) => {
                    const active =
                      entry.uuid ===
                      (selectedMemberUuid ??
                        profile.members?.find((row) => row.isTarget)?.uuid);
                    const label = entry.name ?? entry.uuid.slice(0, 8);
                    return (
                      <button
                        key={entry.uuid}
                        type="button"
                        onClick={() =>
                          chooseMember(entry.isTarget ? null : entry.uuid)
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
                          active
                            ? "border-violet/40 bg-violet-soft text-violet"
                            : "border-line bg-surface-2/40 text-fg-muted hover:border-line-strong hover:text-fg",
                        )}
                        title={entry.uuid}
                      >
                        <span className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-2 text-[9px] font-semibold uppercase">
                          {label.slice(0, 1)}
                          <img
                            src={`https://mc-heads.net/avatar/${entry.uuid}/32`}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 size-full object-cover [image-rendering:pixelated]"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[10.5px] font-medium">
                            {label}
                            {entry.isTarget ? ` · ${t("profile.you")}` : ""}
                          </span>
                          <span className="block font-mono text-[8.5px] opacity-70">
                            LV {entry.member.skyblockLevel ?? "?"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label={t("profile.skyblockLevel")}
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
              hint={t("dashboard.purse")}
              icon={Coins}
              tone="amber"
              unavailable={profile.member?.purse == null}
            />
            <StatCard
              label={t("profile.bank")}
              value={hide ? "•••" : formatCoins(profile.member?.bank, language)}
              hint={t("dashboard.bank")}
              icon={Landmark}
              tone="cyan"
              unavailable={profile.member?.bank == null}
            />
            <StatCard
              label={t("profile.skillAverage")}
              value={profile.member?.skillAverage?.toFixed(2) ?? "—"}
              hint={t("profile.skills")}
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
              hint={t("profile.dungeons")}
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

          <Tabs defaultValue="overview">
            <TabsList className="mb-4 flex w-full overflow-x-auto sm:w-auto">
              <TabsTrigger value="overview">
                <Sparkles className="size-3.5" /> {t("profile.skills")}
              </TabsTrigger>
              <TabsTrigger value="pets">
                <PawPrint className="size-3.5" /> {t("profile.pets")}
                {profile.member?.pets.length ? (
                  <span className="text-fg-subtle">
                    {profile.member.pets.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="inventory">
                <Backpack className="size-3.5" /> {t("profile.inventory")}
                {profile.member?.inventory.available &&
                profile.member.inventory.totalItems ? (
                  <span className="text-fg-subtle">
                    {profile.member.inventory.totalItems}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="collections">
                <Boxes className="size-3.5" /> {t("profile.collections")}
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
              <InfoNote>{t("profile.privacyNote")}</InfoNote>
            </TabsContent>

            <TabsContent value="pets" className="focus:outline-none">
              <PetsPanel member={profile.member} />
            </TabsContent>

            <TabsContent value="inventory" className="focus:outline-none">
              <InventoryPanel member={profile.member} profileId={profile.id} />
            </TabsContent>

            <TabsContent value="collections" className="focus:outline-none">
              <CollectionsPanel member={profile.member} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function ProfileChip({
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
          ? "border-violet/35 bg-violet-soft"
          : "border-line bg-surface-2/40 hover:border-line-strong",
      )}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-lg border text-[10px] font-bold",
          active
            ? "border-violet/30 text-violet"
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
      {active ? (
        <span className="ml-1 size-1.5 rounded-full bg-violet" />
      ) : null}
    </button>
  );
}

function LevelRing({
  level,
  progress,
}: {
  level: number | null;
  progress: number;
}) {
  return (
    <div
      className="relative flex size-[76px] items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(var(--violet) ${Math.max(0, Math.min(100, progress * 100))}%, var(--surface-3) 0)`,
      }}
    >
      <div className="flex size-[68px] flex-col items-center justify-center rounded-full border border-line bg-surface">
        <span className="text-[22px] font-semibold leading-none tracking-[-0.03em] text-fg">
          {level ?? "—"}
        </span>
        <span className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-fg-subtle">
          Level
        </span>
      </div>
    </div>
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
      <div className="panel p-5">
        <Skeleton className="h-4 w-32" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-8" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkillsPanel({ member }: { member: ProfileMemberStats | null }) {
  const { t } = useI18n();
  if (!member) return null;
  if (!member.skills.length) {
    return (
      <section className="panel">
        <EmptyState icon={Sparkles} title={t("progression.noSkills")} />
      </section>
    );
  }
  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">
            {t("profile.skills")}
          </h3>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {member.skillsAvailable
              ? t("progression.skillNote")
              : t("profile.skillsUnavailable")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9.5px] uppercase tracking-[0.08em] text-fg-subtle">
            {t("profile.skillAverage")}
          </p>
          <p className="font-mono text-[16px] font-semibold text-violet">
            {member.skillAverage?.toFixed(2) ?? "—"}
          </p>
        </div>
      </div>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {member.skills.map((skill) => (
          <div key={skill.id}>
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate font-medium text-fg-muted">
                {skill.name}
              </span>
              <span className="shrink-0 font-mono text-[10.5px] text-fg-subtle">
                <b className="text-fg">{skill.level}</b>/{skill.maxLevel}
                {skill.maxed ? (
                  <span className="ml-1.5 text-amber">
                    {t("profile.skillMaxed")}
                  </span>
                ) : null}
              </span>
            </div>
            <Progress
              value={skill.progress * 100}
              className="h-1.5"
              indicatorClassName={skill.maxed ? "bg-amber" : undefined}
            />
            <div className="mt-1 flex justify-between font-mono text-[9px] text-fg-subtle">
              <span>
                {formatCompact(skill.xp)} {t("profile.xp")}
              </span>
              {!skill.maxed && skill.nextLevelXp ? (
                <span>
                  {t("profile.nextLevel")}: {formatCompact(skill.nextLevelXp)}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SlayersPanel({
  member,
}: {
  member: ProfileMemberStats | null;
}) {
  const { t } = useI18n();
  if (!member) return null;
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-fg">
            {t("profile.slayers")}
          </h3>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {t("progression.slayerNote")}
          </p>
        </div>
        <Badge variant="violet">
          {formatCompact(member.slayerTotalXp ?? 0)} XP
        </Badge>
      </div>
      {member.slayers.length ? (
        <div className="space-y-3">
          {member.slayers.map((slayer) => {
            const kills = Object.values(slayer.kills).reduce(
              (sum, value) => sum + value,
              0,
            );
            const attempts = Object.values(slayer.attempts).reduce(
              (sum, value) => sum + value,
              0,
            );
            return (
              <div
                key={slayer.id}
                className="rounded-xl border border-line bg-surface-2/30 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[11.5px] font-medium text-fg">
                    <span className="flex size-6 items-center justify-center rounded-md border border-red/20 bg-red/10 text-[9px] font-bold text-red">
                      {slayer.level}
                    </span>
                    {slayer.name}
                  </span>
                  <span className="font-mono text-[10px] text-fg-subtle">
                    {formatCompact(slayer.xp)} /{" "}
                    {slayer.nextLevelXp
                      ? formatCompact(slayer.nextLevelXp)
                      : "MAX"}
                  </span>
                </div>
                <Progress
                  value={slayer.progress * 100}
                  className="mt-2 h-1"
                  indicatorClassName="bg-red"
                />
                <div className="mt-1.5 flex justify-between text-[9.5px] text-fg-subtle">
                  <span>
                    {t("profile.totalKills")}: {kills.toLocaleString()}
                  </span>
                  <span>
                    {t("profile.attempts")}: {attempts.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState compact icon={Target} title={t("profile.noSlayers")} />
      )}
    </section>
  );
}

export function DungeonsPanel({
  member,
}: {
  member: ProfileMemberStats | null;
}) {
  const { t } = useI18n();
  if (!member) return null;
  const dungeons = member.dungeons;
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-fg">
            {t("profile.dungeons")}
          </h3>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {t("profile.classLevels")}
          </p>
        </div>
        {dungeons?.highestTier != null ? (
          <Badge variant="red">F{dungeons.highestTier}</Badge>
        ) : null}
      </div>
      {dungeons ? (
        <>
          <div className="rounded-xl border border-line bg-surface-2/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-fg">
                {t("profile.catacombs")}
              </span>
              <span className="font-mono text-[11px] text-fg-muted">
                {t("profile.levelShort", { level: dungeons.catacombsLevel })}
              </span>
            </div>
            <Progress
              value={dungeons.catacombsProgress * 100}
              className="mt-2"
              indicatorClassName="bg-red"
            />
            <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-fg-subtle">
              <span>{formatCompact(dungeons.catacombsXp)} XP</span>
              {dungeons.catacombsNextXp ? (
                <span>{formatCompact(dungeons.catacombsNextXp)} XP</span>
              ) : null}
            </div>
          </div>
          <div className="mt-3 space-y-2.5">
            {dungeons.classes.map((entry) => (
              <div key={entry.id}>
                <div className="mb-1 flex items-center justify-between text-[10.5px]">
                  <span className="text-fg-muted">{entry.name}</span>
                  <span className="font-mono text-fg-subtle">
                    {entry.level}
                  </span>
                </div>
                <Progress
                  value={entry.progress * 100}
                  className="h-1"
                  indicatorClassName="bg-violet"
                />
              </div>
            ))}
            {!dungeons.classes.length ? (
              <p className="text-[10.5px] text-fg-subtle">
                {t("profile.noDungeons")}
              </p>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {dungeons.masterHighestTier != null ? (
              <Badge variant="amber">
                Master F{dungeons.masterHighestTier}
              </Badge>
            ) : null}
            <Badge variant="outline">{t("progression.dungeonProgress")}</Badge>
          </div>
        </>
      ) : (
        <EmptyState compact icon={Swords} title={t("profile.noDungeons")} />
      )}
    </section>
  );
}

export function PetsPanel({ member }: { member: ProfileMemberStats | null }) {
  const { t } = useI18n();
  if (!member) return null;
  if (!member.pets.length) {
    return (
      <section className="panel">
        <EmptyState icon={PawPrint} title={t("profile.noPets")} />
      </section>
    );
  }
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
        <h3 className="text-[14px] font-semibold text-fg">
          {t("profile.pets")}
        </h3>
        <span className="text-[10.5px] text-fg-subtle">
          {member.pets.length}
        </span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {member.pets.map((pet, index) => (
          <div
            key={`${pet.type}-${index}`}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3",
              pet.active
                ? "border-violet/30 bg-violet-soft"
                : "border-line bg-surface-2/30",
            )}
          >
            <ItemGlyph name={pet.name} tier={pet.tier} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[12px] font-medium text-fg">
                  {pet.name}
                </p>
                {pet.active ? (
                  <Badge variant="violet">{t("profile.activePet")}</Badge>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-fg-subtle">
                <RarityBadge tier={pet.tier} />
                <span className="font-mono">{formatCompact(pet.xp)} XP</span>
                {pet.heldItem ? (
                  <span>
                    {t("profile.heldItem")}:{" "}
                    {pet.heldItem
                      .replace(/^PET_ITEM_/, "")
                      .replaceAll("_", " ")
                      .toLowerCase()}
                  </span>
                ) : null}
                {pet.candyUsed ? (
                  <span>
                    {t("profile.candyUsed")}: {pet.candyUsed}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function InventoryPanel({
  member,
  profileId,
}: {
  member: ProfileMemberStats | null;
  profileId?: string;
}) {
  const { t } = useI18n();
  const enabled = useSettingsStore(
    (s) => s.settings.showItemValues && !s.settings.hideBalances,
  );
  const checked = useSettingsStore((s) => s.settings.showItemValues);
  const update = useSettingsStore((s) => s.update);

  if (!member) return null;
  const inventory = member.inventory;
  if (!inventory.available) {
    return (
      <section className="panel">
        <EmptyState
          icon={Backpack}
          title={t("profile.inventoryUnavailable")}
          description={
            inventory.reason === "decode-error"
              ? t("profile.inventoryDecodeError")
              : t("profile.inventoryPrivacy")
          }
        />
      </section>
    );
  }

  const containers = inventory.containers.length
    ? inventory.containers
    : fallbackContainer(inventory);
  const hasItems = containers.some((container) =>
    container.slots.some(Boolean),
  );
  const decodedItems = containers.reduce(
    (sum, container) => sum + container.slots.filter(Boolean).length,
    0,
  );

  if (!hasItems) {
    return (
      <section className="panel">
        <EmptyState icon={Backpack} title={t("profile.inventoryEmpty")} />
      </section>
    );
  }

  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-fg">
            {t("inventory.title")}
          </h3>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {t("profile.totalItems")}: {formatNumber(inventory.totalItems)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {inventory.truncated ? (
            <Badge variant="amber">{t("inventory.truncated")}</Badge>
          ) : null}
          {inventory.missing.length ? (
            <Badge variant="amber">
              {t("inventory.missingCount", {
                available: inventory.availableContainers,
                total: inventory.totalContainers,
              })}
            </Badge>
          ) : null}
        </div>
      </div>

      <label className="mb-4 flex items-center gap-2 text-xs">
        <Switch
          checked={checked}
          onCheckedChange={(showItemValues) => update({ showItemValues })}
        />
        {t("invValue.toggle")}
      </label>
      {checked && !enabled ? (
        <p className="mb-3 text-xs text-fg-muted">{t("invValue.hidden")}</p>
      ) : null}
      <MissingContainers inventory={inventory} />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <InventoryStat
          label={t("profile.totalItems")}
          value={formatNumber(inventory.totalItems)}
        />
        <InventoryStat
          label={t("inventory.container")}
          value={`${inventory.availableContainers}/${inventory.totalContainers}`}
          tone={inventory.missing.length ? "amber" : "green"}
        />
        <InventoryStat
          label={t("inventory.decoded")}
          value={formatNumber(decodedItems)}
        />
        <InventoryStat
          label={t("inventory.errors", { count: inventory.errors.length })}
          value={formatNumber(inventory.errors.length)}
          tone={inventory.errors.length ? "amber" : "green"}
        />
      </div>

      {inventory.missing.length ? (
        <p className="mb-4 rounded-lg border border-amber/20 bg-amber/[0.04] px-3 py-2 text-[10px] leading-relaxed text-amber/90">
          {t("inventory.partialNote")}
        </p>
      ) : null}

      {enabled && profileId ? (
        <InventoryValues
          member={member}
          profileId={profileId}
          containers={containers}
        >
          {(values) =>
            containers.map((container) => (
              <InventoryContainerGrid
                key={`${member.uuid}:${profileId}:${container.id}`}
                container={container}
                values={values}
              />
            ))
          }
        </InventoryValues>
      ) : (
        containers.map((container) => (
          <InventoryContainerGrid
            key={`${member.uuid}:${profileId}:${container.id}`}
            container={container}
          />
        ))
      )}

      <div className="mt-4 rounded-xl border border-line bg-bg-elevated/40 px-3 py-2 text-[10px] leading-relaxed text-fg-subtle">
        {t("inventory.containerNote")}
      </div>
    </section>
  );
}

function MissingContainers({
  inventory,
}: {
  inventory: ProfileMemberStats["inventory"];
}) {
  const { t } = useI18n();
  const developer = useSettingsStore(
    (state) => DEVELOPER_TOOLS_ENABLED && state.settings.developerMode,
  );
  if (!inventory.missing.length) return null;

  const reason = (value: string) => {
    if (value === "decode-error") return t("inventory.missingReasonDecode");
    if (value === "backpack-limit") return t("inventory.missingReasonLimit");
    return t("inventory.missingReasonMissing");
  };

  return (
    <div className="mb-4 rounded-xl border border-amber/25 bg-amber/[0.05] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-amber">
          <AlertTriangle className="size-3.5" />
          {t("inventory.missingTitle")}
        </p>
        <span className="text-[9.5px] text-amber/80">
          {t("inventory.missingCount", {
            available: inventory.availableContainers,
            total: inventory.totalContainers,
          })}
        </span>
      </div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-fg-muted">
        {t("inventory.missingDesc")}
      </p>
      <ul className="mt-2 space-y-1">
        {inventory.missing.map((entry) => (
          <li
            key={`${entry.id}-${entry.location}`}
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-fg-subtle"
          >
            <span className="font-mono text-fg-muted">{entry.location}</span>
            <span>· {reason(entry.reason)}</span>
            {developer && entry.detail ? (
              <code className="rounded bg-black/30 px-1 py-px font-mono text-[9px] text-fg-subtle">
                {entry.detail}
              </code>
            ) : null}
          </li>
        ))}
      </ul>
      {!developer ? (
        <p className="mt-2 text-[9.5px] text-fg-subtle">
          {t("inventory.missingDevOnly")}
        </p>
      ) : null}
    </div>
  );
}

function fallbackContainer(
  inventory: ProfileMemberStats["inventory"],
): InventoryContainer[] {
  const slots: Array<ProfileMemberStats["inventory"]["items"][number] | null> =
    [...inventory.armor, ...inventory.items];
  return [
    {
      id: "fallback",
      location: "inv_contents",
      size: slots.length,
      slots,
      known: true,
    },
  ];
}

function InventoryContainerGrid({
  container,
  values,
}: {
  container: InventoryContainer;
  values?: Map<string, InventoryValue>;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<ItemTooltipData | null>(null);
  if (!container.known) {
    return (
      <div className="mb-4 rounded-xl border border-amber/20 bg-amber/[0.03] p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber/90">
          <AlertTriangle className="size-3" />
          {containerLabel(container, t)}
        </p>
        <p className="mt-1 text-[10.5px] text-fg-subtle">
          {t("inventory.unknownContainer")}
        </p>
      </div>
    );
  }

  const itemCount = container.slots.filter(Boolean).length;
  if (!itemCount) return null;

  const toTooltip = (
    item: NonNullable<(typeof container.slots)[number]>,
  ): ItemTooltipData => ({
    itemId: item.itemId,
    name: item.name,
    rarity: item.rarity,
    category: item.category,
    material: item.material,
    lore: item.lore,
    loreLines: item.loreLines,
    count: item.count,
    stars: item.stars,
    recombobulated: item.recombobulated,
    hotPotatoBooks: item.hotPotatoBooks,
    fumingPotatoBooks: item.fumingPotatoBooks,
    reforge: item.reforge,
    enchantments: item.enchantments,
    gemstoneSlots: item.gemstoneSlots,
    soulbound: item.soulbound,
    skullTexture: item.skullTexture,
    location: container.location,
    valueInfo: values?.get(`${container.id}:${item.slot}`),
    value: values?.get(`${container.id}:${item.slot}`)?.total,
    valueMethod: values?.get(`${container.id}:${item.slot}`)?.source,
  });

  return (
    <div className="mb-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">
          <Backpack className="size-3 text-violet/80" />
          {containerLabel(container, t)}
        </p>
        <span className="text-[9.5px] text-fg-subtle">
          {t("inventory.itemCount", { count: itemCount })}
        </span>
      </div>
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${containerColumns(container.location)}, minmax(0, 1fr))`,
        }}
      >
        {container.slots.map((item, index) =>
          item ? (
            <ItemSlot
              key={`${container.id}-${item.slot}-${item.itemId}-${index}`}
              item={toTooltip(item)}
              size="sm"
              onClick={() => setSelected(toTooltip(item))}
            />
          ) : (
            <div
              key={`${container.id}-empty-${index}`}
              title={t("inventory.emptySlot")}
              className="aspect-square rounded-[3px] border border-dashed border-white/5 bg-black/20"
            />
          ),
        )}
      </div>
      <ItemDetails
        item={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

function InventoryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "amber" | "green";
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/30 px-2.5 py-1.5">
      <p className="truncate text-[8.5px] uppercase tracking-[0.06em] text-fg-subtle">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono text-[11px] font-semibold",
          tone === "amber"
            ? "text-amber"
            : tone === "green"
              ? "text-green"
              : "text-fg",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function containerColumns(location: string): number {
  if (location === "inv_armor" || location === "equipment_contents") {
    return 4;
  }
  return 9;
}

function containerLabel(
  container: InventoryContainer,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  if (container.location.startsWith("backpack:")) {
    const index = Number(container.location.split(":")[1] ?? 0) + 1;
    return t("inventory.backpack", { index });
  }
  switch (container.location) {
    case "inv_contents":
      return t("inventory.main");
    case "inv_armor":
      return t("inventory.armor");
    case "equipment_contents":
      return t("inventory.equipment");
    case "ender_chest_contents":
      return t("inventory.enderChest");
    case "wardrobe_contents":
      return t("inventory.wardrobe");
    case "accessory_bag":
      return t("inventory.accessoryBag");
    case "vault":
      return t("inventory.vault");
    default:
      return container.location.replaceAll("_", " ");
  }
}

function CollectionsPanel({ member }: { member: ProfileMemberStats | null }) {
  const { t } = useI18n();
  if (!member) return null;
  if (!member.collections.length) {
    return (
      <section className="panel">
        <EmptyState icon={Boxes} title={t("profile.noCollections")} />
      </section>
    );
  }
  const max = member.collections[0]?.amount ?? 1;
  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-fg">
          {t("profile.collections")}
        </h3>
        {member.collectionCount != null ? (
          <span className="text-[10.5px] text-fg-subtle">
            {t("profile.collectionsCount", { count: member.collectionCount })}
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {member.collections.map((collection) => (
          <div
            key={collection.id}
            className="rounded-xl border border-line bg-surface-2/30 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11.5px] font-medium text-fg">
                {collection.name}
              </span>
              <span className="font-mono text-[10.5px] text-fg-muted">
                {formatCompact(collection.amount)}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan/70 to-violet"
                style={{
                  width: `${Math.max(3, (collection.amount / max) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <InfoNote className="mt-4">{t("profile.privacyNote")}</InfoNote>
    </section>
  );
}
