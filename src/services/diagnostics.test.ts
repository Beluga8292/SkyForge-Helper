import { describe, it, expect, vi } from "vitest";
import { diagnosticReport, exportDiagnosticReport } from "./diagnostics";
import { persistSettings, DEFAULT_SETTINGS } from "./settings";
import { writeCache } from "./cache";
import { invokeDesktop } from "./desktop";
vi.mock("@/api/transport", () => ({ isTauriRuntime: () => true }));
vi.mock("./desktop", () => ({ invokeDesktop: vi.fn(async () => null) }));
describe("release diagnostics and native persistence", () => {
  it("uses an allowlist rather than redacting known secret names", () => {
    const result = diagnosticReport({
      provider: "backend",
      connection: "offline",
      last_error: "/Users/private/token",
      backend_version: "1.2.3?password=secret",
      app_version: "secret",
      profile: { inventory: "secret" },
      endpoint: "https://user:secret@example.com",
      cache_age_ms: Infinity,
      os: "macos",
    });
    const text = JSON.stringify(result);
    expect(text).not.toContain("secret");
    expect(text).not.toContain("/Users");
    expect(text).not.toContain("endpoint");
    expect(result.last_error).toBe("unknown");
    expect(result.backend_version).toBeNull();
    expect(result.cache_age_ms).toBeNull();
  });
  it("passes only the safe projection to native export", async () => {
    await exportDiagnosticReport({ provider: "demo", inventory: "secret" });
    const args = vi.mocked(invokeDesktop).mock.calls.at(-1)![1];
    expect(JSON.stringify(args)).not.toContain("secret");
    expect(vi.mocked(invokeDesktop).mock.calls.at(-1)![0]).toBe(
      "diagnostics_export",
    );
  });
  it("does not mirror successful null-returning SQLite writes to webview localStorage", async () => {
    const trap = vi.fn(() => {
      throw Error("unexpected browser storage");
    });
    vi.stubGlobal("window", { localStorage: { setItem: trap } });
    await persistSettings(DEFAULT_SETTINGS);
    await writeCache("test", { fixture: true });
    expect(trap).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
