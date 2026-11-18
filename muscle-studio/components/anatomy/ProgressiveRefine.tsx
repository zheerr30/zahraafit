"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Sphere, Vector3, type Mesh, type PerspectiveCamera } from "three";
import { refineMeshInPlace, unrefineMeshInPlace } from "@/lib/three/refine";

/**
 * On-demand surface refinement (HD): the interpolating PN refinement of
 * lib/three/refine.ts is applied only to the muscles the user is actually
 * inspecting — those around the orbit target once the camera is close
 * (closer than `nearDistance`), plus an optional priority set (e.g. the study
 * region chosen in the atlas). A few meshes per frame within a small time
 * budget, and a cap on the triangles added — refinement of muscles that are
 * no longer in view is released first — keep it smooth on phones.
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
  refined: Set<Mesh>;
  t: Vector3;
  sphere: Sphere;
}

function distTo(st: RefineState, m: Mesh): number {
  const g = m.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  st.sphere.copy(g.boundingSphere!).applyMatrix4(m.matrixWorld);
  return st.sphere.center.distanceTo(st.t) - st.sphere.radius;
}
function inView(st: RefineState, m: Mesh, radius: number): boolean {
  return distTo(st, m) < radius;
}

/** One frame of work; returns true when something was refined (more may be waiting). */
function step(st: RefineState, camera: PerspectiveCamera, p: Required<Pick<ProgressiveRefineProps, "nearDistance" | "cap">> & ProgressiveRefineProps): boolean {
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
  const wanted = new Set(todo.map((x) => x.mesh));
  const start = performance.now();
  let did = false;
  for (const { mesh } of todo) {
    const est = (mesh.geometry.getIndex()!.count / 3) * 3;
    if (st.added + est > p.cap) {
      // Release the refinement of meshes that are out of view, farthest first.
      const out = [...st.refined].filter((m) => !wanted.has(m) && !(m.visible && inView(st, m, radius * 1.2)));
      out.sort((a, b) => distTo(st, b) - distTo(st, a));
      while (st.added + est > p.cap && out.length) {
        const m = out.shift()!;
        st.added -= unrefineMeshInPlace(m);
        st.refined.delete(m);
      }
      if (st.added + est > p.cap) break;
    }
    st.added += refineMeshInPlace(mesh);
    st.refined.add(mesh);
    did = true;
    if (performance.now() - start > BUDGET_MS) break;
  }
  // Ask for another frame only when work was done (never spin when the budget is full).
  return did;
}

export function ProgressiveRefine({ nearDistance = 1.3, cap = 1_500_000, ...rest }: ProgressiveRefineProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const state = useRef<RefineState>({ added: 0, refined: new Set(), t: new Vector3(), sphere: new Sphere() });
  useFrame(() => {
    // continue next frame (and show the refined surfaces)
    if (step(state.current, camera, { nearDistance, cap, ...rest })) invalidate();
  });
  return null;
}
