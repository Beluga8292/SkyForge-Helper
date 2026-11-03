/**
 * Local texture pack support.
 *
 * FurfSky Reborn is All Rights Reserved: the app never bundles or downloads it.
 * The user selects a pack they already have; textures are parsed and cached
 * locally for personal use only. Only vanilla Minecraft textures are fetched
 * from Mojang's official asset service, also cached locally.
 */

export interface TexturePackLimits {
  maxEntries: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxDepth: number;
  maxCompressionRatio: number;
}

export const DEFAULT_PACK_LIMITS: TexturePackLimits = {
  maxEntries: 30_000,
  maxFileBytes: 32 * 1024 * 1024,
  maxTotalBytes: 512 * 1024 * 1024,
  maxDepth: 24,
  maxCompressionRatio: 400,
};

export class PackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackError";
  }
}

/** Reject absolute paths, traversal and control characters before writing. */
export function safePackPath(raw: string): string {
  const value = raw.replaceAll("\\", "/");
  if (!value || value.includes("\0")) throw new PackError("Invalid empty pack path");
  if (value.startsWith("/")) throw new PackError(`Absolute pack path: ${value}`);
  const parts = value.split("/");
  if (parts.some((part) => part === ".." || part === ".")) {
    throw new PackError(`Unsafe pack path: ${value}`);
  }
  return value;
}

export function assertWithinLimits(
  size: number,
  total: number,
  limits: TexturePackLimits,
): void {
  if (size < 0 || size > limits.maxFileBytes) {
    throw new PackError("Texture exceeds the per-file size limit");
  }
  if (total + size > limits.maxTotalBytes) {
    throw new PackError("Pack exceeds the total uncompressed size limit");
  }
}

export async function gunzip(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Extension filter used by both ZIP and CATS containers. */
export function isRelevantPackFile(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".json") ||
    lower.endsWith("pack.cats") ||
    lower.endsWith(".mcmeta")
  );
}
