import { Color, MeshStandardMaterial, Vector3, type MeshPhysicalMaterial, type ShaderMaterial } from "three";
import { createMuscleMaterialHD, createTissueMaterialHD } from "./hdMaterials";
import { createMuscleMaterial, HIGHLIGHT_LOOK, REALISTIC_LOOK } from "./muscleMaterial";
import { createSkinMaterial } from "./skinMaterial";
import { createTissueMaterial, type TissueKind } from "./tissue";

export type MaterialVariant = "normal" | "hover";
export type MuscleLookName = "realistic" | "highlight";

const LOOKS = { realistic: REALISTIC_LOOK, highlight: HIGHLIGHT_LOOK };

/**
 * Shared, cached studio materials keyed by color + variant. Meshes swap between
 * cached instances instead of mutating shared materials, so changing one
 * muscle's color can never leak into another mesh. Call dispose() on unmount.
 */
export class MaterialLibrary {
  /** HD: the detailed tissue materials of lib/three/hdMaterials.ts (same as the atlas). */
  readonly hd: boolean;
  constructor(opts: { hd?: boolean } = {}) {
    this.hd = !!opts.hd;
  }
  private cache = new Map<string, MeshStandardMaterial>();
  private skinMaterial: ShaderMaterial | null = null;
  private muscleCache = new Map<string, MeshPhysicalMaterial>();

  /** Shaded muscle material (needs the baked _anat/_flow attributes on the geometry). */
  muscle(hex: string, look: MuscleLookName, variant: MaterialVariant = "normal", layer = 0, depthBias = 0): MeshPhysicalMaterial {
    const key = `${hex.toLowerCase()}|${look}|${variant}|${layer}|${depthBias}`;
    let mat = this.muscleCache.get(key);
    if (!mat) {
      mat = this.hd
        ? createMuscleMaterialHD(hex, LOOKS[look], variant === "hover", { seed: new Vector3(), scale: 1, depthBias })
        : createMuscleMaterial(hex, LOOKS[look], variant === "hover");
      if (layer > 0) {
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = layer;
        mat.polygonOffsetUnits = 2 * layer;
      }
      this.muscleCache.set(key, mat);
    }
    return mat;
  }

  private tissueCache = new Map<string, MeshPhysicalMaterial>();

  /** Shared material of a non-muscle tissue (the same standard as the atlas). */
  tissue(t: TissueKind, vertexColors = false): MeshPhysicalMaterial {
    const key = `${t}|${vertexColors}`;
    let mat = this.tissueCache.get(key);
    if (!mat) {
      mat = this.hd ? createTissueMaterialHD(t, { vertexColors }) : createTissueMaterial(t, { vertexColors });
      this.tissueCache.set(key, mat);
    }
    return mat;
  }

  /** Shared translucent skin material. */
  skin(): ShaderMaterial {
    this.skinMaterial ??= createSkinMaterial();
    return this.skinMaterial;
  }

  get(hex: string, variant: MaterialVariant = "normal"): MeshStandardMaterial {
    const key = `${hex.toLowerCase()}|${variant}`;
    let mat = this.cache.get(key);
    if (!mat) {
      const color = new Color(hex);
      mat = new MeshStandardMaterial({
        color,
        roughness: 0.58,
        metalness: 0,
        envMapIntensity: 0.9,
      });
      if (variant === "hover") {
        mat.emissive = color.clone().multiplyScalar(0.22);
      }
      mat.name = `studio:${key}`;
      this.cache.set(key, mat);
    }
    return mat;
  }

  get size(): number {
    return this.cache.size + this.muscleCache.size;
  }

  dispose(): void {
    for (const mat of this.cache.values()) mat.dispose();
    this.cache.clear();
    for (const mat of this.muscleCache.values()) mat.dispose();
    this.muscleCache.clear();
    for (const mat of this.tissueCache.values()) mat.dispose();
    this.tissueCache.clear();
    this.skinMaterial?.dispose();
    this.skinMaterial = null;
  }
}
