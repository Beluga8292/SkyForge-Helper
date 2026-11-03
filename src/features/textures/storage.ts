import type { ExtractedPack } from "./pack";

const DB_NAME = "sbc-textures";
const DB_VERSION = 1;
const STORE_META = "meta";
const STORE_ITEMS = "items";
const STORE_MATERIALS = "materials";
const STORE_TEXTURES = "textures";
const STORE_VANILLA = "vanilla";

export interface PackMeta {
  name: string;
  importedAt: number;
  itemCount: number;
  materialCount: number;
  textureCount: number;
  unresolvedItems: number;
  source: "furfsky" | "resource-pack";
}

export interface VanillaMeta {
  version: string;
  fetchedAt: number;
  indexSize: number;
}

let database: Promise<IDBDatabase> | null = null;
let packMeta: PackMeta | null = null;
let itemMap = new Map<string, string>();
let materialMap = new Map<string, string>();
let vanillaMap = new Map<string, string>();
let initialized = false;
const objectUrls = new Map<string, string>();

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Local texture storage is unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
      if (!db.objectStoreNames.contains(STORE_ITEMS)) db.createObjectStore(STORE_ITEMS);
      if (!db.objectStoreNames.contains(STORE_MATERIALS)) db.createObjectStore(STORE_MATERIALS);
      if (!db.objectStoreNames.contains(STORE_TEXTURES)) db.createObjectStore(STORE_TEXTURES);
      if (!db.objectStoreNames.contains(STORE_VANILLA)) db.createObjectStore(STORE_VANILLA);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open texture storage"));
  });
  return database;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Texture storage request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Texture storage transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Texture storage transaction aborted"));
  });
}

export async function initTextureCache(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const db = await openDatabase();
    const tx = db.transaction([STORE_META, STORE_ITEMS, STORE_MATERIALS, STORE_VANILLA], "readonly");
    const itemStore = tx.objectStore(STORE_ITEMS);
    const materialStore = tx.objectStore(STORE_MATERIALS);
    const vanillaStore = tx.objectStore(STORE_VANILLA);
    const [meta, itemKeys, itemValues, materialKeys, materialValues, vanillaKeys, vanillaValues] =
      await Promise.all([
        requestResult(tx.objectStore(STORE_META).get("pack")),
        requestResult(itemStore.getAllKeys()),
        requestResult(itemStore.getAll()),
        requestResult(materialStore.getAllKeys()),
        requestResult(materialStore.getAll()),
        requestResult(vanillaStore.getAllKeys()),
        requestResult(vanillaStore.getAll()),
      ]);
    packMeta = (meta as PackMeta | undefined) ?? null;
    itemMap = new Map(
      itemKeys
        .map((key, index) => [String(key), String(itemValues[index] ?? "")] as const)
        .filter(([, value]) => value),
    );
    materialMap = new Map(
      materialKeys
        .map((key, index) => [String(key), String(materialValues[index] ?? "")] as const)
        .filter(([, value]) => value),
    );
    vanillaMap = new Map(
      vanillaKeys
        .map((key, index) => [String(key), String(vanillaValues[index] ?? "")] as const)
        .filter(([, value]) => value),
    );
    compactVanilla = null;
  } catch {
    // Texture storage is optional; the SVG fallback remains available.
  }
}

export function getPackMeta(): PackMeta | null {
  return packMeta;
}

export function getItemTextureKey(itemId: string): string | null {
  return itemMap.get(itemId.toUpperCase()) ?? null;
}

export function getMaterialTextureKey(material: string): string | null {
  return materialMap.get(material.toLowerCase()) ?? null;
}

export function getVanillaTextureKey(material: string): string | null {
  return vanillaMap.get(material.toLowerCase()) ?? null;
}

let compactVanilla: Map<string, string> | null = null;

/**
 * Legacy 1.8 texture names differ from modern material names only by dropped
 * underscores (`dead_bush` vs `deadbush`). Older caches were written without
 * those compact aliases, so resolve them against the loaded map instead of
 * forcing a re-download of the client jar.
 */
export function getVanillaTextureKeyLoose(material: string): string | null {
  const name = material.toLowerCase();
  const direct = vanillaMap.get(name);
  if (direct) return direct;
  if (!compactVanilla) {
    compactVanilla = new Map();
    for (const [key, value] of vanillaMap) {
      const compact = key.replace(/_/g, "");
      if (!compactVanilla.has(compact)) compactVanilla.set(compact, value);
    }
  }
  return compactVanilla.get(name.replace(/_/g, "")) ?? null;
}

/** True when the vanilla texture map has been loaded or populated. */
export function isVanillaCacheReady(): boolean {
  return vanillaMap.size > 0;
}

export function hasTexture(key: string): boolean {
  return objectUrls.has(key);
}

export async function getTextureUrl(key: string): Promise<string | null> {
  const cached = objectUrls.get(key);
  if (cached) return cached;
  try {
    const db = await openDatabase();
    const stored = await requestResult(
      db.transaction([STORE_TEXTURES], "readonly").objectStore(STORE_TEXTURES).get(key),
    );
    if (!stored || typeof stored !== "object") return null;
    const record = stored as { data: ArrayBuffer; type?: string };
    const blob = new Blob([record.data], { type: record.type || "image/png" });
    const url = URL.createObjectURL(blob);
    objectUrls.set(key, url);
    return url;
  } catch {
    return null;
  }
}

