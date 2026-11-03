import { DEVELOPER_TOOLS_ENABLED } from "@/version";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  KeyRound,
  Menu,
  RefreshCw,
  Search,
  Settings,
  Check,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useI18n, type TranslationKey } from "@/locales";
import { useSettingsStore } from "@/stores/settings";
import { useApiStatusStore } from "@/stores/api-status";
import { useConnectionStatus } from "@/hooks/useConnection";
import { useBazaar } from "@/hooks/useBazaar";
import { useWatchlistStore } from "@/stores/watchlist";
import { formatPrice, formatTime } from "@/utils/format";
import { validateMinecraftName } from "@/utils/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { toast } from "sonner";
import type { ApiHealth } from "@/types/app";

export function TopBar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const apiHealth = useApiStatusStore((state) => state.health);
  const connection = useConnectionStatus();
  const health: ApiHealth =
    connection.mode === "backend"
      ? (
          {
            connected: "online",
            checking: "unknown",
            degraded: "degraded",
            offline: "offline",
            misconfigured: "unauthorized",
            direct: "unknown",
            demo: "unknown",
          } as const
        )[connection.health]
      : apiHealth;
  const latencyMs = useApiStatusStore((state) => state.latencyMs);
  const developerMode = useSettingsStore(
    (state) => DEVELOPER_TOOLS_ENABLED && state.settings.developerMode,
  );
  const bazaar = useBazaar();
  const entries = useWatchlistStore((state) => state.entries);
  const fetching = useIsFetching();
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const reached = (bazaar.demo || bazaar.envelope?.stale ? [] : entries)
    .map((entry) => ({
      entry,
      quote: bazaar.quotes.find((quote) => quote.productId === entry.productId),
    }))
    .filter(
      (item) =>
        item.entry.targetPrice != null &&
        item.quote &&
        item.quote.instantSell <= (item.entry.targetPrice ?? 0),
    );

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const result = validateMinecraftName(query);
    if (!result.valid) {
      toast.error(t("profile.searchHint"));
      return;
    }
    navigate(`/profile?name=${encodeURIComponent(result.value)}`);
    setQuery("");
  };

  const refreshAll = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await bazaar.refresh();
      await queryClient.invalidateQueries({
        predicate: (query) =>
          !["bazaar", "resources"].includes(String(query.queryKey[0])),
      });
      toast.success(t("toasts.refreshed"));
    } catch {
      toast.error(t("toasts.error"), { description: t("errors.retryHint") });
    } finally {
      setRefreshing(false);
    }
  };

  const lastUpdated = bazaar.envelope?.updatedAt;
  const busy = refreshing || fetching > 0;
  const status =
    connection.mode === "demo"
      ? {
          labelKey: "connection.demo" as TranslationKey,
          dot: "bg-amber",
          text: "text-amber",
        }
      : connection.mode === "backend"
        ? {
            ...STATUS[health],
            labelKey: `connection.${connection.health}` as TranslationKey,
          }
        : STATUS[health];

  return (
    <div className="shrink-0 border-b border-line bg-bg/75 backdrop-blur-xl">
      <div className="flex h-[60px] items-center gap-3 px-4 sm:px-5">
        <button
          type="button"
          onClick={onOpenMobile}
          className="flex size-9 items-center justify-center rounded-lg border border-line-strong bg-surface text-fg-muted hover:text-fg lg:hidden"
          aria-label={t("nav.section.main")}
        >
          <Menu className="size-4" />
        </button>

        <form
          onSubmit={submitSearch}
          className="relative hidden w-full max-w-[320px] md:block"
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("dashboard.searchPlayer")}
            aria-label={t("profile.searchLabel")}
            className="h-9 border-line bg-surface/70 pl-8 text-[12.5px]"
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
          <Tooltip
            side="bottom"
            content={
              <span className="block space-y-0.5">
                <span className="block font-medium text-fg">
                  {t(status.labelKey)}
                </span>
                <span className="block text-fg-subtle">
                  {health === "online" && latencyMs
                    ? `${latencyMs} ms`
                    : t("footer.dataBy")}
                </span>
              </span>
            }
          >
            <div className="flex h-8 items-center gap-2 rounded-lg border border-line bg-surface/60 px-2.5">
              <span className="relative flex size-2">
                {health === "online" ? (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-green/60" />
                ) : null}
                <span
                  className={cn(
                    "relative inline-flex size-2 rounded-full",
                    status.dot,
                  )}
                />
              </span>
              <span
                className={cn(
                  "hidden text-[11px] font-medium sm:inline",
                  status.text,
                )}
              >
                {t(status.labelKey)}
              </span>
              {developerMode && latencyMs ? (
                <span className="hidden font-mono text-[10px] text-fg-subtle sm:inline">
                  {latencyMs}ms
                </span>
              ) : null}
            </div>
          </Tooltip>

          <Tooltip
            side="bottom"
            content={
              lastUpdated
                ? `${t("bazaar.lastUpdated", { time: formatTime(lastUpdated, language) })}`
                : t("topbar.neverUpdated")
            }
          >
            <div className="hidden h-8 items-center gap-1.5 rounded-lg border border-line bg-surface/60 px-2.5 text-[11px] text-fg-muted lg:flex">
              <RefreshCw
                className={cn("size-3", bazaar.isFetching && "animate-spin")}
              />
              <span className="font-mono text-[10.5px]">
                {lastUpdated ? formatTime(lastUpdated, language) : "—"}
              </span>
            </div>
          </Tooltip>

          <Tooltip side="bottom" content={t("topbar.refresh")}>
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={() => void refreshAll()}
              disabled={busy}
              aria-label={t("topbar.refresh")}
            >
              <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
            </Button>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative flex size-8 items-center justify-center rounded-md border border-line-strong bg-surface text-fg-muted outline-none transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-violet"
                aria-label={t("topbar.notifications")}
              >
                <Bell className="size-3.5" />
                {reached.length ? (
                  <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-violet text-[8px] font-bold text-white">
                    {reached.length}
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>{t("topbar.notifications")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {reached.length ? (
                reached.map(({ entry, quote }) => (
                  <DropdownMenuItem
                    key={entry.productId}
                    onSelect={() => navigate("/watchlist")}
                    className="items-start"
                  >
                    <Check className="mt-0.5 size-3.5 text-green" />
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] text-fg">
                        {quote?.name ?? entry.productId}
                      </span>
                      <span className="block text-[10.5px] text-fg-subtle">
                        {t("watchlist.targetReached")} ·{" "}
                        {formatPrice(quote?.instantSell)}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-3 py-5 text-center text-[11.5px] leading-relaxed text-fg-subtle">
                  {t("dashboard.watchlistEmptyDesc")}
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate("/watchlist")}>
                {t("dashboard.openWatchlist")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip side="bottom" content={t("topbar.settings")}>
            <button
              type="button"
              onClick={() => navigate("/settings")}
              className="flex size-8 items-center justify-center rounded-md border border-line-strong bg-surface text-fg-muted outline-none transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-violet"
              aria-label={t("topbar.settings")}
            >
              <Settings className="size-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

const STATUS: Record<
  ApiHealth,
  { labelKey: TranslationKey; dot: string; text: string }
> = {
  unknown: {
    labelKey: "topbar.apiUnknown",
    dot: "bg-fg-subtle",
    text: "text-fg-subtle",
  },
  online: { labelKey: "topbar.apiOnline", dot: "bg-green", text: "text-green" },
  offline: { labelKey: "topbar.apiOffline", dot: "bg-red", text: "text-red" },
  degraded: {
    labelKey: "topbar.apiDegraded",
    dot: "bg-amber",
    text: "text-amber",
  },
  unauthorized: {
    labelKey: "topbar.apiUnauthorized",
    dot: "bg-amber",
    text: "text-amber",
  },
};

export function CompactKeyHint() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-fg-subtle">
      <KeyRound className="size-3" /> {t("settings.apiKeyNote")}
    </span>
  );
}
