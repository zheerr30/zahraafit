import type { Material, Object3D, Texture } from "three";
import { Mesh } from "three";

function disposeMaterial(material: Material, seen: Set<unknown>) {
  if (seen.has(material)) return;
  seen.add(material);
  for (const value of Object.values(material)) {
    const tex = value as Texture | null;
    if (tex && typeof tex === "object" && (tex as Texture).isTexture && !seen.has(tex)) {
      seen.add(tex);
      tex.dispose();
    }
  }
  material.dispose();
}

/**
 * Release GPU resources owned by an object tree: geometries, materials and
 * their textures. Each resource is disposed at most once.
 */
export function disposeObject3D(root: Object3D): void {
  const seen = new Set<unknown>();
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    if (obj.geometry && !seen.has(obj.geometry)) {
      seen.add(obj.geometry);
      obj.geometry.dispose();
    }
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) if (m) disposeMaterial(m, seen);
    const original = obj.userData.originalMaterial as Material | Material[] | undefined;
    if (original) {
      for (const m of Array.isArray(original) ? original : [original]) disposeMaterial(m, seen);
    }
  });
}
