/**
 * Minimal, dependency-free NBT reader for Hypixel inventory blobs.
 *
 * Hypixel stores inventories as base64(gzip(NBT)). We only need a read-only
 * decoder that is defensive against malformed input, so the parser enforces
 * depth, collection and string limits instead of trusting the payload.
 *
 * Format reference: https://minecraft.wiki/w/NBT_format
 */

export type NbtValue = number | bigint | string | NbtValue[] | NbtCompound;

export interface NbtCompound {
  [key: string]: NbtValue;
}

export class NbtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NbtError";
  }
}

const TAG_END = 0;
const TAG_BYTE = 1;
const TAG_SHORT = 2;
const TAG_INT = 3;
const TAG_LONG = 4;
const TAG_FLOAT = 5;
const TAG_DOUBLE = 6;
const TAG_BYTE_ARRAY = 7;
const TAG_STRING = 8;
const TAG_LIST = 9;
const TAG_COMPOUND = 10;
const TAG_INT_ARRAY = 11;
const TAG_LONG_ARRAY = 12;

const MAX_DEPTH = 64;
const MAX_ELEMENTS = 200_000;

class NbtReader {
  private view: DataView;
  private offset = 0;
  private elements = 0;
  private readonly decoder = new TextDecoder("utf-8");
  private readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get position(): number {
    return this.offset;
  }

  get remaining(): number {
    return this.bytes.byteLength - this.offset;
  }

  readRoot(): NbtCompound {
    const type = this.readU8();
    if (type !== TAG_COMPOUND) throw new NbtError(`Unexpected root tag ${type}`);
    this.readString();
    const value = this.readCompound(0);
    return value;
  }

  private ensure(length: number): void {
    if (length < 0 || this.offset + length > this.bytes.byteLength) {
      throw new NbtError("Unexpected end of NBT payload");
    }
  }

  private readU8(): number {
    this.ensure(1);
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  private readI16(): number {
    this.ensure(2);
    const value = this.view.getInt16(this.offset, false);
    this.offset += 2;
    return value;
  }

  private readI32(): number {
    this.ensure(4);
    const value = this.view.getInt32(this.offset, false);
    this.offset += 4;
    return value;
  }

  private readI64(): bigint {
    this.ensure(8);
    const value = this.view.getBigInt64(this.offset, false);
    this.offset += 8;
    return value;
  }

  private readF32(): number {
    this.ensure(4);
    const value = this.view.getFloat32(this.offset, false);
    this.offset += 4;
    return value;
  }

  private readF64(): number {
    this.ensure(8);
    const value = this.view.getFloat64(this.offset, false);
    this.offset += 8;
    return value;
  }

  private readString(): string {
    const length = this.view.getUint16(this.offset, false);
    this.offset += 2;
    if (length > 65_535) throw new NbtError("NBT string is too long");
    this.ensure(length);
    const value = this.decoder.decode(this.bytes.subarray(this.offset, this.offset + length));
    this.offset += length;
    return value;
  }

  private readPayload(type: number, depth: number): NbtValue {
    if (depth > MAX_DEPTH) throw new NbtError("NBT nesting is too deep");
    switch (type) {
      case TAG_BYTE:
        return this.readU8() << 24 >> 24;
      case TAG_SHORT:
        return this.readI16();
      case TAG_INT:
        return this.readI32();
      case TAG_LONG:
        return this.readI64();
      case TAG_FLOAT:
        return this.readF32();
      case TAG_DOUBLE:
        return this.readF64();
      case TAG_BYTE_ARRAY: {
        const length = this.readI32();
        if (length < 0 || length > MAX_ELEMENTS) throw new NbtError("NBT byte array is too large");
        this.ensure(length);
        const values = Array.from(this.bytes.subarray(this.offset, this.offset + length));
        this.offset += length;
        return values;
      }
      case TAG_STRING:
        return this.readString();
      case TAG_LIST: {
        const elementType = this.readU8();
        const length = this.readI32();
        if (length < 0 || length > MAX_ELEMENTS) throw new NbtError("NBT list is too large");
        const values: NbtValue[] = [];
        for (let index = 0; index < length; index += 1) {
          if (elementType === TAG_END) {
            values.push(0);
            continue;
          }
          values.push(this.readPayload(elementType, depth + 1));
        }
        return values;
      }
      case TAG_COMPOUND:
        return this.readCompound(depth + 1);
      case TAG_INT_ARRAY: {
        const length = this.readI32();
        if (length < 0 || length > MAX_ELEMENTS) throw new NbtError("NBT int array is too large");
        const values: number[] = [];
        for (let index = 0; index < length; index += 1) values.push(this.readI32());
        return values;
      }
      case TAG_LONG_ARRAY: {
        const length = this.readI32();
        if (length < 0 || length > MAX_ELEMENTS) throw new NbtError("NBT long array is too large");
        const values: bigint[] = [];
        for (let index = 0; index < length; index += 1) values.push(this.readI64());
        return values;
      }
      default:
        throw new NbtError(`Unknown NBT tag ${type}`);
    }
  }

  private readCompound(depth: number): NbtCompound {
    const result: NbtCompound = {};
    for (let guard = 0; guard < MAX_ELEMENTS; guard += 1) {
      const type = this.readU8();
      if (type === TAG_END) return result;
      const name = this.readString();
      this.elements += 1;
      result[name] = this.readPayload(type, depth);
    }
    throw new NbtError("NBT compound exceeds element limit");
  }
}

export function decodeNbt(bytes: Uint8Array): NbtCompound {
  const reader = new NbtReader(bytes);
  return reader.readRoot();
}

export async function gunzip(bytes: Uint8Array, maxBytes = 16 * 1024 * 1024): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new NbtError("Gzip decompression is not supported in this runtime");
  }
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const result = await reader.read(); if (result.done) break;
    size += result.value.byteLength;
    if (size > maxBytes) throw new NbtError("Decompressed NBT exceeds limit");
    chunks.push(result.value);
  } } finally { await reader.cancel(); }
  const output = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

export async function decodeBase64GzipNbt(base64: string, maxBytes = 16 * 1024 * 1024): Promise<NbtCompound> {
  if (base64.length > 8 * 1024 * 1024) throw new NbtError("Compressed NBT exceeds limit");
  const cleaned = base64.replace(/\s/g, "").replace(/\\u003d/gi, "=").replace(/\\u002b/gi, "+").replace(/\\u002f/gi, "/");
  let binary: string;
  try {
    binary = atob(cleaned);
  } catch (error) {
    throw new NbtError(`Invalid base64 inventory data: ${(error as Error).message}`);
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const decompressed = await gunzip(bytes, maxBytes);
  return decodeNbt(decompressed);
}

export function asCompound(value: NbtValue | undefined): NbtCompound | null {
  return value && typeof value === "object" && !Array.isArray(value) && typeof value !== "bigint" ? value : null;
}

export function asNumber(value: NbtValue | undefined, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return fallback;
}

export function asString(value: NbtValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}
