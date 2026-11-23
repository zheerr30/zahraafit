"use client";

import { useEffect } from "react";
import { Raycaster, Vector2, Vector3 } from "three";
import { pick, refineReport } from "@/lib/region/backModel";
import { backStore } from "@/stores/backStore";
import { regionBridge } from "./BackViewport";

/**
 * window.__backStudioTest (development, or any build with ?e2e=1): lets an E2E
 * script find an on-screen pixel where a given muscle is the first visible
 * surface, then click it with the real mouse.
 */
export function RegionTestHooks() {
  useEffect(() => {
    const enabled = process.env.NODE_ENV !== "production" || new URLSearchParams(window.location.search).has("e2e");
    if (!enabled) return;
    const ray = new Raycaster();
    const v = new Vector3();
    const ndc = new Vector2();
    const api: {
      pointFor: (id: string, side?: "l" | "r" | "m", kind?: string) => { x: number; y: number } | null;
      pointsFor: (id: string, side?: "l" | "r" | "m", kind?: string, max?: number) => { x: number; y: number }[];
      [k: string]: unknown;
    } = {
      /** Screen point (client px) where `kind:id:side` is the first visible hit, or null. */
      pointFor(id: string, side: "l" | "r" | "m" = "l", kind = "unit") {
        return api.pointsFor(id, side, kind, 1)[0] ?? null;
      },
      /** Up to `max` well-separated interior screen points of the structure. */
      pointsFor(id: string, side: "l" | "r" | "m" = "l", kind = "unit", max = 5) {
        const found: { x: number; y: number }[] = [];
        const { model, camera, canvas } = regionBridge;
        if (!model || !camera || !canvas) return found;
        const r = canvas.getBoundingClientRect();
        const meshes = model.meshes.filter((m) => m.kind === kind && m.id === id && (side === "m" || m.side === side) && m.target > 0.3);
        for (const m of meshes) {
          const pos = m.mesh.geometry.getAttribute("position");
          const step = Math.max(1, Math.floor(pos.count / 400));
          for (let i = 0; i < pos.count; i += step) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m.mesh.matrixWorld).project(camera);
            if (Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95 || v.z > 1) continue;
            // Interior points only: the pixel and its ±2 px neighbours must all hit this structure,
            // so a real mouse click (rounded to whole pixels) lands on it too.
            const px = r.left + ((v.x + 1) / 2) * r.width, py = r.top + ((1 - v.y) / 2) * r.height;
            const ok = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].every(([dx, dy]) => {
              ndc.set(((Math.round(px) + dx - r.left) / r.width) * 2 - 1, -((Math.round(py) + dy - r.top) / r.height) * 2 + 1);
              ray.setFromCamera(ndc, camera);
              const hit = pick(model, ray.ray);
              return !!hit && hit.kind === m.kind && hit.id === m.id && hit.side === m.side;
            });
            if (ok && found.every((q) => Math.hypot(q.x - px, q.y - py) > 25)) {
              found.push({ x: Math.round(px), y: Math.round(py) });
              if (found.length >= max) return found;
            }
          }
        }
        return found;
      },
      selected: () => backStore.getState().selected,
      /** Units whose meshes are currently shown (target opacity 1). */
      visibleUnits() {
        const out = new Set<string>();
        for (const m of regionBridge.model?.meshes ?? []) if (m.kind === "unit" && m.target > 0) out.add(m.id);
        return [...out].sort();
      },
      /** Units drawn fully opaque (isolation leaves the rest as ghosts). */
      solidUnits() {
        const out = new Set<string>();
        for (const m of regionBridge.model?.meshes ?? []) if (m.kind === "unit" && m.target === 1) out.add(m.id);
        return [...out].sort();
      },
      visibleKinds() {
        const out: Record<string, number> = {};
        for (const m of regionBridge.model?.meshes ?? []) if (m.target > 0) out[m.kind] = (out[m.kind] ?? 0) + 1;
        return out;
      },
      /** Colour currently shown by a unit's material (hex). */
      unitColor(id: string, side: "l" | "r" = "l") {
        const m = regionBridge.model?.meshes.find((x) => x.kind === "unit" && x.id === id && x.side === side);
        const mat = m?.mesh.material as { color?: { getHexString(): string } } | undefined;
        return mat?.color ? `#${mat.color.getHexString()}` : null;
      },
      /**
       * Where the shown body is on screen: its top, bottom, left and right in px of the 3D
       * view, with the view's size — to check the framing (how much of the height it fills,
       * that head and feet are inside).
       */
      bodyBox() {
        const { model, camera, canvas } = regionBridge;
        if (!model || !camera || !canvas) return null;
        const r = canvas.getBoundingClientRect();
        let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
        for (const m of model.meshes) {
          if (m.target < 0.5 || !(m.kind === "unit" || m.kind === "bone" || m.kind === "tendon")) continue;
          const pos = m.mesh.geometry.getAttribute("position");
          const step = Math.max(1, Math.floor(pos.count / 60));
          for (let i = 0; i < pos.count; i += step) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m.mesh.matrixWorld).project(camera);
            const x = ((v.x + 1) / 2) * r.width, y = ((1 - v.y) / 2) * r.height;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
            if (x < left) left = x;
            if (x > right) right = x;
          }
        }
        return { top: Math.round(top), bottom: Math.round(bottom), left: Math.round(left), right: Math.round(right), width: Math.round(r.width), height: Math.round(r.height) };
      },
      ready: () => !!regionBridge.model,
      /** Totals of the HD surface refinement (triangles, offsets in mm). */
      refine: () => ({ ...refineReport }),
      /** The loaded model object (identity changes when the body is swapped). */
      rawModel: () => regionBridge.model,
      /** Camera position (to wait until a transition has settled). */
      cameraPos: () => {
        const cam = regionBridge.camera as (typeof regionBridge.camera & { view?: { enabled: boolean; offsetX: number; offsetY: number } | null }) | null;
        if (!cam) return null;
        // position + the shift that keeps the subject clear of the panels: both must rest
        const v = cam.view?.enabled ? [Math.round(cam.view.offsetX), Math.round(cam.view.offsetY)] : [0, 0];
        return [...cam.position.toArray().map((x) => +x.toFixed(4)), ...v];
      },
      /** The viewer store, for scripted states in visual checks. */
      store: backStore,
    };
    (window as unknown as { __backStudioTest: typeof api }).__backStudioTest = api;
  }, []);
  return null;
}
