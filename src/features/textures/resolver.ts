import { useEffect, useState } from "react";
import { transportFetch } from "@/api/transport";
import type { ExtractedPack } from "./pack";
import {
  clearPack,
  getItemTextureKey,
  getMaterialTextureKey,
  getPackMeta,
  getTextureUrl,
  getVanillaTextureKey,
  getVanillaTextureKeyLoose,
  importPack,
  initTextureCache,
  storeTexture,
  type PackMeta,
} from "./storage";
import { resolveVanillaMaterial } from "./vanilla";
import {
  itemIdCandidates,
  materialCandidates,
  nameCandidates,
} from "./aliases";

export type TextureSource = "furfsky" | "resource-pack" | "skull" | "vanilla";

export interface ItemTextureRequest {
  itemId?: string | null;
  material?: string | null;
  skullTexture?: string | null;
  /** Weak display-name hint, used only after exact id and skull matching. */
  name?: string | null;
}

export interface ResolvedTexture {
  url: string;
  source: TextureSource;
  key: string;
}

const resolutionCache = new Map<string, ResolvedTexture | null>();
const pendingResolutions = new Map<string, Promise<ResolvedTexture | null>>();
const pendingSkins = new Map<string, Promise<ResolvedTexture | null>>();

function requestKey(request: ItemTextureRequest): string {
  return [
    request.itemId?.toUpperCase() ?? "",
    request.material?.toLowerCase() ?? "",
    request.skullTexture ?? "",
    request.name?.toLowerCase() ?? "",
  ].join("|");
}

function sourceForPack(meta: PackMeta | null): TextureSource {
  return meta?.source === "furfsky" ? "furfsky" : "resource-pack";
}

function normalizeSkullReference(skullTexture: string): string | null {
  const value = skullTexture.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const pathHash = value.includes("/") ? value.split("/").filter(Boolean).pop() : value;
  if (pathHash && /^[a-f0-9]{32,128}$/i.test(pathHash)) return pathHash;
  // Hypixel sometimes keeps the base64 texture value instead of the decoded URL.
  if (/^[A-Za-z0-9+/=]{40,}$/.test(value)) {
    try {
      const decoded = JSON.parse(atob(value)) as {
        textures?: { SKIN?: { url?: string } };
      };
      const url = decoded.textures?.SKIN?.url;
      if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;
    } catch {
      // Not a base64 JSON texture value.
    }
  }
  return null;
}

async function resolveSkin(skullTexture: string): Promise<ResolvedTexture | null> {
  const reference = normalizeSkullReference(skullTexture);
  if (!reference) return null;
  const hash = reference.includes("/")
    ? reference.split("/").filter(Boolean).pop() ?? ""
    : reference;
  if (!/^[a-f0-9]{32,128}$/i.test(hash)) return null;
  const key = `skinface:${hash}`;
  const pending = pendingSkins.get(key);
  if (pending) return pending;
  const loading = (async (): Promise<ResolvedTexture | null> => {
  const cached = await getTextureUrl(key);
  if (cached) return { url: cached, source: "skull", key };
  try {
    // Hypixel still emits `http://textures.minecraft.net/...`; the desktop app
    // allow-list and the dev proxy are both https-only.
    const url = `https://textures.minecraft.net/texture/${hash}`;
    const response = await transportFetch(url, { method: "GET" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const face = await cropMinecraftHead(blob);
    await storeTexture(key, face);
    const objectUrl = await getTextureUrl(key);
    return objectUrl ? { url: objectUrl, source: "skull", key } : null;
  } catch {
    return null;
  }
  })();
  pendingSkins.set(key, loading);
  try {
    return await loading;
  } finally {
    pendingSkins.delete(key);
  }
}

async function cropMinecraftHead(blob: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) return blob;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, 64, 64);
    context.drawImage(bitmap, 8, 8, 8, 8, 0, 0, 64, 64);
    context.drawImage(bitmap, 40, 8, 8, 8, 0, 0, 64, 64);
    const cropped = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), "image/png");
    });
    return cropped ?? blob;
  } finally {
    bitmap.close();
  }
}

