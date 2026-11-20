"use client";

import { useEffect, useSyncExternalStore, type RefObject } from "react";
import { backStore } from "@/stores/backStore";
import { regionBridge } from "./BackViewport";

/** Short names of the body regions (buttons of equal size; the full names stay as titles). */
export const REGION_SHORT: Record<string, string> = {
  "head-neck": "الرأس والعنق",
  chest: "الصدر",
  back: "الظهر",
  shoulders: "الكتفان",
  arms: "الذراعان",
  abdomen: "البطن",
  pelvis: "الحوض والألوية",
  thigh: "الفخذ",
  adductors: "المقرِّبات",
  legs: "الساق والقدم",
};

const DESKTOP = "(min-width: 1024px)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(DESKTOP);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
/** Desktop layout (dock column, floating side panel) vs phone layout (bottom bar, sheets). */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches, () => true);
}
export const isDesktopNow = () => typeof window !== "undefined" && window.matchMedia(DESKTOP).matches;

/**
 * How much of the 3D view a panel covers, reported to the store so the camera keeps
 * its subject in the free part: `bottom` for a sheet, `left` for the side panel
 * (the end side of this right-to-left layout). Several panels may cover the same
 * side; the largest counts.
 */
const covers: Record<string, { side: "left" | "bottom"; px: number }> = {};
function publish(): void {
  const max = (side: "left" | "bottom") => Math.max(0, ...Object.values(covers).filter((c) => c.side === side).map((c) => c.px));
  backStore.getState().setInsets({ left: max("left"), bottom: max("bottom"), right: 0 });
}
export function useCover(ref: RefObject<HTMLElement | null>, key: string, side: "left" | "bottom", active: boolean, dep: string = ""): void {
  useEffect(() => {
    const el = ref.current;
    const measure = () => {
      const canvas = regionBridge.canvas;
      let px = 0;
      if (el && canvas && active) {
        const c = canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) px = side === "bottom" ? Math.max(0, c.bottom - Math.max(r.top, c.top)) : Math.max(0, Math.min(r.right, c.right) - c.left);
      }
      covers[key] = { side, px: Math.round(px) };
      publish();
    };
    measure();
    const t = window.setTimeout(measure, 60); // after the layout of a just-opened panel
    const ro = el ? new ResizeObserver(measure) : null;
    if (el) ro!.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      delete covers[key];
      publish();
    };
  }, [ref, key, side, active, dep]);
}
