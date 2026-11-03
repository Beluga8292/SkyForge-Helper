import { useEffect, type ReactNode } from "react";
import { Gem } from "lucide-react";
import { useSettingsStore } from "@/stores/settings";
import { useWatchlistStore } from "@/stores/watchlist";
import { ItemRegistryLoader } from "@/features/items/registry";
import { initTextureCache } from "@/features/textures/storage";

export function Bootstrap({ children }: { children: ReactNode }) {
  const hydrated = useSettingsStore((state) => state.hydrated);
  const hydrate = useSettingsStore((state) => state.hydrate);
  const loadWatchlist = useWatchlistStore((state) => state.load);

  useEffect(() => {
    void hydrate();
    void initTextureCache();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    void loadWatchlist();
  }, [hydrated, loadWatchlist]);

  if (!hydrated) return <Splash />;
  return (
    <>
      <ItemRegistryLoader />
      {children}
    </>
  );
}

function Splash() {
  return (
    <div className="app-backdrop flex h-screen flex-col items-center justify-center gap-5">
      <div className="brand-glow flex size-14 items-center justify-center rounded-2xl border border-violet/30 bg-violet-soft">
        <Gem className="size-7 text-violet" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold tracking-[-0.01em] text-fg">SkyForge Helper</p>
        <p className="mt-1 text-[12px] text-fg-subtle">Загружаем локальные настройки…</p>
      </div>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-1/2 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-full bg-violet" />
      </div>
    </div>
  );
}
