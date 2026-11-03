import { PackError } from "./pack-format";

export interface ExtractedPack {
  items: Record<string, string>;
  materials: Record<string, string>;
  textures: Record<string, Uint8Array>;
  stats: {
    itemJsonCount: number;
    resolvedItems: number;
    unresolvedItems: number;
    materialCount: number;
    textureCount: number;
  };
}

interface AssetPath {
  namespace: string;
  kind: "models" | "textures" | "items";
  relative: string;
}

function parseAssetPath(path: string): AssetPath | null {
  const normalized = path.replaceAll("\\", "/");
  const lower = normalized.toLowerCase();
  const index = lower.lastIndexOf("assets/");
  if (index < 0) return null;
  const parts = normalized.slice(index + "assets/".length).split("/");
  if (parts.length < 3) return null;
  const [namespace, kind, ...rest] = parts;
  if (!namespace || !kind || !rest.length) return null;
  const lowerKind = kind.toLowerCase();
  if (lowerKind !== "models" && lowerKind !== "textures" && lowerKind !== "items") return null;
  return {
    namespace: namespace.toLowerCase(),
    kind: lowerKind,
    relative: rest.join("/"),
  };
}

function withoutExtension(value: string, extension: string): string {
  return value.toLowerCase().endsWith(extension) ? value.slice(0, -extension.length) : value;
}

function scorePath(path: string): number {
  const lower = path.toLowerCase();
  let score = 0;
  if (lower.includes("/base/")) score += 4;
  if (lower.includes("icon")) score += 3;
  if (lower.includes("item_melee") || lower.includes("item_ranged")) score += 2;
  if (lower.includes("legacy")) score -= 4;
  if (lower.includes("accessibility")) score -= 5;
  if (lower.includes("strip")) score -= 3;
  if (lower.includes("tint")) score -= 2;
  if (lower.includes("model")) score -= 2;
  return score;
}

