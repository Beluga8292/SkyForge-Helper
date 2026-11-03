import { describe, expect, it } from "vitest";
import { DEFAULT_PACK_LIMITS, PackError, safePackPath } from "@/features/textures/pack-format";
import { parseCats, readCatsDirectory } from "@/features/textures/cats";
import { parseZip } from "@/features/textures/zip";
import { extractPackTextures, findCatsBlob } from "@/features/textures/pack";

interface CatsFile {
  path: string;
  data: Uint8Array;
  gzip?: boolean;
}

interface DirNode {
  children: Map<string, DirNode | CatsFile>;
}

function buildCatsTree(files: CatsFile[]): DirNode {
  const root: DirNode = { children: new Map() };
  for (const file of files) {
    const parts = file.path.split("/");
    let node = root;
    for (const part of parts.slice(0, -1)) {
      const existing = node.children.get(part);
      if (existing && "children" in existing) {
        node = existing;
      } else {
        const next: DirNode = { children: new Map() };
        node.children.set(part, next);
        node = next;
      }
    }
    const leaf = parts[parts.length - 1];
    if (leaf) node.children.set(leaf, file);
  }
  return root;
}

function encodeDirectory(
  dir: DirNode,
  offsetOf: (path: string) => number,
  prefix = "",
): number[] {
  const bytes: number[] = [];
  const pushU16 = (value: number) => bytes.push((value >> 8) & 0xff, value & 0xff);
  const pushI32 = (value: number) =>
    bytes.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
  pushU16(dir.children.size);
  for (const [name, entry] of dir.children) {
    const path = prefix ? `${prefix}/${name}` : name;
    const nameBytes = [...new TextEncoder().encode(name)];
    if ("children" in entry) {
      bytes.push(1, nameBytes.length, ...nameBytes);
      bytes.push(...encodeDirectory(entry, offsetOf, path));
    } else {
      const payload = (entry as CatsFile & { payload?: Uint8Array }).payload ?? entry.data;
      bytes.push(0, nameBytes.length, ...nameBytes);
      pushI32(offsetOf(path));
      pushI32(payload.length);
      bytes.push(entry.gzip ? 0xfe : 0xff);
    }
  }
  return bytes;
}

