import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    // Only used by the browser preview (`npm run dev`). The desktop build talks
    // to the Hypixel/Mojang APIs directly through the Tauri HTTP plugin.
    proxy: {
      "/hypixel": {
        target: "https://api.hypixel.net",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/hypixel/, ""),
      },
      "/mojang": {
        target: "https://api.mojang.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/mojang/, ""),
      },
      "/backend": {
        target: process.env.VITE_BACKEND_PROXY_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/backend/, ""),
      },
      "/mcm": {
        target: "https://piston-meta.mojang.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/mcm/, ""),
      },
      "/mclauncher": {
        target: "https://launchermeta.mojang.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/mclauncher/, ""),
      },
      "/mcjar": {
        target: "https://launcher.mojang.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/mcjar/, ""),
      },
      "/mcres": {
        target: "https://resources.download.minecraft.net",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/mcres/, ""),
      },
      "/mctex": {
        target: "https://textures.minecraft.net",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/mctex/, ""),
      },
    },
  },
  envPrefix: ["VITE_"],
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
});
