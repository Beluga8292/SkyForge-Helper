import { z } from "zod";
import { APP_VERSION } from "@/version";
import { invokeDesktop } from "./desktop";
import { isTauriRuntime } from "@/api/transport";
const version = z
  .string()
  .regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-rc\.\d{1,4})?$/);
const choices = {
  provider: ["backend", "direct", "demo"],
  connection: [
    "checking",
    "connected",
    "degraded",
    "offline",
    "misconfigured",
    "direct",
    "demo",
  ],
  database: ["ok", "unavailable", "not_applicable"],
  notification_permission: ["granted", "denied", "default", "unsupported"],
  last_error: [
    "configuration",
    "network",
    "timeout",
    "aborted",
    "auth",
    "missing-key",
    "rate-limit",
    "not-found",
    "validation",
    "server",
    "unavailable",
    "none",
  ],
  os: ["macos", "windows", "linux", "browser"],
  build_type: ["development", "release"],
} as const;
export function diagnosticReport(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {
    schema_version: 1,
    app_version: APP_VERSION,
    generated_at: Date.now(),
  };
  for (const [key, allowed] of Object.entries(choices))
    out[key] =
      typeof input[key] === "string" &&
      (allowed as readonly string[]).includes(input[key] as string)
        ? input[key]
        : "unknown";
  for (const key of ["latest_success_ms", "cache_age_ms"])
    out[key] =
      typeof input[key] === "number" &&
      Number.isSafeInteger(input[key]) &&
      input[key] >= 0
        ? input[key]
        : null;
  const backend = version.safeParse(input.backend_version);
  out.backend_version = backend.success ? backend.data : null;
  return out;
}
export async function localDiagnosticStatus() {
  return (
    (await invokeDesktop<{
      database: string;
      os: string;
      build_type: string;
      app_version: string;
    }>("diagnostics_status")) ?? {
      database: "not_applicable",
      os: "browser",
      build_type: import.meta.env.DEV ? "development" : "release",
      app_version: APP_VERSION,
    }
  );
}
export async function exportDiagnosticReport(input: Record<string, unknown>) {
  const report = diagnosticReport(input);
  if (isTauriRuntime())
    return invokeDesktop<string>("diagnostics_export", { report });
  const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "skyblock-diagnostics.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return a.download;
}
