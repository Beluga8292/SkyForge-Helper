import { useEffect, useState } from "react";
import { Gem, Minus, Square, X, Copy } from "lucide-react";
import { isTauriRuntime } from "@/api/transport";
import { Tooltip } from "@/components/ui/tooltip";
import { useI18n } from "@/locales";

type WindowAction = "minimize" | "toggle" | "close";

async function runWindowAction(action: WindowAction): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const current = getCurrentWindow();
  if (action === "minimize") await current.minimize();
  if (action === "toggle") await current.toggleMaximize();
  if (action === "close") await current.close();
}

export function TitleBar() {
  const { t } = useI18n();
  const [maximized, setMaximized] = useState(false);
  const tauri = isTauriRuntime();

  useEffect(() => {
    if (!tauri) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const current = getCurrentWindow();
      const state = await current.isMaximized();
      if (!disposed) setMaximized(state);
      unlisten = await current.onResized(async () => {
        const next = await current.isMaximized();
        if (!disposed) setMaximized(next);
      });
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [tauri]);

  return (
    <header className="drag-region relative z-50 flex h-10 shrink-0 items-center justify-between border-b border-line bg-bg-elevated/90 pl-3 pr-1 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <span className="brand-glow flex size-6 items-center justify-center rounded-lg border border-violet/30 bg-violet-soft">
          <Gem className="size-3.5 text-violet" />
        </span>
        <span className="text-[12px] font-semibold tracking-[-0.01em] text-fg">
          SkyForge Helper
        </span>
      </div>

      <div className="drag-region h-full flex-1" data-tauri-drag-region />

      {tauri ? (
        <div className="no-drag flex h-full items-stretch">
          <button
            type="button"
            aria-label={t("titlebar.minimize")}
            onClick={() => void runWindowAction("minimize")}
            className="flex w-11 items-center justify-center text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={
              maximized ? t("titlebar.restore") : t("titlebar.maximize")
            }
            onClick={() => void runWindowAction("toggle")}
            className="flex w-11 items-center justify-center text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {maximized ? (
              <Copy className="size-3.5 -scale-x-100" />
            ) : (
              <Square className="size-3" />
            )}
          </button>
          <button
            type="button"
            aria-label={t("titlebar.close")}
            onClick={() => void runWindowAction("close")}
            className="flex w-11 items-center justify-center text-fg-muted transition-colors hover:bg-red hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <Tooltip content={t("titlebar.previewHint")} side="bottom">
          <span className="no-drag mr-2 rounded-md border border-line-strong bg-surface px-2 py-1 text-[10px] font-medium text-fg-subtle">
            {t("titlebar.preview")}
          </span>
        </Tooltip>
      )}
    </header>
  );
}
