export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

/**
 * In the desktop app requests go through the Tauri HTTP plugin (Rust), which
 * bypasses webview CORS and keeps URL scopes explicit in the capability file.
 * In the browser preview we route through Vite's dev proxy instead.
 */
export async function transportFetch(url: string, init: RequestInit): Promise<Response> {
  if (isTauriRuntime()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(url, init);
  }

  const mapped = mapForDevProxy(url);
  return window.fetch(mapped, init);
}

function mapForDevProxy(url: string): string {
  if (url.startsWith("https://api.hypixel.net/")) {
    return url.replace("https://api.hypixel.net", "/hypixel");
  }
  if (url.startsWith("https://api.mojang.com/")) {
    return url.replace("https://api.mojang.com", "/mojang");
  }
  if (url.startsWith("https://piston-meta.mojang.com/")) {
    return url.replace("https://piston-meta.mojang.com", "/mcm");
  }
  if (url.startsWith("https://launchermeta.mojang.com/")) {
    return url.replace("https://launchermeta.mojang.com", "/mclauncher");
  }
  if (url.startsWith("https://launcher.mojang.com/")) {
    return url.replace("https://launcher.mojang.com", "/mcjar");
  }
  if (url.startsWith("https://textures.minecraft.net/")) {
    return url.replace("https://textures.minecraft.net", "/mctex");
  }
  if (url.startsWith("https://resources.download.minecraft.net/")) {
    return url.replace("https://resources.download.minecraft.net", "/mcres");
  }
  return url;
}