export async function storeTexture(key: string, bytes: Uint8Array | Blob): Promise<void> {
  const db = await openDatabase();
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: "image/png" });
  const data = await blob.arrayBuffer();
  await requestResult(
    db
      .transaction([STORE_TEXTURES], "readwrite")
      .objectStore(STORE_TEXTURES)
      .put({ data, type: blob.type || "image/png" }, key),
  );
  const url = URL.createObjectURL(blob);
  const previous = objectUrls.get(key);
  if (previous) URL.revokeObjectURL(previous);
  objectUrls.set(key, url);
}

export async function importPack(pack: ExtractedPack, name: string): Promise<PackMeta> {
  const db = await openDatabase();
  const meta: PackMeta = {
    name,
    importedAt: Date.now(),
    itemCount: Object.keys(pack.items).length,
    materialCount: Object.keys(pack.materials).length,
    textureCount: Object.keys(pack.textures).length,
    unresolvedItems: pack.stats.unresolvedItems,
    source: /furfsky/i.test(name) ? "furfsky" : "resource-pack",
  };
  const tx = db.transaction(
    [STORE_META, STORE_ITEMS, STORE_MATERIALS, STORE_TEXTURES],
    "readwrite",
  );
  tx.objectStore(STORE_META).put(meta, "pack");
  tx.objectStore(STORE_ITEMS).clear();
  tx.objectStore(STORE_MATERIALS).clear();
  tx.objectStore(STORE_TEXTURES).clear();
  for (const [itemId, key] of Object.entries(pack.items)) {
    tx.objectStore(STORE_ITEMS).put(key, itemId.toUpperCase());
  }
  for (const [material, key] of Object.entries(pack.materials)) {
    tx.objectStore(STORE_MATERIALS).put(key, material.toLowerCase());
  }
  for (const [key, bytes] of Object.entries(pack.textures)) {
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    tx.objectStore(STORE_TEXTURES).put({ data, type: "image/png" }, key);
  }
  await transactionDone(tx);

  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
  packMeta = meta;
  itemMap = new Map(Object.entries(pack.items).map(([id, key]) => [id.toUpperCase(), key]));
  materialMap = new Map(
    Object.entries(pack.materials).map(([material, key]) => [material.toLowerCase(), key]),
  );
  return meta;
}

export async function clearPack(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(
    [STORE_META, STORE_ITEMS, STORE_MATERIALS, STORE_TEXTURES],
    "readwrite",
  );
  tx.objectStore(STORE_META).delete("pack");
  tx.objectStore(STORE_ITEMS).clear();
  tx.objectStore(STORE_MATERIALS).clear();
  tx.objectStore(STORE_TEXTURES).clear();
  await transactionDone(tx);
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
  packMeta = null;
  itemMap = new Map();
  materialMap = new Map();
}

export async function storeVanillaTexture(material: string, bytes: Uint8Array): Promise<string> {
  const key = `vanilla:${material.toLowerCase()}`;
  await storeTexture(key, bytes);
  const db = await openDatabase();
  await requestResult(
    db
      .transaction([STORE_VANILLA], "readwrite")
      .objectStore(STORE_VANILLA)
      .put(key, material.toLowerCase()),
  );
  vanillaMap.set(material.toLowerCase(), key);
  compactVanilla = null;
  return key;
}

/**
 * Persist a whole vanilla texture set in one IndexedDB transaction. The client
 * jar contains roughly a thousand textures, so individual transactions would
 * make the first run noticeably slow.
 */
export async function storeVanillaTextures(
  textures: Map<string, Uint8Array>,
): Promise<number> {
  if (!textures.size) return 0;
  const db = await openDatabase();
  const tx = db.transaction([STORE_TEXTURES, STORE_VANILLA], "readwrite");
  const textureStore = tx.objectStore(STORE_TEXTURES);
  const vanillaStore = tx.objectStore(STORE_VANILLA);
  const written = new Map<string, string>();
  for (const [material, bytes] of textures) {
    const key = `vanilla:${material.toLowerCase()}`;
    const data = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    textureStore.put({ data, type: "image/png" }, key);
    vanillaStore.put(key, material.toLowerCase());
    written.set(material.toLowerCase(), key);
  }
  await transactionDone(tx);
  compactVanilla = null;
  for (const [material, key] of written) vanillaMap.set(material, key);
  return written.size;
}

export async function getVanillaMeta(): Promise<VanillaMeta | null> {
  try {
    const db = await openDatabase();
    return (await requestResult(
      db.transaction([STORE_META], "readonly").objectStore(STORE_META).get("vanilla"),
    )) as VanillaMeta | null;
  } catch {
    return null;
  }
}

export async function setVanillaMeta(meta: VanillaMeta): Promise<void> {
  try {
    const db = await openDatabase();
    await requestResult(
      db.transaction([STORE_META], "readwrite").objectStore(STORE_META).put(meta, "vanilla"),
    );
  } catch {
    // Optional metadata.
  }
}

export async function clearAllTextures(): Promise<void> {
  await clearPack();
  try {
    const db = await openDatabase();
    const tx = db.transaction([STORE_VANILLA], "readwrite");
    tx.objectStore(STORE_VANILLA).clear();
    await transactionDone(tx);
    vanillaMap = new Map();
    compactVanilla = null;
  } catch {
    // Ignore.
  }
}
