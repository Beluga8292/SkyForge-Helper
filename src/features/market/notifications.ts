import { isTauriRuntime } from "@/api/transport";
export async function notificationPermission(request = false): Promise<string> {
  if (isTauriRuntime()) {
    const plugin = await import("@tauri-apps/plugin-notification");
    if (request) {
      const state = await plugin.requestPermission();
      return state === "granted" || state === "denied" ? state : "default";
    }
    return (await plugin.isPermissionGranted()) ? "granted" : "default";
  }
  if (typeof Notification === "undefined") return "unsupported";
  return request ? Notification.requestPermission() : Notification.permission;
}
export async function notifyMarket(title: string, body: string) {
  if ((await notificationPermission()) !== "granted") return;
  if (isTauriRuntime()) {
    const { sendNotification } =
      await import("@tauri-apps/plugin-notification");
    sendNotification({ title, body });
  } else new Notification(title, { body });
}
