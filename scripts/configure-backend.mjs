import { readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnv } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = JSON.parse(await readFile(path.join(root, "src-tauri/tauri.conf.json"), "utf8"));
const raw = (process.env.VITE_BACKEND_URL ?? loadEnv("production", root, "VITE_").VITE_BACKEND_URL)?.trim();
const capability = path.join(root, "src-tauri/capabilities/backend.generated.json");
let csp = base.app.security.csp;
if (raw) {
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      !(url.protocol === "https:" || (url.protocol === "http:" && local))) {
    throw new Error("VITE_BACKEND_URL must use HTTPS (or loopback HTTP), without credentials, query or fragment");
  }
  if (process.argv.includes("--release") && local) throw new Error("RC backend must be remote HTTPS; loopback is development-only");
  const endpoint = `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  if (endpoint.includes("*")) throw new Error("Wildcard backend endpoints are forbidden");
  await writeFile(capability, JSON.stringify({
    identifier: "backend-generated", description: "Compile-time backend endpoint only", windows: ["main"],
    permissions: [{ identifier: "http:default", allow: [{ url: `${endpoint}/api/v1/*` }] }],
  }, null, 2) + "\n");
  csp = csp.replace("connect-src 'self'", `connect-src 'self' ${url.origin}`);
} else {
  await rm(capability, { force: true });
}
const updaterEndpoint = process.env.SBC_UPDATER_ENDPOINT?.trim();
const generated = {
  ...(process.argv.includes("--release") ? { build: { devUrl: null, beforeDevCommand: null } } : {}),
  app: { security: { csp, ...(process.argv.includes("--release") ? { devCsp: null } : {}) } },
};
if (updaterEndpoint) {
  const url = new URL(updaterEndpoint);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("SBC_UPDATER_ENDPOINT must be a plain HTTPS URL without credentials, query or fragment");
  }
  // Staging builds only: the shipped production endpoint stays in tauri.conf.json.
  generated.plugins = { updater: { endpoints: [updaterEndpoint] } };
}
await writeFile(path.join(root, "src-tauri/tauri.backend.generated.json"), JSON.stringify(generated, null, 2) + "\n");
console.log(raw ? "Configured an exact backend HTTP scope" : "No production backend configured; the app will show configuration required");
