import { DEVELOPER_TOOLS_ENABLED } from "@/version";
import { useSmartAlerts } from "@/hooks/useSmartAlerts";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AlertTriangle, FlaskConical, WifiOff } from "lucide-react";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useI18n } from "@/locales";
import { useSettingsStore } from "@/stores/settings";
import { useApiStatusStore } from "@/stores/api-status";
import { useOnlineStatus } from "@/hooks/useEnvironment";
import { useMarketMonitor } from "@/hooks/useMarketMonitor";
import { UpdateDialog, useUpdaterAutoCheck } from "@/components/common/UpdateDialog";
import { LinkAccountDialog } from "@/components/account/LinkAccountDialog";

const SIDEBAR_KEY = "sbc:sidebar:collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell() {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const demo = useSettingsStore((state) => DEVELOPER_TOOLS_ENABLED && state.settings.demoMode);
  const health = useApiStatusStore((state) => state.health);
  const lastError = useApiStatusStore((state) => state.lastError);
  const online = useOnlineStatus();

  useMarketMonitor();
  useSmartAlerts();
  useUpdaterAutoCheck();

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const rateLimited = health === "degraded" && Boolean(lastError && /rate/i.test(lastError));

  return (
    <div className="app-backdrop flex h-screen flex-col overflow-hidden">
      <TitleBar />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenMobile={() => setMobileOpen(true)} />

          {!online ? (
            <Banner tone="red" icon={<WifiOff className="size-3.5" />}>
              {t("errors.offlineBanner")}
            </Banner>
          ) : null}

          {rateLimited ? (
            <Banner tone="amber" icon={<AlertTriangle className="size-3.5" />}>
              {t("errors.rateLimitBanner")}
            </Banner>
          ) : null}

          {demo ? (
            <Banner tone="amber" icon={<FlaskConical className="size-3.5" />} badge={t("common.demo")}>
              {t("topbar.demoDesc")}
            </Banner>
          ) : null}

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-[1460px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
              <Outlet />
            </div>
            <footer className="mx-auto flex w-full max-w-[1460px] flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-4 text-[10.5px] text-fg-subtle sm:px-6 lg:px-8">
              <span>{t("footer.disclaimer")}</span>
              <span className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-green/70" />
                {t("footer.dataBy")}
              </span>
            </footer>
          </main>
        </div>
      </div>
      <UpdateDialog />
      <LinkAccountDialog />
    </div>
  );
}

function Banner({
  children,
  icon,
  tone,
  badge,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone: "red" | "amber";
  badge?: string;
}) {
  return (
    <div
      className={
        tone === "red"
          ? "flex shrink-0 items-center gap-2 border-b border-red/20 bg-red/[0.07] px-4 py-2 text-[11.5px] text-red/90 sm:px-5"
          : "flex shrink-0 items-center gap-2 border-b border-amber/20 bg-amber/[0.06] px-4 py-2 text-[11.5px] text-amber/95 sm:px-5"
      }
    >
      {icon}
      {badge ? (
        <span className="rounded border border-amber/30 bg-amber/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.12em] text-amber">
          {badge}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </div>
  );
}