function collectModelRefs(node: unknown, output: string[], depth = 0): void {
  if (depth > 32 || output.length > 64) return;
  if (Array.isArray(node)) {
    for (const entry of node) collectModelRefs(entry, output, depth + 1);
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  const model = record.model;
  if (typeof model === "string" && /^[a-z0-9_.-]+:.+$/i.test(model)) output.push(model);
  for (const value of Object.values(record)) collectModelRefs(value, output, depth + 1);
}

function parseJson(bytes: Uint8Array): Record<string, unknown> | null {
  try {
    const value = JSON.parse(new TextDecoder("utf-8").decode(bytes)) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function resolveTextureRef(
  ref: string,
  textures: Map<string, string>,
  seen: Set<string>,
): string | null {
  const key = `texture:${ref}`;
  if (seen.has(key)) return null;
  seen.add(key);
  return textures.get(ref) ?? null;
}

function resolveTextureValue(
  value: unknown,
  textureVariables: Record<string, unknown>,
  textures: Map<string, string>,
  seen: Set<string>,
  depth = 0,
): string | null {
  if (depth > 16 || typeof value !== "string") return null;
  if (value.startsWith("#")) {
    return resolveTextureValue(
      textureVariables[value.slice(1)],
      textureVariables,
      textures,
      seen,
      depth + 1,
    );
  }
  return resolveTextureRef(value.toLowerCase(), textures, seen);
}

function resolveModelTexture(
  modelRef: string,
  models: Map<string, Record<string, unknown>>,
  textures: Map<string, string>,
  seen = new Set<string>(),
): string | null {
  const ref = modelRef.toLowerCase();
  const seenKey = `model:${ref}`;
  if (seen.has(seenKey)) return null;
  seen.add(seenKey);
  const model = models.get(ref);
  if (!model) return null;
  const textureVariables =
    model.textures && typeof model.textures === "object" && !Array.isArray(model.textures)
      ? (model.textures as Record<string, unknown>)
      : {};
  for (const key of ["layer0", "0", "all", "texture", "particle"]) {
    const resolved = resolveTextureValue(textureVariables[key], textureVariables, textures, seen);
    if (resolved) return resolved;
  }
  for (const value of Object.values(textureVariables)) {
    const resolved = resolveTextureValue(value, textureVariables, textures, seen);
    if (resolved) return resolved;
  }
  const parent = model.parent;
  if (typeof parent === "string") return resolveModelTexture(parent, models, textures, seen);
  return null;
}

/**
 * Resolve a resource-pack file tree into item-id → texture-key and
 * material → texture-key maps. Supports Catharsis `assets/skyblock/items`
 * mappings as well as ordinary `assets/minecraft` packs.
 */
export function extractPackTextures(files: Map<string, Uint8Array>): ExtractedPack {
  const models = new Map<string, Record<string, unknown>>();
  const textures = new Map<string, string>();
  const textureBytes = new Map<string, Uint8Array>();
  const itemSpecs: Array<{ id: string; path: string; bytes: Uint8Array }> = [];

  for (const [path, bytes] of files) {
    const asset = parseAssetPath(path);
    if (!asset) continue;
    if (asset.kind === "textures") {
      if (!asset.relative.toLowerCase().endsWith(".png")) continue;
      const key = `${asset.namespace}:${withoutExtension(asset.relative, ".png")}`;
      if (!textures.has(key) || scorePath(path) > scorePath(textures.get(key) ?? "")) {
        textures.set(key, path);
        textureBytes.set(path, bytes);
      }
      continue;
    }
    if (asset.kind === "models" && asset.relative.toLowerCase().endsWith(".json")) {
      const parsed = parseJson(bytes);
      if (parsed) {
        models.set(`${asset.namespace}:${withoutExtension(asset.relative, ".json")}`, parsed);
      }
      continue;
    }
    if (
      asset.kind === "items" &&
      asset.namespace === "skyblock" &&
      asset.relative.toLowerCase().endsWith(".json")
    ) {
      itemSpecs.push({
        id: withoutExtension(asset.relative.split("/").pop() ?? "", ".json").toUpperCase(),
        path,
        bytes,
      });
    }
  }

  // Later duplicates are sorted so icon-like contexts win over 3D/legacy ones.
  itemSpecs.sort((a, b) => scorePath(b.path) - scorePath(a.path));

  // Packs do not always put models under `skyblock`. Index item models by
  // basename so `hypixel:item/hyperion` still resolves when the descriptor
  // references a different namespace.
  const modelsByItemName = new Map<string, string[]>();
  for (const key of models.keys()) {
    const match = /^[^:]+:(?:item|items)\/(.+)$/i.exec(key);
    const name = match?.[1]?.toLowerCase();
    if (!name) continue;
    const entries = modelsByItemName.get(name);
    if (entries) entries.push(key);
    else modelsByItemName.set(name, [key]);
  }

  const items: Record<string, string> = {};
  let unresolved = 0;
  for (const spec of itemSpecs) {
    if (!spec.id || items[spec.id]) continue;
    const parsed = parseJson(spec.bytes);
    if (!parsed) {
      unresolved += 1;
      continue;
    }
    const refs: string[] = [];
    collectModelRefs(parsed, refs);
    const direct = resolveModelTexture(`skyblock:item/${spec.id.toLowerCase()}`, models, textures);
    const resolved =
      direct ??
      refs.map((ref) => resolveModelTexture(ref, models, textures)).find((value) => Boolean(value)) ??
      (modelsByItemName.get(spec.id.toLowerCase()) ?? [])
        .map((key) => resolveModelTexture(key, models, textures))
        .find((value) => Boolean(value)) ??
      null;
    if (resolved) items[spec.id] = resolved;
    else unresolved += 1;
  }

  // Older packs (for example FurfSky 1.9.x) ship textures without
  // `assets/skyblock/items` descriptors. Fall back to well-known
  // `textures/item/<id>.png` names so those packs still resolve.
  for (const [key, path] of textures) {
    const match = /^[^:]+:(?:item|items)\/(.+)$/i.exec(key);
    const file = match?.[1]?.split("/").pop();
    if (!file) continue;
    const id = file.toUpperCase();
    if (!items[id]) items[id] = path;
  }

  const materials: Record<string, string> = {};
  for (const [key, path] of textures) {
    const match = /^minecraft:(?:item|items)\/(.+)$/i.exec(key);
    if (!match?.[1]) continue;
    const material = match[1].toLowerCase();
    if (!materials[material]) materials[material] = path;
  }
  for (const [key] of models) {
    const match = /^minecraft:(?:item|items)\/(.+)$/i.exec(key);
    if (!match?.[1] || materials[match[1]]) continue;
    const resolved = resolveModelTexture(key, models, textures);
    if (resolved) materials[match[1].toLowerCase()] = resolved;
  }
  // Block-shaped SkyBlock materials (minions, enchanted blocks, storage) live
  // under textures/blocks in ordinary resource packs.
  for (const [key, path] of textures) {
    const match = /^minecraft:(?:block|blocks)\/(.+)$/i.exec(key);
    if (!match?.[1]) continue;
    const material = match[1].toLowerCase();
    if (!materials[material]) materials[material] = path;
  }

  const usedPaths = new Set<string>([...Object.values(items), ...Object.values(materials)]);
  const packedTextures: Record<string, Uint8Array> = {};
  for (const path of usedPaths) {
    const bytes = textureBytes.get(path);
    if (bytes) packedTextures[path] = bytes;
  }

  return {
    items,
    materials,
    textures: packedTextures,
    stats: {
      itemJsonCount: itemSpecs.length,
      resolvedItems: Object.keys(items).length,
      unresolvedItems: unresolved,
      materialCount: Object.keys(materials).length,
      textureCount: Object.keys(packedTextures).length,
    },
  };
}

/** Locate an embedded `pack.cats` blob inside a ZIP. */
export function findCatsBlob(files: Map<string, Uint8Array>): Uint8Array | null {
  for (const [path, bytes] of files) {
    if (path.toLowerCase().endsWith("pack.cats")) return bytes;
  }
  return null;
}

export function assertPackLooksUsable(pack: ExtractedPack): void {
  if (!Object.keys(pack.items).length && !Object.keys(pack.materials).length) {
    throw new PackError(
      "Pack does not contain SkyBlock item models or Minecraft item textures",
    );
  }
}
