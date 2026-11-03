import { invokeDesktop } from "@/services/desktop";
import { isTauriRuntime } from "@/api/transport";
export async function readMarketSetting(key: string): Promise<unknown> {
  const value = isTauriRuntime()
    ? await invokeDesktop<string | null>("settings_get", {
        key: `sbc:market:${key}`,
      })
    : window.localStorage.getItem(`sbc:market:${key}`);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
export async function writeMarketSetting(
  key: string,
  value: unknown,
): Promise<void> {
  const data = JSON.stringify(value);
  if (isTauriRuntime()) {
    await invokeDesktop("settings_set", {
      key: `sbc:market:${key}`,
      value: data,
    });
    return;
  }
  window.localStorage.setItem(`sbc:market:${key}`, data);
}
