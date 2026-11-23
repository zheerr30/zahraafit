import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { REGION_MUSCLES, type RegionLayer } from "@/data/region/backShoulders";
import { SELECTION_ACCENT } from "@/lib/highlight";
import { DEFAULT_MODEL, type ModelId } from "@/lib/region/profile";

/** What the user picked on the model: a muscle unit (full card) or any other structure (name only). */
export interface PickedStructure {
  kind: "unit" | "bone" | "tendon" | "ligament" | "fascia" | "nerve" | "attachment" | "fat" | "vessel" | "skin";
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
  /** Turn to the side of the body a muscle is on and frame it (links that open on a muscle). */
  | { type: "face"; unitId: string; side: "l" | "r" | "m" | null; nonce: number }
  | { type: "region"; region: string; nonce: number }
  | { type: "zoom"; dir: 1 | -1; nonce: number };

/** Control groups of the dock (a column on desktop, a bottom sheet on a phone). */
export type DockTab = "regions" | "layers" | "muscles";

/** Parts of the 3D view covered by panels (px): the camera keeps its subject in the free part. */
export interface ViewInsets {
  left: number;
  right: number;
  bottom: number;
}

export const DEFAULT_LAYERS: Record<RegionLayer, boolean> = {
  muscles: true,
  tendons: true,
  bones: true,
  fasciae: false,
  attachments: false,
  nerves: false,
  fat: false,
  vessels: false,
  skin: false,
};

export type Sex = "male" | "female";

/** What the contextual panel of the selected structure shows. */
export type PanelMode = "summary" | "details" | "exercises";

/** Muscles lit on the model for an exercise: prime movers and helpers (unit ids). */
export interface Spotlight {
  primary: string[];
  secondary: string[];
}

interface BackState {
  selected: PickedStructure | null;
  hovered: PickedStructure | null;
  /** Units hidden individually from the list. */
  hiddenUnits: Record<string, true>;
  layers: Record<RegionLayer, boolean>;
  /** The body in use (lib/region/profile.ts); set from the address when the atlas mounts. */
  model: ModelId;
  /** The layers shown when the atlas opens and after "reset" (they depend on the body in use). */
  defaultLayers: Record<RegionLayer, boolean>;
  depthMode: DepthMode;
  /** Show only the selected structure (with the skeleton for reference). */
  isolate: boolean;
  showEnglish: boolean;
  background: "black" | "navy" | "cream";
  autoRotate: boolean;
  /** Colour of the selected structure (user-chosen). */
  highlightColor: string;
  sex: Sex;
  /** HD rendering (prototype): refined surfaces, detailed tissue materials, AO and shadows. */
  hd: boolean | null;
  /** Bumped when a model has loaded (the unit list is read from the model). */
  unitsVersion: number;
  /** Study region the list and camera are focused on (null = whole body). */
  region: string | null;
  cameraCommand: CameraCommand | null;
  /** Contextual panel of the selection: summary → "learn more" / "exercises". */
  panel: PanelMode;
  /** Target muscles of the exercise being looked at (overrides the selection colour). */
  spotlight: Spotlight | null;
  /** Exercise to open when the exercises panel appears (set by a link to one exercise). */
  linkedExercise: string | null;
  /** Open control group of the dock (null: closed — phones start closed). */
  dock: DockTab | null;
  insets: ViewInsets;
  setDock: (d: DockTab | null) => void;
  setInsets: (i: Partial<ViewInsets>) => void;
  /** Step the camera towards (1) or away from (-1) what it looks at. */
  zoom: (dir: 1 | -1) => void;
  setPanel: (p: PanelMode) => void;
  setSpotlight: (s: Spotlight | null) => void;
  /** Back to the whole anatomy: no isolation, no region, front view. */
  showFullBody: () => void;
  select: (p: PickedStructure | null) => void;
  selectUnit: (id: string, side?: "l" | "r" | "m") => void;
  face: (unitId: string, side?: "l" | "r" | "m" | null) => void;
  setHovered: (p: PickedStructure | null) => void;
  toggleUnit: (id: string) => void;
  setLayer: (l: RegionLayer, v: boolean) => void;
  setDepthMode: (d: DepthMode) => void;
  setIsolate: (v: boolean) => void;
  skeletonOnly: () => void;
  showNervesAndTendons: () => void;
  showAttachmentsOf: (id: string) => void;
  setShowEnglish: (v: boolean) => void;
  setBackground: (b: "black" | "navy" | "cream") => void;
  setAutoRotate: (v: boolean) => void;
  setHighlightColor: (hex: string) => void;
  setSex: (s: Sex) => void;
  setHd: (v: boolean) => void;
  focusRegion: (region: string | null) => void;
  view: (v: RegionView) => void;
  focus: (unitId: string, side?: "l" | "r" | "m" | null) => void;
  resetAll: () => void;
}

/** Names of the muscles of the loaded model (filled by the viewer), so a muscle chosen by id — from the list, a link or an exercise — is shown by its name. */
export const unitNames = new Map<string, { ar: string; en: string }>();

let nonce = 0;
const unitPick = (id: string, side: "l" | "r" | "m" = "l"): PickedStructure => {
  const m = unitNames.get(id) ?? REGION_MUSCLES.find((x) => x.id === id);
  return { kind: "unit", id, side, ar: m?.ar ?? id, en: m?.en ?? id };
};

export const backStore = createStore<BackState>()((set, get) => ({
  selected: null,
  hovered: null,
  hiddenUnits: {},
  layers: { ...DEFAULT_LAYERS },
  model: DEFAULT_MODEL,
  defaultLayers: { ...DEFAULT_LAYERS },
  depthMode: "all",
  isolate: false,
  showEnglish: false,
  background: "black",
  autoRotate: false,
  highlightColor: SELECTION_ACCENT,
  sex: "male",
  hd: null,
  unitsVersion: 0,
  region: null,
  cameraCommand: null,
  panel: "summary",
  spotlight: null,
  linkedExercise: null,
  dock: null,
  insets: { left: 0, right: 0, bottom: 0 },
  setDock: (dock) => set({ dock }),
  setInsets: (i) => {
    const cur = get().insets;
    const next = { ...cur, ...i };
    if (next.left !== cur.left || next.right !== cur.right || next.bottom !== cur.bottom) set({ insets: next });
  },
  zoom: (dir) => set({ cameraCommand: { type: "zoom", dir, nonce: ++nonce }, autoRotate: false }),
  setPanel: (panel) => set({ panel, spotlight: panel === "exercises" ? get().spotlight : null }),
  setSpotlight: (spotlight) => set({ spotlight }),
  showFullBody: () =>
    set({ isolate: false, region: null, spotlight: null, autoRotate: false, cameraCommand: { type: "view", view: "front", nonce: ++nonce } }),
  select: (p) => {
    const cur = get().selected;
    const same = !!p && !!cur && p.kind === cur.kind && p.id === cur.id;
    // a new structure opens its summary; re-picking the same one keeps the open panel
    set({ selected: p, isolate: p ? get().isolate : false, panel: same ? get().panel : "summary", spotlight: same ? get().spotlight : null, linkedExercise: same ? get().linkedExercise : null });
  },
  selectUnit: (id, side = "l") => {
    const hidden = { ...get().hiddenUnits };
    delete hidden[id];
    const same = get().selected?.kind === "unit" && get().selected?.id === id;
    set({
      selected: unitPick(id, side),
      hiddenUnits: hidden,
      panel: same ? get().panel : "summary",
      spotlight: same ? get().spotlight : null,
      linkedExercise: same ? get().linkedExercise : null,
      // chosen by name (the list, a link, a related muscle): the camera turns to the side it is on
      cameraCommand: { type: "face", unitId: id, side, nonce: ++nonce },
    });
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
      layers: { muscles: false, tendons: false, bones: true, fasciae: false, attachments: false, nerves: false, fat: false, vessels: false, skin: false },
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
  setHighlightColor: (hex) => set({ highlightColor: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : SELECTION_ACCENT }),
  setSex: (sex) => set({ sex, selected: null, hovered: null, isolate: false, spotlight: null }),
  setHd: (hd) => set({ hd, selected: null, hovered: null, isolate: false, spotlight: null }),
  focusRegion: (region) =>
    set({ region, autoRotate: false, cameraCommand: region ? { type: "region", region, nonce: ++nonce } : { type: "view", view: "front", nonce: ++nonce } }),
  view: (v) => set({ cameraCommand: { type: "view", view: v, nonce: ++nonce }, autoRotate: false }),
  focus: (unitId, side = null) => set({ cameraCommand: { type: "focus", unitId, side, nonce: ++nonce } }),
  face: (unitId, side = null) => set({ autoRotate: false, cameraCommand: { type: "face", unitId, side, nonce: ++nonce } }),
  resetAll: () =>
    set({
      selected: null,
      hovered: null,
      hiddenUnits: {},
      layers: { ...get().defaultLayers },
      depthMode: "all",
      isolate: false,
      autoRotate: false,
      panel: "summary",
      spotlight: null,
      cameraCommand: get().region ? { type: "region", region: get().region!, nonce: ++nonce } : { type: "view", view: "front", nonce: ++nonce },
    }),
}));

export function useBack<T>(selector: (s: BackState) => T): T {
  return useStore(backStore, selector);
}
