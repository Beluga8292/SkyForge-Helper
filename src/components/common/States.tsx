import { DEVELOPER_TOOLS_ENABLED } from "@/version";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useI18n, type TranslationKey } from "@/locales";
import { errorMessageKey } from "@/api/errors";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-2xl border border-line-strong bg-surface-2 text-fg-muted">
        <Icon className="size-5" />
      </div>
      <p className="mt-3.5 text-[13.5px] font-medium text-fg">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[11.5px] leading-relaxed text-fg-subtle">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title,
  compact = false,
  action,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
  action?: ReactNode;
}) {
  const { t } = useI18n();
  const developerMode = useSettingsStore(
    (state) => DEVELOPER_TOOLS_ENABLED && state.settings.developerMode,
  );
  const message = t(errorMessageKey(error) as TranslationKey);
  const isMissingKey =
    developerMode && errorMessageKey(error) === "errors.missingKey";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-2xl border border-red/25 bg-red/10 text-red">
        <AlertTriangle className="size-5" />
      </div>
      <p className="mt-3.5 max-w-md text-[13.5px] font-medium text-fg">
        {title ?? message}
      </p>
      {title ? (
        <p className="mt-1 max-w-md text-[11.5px] leading-relaxed text-fg-subtle">
          {message}
        </p>
      ) : null}
      {developerMode && error instanceof Error ? (
        <pre className="mt-3 max-w-full overflow-auto rounded-lg border border-line bg-bg-elevated px-3 py-2 text-left font-mono text-[10px] text-fg-subtle">
          {error.message}
        </pre>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {isMissingKey ? (
          <Button asChild size="sm">
            <Link to="/settings">
              <KeyRound className="size-3.5" />
              {t("profile.openSettings")}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        ) : onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}

export function ApiKeyNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-amber/20 bg-amber/[0.05]",
        compact ? "px-3 py-2" : "px-4 py-3",
      )}
    >
      <KeyRound className="size-4 shrink-0 text-amber" />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-fg">
          {t("profile.noApiKey")}
        </p>
        {!compact ? (
          <p className="mt-0.5 text-[11px] leading-relaxed text-fg-subtle">
            {t("profile.noApiKeyDesc")}
          </p>
        ) : null}
      </div>
      <Button asChild size="sm" variant="secondary">
        <Link to="/settings">{t("profile.openSettings")}</Link>
      </Button>
    </div>
  );
}

export function DemoNote({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-amber/20 bg-amber/[0.04] px-3 py-2 text-[11px] leading-relaxed text-amber/90",
        className,
      )}
    >
      <span className="rounded border border-amber/30 px-1 py-px text-[8.5px] font-bold uppercase tracking-[0.12em]">
        Demo
      </span>
      <span>{children ?? t("topbar.demoDesc")}</span>
    </div>
  );
}

export function StaleNote({
  updatedAt,
}: {
  updatedAt: number | null | undefined;
}) {
  const { t, language } = useI18n();
  if (!updatedAt) return null;
  const time = new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(updatedAt));
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber/20 bg-amber/[0.05] px-3 py-2 text-[11px] text-amber/90">
      <AlertTriangle className="size-3.5" />
      {t("topbar.staleDesc", { time })}
    </div>
  );
}

export function NoValue({ label }: { label?: string }) {
  return (
    <span className="text-[11px] italic text-fg-subtle">
      {label ?? "нет данных"}
    </span>
  );
}

export function InfoNote({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-bg-elevated/60 px-3 py-2 text-[11px] leading-relaxed text-fg-subtle",
        className,
      )}
    >
      {children}
    </div>
  );
}
