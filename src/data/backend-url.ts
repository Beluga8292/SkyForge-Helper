export function normalizeBackendUrl(raw: string): string | null {
  const value = raw.trim().replace(/\/+$/, "");
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.username || url.password || url.search || url.hash || url.pathname.includes("*")) return null;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
    // Remote development backends must use TLS. Plain HTTP is allowed only for loopback.
    if (url.protocol === "http:" && !local) return null;
    return `${url.origin}${url.pathname === "/" ? "" : url.pathname}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

