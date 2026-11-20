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

/** How a failed load is told apart: missing file, dropped connection, or a file that cannot be read. */
function classify(msg: string): AssetLoadError["kind"] {
  if (/404|not found/i.test(msg)) return "not-found";
  // "Load failed" (Safari), "Failed to fetch" (Chrome), "NetworkError…" (Firefox), HTTP 5xx / 429 from the host
  if (/load failed|failed to fetch|networkerror|network|fetch|responded with (5\d\d|429)|timed? ?out|aborted/i.test(msg)) return "network";
  return "parse";
}

/** Pauses before the 2nd and 3rd attempt of a download that was cut off (ms). */
const RETRY_DELAYS = [1200, 3500];

/**
 * Load a GLB/GLTF with progress reporting and descriptive errors.
 * The model files are large (tens of MB): a download cut off by the connection —
 * common on mobile data — is tried again twice before the error is reported.
 */
export function loadGltf(url: string, { renderer, onProgress, signal }: LoadOptions): Promise<GLTF> {
  const loader = createLoader(renderer);
  return new Promise<GLTF>((resolve, reject) => {
    const aborted = () => new DOMException("Aborted", "AbortError");
    if (signal?.aborted) return reject(aborted());
    const attempt = (n: number) => {
      loader.load(
        url,
        (gltf) => {
          if (signal?.aborted) return reject(aborted());
          resolve(gltf);
        },
        (evt) => {
          if (evt.lengthComputable && evt.total > 0) onProgress?.(evt.loaded / evt.total);
        },
        (err) => {
          if (signal?.aborted) return reject(aborted());
          const msg = err instanceof Error ? err.message : String(err);
          const kind = classify(msg);
          if (kind === "network" && n < RETRY_DELAYS.length) {
            onProgress?.(0);
            setTimeout(() => (signal?.aborted ? reject(aborted()) : attempt(n + 1)), RETRY_DELAYS[n]);
            return;
          }
          reject(
            new AssetLoadError(
              kind === "not-found"
                ? `ملف النموذج غير موجود على المسار ${url}.`
                : kind === "network"
                  ? "انقطع الاتصال أثناء تنزيل النموذج (ملف كبير، نحو 27 ميغابايت) بعد ثلاث محاولات. يرجى التحقق من الاتصال ثم إعادة المحاولة."
                  : `تعذر قراءة ملف النموذج ${url}: ${msg}`,
              url,
              kind,
            ),
          );
        },
      );
    };
    attempt(0);
  });
}
