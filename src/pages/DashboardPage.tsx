import { MarketOverviewPanel } from "@/components/common/MarketWidgets";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Calculator,
  Coins,
  Landmark,
  LineChart,
  Search,
  Sparkles,
  Star,
  Store,
  Swords,
  TrendingUp,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useConnectedProfile } from "@/hooks/usePlayer";
import { useBazaar } from "@/hooks/useBazaar";
import { useSettingsStore } from "@/stores/settings";
import { openLinkAccount } from "@/stores/account-dialog";
import { useWatchlistStore } from "@/stores/watchlist";
import { useI18n, type TranslationKey } from "@/locales";
import { formatCoins, formatPercent, formatPrice, formatTime, timeAgo } from "@/utils/format";
import { topOpportunities } from "@/features/bazaar/calculations";
import { errorMessageKey } from "@/api/errors";
import { PageHeader, SectionHeading } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ApiKeyNotice, EmptyState, ErrorState } from "@/components/common/States";
import { ItemGlyph } from "@/components/common/ItemVisuals";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonStat } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";

export function DashboardPage() {
  const { t, language } = useI18n();
  const settings = useSettingsStore((state) => state.settings);
  const watchlist = useWatchlistStore((state) => state.entries);
  const profile = useConnectedProfile();
  const bazaar = useBazaar();

  const member = profile.profile?.member;
  const hide = settings.hideBalances;
  const opportunities = useMemo(() => topOpportunities(bazaar.quotes, 6), [bazaar.quotes]);
  const watchQuotes = useMemo(
    () =>
      watchlist
        .map((entry) => bazaar.quotes.find((quote) => quote.productId === entry.productId))
        .filter((quote): quote is NonNullable<typeof quote> => Boolean(quote))
        .slice(0, 5),
    [watchlist, bazaar.quotes],
  );

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? "dashboard.greetingMorning" : hour < 18 ? "dashboard.greetingAfternoon" : "dashboard.greetingEvening";
  const linked = profile.linked;
  const missingKey = profile.error ? errorMessageKey(profile.error) === "errors.missingKey" : false;

  return (
    <div className="animate-[fade-up_260ms_ease-out]">
      <Link className="mb-3 inline-flex items-center gap-2 text-sm text-violet" to="/intelligence">{t("intel.title")} <ArrowRight className="size-3" /></Link>
      <PageHeader
        eyebrow={
          <>
            <Sparkles className="size-3" /> {greetingKey === "dashboard.greetingMorning" ? t("dashboard.greetingMorning") : t(greetingKey)}
          </>
        }
        title={linked ? t("dashboard.welcomeBack", { name: linked.name }) : t("dashboard.welcomeGuest")}
        description={t("dashboard.subtitle")}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openLinkAccount({ mode: "link", redirect: "/" })}
            >
              <UserPlus className="size-3.5" /> {t("dashboard.connectProfile")}
            </Button>
            <Button asChild size="sm">
              <Link to="/bazaar">
                <Store className="size-3.5" /> {t("nav.bazaar")}
              </Link>
            </Button>
          </>
        }
      />

      <MarketOverviewPanel />

      <section className="hero-mesh panel relative mb-5 overflow-hidden p-5 sm:p-6">
        <div className="grid-texture pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative grid gap-6 xl:grid-cols-[1.25fr_1fr]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-violet/25 bg-violet-soft px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-violet">
                <UserRound className="size-3" /> {linked ? t("dashboard.linkedProfile") : t("dashboard.profileStatus")}
              </span>
              {profile.demo ? (
                <Badge variant="amber">{t("common.demo")}</Badge>
              ) : profile.profile?.gameMode && profile.profile.gameMode !== "normal" ? (
                <Badge variant="violet">{t(`profile.${profile.profile.gameMode}` as TranslationKey)}</Badge>
              ) : null}
              {profile.profile?.isCoop ? (
                <Badge variant="cyan">{t("profile.coopMembers", { count: profile.profile.coopMemberCount })}</Badge>
              ) : null}
            </div>

            {!linked ? (
              <div className="mt-5 flex flex-wrap items-center gap-5">
                <div className="flex size-14 items-center justify-center rounded-2xl border border-line-strong bg-surface-2/80 text-fg-subtle">
                  <UserPlus className="size-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-fg">
                    {t("account.requiredTitle")}
                  </h2>
                  <p className="mt-1 max-w-md text-[12px] leading-relaxed text-fg-muted">
                    {t("account.requiredDesc")}
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => openLinkAccount({ mode: "link", redirect: "/" })}
                  >
                    <UserPlus className="size-3.5" /> {t("account.link")}
                  </Button>
                </div>
              </div>
            ) : profile.isPending ? (
              <div className="mt-5 flex items-center gap-4">
                <Skeleton className="size-14 rounded-2xl" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ) : profile.error ? (
              <div className="mt-4">
                {missingKey ? (
                  <ApiKeyNotice />
                ) : (
                  <ErrorState error={profile.error} onRetry={() => void profile.refresh()} compact title={t("dashboard.profileLoadError")} />
                )}
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-start gap-4 sm:flex-nowrap">
                <div className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl border border-violet/30 bg-gradient-to-br from-violet/35 to-cyan/20 text-[21px] font-semibold uppercase text-white">
                  {linked.name.slice(0, 1)}
                  <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-surface bg-violet text-[9px] font-bold">
                    {member?.skyblockLevel ?? "?"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <h2 className="truncate text-[21px] font-semibold tracking-[-0.025em] text-fg">{linked.name}</h2>
                    <span className="text-[12px] text-fg-subtle">{profile.profile?.cuteName ?? linked.profileName ?? "SkyBlock"}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-muted">
                    <span>{t("profile.skyblockLevel")} <b className="font-semibold text-fg">{member?.skyblockLevel ?? "—"}</b></span>
                    <span>{t("profile.skillAverage")} <b className="font-semibold text-fg">{member?.skillAverage?.toFixed(1) ?? "—"}</b></span>
                    <span className="text-fg-subtle">{profile.profile?.lastSave ? timeAgo(profile.profile.lastSave, language) : "—"}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/profile">
                        {t("dashboard.viewAll")} <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                    {!profile.demo ? (
                      <Button size="sm" variant="ghost" onClick={() => void profile.refresh()}>
                        {t("common.refresh")}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface/60 px-2.5 py-1.5 text-[10.5px] text-fg-subtle sm:flex">
                  <span className="size-1.5 rounded-full bg-violet" />
                  {t("profile.skyblockXp")}: <span className="font-mono text-fg-muted">{member?.skyblockXp?.toLocaleString(language === "ru" ? "ru-RU" : "en-US") ?? "—"}</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 self-center sm:grid-cols-3 xl:grid-cols-2">
            <HeroMetric label={t("dashboard.purse")} value={hide ? "•••" : formatCoins(member?.purse, language)} icon={Coins} loading={profile.isPending && Boolean(linked)} unavailable={!member} />
            <HeroMetric label={t("dashboard.bank")} value={hide ? "•••" : formatCoins(member?.bank, language)} icon={Landmark} loading={profile.isPending && Boolean(linked)} unavailable={!member} />
            <HeroMetric
              label={t("dashboard.skyblockLevel")}
              value={member?.skyblockLevel ?? "—"}
              icon={Sparkles}
              loading={profile.isPending && Boolean(linked)}
              unavailable={!member}
              hint={member?.skyblockLevel != null ? `${Math.round(member.skyblockLevelProgress * 100)}% ${t("profile.nextLevel").toLowerCase()}` : undefined}
            />
            <HeroMetric
              label={t("dashboard.catacombs")}
              value={member?.dungeons?.catacombsLevel ?? "—"}
              icon={Swords}
              loading={profile.isPending && Boolean(linked)}
              unavailable={!member?.dungeons}
              hint={member?.dungeons ? t("profile.levelShort", { level: member.dungeons.catacombsLevel }) : undefined}
            />
          </div>
        </div>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {profile.isPending && linked ? (
          Array.from({ length: 5 }).map((_, index) => <SkeletonStat key={index} />)
        ) : (
          <>
            <StatCard
              label={t("dashboard.skyblockLevel")}
              value={member?.skyblockLevel ?? "—"}
              hint={member ? t("profile.skyblockXp") + `: ${member.skyblockXp?.toLocaleString() ?? "—"}` : t("dashboard.noStats")}
              icon={Sparkles}
              tone="violet"
              unavailable={!member}
            />
            <StatCard
              label={t("dashboard.purse")}
              value={hide ? "•••" : formatCoins(member?.purse, language)}
              hint={t("profile.purse")}
              icon={Coins}
              tone="amber"
              unavailable={!member || member.purse == null}
            />
            <StatCard
              label={t("dashboard.bank")}
              value={hide ? "•••" : formatCoins(member?.bank, language)}
              hint={t("profile.bank")}
              icon={Landmark}
              tone="cyan"
              unavailable={!member || member.bank == null}
            />
            <StatCard
              label={t("dashboard.catacombs")}
              value={member?.dungeons ? t("profile.levelShort", { level: member.dungeons.catacombsLevel }) : "—"}
              hint={member?.dungeons ? `${t("profile.dungeons")} · ${member.dungeons.classes.length}` : t("profile.noDungeons")}
              icon={Swords}
              tone="red"
              unavailable={!member?.dungeons}
            />
            <StatCard
              label={t("dashboard.skillAvg")}
              value={member?.skillAverage?.toFixed(1) ?? "—"}
              hint={member?.skillsAvailable ? t("profile.skills") : t("profile.skillsUnavailable")}
              icon={TrendingUp}
              tone="green"
              unavailable={!member || member.skillAverage == null}
            />
          </>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
              <div>
                <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] text-fg">
                  <Store className="size-4 text-violet" /> {t("dashboard.bazaar")}
                </h2>
                <p className="mt-0.5 text-[11.5px] text-fg-muted">{t("dashboard.bazaarDesc")}</p>
              </div>
              <div className="flex items-center gap-2">
                {bazaar.demo ? <Badge variant="amber">{t("common.demo")}</Badge> : null}
                {bazaar.envelope?.source === "cache" ? <Badge variant="outline">{t("common.stale")}</Badge> : null}
                <Link to="/bazaar" className="inline-flex items-center gap-1 text-[11px] font-medium text-violet hover:underline">
                  {t("dashboard.viewAll")} <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>

            {bazaar.isPending ? (
              <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-xl border border-line bg-surface-2/40 p-3">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="mt-3 h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : bazaar.error ? (
              <ErrorState error={bazaar.error} onRetry={() => void bazaar.refresh()} compact title={t("dashboard.bazaarUnavailable")} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
                  <MiniStat label={t("dashboard.products")} value={bazaar.summary.productCount.toLocaleString()} />
                  <MiniStat label={t("dashboard.medianSpread")} value={bazaar.summary.medianSpreadPct != null ? formatPercent(bazaar.summary.medianSpreadPct) : "—"} tone="green" />
                  <MiniStat label={t("dashboard.topOpportunity")} value={bazaar.summary.topGainer ? formatPercent(bazaar.summary.topGainer.spreadPct) : "—"} tone="violet" />
                  <MiniStat
                    label={t("common.updated")}
                    value={bazaar.envelope ? timeAgo(bazaar.envelope.updatedAt, language) : "—"}
                    hint={bazaar.envelope ? formatTime(bazaar.envelope.updatedAt, language) : undefined}
                  />
                </div>

                <p className="px-5 pb-1 pt-2 text-[10px] text-fg-subtle">{t("dashboard.marketNote")}</p>
                <div className="mt-1 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[11.5px]">
                    <thead>
                      <tr className="border-y border-line bg-surface-2/30 text-[9.5px] uppercase tracking-[0.08em] text-fg-subtle">
                        <th className="px-5 py-2 font-medium">{t("common.name")}</th>
                        <th className="px-2 py-2 text-right font-medium">{t("bazaar.instantBuy")}</th>
                        <th className="px-2 py-2 text-right font-medium">{t("bazaar.instantSell")}</th>
                        <th className="px-2 py-2 text-right font-medium">{t("bazaar.spreadPct")}</th>
                        <th className="px-5 py-2 text-right font-medium">{t("bazaar.potential")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opportunities.length ? (
                        opportunities.map((quote) => {
                          const potential = quote.instantSell > 0 ? ((quote.instantBuy * (1 - bazaar.feePct / 100) - quote.instantSell) / quote.instantSell) * 100 : 0;
                          return (
                            <tr key={quote.productId} className="group border-b border-line/60 transition-colors last:border-0 hover:bg-surface-2/40">
                              <td className="px-5 py-2.5">
                                <Link to={`/bazaar?item=${encodeURIComponent(quote.productId)}`} className="flex items-center gap-2.5">
                                  <ItemGlyph name={quote.name} tier={quote.tier} size="sm" itemId={quote.productId} category={quote.category} />
                                  <span className="min-w-0">
                                    <span className="block max-w-[240px] truncate font-medium text-fg group-hover:text-violet">{quote.name}</span>
                                    <span className="block font-mono text-[9px] text-fg-subtle">{quote.productId}</span>
                                  </span>
                                </Link>
                              </td>
                              <td className="px-2 py-2.5 text-right font-mono text-fg-muted">{formatPrice(quote.instantBuy)}</td>
                              <td className="px-2 py-2.5 text-right font-mono text-fg-muted">{formatPrice(quote.instantSell)}</td>
                              <td className="px-2 py-2.5 text-right font-mono text-green">{formatPercent(quote.spreadPct)}</td>
                              <td className="px-5 py-2.5 text-right font-mono font-medium text-green">{formatPercent(potential)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5}>
                            <EmptyState compact icon={BarChart3} title={t("bazaar.noResults")} />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="panel p-5">
            <SectionHeading
              title={t("dashboard.watchlist")}
              description={t("dashboard.watchlistCount", { count: watchlist.length })}
              actions={
                <Link to="/watchlist" className="inline-flex items-center gap-1 text-[11px] font-medium text-violet hover:underline">
                  {t("dashboard.viewAll")} <ArrowRight className="size-3" />
                </Link>
              }
            />
            {watchQuotes.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {watchQuotes.map((quote) => {
                  const entry = watchlist.find((item) => item.productId === quote.productId);
                  const hit = entry?.targetPrice != null && quote.instantSell <= entry.targetPrice;
                  return (
                    <Link
                      key={quote.productId}
                      to={`/watchlist`}
                      className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/30 p-2.5 transition-colors hover:border-line-strong hover:bg-surface-2/60"
                    >
                      <ItemGlyph name={quote.name} tier={quote.tier} size="sm" itemId={quote.productId} category={quote.category} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] font-medium text-fg">{quote.name}</span>
                        <span className="block text-[10px] text-fg-subtle">{formatPrice(quote.instantSell)} · {formatPercent(quote.spreadPct)}</span>
                      </span>
                      {hit ? <Badge variant="green">{t("watchlist.targetReached")}</Badge> : <Star className="size-3.5 text-fg-subtle" />}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                compact
                icon={Star}
                title={t("dashboard.watchlistEmpty")}
                description={t("dashboard.watchlistEmptyDesc")}
                action={
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/bazaar">{t("watchlist.addFromBazaar")}</Link>
                  </Button>
                }
              />
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="panel p-5">
            <SectionHeading title={t("dashboard.quickActions")} />
            <div className="grid grid-cols-2 gap-2.5">
              <QuickAction to="/profile" icon={Search} label={t("dashboard.searchPlayer")} tone="violet" />
              <QuickAction to="/bazaar" icon={Store} label={t("dashboard.openBazaar")} tone="cyan" />
              <QuickAction to="/calculators" icon={Calculator} label={t("dashboard.openCalculators")} tone="green" />
              <QuickAction to="/progression" icon={LineChart} label={t("nav.progression")} tone="amber" />
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5">
              <div>
                <h2 className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                  <ArrowUpRight className="size-4 text-green" /> {t("bazaar.topMovers")}
                </h2>
                <p className="mt-0.5 text-[11px] text-fg-muted">{t("bazaar.potentialExplain")}</p>
              </div>
              <Link to="/bazaar" className="text-[11px] font-medium text-violet hover:underline">
                {t("dashboard.viewAll")}
              </Link>
            </div>
            <div className="mt-4 divide-y divide-line border-t border-line">
              {opportunities.slice(0, 5).map((quote, index) => (
                <Link
                  key={quote.productId}
                  to={`/bazaar?item=${encodeURIComponent(quote.productId)}`}
                  className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2/40"
                >
                  <span className="w-4 font-mono text-[10px] text-fg-subtle">{String(index + 1).padStart(2, "0")}</span>
                  <ItemGlyph name={quote.name} tier={quote.tier} size="sm" itemId={quote.productId} category={quote.category} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-medium text-fg">{quote.name}</span>
                    <span className="block text-[10px] text-fg-subtle">{formatPrice(quote.instantSell)} → {formatPrice(quote.instantBuy)}</span>
                  </span>
                  <span className="font-mono text-[11.5px] font-semibold text-green">{formatPercent(quote.spreadPct)}</span>
                </Link>
              ))}
              {!opportunities.length && !bazaar.isPending ? (
                <EmptyState compact icon={BarChart3} title={t("bazaar.noResults")} />
              ) : null}
            </div>
          </section>

          {profile.profile?.member ? (
            <section className="panel p-5">
              <SectionHeading title={t("profile.skills")} description={t("profile.skillAverage")} />
              <div className="space-y-2.5">
                {profile.profile.member.skills.slice(0, 5).map((skill) => (
                  <div key={skill.id}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-fg-muted">{skill.name}</span>
                      <span className="font-mono text-fg-subtle">
                        {skill.level}
                        <span className="text-fg-subtle/60">/{skill.maxLevel}</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet to-cyan" style={{ width: `${Math.min(100, skill.progress * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <Button asChild variant="ghost" size="sm" className="mt-3 w-full">
                <Link to="/progression">
                  {t("progression.title")} <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  unavailable,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: typeof Coins;
  loading?: boolean;
  unavailable?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg-elevated/55 px-3 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.08em] text-fg-subtle">
        <Icon className="size-3" /> {label}
      </div>
      {loading ? (
        <div className="mt-1.5 h-5 w-20 animate-pulse rounded bg-surface-3" />
      ) : unavailable ? (
        <p className="mt-1.5 text-[12px] italic text-fg-subtle">—</p>
      ) : (
        <p className="mt-1 truncate text-[17px] font-semibold tracking-[-0.02em] text-fg tabular-nums">{value}</p>
      )}
      {hint && !unavailable ? <p className="mt-0.5 truncate text-[9.5px] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

function MiniStat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "green" | "violet" }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/35 px-3 py-2.5">
      <p className="text-[9.5px] uppercase tracking-[0.08em] text-fg-subtle">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-mono text-[15px] font-semibold tabular-nums",
          tone === "green" ? "text-green" : tone === "violet" ? "text-violet" : "text-fg",
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-[9px] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, tone }: { to: string; icon: typeof Search; label: string; tone: "violet" | "cyan" | "green" | "amber" }) {
  const tones = {
    violet: "border-violet/20 bg-violet-soft text-violet hover:bg-violet/20",
    cyan: "border-cyan/20 bg-cyan/10 text-cyan hover:bg-cyan/15",
    green: "border-green/20 bg-green/10 text-green hover:bg-green/15",
    amber: "border-amber/20 bg-amber/10 text-amber hover:bg-amber/15",
  };
  return (
    <Link
      to={to}
      className={cn("flex flex-col gap-2 rounded-xl border p-3 transition-colors", tones[tone])}
    >
      <Icon className="size-4" />
      <span className="text-[11px] font-medium leading-tight text-fg">{label}</span>
    </Link>
  );
}
