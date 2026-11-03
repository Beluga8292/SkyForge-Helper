import { useQuery } from "@tanstack/react-query";
import { useConnectionStatus } from "@/hooks/useConnection";
import { useApiStatusStore } from "@/stores/api-status";
import {
  diagnosticReport,
  exportDiagnosticReport,
  localDiagnosticStatus,
} from "@/services/diagnostics";
import { notificationPermission } from "@/features/market/notifications";
import { useI18n, type TranslationKey } from "@/locales";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
export function DiagnosticsPanel() {
  const { t } = useI18n(),
    connection = useConnectionStatus(),
    lastError = useApiStatusStore((s) => s.lastErrorKind);
  const local = useQuery({
    queryKey: ["diagnostics-local"],
    queryFn: localDiagnosticStatus,
    staleTime: 10000,
    retry: 0,
  });
  const permission = useQuery({
    queryKey: ["diagnostics-permission"],
    queryFn: () => notificationPermission(false),
    staleTime: 10000,
    retry: 0,
  });
  const report = diagnosticReport({
    ...local.data,
    provider: connection.mode,
    connection: connection.health,
    backend_version: connection.version,
    latest_success_ms: connection.lastSuccessAt,
    cache_age_ms: connection.cacheAgeMs,
    notification_permission: permission.data,
    last_error: connection.error?.kind ?? lastError ?? "none",
  });
  return (
    <section className="panel mb-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{t("diagnostics.title")}</h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void local.refetch();
              void permission.refetch();
              connection.refresh();
            }}
          >
            {t("common.refresh")}
          </Button>
          <Button
            size="sm"
            onClick={() =>
              void exportDiagnosticReport(report)
                .then(() => toast.success(t("diagnostics.saved")))
                .catch(() => toast.error(t("toasts.error")))
            }
          >
            {t("diagnostics.export")}
          </Button>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {Object.entries(report)
          .filter(([k]) => !["schema_version", "generated_at"].includes(k))
          .map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs text-fg-muted">
                {t(`diagnostics.${key}` as TranslationKey)}
              </dt>
              <dd className="mt-1 font-mono text-xs text-fg">
                {value === null
                  ? "—"
                  : key === "latest_success_ms"
                    ? new Date(Number(value)).toLocaleString()
                    : String(value)}
              </dd>
            </div>
          ))}
      </dl>
      <p className="mt-4 text-xs text-fg-muted">{t("diagnostics.privacy")}</p>
    </section>
  );
}