export async function resolveItemTexture(
  request: ItemTextureRequest,
): Promise<ResolvedTexture | null> {
  const key = requestKey(request);
  const cached = resolutionCache.get(key);
  if (cached !== undefined) return cached;
  const pending = pendingResolutions.get(key);
  if (pending) return pending;

  const promise = (async (): Promise<ResolvedTexture | null> => {
    await initTextureCache();
    const meta = getPackMeta();
    const itemId = request.itemId?.toUpperCase();
    const itemCandidates = itemIdCandidates(itemId);
    for (const candidate of itemCandidates) {
      const textureKey = getItemTextureKey(candidate);
      if (!textureKey) continue;
      const url = await getTextureUrl(textureKey);
      if (url) return { url, source: sourceForPack(meta), key: textureKey };
    }
    if (request.skullTexture) {
      const skin = await resolveSkin(request.skullTexture);
      if (skin) return skin;
    }
    // Display-name matching is deliberately weak and comes after the exact id
    // and the real skull texture, so it can never override a correct source.
    for (const candidate of nameCandidates(request.name)) {
      if (itemCandidates.includes(candidate)) continue;
      const textureKey = getItemTextureKey(candidate);
      if (!textureKey) continue;
      const url = await getTextureUrl(textureKey);
      if (url) return { url, source: sourceForPack(meta), key: textureKey };
    }
    const materials = materialCandidates(request.material, itemId);
    for (const material of materials) {
      const textureKey = getMaterialTextureKey(material);
      if (textureKey) {
        const url = await getTextureUrl(textureKey);
        if (url) return { url, source: sourceForPack(meta), key: textureKey };
      }
    }
    for (const material of materials) {
      const vanillaKey =
        getVanillaTextureKey(material) ??
        getVanillaTextureKeyLoose(material) ??
        (await resolveVanillaMaterial(material));
      if (!vanillaKey) continue;
      const url = await getTextureUrl(vanillaKey);
      if (url) return { url, source: "vanilla", key: vanillaKey };
    }
    return null;
  })();

  pendingResolutions.set(key, promise);
  try {
    const result = await promise;
    resolutionCache.set(key, result);
    return result;
  } finally {
    pendingResolutions.delete(key);
  }
}

export function useItemTexture(request: ItemTextureRequest): {
  texture: ResolvedTexture | null;
  loading: boolean;
} {
  const key = requestKey(request);
  const [state, setState] = useState<{ key: string; texture: ResolvedTexture | null } | null>(
    () => {
      const cached = resolutionCache.get(key);
      return cached !== undefined ? { key, texture: cached } : null;
    },
  );

  useEffect(() => {
    let active = true;
    const cached = resolutionCache.get(key);
    if (cached !== undefined) {
      setState({ key, texture: cached });
      return () => {
        active = false;
      };
    }
    void resolveItemTexture(request).then((texture) => {
      if (active) setState({ key, texture });
    });
    return () => {
      active = false;
    };
    // The signature is the stable identity of the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    texture: state?.key === key ? state.texture : null,
    loading: state?.key !== key,
  };
}

interface WorkerResponse {
  id: number;
  ok: boolean;
  pack?: ExtractedPack;
  error?: string;
}

let worker: Worker | null = null;
let workerRequestId = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./pack.worker.ts", import.meta.url), { type: "module" });
  }
  return worker;
}

async function parsePackInWorker(buffer: ArrayBuffer): Promise<ExtractedPack> {
  const id = ++workerRequestId;
  const instance = getWorker();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      instance.removeEventListener("message", handler);
      reject(new Error("Texture pack import timed out"));
    }, 180_000);
    const handler = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return;
      window.clearTimeout(timer);
      instance.removeEventListener("message", handler);
      if (event.data.ok && event.data.pack) resolve(event.data.pack);
      else reject(new Error(event.data.error ?? "Texture pack import failed"));
    };
    instance.addEventListener("message", handler);
    instance.postMessage({ id, buffer });
  });
}

async function parsePackOnMainThread(buffer: ArrayBuffer): Promise<ExtractedPack> {
  const { parseCats } = await import("./cats");
  const { parseZip, isZipArchive } = await import("./zip");
  const { extractPackTextures, findCatsBlob } = await import("./pack");
  const magic = buffer.byteLength >= 4 ? new DataView(buffer).getUint32(0, false) : 0;
  let files: Map<string, Uint8Array>;
  if (magic === 0x43415453) {
    files = await parseCats(buffer);
  } else if (isZipArchive(buffer)) {
    const zip = await parseZip(buffer);
    const cats = findCatsBlob(zip);
    files = cats
      ? await parseCats(cats.slice().buffer)
      : zip;
  } else {
    throw new Error("Unsupported pack container: expected a ZIP or Catharsis pack");
  }
  return extractPackTextures(files);
}

export async function importTexturePack(file: File): Promise<PackMeta> {
  if (file.size > 512 * 1024 * 1024) throw new Error("Texture pack is larger than 512 MB");
  const buffer = await file.arrayBuffer();
  let pack: ExtractedPack;
  try {
    pack = typeof Worker === "function" ? await parsePackInWorker(buffer) : await parsePackOnMainThread(buffer);
  } catch (error) {
    if (error instanceof Error && /timed out/i.test(error.message)) throw error;
    pack = await parsePackOnMainThread(buffer);
  }
  if (!Object.keys(pack.items).length && !Object.keys(pack.materials).length) {
    throw new Error("Pack does not contain SkyBlock item models or Minecraft item textures");
  }
  resolutionCache.clear();
  pendingResolutions.clear();
  return importPack(pack, file.name);
}

export async function removeTexturePack(): Promise<void> {
  resolutionCache.clear();
  pendingResolutions.clear();
  await clearPack();
}

export function texturePackMeta(): PackMeta | null {
  return getPackMeta();
}
