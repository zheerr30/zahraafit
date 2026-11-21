"use client";

import { useEffect } from "react";
import { Raycaster, Vector2, Vector3 } from "three";
import { raycastPickable } from "@/lib/three/anatomyModel";
import { viewportBridge } from "@/lib/three/viewportBridge";
import { editorStore } from "@/stores/editorStore";

declare global {
  interface Window {
    __muscleStudioTest?: {
      pointFor: (muscleId: string) => { x: number; y: number } | null;
      selected: () => string[];
      clear: () => void;
    };
  }
}

const OFFSETS = [
  [0, 0],
  [3, 0],
  [-3, 0],
  [0, 3],
  [0, -3],
];

/**
 * Read-only hooks for end-to-end tests: a screen point where a muscle is
 * robustly visible (the same muscle is hit within ±3 px), and the selection.
 * Enabled in development or with `?e2e=1`.
 */
export function TestHooks() {
  useEffect(() => {
    const enabled =
      process.env.NODE_ENV !== "production" || new URLSearchParams(window.location.search).has("e2e");
    if (!enabled) return;
    window.__muscleStudioTest = {
      pointFor(muscleId) {
        const h = viewportBridge.handles;
        const loaded = viewportBridge.loaded;
        if (!h || !loaded) return null;
        h.camera.updateMatrixWorld();
        const rect = h.gl.domElement.getBoundingClientRect();
        const raycaster = new Raycaster();
        (raycaster as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
        const ndc = new Vector2();
        const hitsMuscle = (px: number, py: number) => {
          ndc.set((px / rect.width) * 2 - 1, -(py / rect.height) * 2 + 1);
          raycaster.setFromCamera(ndc, h.camera);
          const hit = raycastPickable(loaded.model, raycaster);
          return hit ? loaded.report.byMesh.get(hit.object.uuid)?.muscleId === muscleId : false;
        };
        const candidates: { x: number; y: number; d: number }[] = [];
        for (const uid of loaded.report.byMuscle.get(muscleId) ?? []) {
          const mesh = loaded.model.meshByUid.get(uid);
          if (!mesh) continue;
          const pos = mesh.geometry.getAttribute("position");
          const stride = Math.max(1, Math.floor(pos.count / 400));
          const c = mesh.geometry.boundingBox!.getCenter(new Vector3()).applyMatrix4(mesh.matrixWorld).project(h.camera);
          for (let i = 0; i < pos.count; i += stride) {
            const v = new Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(h.camera);
            if (Math.abs(v.x) > 0.98 || Math.abs(v.y) > 0.98 || v.z > 1) continue;
            candidates.push({ x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height, d: (v.x - c.x) ** 2 + (v.y - c.y) ** 2 });
          }
        }
        candidates.sort((a, b) => a.d - b.d);
        for (const p of candidates) {
          if (OFFSETS.every(([dx, dy]) => hitsMuscle(p.x + dx, p.y + dy))) {
            return { x: rect.left + p.x, y: rect.top + p.y };
          }
        }
        return null;
      },
      selected: () => Object.keys(editorStore.getState().doc.selections),
      clear: () => editorStore.getState().clearSelection(),
    };
    return () => {
      delete window.__muscleStudioTest;
    };
  }, []);
  return null;
}
