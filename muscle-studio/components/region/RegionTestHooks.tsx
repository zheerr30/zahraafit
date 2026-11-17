"use client";

import { useEffect } from "react";
import { Raycaster, Vector2, Vector3 } from "three";
import { pick } from "@/lib/region/backModel";
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
    const api = {
      /** Screen point (client px) where `kind:id:side` is the first visible hit, or null. */
      pointFor(id: string, side: "l" | "r" | "m" = "l", kind = "unit") {
        const { model, camera, canvas } = regionBridge;
        if (!model || !camera || !canvas) return null;
        const r = canvas.getBoundingClientRect();
        const meshes = model.meshes.filter((m) => m.kind === kind && m.id === id && (side === "m" || m.side === side) && m.target > 0.3);
        for (const m of meshes) {
          const pos = m.mesh.geometry.getAttribute("position");
          const step = Math.max(1, Math.floor(pos.count / 400));
          for (let i = 0; i < pos.count; i += step) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m.mesh.matrixWorld).project(camera);
            if (Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95 || v.z > 1) continue;
            ndc.set(v.x, v.y);
            ray.setFromCamera(ndc, camera);
            const hit = pick(model, ray.ray);
            if (hit && hit.kind === m.kind && hit.id === m.id && hit.side === m.side) {
              return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
            }
          }
        }
        return null;
      },
      selected: () => backStore.getState().selected,
      /** Units whose meshes are currently shown (target opacity 1). */
      visibleUnits() {
        const out = new Set<string>();
        for (const m of regionBridge.model?.meshes ?? []) if (m.kind === "unit" && m.target > 0) out.add(m.id);
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
      ready: () => !!regionBridge.model,
      /** The viewer store, for scripted states in visual checks. */
      store: backStore,
    };
    (window as unknown as { __backStudioTest: typeof api }).__backStudioTest = api;
  }, []);
  return null;
}
