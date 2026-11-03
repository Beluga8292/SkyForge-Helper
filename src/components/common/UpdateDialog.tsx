import { useEffect } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/locales";
import { useUpdaterStore } from "@/stores/updater";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Checks once at startup and then periodically, release builds only. */
export function useUpdaterAutoCheck(): void {
  useEffect(() => {
    const store = useUpdaterStore.getState();
    void store.check();
    const timer = window.setInterval(() => void useUpdaterStore.getState().check(), CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);
}

function progressPercent(downloaded: number, total: number | null): number | null {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.round((downloaded / total) * 100));
}

export function UpdateDialog() {
  const { t } = useI18n();
  const phase = useUpdaterStore((state) => state.phase);
  const info = useUpdaterStore((state) => state.info);
  const downloaded = useUpdaterStore((state) => state.downloaded);
  const total = useUpdaterStore((state) => state.total);
  const dismissed = useUpdaterStore((state) => state.dismissed);
  const download = useUpdaterStore((state) => state.download);
  const install = useUpdaterStore((state) => state.install);
  const dismiss = useUpdaterStore((state) => state.dismiss);

  const visible =
    !dismissed && (phase === "available" || phase === "downloading" || phase === "ready" || phase === "installing");
  const percent = progressPercent(downloaded, total);

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && phase === "available" && dismiss()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-4 text-violet" />
            {t("update.title")}
          </DialogTitle>
          <DialogDescription>
            {t("update.version", { version: info?.version ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          {phase === "available" && info?.notes ? (
            <div className="rounded-lg border border-line bg-bg-elevated/60 px-3 py-2">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
                {t("update.notes")}
              </p>
              <p className="max-h-40 overflow-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-fg-muted">
                {info.notes}
              </p>
            </div>
          ) : null}

          {phase === "downloading" ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-fg-muted">
                <span>{t("update.downloading")}</span>
                <span>{percent === null ? "" : `${percent}%`}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-violet transition-[width]"
                  style={{ width: `${percent ?? 15}%` }}
                />
              </div>
            </div>
          ) : null}

          {phase === "ready" ? (
            <p className="text-[11.5px] leading-relaxed text-fg-muted">{t("update.readyNote")}</p>
          ) : null}

          {phase === "installing" ? (
            <p className="text-[11.5px] leading-relaxed text-fg-muted">{t("update.installing")}</p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          {phase !== "installing" ? (
            <Button variant="ghost" size="sm" onClick={dismiss}>
              {t("update.later")}
            </Button>
          ) : null}
          {phase === "available" ? (
            <Button size="sm" onClick={() => void download()}>
              {t("update.updateNow")}
            </Button>
          ) : null}
          {phase === "ready" ? (
            <Button size="sm" onClick={() => void install()}>
              {t("update.install")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UpdatePanel() {
  const { t } = useI18n();
  const phase = useUpdaterStore((state) => state.phase);
  const info = useUpdaterStore((state) => state.info);
  const downloaded = useUpdaterStore((state) => state.downloaded);
  const total = useUpdaterStore((state) => state.total);
  const errorKey = useUpdaterStore((state) => state.errorKey);
  const check = useUpdaterStore((state) => state.check);
  const download = useUpdaterStore((state) => state.download);
  const install = useUpdaterStore((state) => state.install);

  if (phase === "unsupported") return null;

  const percent = progressPercent(downloaded, total);
  const status =
    phase === "checking"
      ? t("update.checking")
      : phase === "available"
        ? t("update.available", { version: info?.version ?? "" })
        : phase === "downloading"
          ? percent === null
            ? t("update.downloading")
            : t("update.progress", { percent })
          : phase === "ready"
            ? t("update.ready")
            : phase === "installing"
              ? t("update.installing")
              : phase === "current"
                ? t("update.current")
                : phase === "error"
                  ? t(errorKey ?? "update.error")
                  : t("update.notChecked");

  const busy = phase === "checking" || phase === "downloading" || phase === "installing";

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface-2/25 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[11.5px] text-fg-muted">
          <RefreshCw className="size-3.5 text-cyan" />
          {t("update.status")}
        </span>
        <span className={phase === "error" ? "text-right text-[11px] text-red" : "text-right text-[11px] text-fg-subtle"}>
          {status}
        </span>
      </div>

      {phase === "downloading" ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-violet transition-[width]"
            style={{ width: `${percent ?? 15}%` }}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void check(true)}>
          <RefreshCw className={busy ? "size-3.5 animate-spin" : "size-3.5"} />
          {phase === "checking" ? t("update.checking") : t("update.check")}
        </Button>
        {phase === "available" ? (
          <Button size="sm" onClick={() => void download()}>
            {t("update.updateNow")}
          </Button>
        ) : null}
        {phase === "ready" ? (
          <Button size="sm" onClick={() => void install()}>
            {t("update.install")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
