import { isTauriRuntime } from "@/api/transport";
import type { SecretStatus } from "@/types/app";
import { invokeDesktop } from "@/services/desktop";

const SESSION_KEY = "sbc:dev-api-key";

let memoryKey: string | null = null;

/**
 * The Hypixel API key is never embedded in the binary and never written to
 * SQLite, logs or localStorage in production. The desktop build stores it in
 * the operating system credential vault (Windows Credential Manager / macOS
 * Keychain) through Rust. The browser preview keeps it in sessionStorage only
 * so that it disappears when the tab is closed.
 */
export async function getApiKey(): Promise<string | null> {
  if (memoryKey) return memoryKey;
  const desktop = await invokeDesktop<string | null>("secret_get", {});
  if (desktop) {
    memoryKey = desktop;
    return desktop;
  }
  if (isTauriRuntime()) return null;
  try {
    const session = window.sessionStorage.getItem(SESSION_KEY);
    if (session) {
      memoryKey = session;
      return session;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function saveApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) throw new Error("API key is empty");
  await invokeDesktop<null>("secret_set", { key: trimmed });
  if (!isTauriRuntime()) {
    window.sessionStorage.setItem(SESSION_KEY, trimmed);
  }
  memoryKey = trimmed;
}

export async function deleteApiKey(): Promise<void> {
  await invokeDesktop<null>("secret_delete", {});
  if (!isTauriRuntime()) {
    window.sessionStorage.removeItem(SESSION_KEY);
  }
  memoryKey = null;
}

export async function getSecretStatus(): Promise<SecretStatus> {
  const desktop = await invokeDesktop<{ configured: boolean; storage: string; hint: string | null }>("secret_status", {});
  if (desktop) {
    const key = await invokeDesktop<string | null>("secret_get", {});
    memoryKey = key ?? memoryKey;
    return {
      configured: desktop.configured,
      storage: desktop.storage === "os-keychain" ? "os-keychain" : "none",
      hint: desktop.hint,
    };
  }

  try {
    const session = window.sessionStorage.getItem(SESSION_KEY);
    if (session) {
      memoryKey = session;
      return { configured: true, storage: "session", hint: `••••${session.slice(-4)}` };
    }
  } catch {
    // ignore
  }
  return { configured: false, storage: "none", hint: null };
}

export function clearApiKeyMemory(): void {
  memoryKey = null;
}
