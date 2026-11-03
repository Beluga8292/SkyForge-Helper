import {
  DEFAULT_PACK_LIMITS,
  PackError,
  assertWithinLimits,
  gunzip,
  isRelevantPackFile,
  safePackPath,
  type TexturePackLimits,
} from "./pack-format";

/**
 * Catharsis `pack.cats` reader. Format reference:
 * https://catharsis.meowdd.ing/miscellaneous/cats_file_format.html
 *
 * Header: magic "CATS" (0x43415453), version byte, root directory.
 * Directory: big-endian uint16 entry count, then entries.
 * Entry: type (0 file, 1 directory), name length, name.
 * File: big-endian int32 offset, int32 size, compression (0xFF none, 0xFE gzip).
 * Offsets are relative to the data section immediately after the directory.
 */
const CATS_MAGIC = 0x43415453;

class Reader {
  private offset = 0;
  private readonly view: DataView;

  constructor(view: DataView) {
    this.view = view;
  }

  get position(): number {
    return this.offset;
  }

  u8(): number {
    this.need(1);
    return this.view.getUint8(this.offset++);
  }

  u16(): number {
    this.need(2);
    const value = this.view.getUint16(this.offset, false);
    this.offset += 2;
    return value;
  }

  i32(): number {
    this.need(4);
    const value = this.view.getInt32(this.offset, false);
    this.offset += 4;
    return value;
  }

  name(length: number): string {
    this.need(length);
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
    this.offset += length;
    return new TextDecoder("utf-8").decode(bytes);
  }

  private need(bytes: number): void {
    if (this.offset + bytes > this.view.byteLength) {
      throw new PackError("Truncated Catharsis pack");
    }
  }
}

export interface CatsEntry {
  path: string;
  offset: number;
  size: number;
  compression: number;
}

export function readCatsDirectory(buffer: ArrayBuffer, limits = DEFAULT_PACK_LIMITS): {
  version: number;
  dataStart: number;
  files: CatsEntry[];
} {
  if (buffer.byteLength < 5) throw new PackError("Not a Catharsis pack");
  const reader = new Reader(new DataView(buffer));
  if (reader.i32() !== CATS_MAGIC) throw new PackError("Not a Catharsis pack (bad magic)");
  const version = reader.u8();
  const files: CatsEntry[] = [];
  let entries = 0;

  const walk = (prefix: string, depth: number): void => {
    if (depth > limits.maxDepth) throw new PackError("Catharsis directory is too deep");
    const count = reader.u16();
    entries += count;
    if (entries > limits.maxEntries) throw new PackError("Catharsis pack has too many entries");
    for (let index = 0; index < count; index += 1) {
      const type = reader.u8();
      const nameLength = reader.u8();
      const rawName = reader.name(nameLength);
      const name = safePackPath(rawName);
      const child = prefix ? `${prefix}/${name}` : name;
      if (type === 1) {
        walk(child, depth + 1);
      } else if (type === 0) {
        const offset = reader.i32();
        const size = reader.i32();
        const compression = reader.u8();
        if (size < 0 || offset < 0) throw new PackError("Negative Catharsis entry bounds");
        files.push({ path: child, offset, size, compression });
      } else {
        throw new PackError(`Unknown Catharsis entry type ${type}`);
      }
    }
  };

  walk("", 0);
  return { version, dataStart: reader.position, files };
}

export async function parseCats(
  buffer: ArrayBuffer,
  limits: TexturePackLimits = DEFAULT_PACK_LIMITS,
): Promise<Map<string, Uint8Array>> {
  const { dataStart, files } = readCatsDirectory(buffer, limits);
  const result = new Map<string, Uint8Array>();
  let total = 0;

  for (const file of files) {
    if (!isRelevantPackFile(file.path)) continue;
    if (file.compression !== 0xff && file.compression !== 0xfe) {
      throw new PackError(`Unsupported Catharsis compression ${file.compression}`);
    }
    if (file.size > limits.maxFileBytes) throw new PackError("Catharsis file is too large");
    const start = dataStart + file.offset;
    const end = start + file.size;
    if (start < dataStart || end > buffer.byteLength) {
      throw new PackError("Catharsis entry points outside the archive");
    }
    let bytes = new Uint8Array(buffer, start, file.size);
    if (file.compression === 0xfe) {
      bytes = await gunzip(bytes);
      if (bytes.byteLength > limits.maxFileBytes) {
        throw new PackError("Catharsis gzip entry is too large");
      }
    }
    assertWithinLimits(bytes.byteLength, total, limits);
    total += bytes.byteLength;
    result.set(file.path, bytes);
  }

  return result;
}
