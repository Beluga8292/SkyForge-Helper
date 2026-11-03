import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/api/transport", () => ({ isTauriRuntime: () => true }));
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { notificationPermission, notifyMarket } from "./notifications";
beforeEach(() => vi.clearAllMocks());
it("does not request permissions or send a notification without permission", async () => {
  vi.mocked(isPermissionGranted).mockResolvedValue(false);
  await notifyMarket("title", "body");
  expect(sendNotification).not.toHaveBeenCalled();
  expect(requestPermission).not.toHaveBeenCalled();
});
it("delivers through the native plugin only with permission", async () => {
  vi.mocked(isPermissionGranted).mockResolvedValue(true);
  await notifyMarket("Market alert", "X");
  expect(sendNotification).toHaveBeenCalledWith({
    title: "Market alert",
    body: "X",
  });
});
it("handles a denied user permission request", async () => {
  vi.mocked(requestPermission).mockResolvedValue("denied");
  expect(await notificationPermission(true)).toBe("denied");
});
