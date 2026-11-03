import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/api/transport";

/**
 * Thin typed wrapper around Tauri commands. Returns `null` in the browser
 * preview so feature code can transparently fall back to localStorage.
 */
export async function invokeDesktop<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauriRuntime()) return null;
  return invoke<T>(command, args);
}

export async function openLocalPath(path: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const { openPath } = await import("@tauri-apps/plugin-opener");
  await openPath(path);
  return true;
}

export async function getDataDirectory(): Promise<string | null> {
  return invokeDesktop<string>("data_dir");
}

export async function openExternal(url: string): Promise<void> {
  if (isTauriRuntime()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
