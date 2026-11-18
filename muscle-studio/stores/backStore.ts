import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { REGION_MUSCLES, type RegionLayer } from "@/data/region/backShoulders";

/** What the user picked on the model: a muscle unit (full card) or any other structure (name only). */
export interface PickedStructure {
  kind: "unit" | "bone" | "tendon" | "ligament" | "fascia" | "nerve" | "attachment";
  id: string;
  side: "l" | "r" | "m";
  ar: string;
  en: string;
}

export type DepthMode = "all" | "no-superficial" | "deep";
export type RegionView = "back" | "left" | "right" | "front" | "closeup";

export type CameraCommand =
  | { type: "view"; view: RegionView; nonce: number }
  | { type: "focus"; unitId: string; side: "l" | "r" | "m" | null; nonce: number }
  | { type: "focus-structure"; key: string; nonce: number }
  | { type: "region"; region: string; nonce: number };

export const DEFAULT_LAYERS: Record<RegionLayer, boolean> = {
  muscles: true,
  tendons: true,
  bones: true,
  fasciae: false,
  attachments: false,
  nerves: false,
};

export type Sex = "male" | "female";

interface BackState {
  selected: PickedStructure | null;
  hovered: PickedStructure | null;
  /** Units hidden individually from the list. */
  hiddenUnits: Record<string, true>;
  layers: Record<RegionLayer, boolean>;
  depthMode: DepthMode;
  /** Show only the selected structure (with the skeleton for reference). */
  isolate: boolean;
  showEnglish: boolean;
  background: "black" | "navy";
  autoRotate: boolean;
  /** Colour of the selected structure (user-chosen). */
  highlightColor: string;
  sex: Sex;
  /** Bumped when a model has loaded (the unit list is read from the model). */
  unitsVersion: number;
  /** Study region the list and camera are focused on (null = whole body). */
  region: string | null;
  cameraCommand: CameraCommand | null;
  select: (p: PickedStructure | null) => void;
  selectUnit: (id: string, side?: "l" | "r" | "m") => void;
  setHovered: (p: PickedStructure | null) => void;
  toggleUnit: (id: string) => void;
  setLayer: (l: RegionLayer, v: boolean) => void;
  setDepthMode: (d: DepthMode) => void;
  setIsolate: (v: boolean) => void;
  skeletonOnly: () => void;
  showNervesAndTendons: () => void;
  showAttachmentsOf: (id: string) => void;
  setShowEnglish: (v: boolean) => void;
  setBackground: (b: "black" | "navy") => void;
  setAutoRotate: (v: boolean) => void;
  setHighlightColor: (hex: string) => void;
  setSex: (s: Sex) => void;
  focusRegion: (region: string | null) => void;
  view: (v: RegionView) => void;
  focus: (unitId: string, side?: "l" | "r" | "m" | null) => void;
  resetAll: () => void;
}

let nonce = 0;
const unitPick = (id: string, side: "l" | "r" | "m" = "l"): PickedStructure => {
  const m = REGION_MUSCLES.find((x) => x.id === id);
  return { kind: "unit", id, side, ar: m?.ar ?? id, en: m?.en ?? id };
};

export const backStore = createStore<BackState>()((set, get) => ({
  selected: null,
  hovered: null,
  hiddenUnits: {},
  layers: { ...DEFAULT_LAYERS },
  depthMode: "all",
  isolate: false,
  showEnglish: false,
  background: "black",
  autoRotate: false,
  highlightColor: "#E8602C",
  sex: "male",
  unitsVersion: 0,
  region: null,
  cameraCommand: null,
  select: (p) => set({ selected: p, isolate: p ? get().isolate : false }),
  selectUnit: (id, side = "l") => {
    const hidden = { ...get().hiddenUnits };
    delete hidden[id];
    set({ selected: unitPick(id, side), hiddenUnits: hidden, cameraCommand: { type: "focus", unitId: id, side, nonce: ++nonce } });
  },
  setHovered: (p) => {
    const h = get().hovered;
    if (h?.kind === p?.kind && h?.id === p?.id && h?.side === p?.side) return;
    set({ hovered: p });
  },
  toggleUnit: (id) => {
    const hidden = { ...get().hiddenUnits };
    if (hidden[id]) delete hidden[id];
    else hidden[id] = true;
    set({ hiddenUnits: hidden });
  },
  setLayer: (l, v) => set({ layers: { ...get().layers, [l]: v } }),
  setDepthMode: (d) => set({ depthMode: d }),
  setIsolate: (v) => set({ isolate: v && get().selected !== null }),
  skeletonOnly: () =>
    set({
      layers: { muscles: false, tendons: false, bones: true, fasciae: false, attachments: false, nerves: false },
      isolate: false,
      selected: null,
    }),
  showNervesAndTendons: () => set({ layers: { ...get().layers, nerves: true, tendons: true } }),
  showAttachmentsOf: (id) => {
    set({
      selected: get().selected?.id === id ? get().selected : unitPick(id),
      isolate: true,
      layers: { ...get().layers, bones: true, attachments: true },
      cameraCommand: { type: "focus", unitId: id, side: get().selected?.side ?? "l", nonce: ++nonce },
    });
  },
  setShowEnglish: (v) => set({ showEnglish: v }),
  setBackground: (b) => set({ background: b }),
  setAutoRotate: (v) => set({ autoRotate: v }),
  setHighlightColor: (hex) => set({ highlightColor: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#E8602C" }),
  setSex: (sex) => set({ sex, selected: null, hovered: null, isolate: false }),
  focusRegion: (region) =>
    set({ region, autoRotate: false, cameraCommand: region ? { type: "region", region, nonce: ++nonce } : { type: "view", view: "front", nonce: ++nonce } }),
  view: (v) => set({ cameraCommand: { type: "view", view: v, nonce: ++nonce }, autoRotate: false }),
  focus: (unitId, side = null) => set({ cameraCommand: { type: "focus", unitId, side, nonce: ++nonce } }),
  resetAll: () =>
    set({
      selected: null,
      hovered: null,
      hiddenUnits: {},
      layers: { ...DEFAULT_LAYERS },
      depthMode: "all",
      isolate: false,
      autoRotate: false,
      cameraCommand: get().region ? { type: "region", region: get().region!, nonce: ++nonce } : { type: "view", view: "front", nonce: ++nonce },
    }),
}));

export function useBack<T>(selector: (s: BackState) => T): T {
  return useStore(backStore, selector);
}
