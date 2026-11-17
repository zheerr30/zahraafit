import type { WebGLRenderer } from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

let draco: DRACOLoader | null = null;
let ktx2: KTX2Loader | null = null;

/**
 * GLTFLoader configured for optimized assets: Draco + KTX2 decoders are served
 * locally from /public (copied by scripts/copy-decoders.mjs), Meshopt is bundled.
 */
function createLoader(renderer: WebGLRenderer | null): GLTFLoader {
  const loader = new GLTFLoader();
  draco ??= new DRACOLoader().setDecoderPath("/decoders/draco/gltf/");
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (renderer) {
    ktx2 ??= new KTX2Loader().setTranscoderPath("/decoders/basis/").detectSupport(renderer);
    loader.setKTX2Loader(ktx2);
  }
  return loader;
}

export class AssetLoadError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly kind: "not-found" | "parse" | "network",
  ) {
    super(message);
    this.name = "AssetLoadError";
  }
}

export interface LoadOptions {
  renderer: WebGLRenderer | null;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Load a GLB/GLTF with progress reporting and descriptive errors. */
export function loadGltf(url: string, { renderer, onProgress, signal }: LoadOptions): Promise<GLTF> {
  const loader = createLoader(renderer);
  return new Promise<GLTF>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    loader.load(
      url,
      (gltf) => {
        if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
        resolve(gltf);
      },
      (evt) => {
        if (evt.lengthComputable && evt.total > 0) onProgress?.(evt.loaded / evt.total);
      },
      (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        const notFound = /404|not found/i.test(msg);
        reject(
          new AssetLoadError(
            notFound
              ? `ملف النموذج غير موجود على المسار ${url}.`
              : `تعذّر تحميل النموذج ${url}: ${msg}`,
            url,
            notFound ? "not-found" : /fetch|network/i.test(msg) ? "network" : "parse",
          ),
        );
      },
    );
  });
}
