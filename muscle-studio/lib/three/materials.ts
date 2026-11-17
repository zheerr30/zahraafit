import { Color, MeshStandardMaterial, type ShaderMaterial } from "three";
import { createSkinMaterial } from "./skinMaterial";

export type MaterialVariant = "normal" | "hover";

/**
 * Shared, cached studio materials keyed by color + variant. Meshes swap between
 * cached instances instead of mutating shared materials, so changing one
 * muscle's color can never leak into another mesh. Call dispose() on unmount.
 */
export class MaterialLibrary {
  private cache = new Map<string, MeshStandardMaterial>();
  private skinMaterial: ShaderMaterial | null = null;

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
    return this.cache.size;
  }

  dispose(): void {
    for (const mat of this.cache.values()) mat.dispose();
    this.cache.clear();
    this.skinMaterial?.dispose();
    this.skinMaterial = null;
  }
}
