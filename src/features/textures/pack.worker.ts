/// <reference lib="webworker" />
import { parseCats } from "./cats";
import { parseZip, isZipArchive } from "./zip";
import { extractPackTextures, findCatsBlob, type ExtractedPack } from "./pack";
import { PackError } from "./pack-format";

export interface PackWorkerRequest {
  id: number;
  buffer: ArrayBuffer;
}

export interface PackWorkerSuccess {
  id: number;
  ok: true;
  pack: ExtractedPack;
}

export interface PackWorkerFailure {
  id: number;
  ok: false;
  error: string;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", (event: MessageEvent<PackWorkerRequest>) => {
  const { id, buffer } = event.data;
  void (async () => {
    try {
      const magic = new DataView(buffer).getUint32(0, false);
      let files: Map<string, Uint8Array>;
      if (magic === 0x43415453) {
        files = await parseCats(buffer);
      } else if (isZipArchive(buffer)) {
        const zip = await parseZip(buffer);
        const cats = findCatsBlob(zip);
        files = cats ? await parseCats(cats.slice().buffer) : zip;
      } else {
        throw new PackError("Unsupported pack container: expected a ZIP or Catharsis pack");
      }
      const pack = extractPackTextures(files);
      ctx.postMessage({ id, ok: true, pack } satisfies PackWorkerSuccess);
    } catch (error) {
      ctx.postMessage({
        id,
        ok: false,
        error: error instanceof Error ? error.message : "Texture pack import failed",
      } satisfies PackWorkerFailure);
    }
  })();
});
