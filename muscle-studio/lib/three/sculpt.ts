import { Matrix4, type Mesh, type Object3D } from "three";
import { dequantizeMesh } from "@/lib/three/anatomyModel";

/**
 * Redesigned visual geometry (pipeline/sculpt/*.mjs): built from the original
 * Z-Anatomy meshes with attachments pinned and fibres carried over. The core
 * meshes keep their identity (node, name, extras, side, selection); only their
 * geometry is swapped for the redesigned one with the same Z-Anatomy name.
 * Returns the number of meshes replaced.
 */
export function applySculpt(core: Object3D, sculpt: Object3D): number {
  core.updateMatrixWorld(true);
  sculpt.updateMatrixWorld(true);
  const byName = new Map<string, Mesh>();
  sculpt.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && typeof m.userData.za_name === "string") byName.set(m.userData.za_name, m);
  });
  let n = 0;
  const inv = new Matrix4();
  core.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const s = byName.get(m.userData.za_name as string);
    if (!s) return;
    dequantizeMesh(s); // world-space float geometry
    const g = s.geometry;
    if (m.parent) g.applyMatrix4(inv.copy(m.parent.matrixWorld).invert());
    m.geometry.dispose();
    m.geometry = g;
    m.position.set(0, 0, 0);
    m.quaternion.identity();
    m.scale.set(1, 1, 1);
    m.updateMatrix();
    m.userData.sculpt = s.userData.sculpt ?? true;
    n++;
  });
  core.updateMatrixWorld(true);
  return n;
}
