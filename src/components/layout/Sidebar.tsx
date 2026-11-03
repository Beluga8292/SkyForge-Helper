import { Link, NavLink } from "react-router-dom";
import {
  Calculator,
  BarChart3,
  Coins,
  Gavel,
  Gem,
  LayoutDashboard,
  LineChart,
  Settings,
  Star,
  Store,
  UserRound,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
  KeyRound,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useI18n, type TranslationKey } from "@/locales";
import { useWatchlistStore } from "@/stores/watchlist";
import { Tooltip } from "@/components/ui/tooltip";
import { SidebarAccount } from "@/components/account/SidebarAccount";

interface NavEntry {
  to: string;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
  end?: boolean;
  count?: number;
}

const SECTIONS: Array<{
  titleKey: TranslationKey;
  entries: Omit<NavEntry, "count">[];
}> = [
  {
    titleKey: "nav.section.account",
    entries: [
      { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, end: true },
      { to: "/profile", labelKey: "nav.profile", icon: UserRound },
      { to: "/networth", labelKey: "nav.networth", icon: Coins },
      { to: "/intelligence", labelKey: "intel.title", icon: UserRound },
      { to: "/equipment", labelKey: "advisor.title", icon: Gem },
      { to: "/dungeons", labelKey: "dp.title", icon: Gem },
      { to: "/progression", labelKey: "nav.progression", icon: LineChart },
    ],
  },
  {
    titleKey: "nav.section.view",
    entries: [
      { to: "/view", labelKey: "nav.viewPlayer", icon: Users },
    ],
  },
  {
    titleKey: "nav.section.analytics",
    entries: [
      { to: "/flips", labelKey: "nav.flips", icon: BarChart3 },
      { to: "/bazaar", labelKey: "nav.bazaar", icon: Store },
      { to: "/auction", labelKey: "nav.auction", icon: Gavel },
      { to: "/watchlist", labelKey: "nav.watchlist", icon: Star },
    ],
  },
  {
    titleKey: "nav.section.tools",
    entries: [
      { to: "/calculators", labelKey: "nav.calculators", icon: Calculator },
      { to: "/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
];

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { t } = useI18n();
  const watchCount = useWatchlistStore((state) => state.entries.length);

  const nav = (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex items-center gap-2.5 px-4 pb-4 pt-5",
          collapsed && "justify-center px-2",
        )}
      >
        <Link
          to="/"
          onClick={onCloseMobile}
          className="flex min-w-0 items-center gap-2.5 outline-none focus-visible:outline-2 focus-visible:outline-violet"
        >
          <span className="brand-glow flex size-8 shrink-0 items-center justify-center rounded-xl border border-violet/30 bg-violet-soft">
            <Gem className="size-4 text-violet" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold tracking-[-0.01em] text-fg">
                SkyForge
              </span>
              <span className="block truncate text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle">
                Helper
              </span>
            </span>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={onCloseMobile}
          className="ml-auto flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg lg:hidden"
          aria-label={t("common.close")}
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 pb-4 hide-scrollbar">
        {SECTIONS.map((section) => (
          <div key={section.titleKey}>
            {!collapsed ? (
              <p className="px-2 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
                {t(section.titleKey)}
              </p>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-line" />
            )}
            {section.titleKey === "nav.section.account" ? (
              <SidebarAccount collapsed={collapsed} onNavigate={onCloseMobile} />
            ) : null}
            <div className="space-y-0.5">
              {section.entries.map((entry) => (
                <SidebarLink
                  key={entry.to}
                  entry={{
                    ...entry,
                    count: entry.to === "/watchlist" ? watchCount : undefined,
                  }}
                  collapsed={collapsed}
                  onNavigate={onCloseMobile}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-line p-2.5", collapsed && "px-1.5")}>
        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn(
            "hidden w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg lg:flex",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
          {!collapsed ? <span>{t("nav.collapse")}</span> : null}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "relative z-30 hidden shrink-0 border-r border-line bg-surface/40 backdrop-blur-md transition-[width] duration-200 lg:block",
          collapsed ? "w-[68px]" : "w-[236px]",
        )}
      >
        {nav}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="absolute inset-y-0 left-0 w-[270px] animate-[fade-in_160ms_ease-out] border-r border-line-strong bg-surface shadow-2xl">
            {nav}
          </aside>
        </div>
      ) : null}
    </>
  );
}

function SidebarLink({
  entry,
  collapsed,
  onNavigate,
}: {
  entry: NavEntry;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const { t } = useI18n();
  const Icon = entry.icon;

  const link = (
    <NavLink
      to={entry.to}
      end={entry.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] font-medium text-fg-muted outline-none transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-violet",
          isActive &&
            "bg-violet-soft text-fg shadow-[inset_0_0_0_1px_rgba(139,92,246,0.16)]",
          collapsed && "justify-center px-0",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span className="absolute left-0 top-2 h-5 w-0.5 rounded-r-full bg-violet" />
          ) : null}
          <Icon
            className={cn(
              "size-4 shrink-0",
              isActive
                ? "text-violet"
                : "text-fg-subtle group-hover:text-fg-muted",
            )}
          />
          {!collapsed ? (
            <span className="flex-1 truncate">{t(entry.labelKey)}</span>
          ) : null}
          {!collapsed && entry.count ? (
            <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-fg-muted">
              {entry.count}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );

  if (!collapsed) return link;
  return (
    <Tooltip content={t(entry.labelKey)} side="right">
      {link}
    </Tooltip>
  );
}

export function KeyStatusPill({ configured }: { configured: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1.5 text-[10.5px] text-fg-subtle">
      <KeyRound
        className={cn("size-3", configured ? "text-green" : "text-amber")}
      />
      {configured ? t("settings.apiKeyStored") : t("settings.apiKeyMissing")}
    </div>
  );
}
