"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Sphere, Vector3, type Mesh, type PerspectiveCamera } from "three";
import { refineMeshInPlace } from "@/lib/three/refine";

/**
 * On-demand surface refinement (HD): the interpolating PN refinement of
 * lib/three/refine.ts is applied only to the muscles the user is actually
 * inspecting — those around the orbit target once the camera is close
 * (closer than `nearDistance`), plus an optional priority set (e.g. the study
 * region chosen in the atlas). A few meshes per frame within a small time
 * budget, and a cap on the triangles added, keep it smooth on phones.
 * Refined meshes keep their identity (ids, picking, selection, colours).
 */
export interface ProgressiveRefineProps {
  getTarget: (out: Vector3) => void;
  /** Muscle meshes that may be refined (indexed, with baked fibres). */
  getCandidates: () => Mesh[];
  /** Meshes to refine regardless of the camera distance. */
  getPriority?: () => ReadonlySet<Mesh> | null;
  nearDistance?: number;
  /** Maximum number of triangles added in total. */
  cap?: number;
}

const BUDGET_MS = 12;

interface RefineState {
  added: number;
  t: Vector3;
  sphere: Sphere;
}

/** One frame of work; returns true when more meshes are waiting. */
function step(st: RefineState, camera: PerspectiveCamera, p: Required<Pick<ProgressiveRefineProps, "nearDistance" | "cap">> & ProgressiveRefineProps): boolean {
  if (st.added >= p.cap) return false;
  p.getTarget(st.t);
  const dist = camera.position.distanceTo(st.t);
  const near = dist < p.nearDistance;
  const priority = p.getPriority?.() ?? null;
  if (!near && !priority?.size) return false;
  const radius = dist * Math.tan(((camera.fov ?? 30) * Math.PI) / 360) * 1.7;
  const todo: { mesh: Mesh; d: number }[] = [];
  for (const mesh of p.getCandidates()) {
    const g = mesh.geometry;
    if (g.userData.refined || !mesh.visible || !g.getIndex()) continue;
    if (!g.boundingSphere) g.computeBoundingSphere();
    st.sphere.copy(g.boundingSphere!).applyMatrix4(mesh.matrixWorld);
    const d = st.sphere.center.distanceTo(st.t) - st.sphere.radius;
    if (priority?.has(mesh) || (near && d < radius)) todo.push({ mesh, d });
  }
  if (!todo.length) return false;
  todo.sort((a, b) => a.d - b.d);
  const start = performance.now();
  for (const { mesh } of todo) {
    st.added += refineMeshInPlace(mesh);
    if (st.added >= p.cap || performance.now() - start > BUDGET_MS) break;
  }
  return true;
}

export function ProgressiveRefine({ nearDistance = 1.1, cap = 2_600_000, ...rest }: ProgressiveRefineProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const state = useRef<RefineState>({ added: 0, t: new Vector3(), sphere: new Sphere() });
  useFrame(() => {
    // continue next frame (and show the refined surfaces)
    if (step(state.current, camera, { nearDistance, cap, ...rest })) invalidate();
  });
  return null;
}
