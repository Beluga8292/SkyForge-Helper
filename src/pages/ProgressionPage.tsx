import { Link } from "react-router-dom";
import { ArrowRight, Coins, Compass, Landmark, LineChart, RefreshCw, Sparkles, Swords, Target, TrendingUp } from "lucide-react";
import { useI18n } from "@/locales";
import { useConnectedProfile } from "@/hooks/usePlayer";
import { useSettingsStore } from "@/stores/settings";
import { ApiError, errorMessageKey } from "@/api/errors";
import { formatCoins, formatCompact, formatNumber } from "@/utils/format";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ApiKeyNotice, DemoNote, EmptyState, ErrorState, InfoNote } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import { openLinkAccount } from "@/stores/account-dialog";
import { LinkAccountPrompt } from "@/components/account/LinkAccountPrompt";
import type { ProfileMemberStats } from "@/types/profile";

export function ProgressionPage() {
  const { t, language } = useI18n();
  const profile = useConnectedProfile();
  const hideBalances = useSettingsStore((state) => state.settings.hideBalances);
  const member = profile.profile?.member;
  const missingKey = profile.error instanceof ApiError && errorMessageKey(profile.error) === "errors.missingKey";

  return (
    <div className="animate-[fade-up_260ms_ease-out]">
      <Link className="mb-3 inline-flex items-center gap-2 text-sm text-violet" to="/intelligence">{t("intel.title")} <ArrowRight className="size-3" /></Link>
      <PageHeader
        eyebrow={
          <>
            <LineChart className="size-3" /> {t("nav.progression")}
          </>
        }
        title={t("progression.title")}
        description={t("progression.subtitle")}
        actions={
          <>
            {profile.demo ? <Badge variant="amber">{t("common.demo")}</Badge> : null}
            {profile.linked ? (
              <Button size="sm" variant="secondary" onClick={() => void profile.refresh()} disabled={profile.isFetching || profile.demo}>
                <RefreshCw className={cn("size-3.5", profile.isFetching && "animate-spin")} /> {t("common.refresh")}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => openLinkAccount({ mode: "link", redirect: "/progression" })}
              >
                <Compass className="size-3.5" /> {t("progression.connect")}
              </Button>
            )}
          </>
        }
      />

      {!profile.linked ? (
        <LinkAccountPrompt redirect="/progression" icon={Compass} />
      ) : profile.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </div>
      ) : profile.error ? (
        <section className="panel p-5">
          {missingKey ? <ApiKeyNotice /> : <ErrorState error={profile.error} onRetry={() => void profile.refresh()} title={t("progression.title")} />}
        </section>
      ) : member ? (
        <>
          <section className="hero-mesh panel mb-4 overflow-hidden p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-violet/30 bg-violet-soft text-violet">
                  <TrendingUp className="size-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-fg">{profile.linked?.name}</h2>
                    <Badge variant="violet">{t("profile.levelShort", { level: member.skyblockLevel ?? "—" })}</Badge>
                    {profile.demo ? <Badge variant="amber">{t("common.demo")}</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[11px] text-fg-muted">
                    {t("progression.coopNote", { name: profile.linked?.name ?? "", profile: profile.profile?.cuteName ?? "SkyBlock" })}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-right">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.08em] text-fg-subtle">{t("profile.skyblockLevel")}</p>
                  <p className="font-mono text-[20px] font-semibold text-violet">{member.skyblockLevel ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.08em] text-fg-subtle">{t("profile.skillAverage")}</p>
                  <p className="font-mono text-[20px] font-semibold text-fg">{member.skillAverage?.toFixed(1) ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.08em] text-fg-subtle">{t("profile.catacombs")}</p>
                  <p className="font-mono text-[20px] font-semibold text-red">{member.dungeons?.catacombsLevel ?? "—"}</p>
                </div>
              </div>
            </div>
            {profile.demo ? <DemoNote className="mt-4">{t("profile.demoNote")}</DemoNote> : null}
          </section>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label={t("profile.skills")}
              value={member.skills.length ? formatNumber(member.skills.reduce((sum, skill) => sum + skill.level, 0)) : "—"}
              hint={`${member.skills.filter((skill) => skill.maxed).length} ${t("profile.skillMaxed").toLowerCase()}`}
              icon={Sparkles}
              tone="violet"
              unavailable={!member.skills.length}
            />
            <StatCard
              label={t("profile.skillAverage")}
              value={member.skillAverage?.toFixed(2) ?? "—"}
              hint={t("profile.skills")}
              icon={TrendingUp}
              tone="green"
              unavailable={member.skillAverage == null}
            />
            <StatCard
              label={t("profile.slayers")}
              value={formatCompact(member.slayerTotalXp ?? 0)}
              hint={`${member.slayers.length} ${t("progression.slayerProgress")}`}
              icon={Target}
              tone="red"
              unavailable={!member.slayers.length}
            />
            <StatCard
              label={t("profile.catacombs")}
              value={member.dungeons?.catacombsLevel ?? "—"}
              hint={member.dungeons?.highestTier != null ? `F${member.dungeons.highestTier}` : t("profile.noDungeons")}
              icon={Swords}
              tone="amber"
              unavailable={!member.dungeons}
            />
            <StatCard
              label={t("dashboard.purse")}
              value={hideBalances ? "•••" : formatCoins(member.purse, language)}
              hint={t("profile.purse")}
              icon={Coins}
              tone="neutral"
              unavailable={member.purse == null}
            />
            <StatCard
              label={t("profile.bank")}
              value={hideBalances ? "•••" : formatCoins(member.bank, language)}
              hint={t("profile.bank")}
              icon={Landmark}
              tone="cyan"
              unavailable={member.bank == null}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Skills member={member} />
            <Slayers member={member} />
          </div>

          <div className="mt-4">
            <Dungeons member={member} />
          </div>

          <section className="mt-4 rounded-xl border border-violet/20 bg-violet-soft/40 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                  <Sparkles className="size-4 text-violet" /> {t("progression.roadmapTitle")}
                </p>
                <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-fg-muted">{t("progression.roadmapDesc")}</p>
              </div>
              <Badge variant="violet">Stage 6</Badge>
            </div>
          </section>

          <InfoNote className="mt-4">{t("profile.privacyNote")}</InfoNote>
        </>
      ) : (
        <section className="panel">
          <EmptyState icon={LineChart} title={t("progression.noProfile")} description={t("profile.noProfilesDesc")} />
        </section>
      )}
    </div>
  );
}

