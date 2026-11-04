import { isTauriRuntime } from "@/api/transport";
import { RELEASE_BUILD } from "@/version";
import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";

export interface UpdateDetails {
  version: string;
  currentVersion: string;
  date?: string;
  notes?: string;
}

export interface DownloadProgress {
  downloaded: number;
  total: number | null;
}

let pending: Update | null = null;

/** Updates are only offered by signed release builds running in the desktop shell. */
export function updaterAvailable(): boolean {
  return RELEASE_BUILD && isTauriRuntime();
}

export async function checkForUpdate(): Promise<UpdateDetails | null> {
  if (!updaterAvailable()) return null;
  await closePendingUpdate();
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check({ timeout: 20_000 });
  if (!update) return null;
  pending = update;
  return {
    version: update.version,
    currentVersion: update.currentVersion,
    date: update.date,
    notes: update.body,
  };
}

export async function downloadUpdate(onProgress: (progress: DownloadProgress) => void): Promise<void> {
  if (!pending) throw new Error("no-update");
  let downloaded = 0;
  let total: number | null = null;
  await pending.download((event: DownloadEvent) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? null;
      onProgress({ downloaded, total });
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress({ downloaded, total });
    } else {
      onProgress({ downloaded, total });
    }
  });
}

export async function installUpdate(): Promise<void> {
  if (!pending) throw new Error("no-update");
  await pending.install();
  pending = null;
}

export async function relaunchApp(): Promise<void> {
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

export async function closePendingUpdate(): Promise<void> {
  const update = pending;
  pending = null;
  if (update) await update.close().catch(() => undefined);
}
