import {
  DEFAULT_PACK_LIMITS,
  PackError,
  assertWithinLimits,
  inflateRaw,
  isRelevantPackFile,
  safePackPath,
  type TexturePackLimits,
} from "./pack-format";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

interface CentralEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
}

function findEndOfCentralDirectory(view: DataView): number {
  const min = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  throw new PackError("Not a ZIP archive (no end-of-central-directory record)");
}

function readCentralDirectory(view: DataView, buffer: ArrayBuffer, limits: TexturePackLimits): CentralEntry[] {
  const eocd = findEndOfCentralDirectory(view);
  const entries = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (entries === 0xffff || directoryOffset === 0xffffffff || directorySize === 0xffffffff) {
    throw new PackError("ZIP64 archives are not supported");
  }
  if (entries > limits.maxEntries) throw new PackError("ZIP archive has too many entries");
  if (directoryOffset + directorySize > buffer.byteLength) {
    throw new PackError("ZIP central directory points outside the archive");
  }

  const result: CentralEntry[] = [];
  let offset = directoryOffset;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > buffer.byteLength || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new PackError("Corrupt ZIP central directory");
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameStart = offset + 46;
    if (nameStart + nameLength > buffer.byteLength) throw new PackError("Corrupt ZIP entry name");
    if (flags & 0x1) throw new PackError("Encrypted ZIP entries are not supported");
    const name = new TextDecoder("utf-8").decode(
      new Uint8Array(buffer, nameStart, nameLength),
    );
    result.push({
      name: safePackPath(name),
      method,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    offset = nameStart + nameLength + extraLength + commentLength;
  }
  return result;
}

export async function parseZip(
  buffer: ArrayBuffer,
  limits: TexturePackLimits = DEFAULT_PACK_LIMITS,
): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buffer);
  const entries = readCentralDirectory(view, buffer, limits);
  const result = new Map<string, Uint8Array>();
  let total = 0;

  for (const entry of entries) {
    if (!isRelevantPackFile(entry.name)) continue;
    if (entry.uncompressedSize > limits.maxFileBytes) {
      throw new PackError(`ZIP entry is too large: ${entry.name}`);
    }
    if (entry.method !== 0 && entry.method !== 8) {
      throw new PackError(`Unsupported ZIP compression method ${entry.method}`);
    }
    if (
      entry.compressedSize > 0 &&
      entry.uncompressedSize > 1024 * 1024 &&
      entry.uncompressedSize / entry.compressedSize > limits.maxCompressionRatio
    ) {
      throw new PackError(`Suspicious ZIP compression ratio: ${entry.name}`);
    }
    if (entry.localOffset + 30 > buffer.byteLength) throw new PackError("Corrupt ZIP local header");
    if (view.getUint32(entry.localOffset, true) !== LOCAL_SIGNATURE) {
      throw new PackError("Corrupt ZIP local header signature");
    }
    const nameLength = view.getUint16(entry.localOffset + 26, true);
    const extraLength = view.getUint16(entry.localOffset + 28, true);
    const dataStart = entry.localOffset + 30 + nameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > buffer.byteLength) throw new PackError("ZIP entry points outside the archive");

    let bytes =
      entry.method === 0
        ? new Uint8Array(buffer.slice(dataStart, dataEnd))
        : await inflateRaw(new Uint8Array(buffer, dataStart, entry.compressedSize));
    if (bytes.byteLength > limits.maxFileBytes) {
      throw new PackError(`ZIP entry expands beyond the limit: ${entry.name}`);
    }
    assertWithinLimits(bytes.byteLength, total, limits);
    total += bytes.byteLength;
    result.set(entry.name, bytes);
    // Avoid retaining more than the configured budget.
    if (total > limits.maxTotalBytes) throw new PackError("ZIP archive is too large");
  }

  return result;
}

export function isZipArchive(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  return new DataView(buffer).getUint32(0, true) === LOCAL_SIGNATURE;
}