async function gzipBytes(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function buildCats(files: CatsFile[]): Promise<ArrayBuffer> {
  const prepared = await Promise.all(
    files.map(async (file) => ({
      ...file,
      payload: file.gzip ? await gzipBytes(file.data) : file.data,
    })),
  );
  const tree = buildCatsTree(prepared as CatsFile[]);
  const offsets = new Map<string, number>();
  let cursor = 0;
  for (const file of prepared) {
    offsets.set(file.path, cursor);
    cursor += file.payload.length;
  }
  const directory = encodeDirectory(tree, (path) => offsets.get(path) ?? 0);
  const total = 5 + directory.length + cursor;
  const buffer = new Uint8Array(total);
  const view = new DataView(buffer.buffer);
  view.setInt32(0, 0x43415453, false);
  view.setUint8(4, 1);
  buffer.set(directory, 5);
  let dataCursor = 5 + directory.length;
  for (const file of prepared) {
    buffer.set(file.payload, dataCursor);
    dataCursor += file.payload.length;
  }
  return buffer.buffer;
}

interface ZipFile {
  name: string;
  data: Uint8Array;
  deflate?: boolean;
}

async function deflateBytes(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function buildZip(files: ZipFile[]): Promise<ArrayBuffer> {
  const prepared = await Promise.all(
    files.map(async (file) => ({
      ...file,
      payload: file.deflate ? await deflateBytes(file.data) : file.data,
    })),
  );
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  for (const file of prepared) {
    const name = new TextEncoder().encode(file.name);
    const local = new Uint8Array(30 + name.length + file.payload.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, file.deflate ? 8 : 0, true);
    lv.setUint32(14, 0, true);
    lv.setUint32(18, file.payload.length, true);
    lv.setUint32(22, file.data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(file.payload, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, file.deflate ? 8 : 0, true);
    cv.setUint32(16, 0, true);
    cv.setUint32(20, file.payload.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralParts.push(central);

    localOffset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, prepared.length, true);
  ev.setUint16(10, prepared.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, localOffset, true);

  const total = localOffset + centralSize + eocd.length;
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output.buffer;
}

const text = (value: string) => new TextEncoder().encode(value);

describe("texture pack path safety", () => {
  it("accepts normal resource-pack paths", () => {
    expect(safePackPath("assets/minecraft/textures/item/iron_sword.png")).toBe(
      "assets/minecraft/textures/item/iron_sword.png",
    );
    expect(safePackPath("assets\\skyblock\\items\\hyperion.json")).toBe(
      "assets/skyblock/items/hyperion.json",
    );
  });

  it("rejects traversal, absolute and NUL paths", () => {
    expect(() => safePackPath("../evil.png")).toThrow(PackError);
    expect(() => safePackPath("assets/../../evil.png")).toThrow(PackError);
    expect(() => safePackPath("/etc/passwd")).toThrow(PackError);
    expect(() => safePackPath("assets/\0evil.png")).toThrow(PackError);
  });
});

describe("Catharsis reader", () => {
  it("reads nested files and gzip entries", async () => {
    const buffer = await buildCats([
      { path: "assets/minecraft/textures/item/iron_sword.png", data: text("sword") },
      { path: "assets/skyblock/items/hyperion.json", data: text("{\"model\":\"x:y\"}"), gzip: true },
    ]);
    const directory = readCatsDirectory(buffer);
    expect(directory.version).toBe(1);
    expect(directory.files.map((file) => file.path)).toEqual([
      "assets/minecraft/textures/item/iron_sword.png",
      "assets/skyblock/items/hyperion.json",
    ]);
    const files = await parseCats(buffer);
    expect(files.get("assets/minecraft/textures/item/iron_sword.png")).toEqual(text("sword"));
    expect(files.get("assets/skyblock/items/hyperion.json")).toEqual(text("{\"model\":\"x:y\"}"));
  });

  it("rejects a truncated or foreign container", async () => {
    await expect(parseCats(new Uint8Array([1, 2, 3]).buffer)).rejects.toBeInstanceOf(PackError);
    const foreign = new Uint8Array(8);
    new DataView(foreign.buffer).setInt32(0, 0x504b0304, false);
    await expect(parseCats(foreign.buffer)).rejects.toBeInstanceOf(PackError);
  });
});

describe("ZIP reader", () => {
  it("reads stored and deflated entries", async () => {
    const buffer = await buildZip([
      { name: "assets/minecraft/textures/item/diamond.png", data: text("diamond") },
      { name: "assets/skyblock/items/terminator.json", data: text("{\"model\":\"skyblock:terminator\"}"), deflate: true },
    ]);
    const files = await parseZip(buffer);
    expect(files.get("assets/minecraft/textures/item/diamond.png")).toEqual(text("diamond"));
    expect(files.get("assets/skyblock/items/terminator.json")).toEqual(
      text("{\"model\":\"skyblock:terminator\"}"),
    );
  });

  it("rejects path traversal entries", async () => {
    const buffer = await buildZip([{ name: "../escape.png", data: text("bad") }]);
    await expect(parseZip(buffer)).rejects.toBeInstanceOf(PackError);
  });

  it("enforces per-file limits", async () => {
    const buffer = await buildZip([{ name: "assets/a.png", data: new Uint8Array(64) }]);
    await expect(
      parseZip(buffer, { ...DEFAULT_PACK_LIMITS, maxFileBytes: 16 }),
    ).rejects.toBeInstanceOf(PackError);
  });
});

describe("pack extraction", () => {
  const files = new Map<string, Uint8Array>([
    [
      "assets/skyblock/items/hyperion.json",
      text(
        JSON.stringify({
          model: { type: "model", model: "hypixel_skyblock:item/uncategorized/hyperion" },
        }),
      ),
    ],
    [
      "assets/hypixel_skyblock/models/item/uncategorized/hyperion.json",
      text(
        JSON.stringify({
          parent: "item/handheld",
          textures: { layer0: "hypixel_skyblock:item/uncategorized/hyperion" },
        }),
      ),
    ],
    [
      "assets/hypixel_skyblock/textures/item/uncategorized/hyperion.png",
      text("hyperion-png"),
    ],
    [
      "assets/minecraft/textures/item/diamond.png",
      text("diamond-png"),
    ],
  ]);

  it("maps SkyBlock item ids through model refs to texture keys", () => {
    const pack = extractPackTextures(files);
    expect(pack.items.HYPERION).toBe(
      "assets/hypixel_skyblock/textures/item/uncategorized/hyperion.png",
    );
    expect(pack.materials.diamond).toBe("assets/minecraft/textures/item/diamond.png");
    // HYPERION resolves through the SkyBlock model descriptor and DIAMOND
    // resolves through the texture-name fallback used by legacy packs.
    expect(pack.items.DIAMOND).toBe("assets/minecraft/textures/item/diamond.png");
    expect(pack.stats.resolvedItems).toBe(2);
    expect(pack.stats.materialCount).toBe(1);
    expect(pack.textures["assets/hypixel_skyblock/textures/item/uncategorized/hyperion.png"]).toBeTruthy();
  });

  it("locates an embedded pack.cats blob", () => {
    const blob = new Uint8Array([1, 2, 3]);
    const zip = new Map<string, Uint8Array>([["FurfSky Reborn/pack.cats", blob]]);
    expect(findCatsBlob(zip)).toBe(blob);
    expect(findCatsBlob(new Map())).toBeNull();
  });

  it("resolves an item model by basename when the descriptor namespace differs", () => {
    const pack = extractPackTextures(
      new Map<string, Uint8Array>([
        [
          "assets/skyblock/items/yeti_sword.json",
          text(JSON.stringify({ model: { type: "model", model: "skyblock:item/missing" } })),
        ],
        [
          "assets/hypixel/models/item/yeti_sword.json",
          text(JSON.stringify({ textures: { layer0: "hypixel:item/yeti_sword" } })),
        ],
        [
          "assets/hypixel/textures/item/yeti_sword.png",
          text("yeti-sword-png"),
        ],
      ]),
    );
    expect(pack.items.YETI_SWORD).toBe(
      "assets/hypixel/textures/item/yeti_sword.png",
    );
  });

  it("indexes block textures as materials for block-shaped items", () => {
    const pack = extractPackTextures(
      new Map<string, Uint8Array>([
        [
          "assets/minecraft/textures/blocks/iron_block.png",
          text("iron-block-png"),
        ],
      ]),
    );
    expect(pack.materials.iron_block).toBe(
      "assets/minecraft/textures/blocks/iron_block.png",
    );
  });
});