function Skills({ member }: { member: ProfileMemberStats }) {
  const { t } = useI18n();
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-fg">{t("progression.skillsProgress")}</h3>
          <p className="mt-0.5 text-[11px] text-fg-muted">{t("progression.skillNote")}</p>
        </div>
        {!member.skillsAvailable ? <Badge variant="amber">{t("profile.skillsUnavailable")}</Badge> : null}
      </div>
      {member.skills.length ? (
        <div className="space-y-3.5">
          {member.skills.map((skill) => (
            <div key={skill.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-fg-muted">{skill.name}</span>
                <span className="font-mono text-[10px] text-fg-subtle">
                  <b className="text-fg">{skill.level}</b> / {skill.maxLevel} · {formatPercentValue(skill.progress)}
                </span>
              </div>
              <Progress value={skill.progress * 100} className="h-1.5" indicatorClassName={skill.maxed ? "bg-amber" : undefined} />
              <div className="mt-1 flex justify-between font-mono text-[9px] text-fg-subtle">
                <span>{formatCompact(skill.xp)} XP</span>
                <span>{skill.maxed ? t("progression.maxed") : skill.nextLevelXp ? `${t("progression.nextLevel")}: ${formatCompact(skill.nextLevelXp)}` : "—"}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState compact icon={Sparkles} title={t("progression.noSkills")} />
      )}
    </section>
  );
}

function Slayers({ member }: { member: ProfileMemberStats }) {
  const { t } = useI18n();
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-fg">{t("progression.slayerProgress")}</h3>
          <p className="mt-0.5 text-[11px] text-fg-muted">{t("progression.slayerNote")}</p>
        </div>
        <Badge variant="red">{formatCompact(member.slayerTotalXp ?? 0)} XP</Badge>
      </div>
      {member.slayers.length ? (
        <div className="space-y-3">
          {member.slayers.map((slayer) => {
            const kills = Object.values(slayer.kills).reduce((sum, value) => sum + value, 0);
            return (
              <div key={slayer.id} className="rounded-xl border border-line bg-surface-2/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[11.5px] font-medium text-fg">
                    <span className="flex size-7 items-center justify-center rounded-lg border border-red/25 bg-red/10 font-mono text-[10px] font-bold text-red">
                      {slayer.level}
                    </span>
                    {slayer.name}
                  </span>
                  <span className="font-mono text-[10px] text-fg-subtle">{formatCompact(slayer.xp)} XP</span>
                </div>
                <Progress value={slayer.progress * 100} className="mt-2 h-1.5" indicatorClassName="bg-red" />
                <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[9.5px] text-fg-subtle">
                  <span>{t("profile.totalKills")}: {formatNumber(kills)}</span>
                  <span>{slayer.level >= slayer.maxLevel ? t("progression.maxed") : slayer.nextLevelXp ? `${t("progression.nextLevel")}: ${formatCompact(slayer.nextLevelXp)}` : "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState compact icon={Target} title={t("progression.noSlayers")} />
      )}
    </section>
  );
}

function Dungeons({ member }: { member: ProfileMemberStats }) {
  const { t } = useI18n();
  const dungeons = member.dungeons;
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-fg">{t("progression.dungeonProgress")}</h3>
          <p className="mt-0.5 text-[11px] text-fg-muted">{t("profile.classLevels")}</p>
        </div>
        <div className="flex items-center gap-2">
          {dungeons?.highestTier != null ? <Badge variant="red">F{dungeons.highestTier}</Badge> : null}
          {dungeons?.masterHighestTier != null ? <Badge variant="amber">M{dungeons.masterHighestTier}</Badge> : null}
        </div>
      </div>
      {dungeons ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-xl border border-line bg-surface-2/30 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[12px] font-medium text-fg">
                <Swords className="size-4 text-red" /> {t("profile.catacombs")}
              </span>
              <span className="font-mono text-[12px] font-semibold text-red">{dungeons.catacombsLevel}</span>
            </div>
            <Progress value={dungeons.catacombsProgress * 100} className="mt-3 h-2" indicatorClassName="bg-red" />
            <div className="mt-2 flex justify-between font-mono text-[10px] text-fg-subtle">
              <span>{formatCompact(dungeons.catacombsXp)} XP</span>
              {dungeons.catacombsNextXp ? <span>{formatCompact(dungeons.catacombsNextXp)} XP</span> : null}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {dungeons.classes.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-line bg-surface-2/25 p-2.5">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-fg-muted">{entry.name}</span>
                  <span className="font-mono font-semibold text-fg">{entry.level}</span>
                </div>
                <Progress value={entry.progress * 100} className="mt-1.5 h-1" indicatorClassName="bg-violet" />
                <p className="mt-1 font-mono text-[8.5px] text-fg-subtle">{formatCompact(entry.xp)} XP</p>
              </div>
            ))}
            {!dungeons.classes.length ? <p className="text-[10.5px] text-fg-subtle">{t("profile.noDungeons")}</p> : null}
          </div>
        </div>
      ) : (
        <EmptyState compact icon={Swords} title={t("progression.noDungeons")} />
      )}
    </section>
  );
}

function formatPercentValue(value: number): string {
  return `${Math.round(value * 100)}%`;
}
