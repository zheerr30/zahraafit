import { createStore, useStore } from "zustand";
import { MUSCLES, musclesInRegion } from "@/data/muscles/muscles";
import {
  createDefaultDoc,
  DEFAULT_PALETTE,
  HEX_COLOR,
  type CameraState,
  type IllustrationDoc,
  type Layers,
  type MuscleTone,
  type Palette,
  type Project,
} from "@/lib/storage/schema";
import type { Gender, RegionId, ViewId } from "@/types/anatomy";

export const HISTORY_LIMIT = 100;
/** Consecutive edits with the same key inside this window collapse into one undo step. */
export const COALESCE_MS = 800;

export type CameraCommand =
  | { type: "view"; view: ViewId; animate: boolean; nonce: number }
  | { type: "reset"; nonce: number }
  | { type: "frame-selection"; nonce: number }
  | { type: "restore"; camera: CameraState; nonce: number };

export type AssetMode = "manifest" | "local-file";

export interface EditorState {
  doc: IllustrationDoc;
  past: IllustrationDoc[];
  future: IllustrationDoc[];
  lastCommit: { key: string | null; at: number };

  paintTone: MuscleTone;
  hoveredMuscleId: string | null;
  focusedMuscleId: string | null;
  projectId: string | null;
  projectName: string;
  dirty: boolean;
  currentView: ViewId | null;
  /** Last named view; picks front/back-specific assets and survives free orbiting. */
  assetView: ViewId;
  cameraCommand: CameraCommand | null;
  assetMode: AssetMode;
  localFile: { url: string; name: string } | null;
  exporting: boolean;

  // Selection / painting
  toggleMuscle: (id: string) => void;
  selectMuscles: (ids: string[], tone?: MuscleTone) => void;
  deselectMuscle: (id: string) => void;
  toggleRegion: (region: RegionId) => void;
  clearSelection: () => void;
  setMuscleTone: (id: string, tone: MuscleTone) => void;
  setMuscleColor: (id: string, color: string | null) => void;
  setPaintTone: (tone: MuscleTone) => void;
  setHovered: (id: string | null) => void;
  setFocused: (id: string | null) => void;

  // Visual settings
  setPaletteColor: (key: keyof Palette, color: string) => void;
  resetPalette: () => void;
  setGender: (gender: Gender) => void;
  setBackground: (bg: IllustrationDoc["background"]) => void;
  setLighting: (value: number) => void;
  setModelScale: (value: number) => void;
  setModelOffsetY: (value: number) => void;
  setShowLabels: (value: boolean) => void;
  setShowSelectedNames: (value: boolean) => void;
  setLabelLanguage: (value: IllustrationDoc["labelLanguage"]) => void;
  setDimUnselected: (value: boolean) => void;
  setMaterialMode: (value: IllustrationDoc["materialMode"]) => void;
  setLayer: (system: keyof Layers, visible: boolean) => void;

  // History
  undo: () => void;
  redo: () => void;

  // Camera
  requestView: (view: ViewId, animate?: boolean) => void;
  requestReset: () => void;
  requestFrameSelection: () => void;
  setCurrentView: (view: ViewId | null) => void;

  // Assets
  setAssetMode: (mode: AssetMode) => void;
  setLocalFile: (file: { url: string; name: string } | null) => void;

  // Project lifecycle
  newDocument: (gender?: Gender) => void;
  /** Loads a project; returns how many saved selections no longer exist and were dropped. */
  loadProject: (project: Project) => number;
  markSaved: (id: string, name: string) => void;
  setProjectName: (name: string) => void;
  setExporting: (value: boolean) => void;
}

export interface EditorStoreOptions {
  now?: () => number;
  initialDoc?: IllustrationDoc;
}

const KNOWN_IDS = new Set(MUSCLES.map((m) => m.id));

export function createEditorStore(options: EditorStoreOptions = {}) {
  const now = options.now ?? (() => Date.now());
  let nonce = 0;
  const nextNonce = () => ++nonce;

  return createStore<EditorState>()((set, get) => {
    /** Apply an undoable change to the document. */
    const commit = (recipe: (doc: IllustrationDoc) => IllustrationDoc, coalesceKey?: string) => {
      const { doc, past, lastCommit } = get();
      const next = recipe(doc);
      if (next === doc) return;
      const t = now();
      const coalesce =
        coalesceKey !== undefined &&
        lastCommit.key === coalesceKey &&
        t - lastCommit.at < COALESCE_MS;
      set({
        doc: next,
        past: coalesce ? past : [...past, doc].slice(-HISTORY_LIMIT),
        future: [],
        lastCommit: { key: coalesceKey ?? null, at: t },
        dirty: true,
      });
    };

    const withSelections = (
      doc: IllustrationDoc,
      fn: (s: IllustrationDoc["selections"]) => IllustrationDoc["selections"] | null,
    ): IllustrationDoc => {
      const next = fn({ ...doc.selections });
      return next ? { ...doc, selections: next } : doc;
    };

    const setField = <K extends keyof IllustrationDoc>(
      key: K,
      value: IllustrationDoc[K],
      coalesce = false,
    ) =>
      commit(
        (doc) => (doc[key] === value ? doc : { ...doc, [key]: value }),
        coalesce ? `field:${String(key)}` : undefined,
      );

    return {
      doc: options.initialDoc ?? createDefaultDoc(),
      past: [],
      future: [],
      lastCommit: { key: null, at: 0 },

      paintTone: "primary",
      hoveredMuscleId: null,
      focusedMuscleId: null,
      projectId: null,
      projectName: "رسم توضيحي جديد",
      dirty: false,
      currentView: "front",
      assetView: "front",
      cameraCommand: null,
      assetMode: "manifest",
      localFile: null,
      exporting: false,

      toggleMuscle: (id) => {
        if (!KNOWN_IDS.has(id)) return;
        const tone = get().paintTone;
        commit((doc) =>
          withSelections(doc, (s) => {
            const current = s[id];
            if (current && current.tone === tone) delete s[id];
            else s[id] = { tone, color: current?.color ?? null };
            return s;
          }),
        );
        set({ focusedMuscleId: id });
      },

      selectMuscles: (ids, tone) => {
        const t = tone ?? get().paintTone;
        const valid = ids.filter((id) => KNOWN_IDS.has(id));
        if (!valid.length) return;
        commit((doc) =>
          withSelections(doc, (s) => {
            let changed = false;
            for (const id of valid) {
              if (s[id]?.tone === t) continue;
              s[id] = { tone: t, color: s[id]?.color ?? null };
              changed = true;
            }
            return changed ? s : null;
          }),
        );
      },

      deselectMuscle: (id) =>
        commit((doc) =>
          withSelections(doc, (s) => {
            if (!s[id]) return null;
            delete s[id];
            return s;
          }),
        ),

      toggleRegion: (region) => {
        const ids = musclesInRegion(region).map((m) => m.id);
        const tone = get().paintTone;
        commit((doc) =>
          withSelections(doc, (s) => {
            const allSelected = ids.every((id) => s[id]?.tone === tone);
            for (const id of ids) {
              if (allSelected) delete s[id];
              else s[id] = { tone, color: s[id]?.color ?? null };
            }
            return s;
          }),
        );
      },

      clearSelection: () =>
        commit((doc) => (Object.keys(doc.selections).length ? { ...doc, selections: {} } : doc)),

      setMuscleTone: (id, tone) =>
        commit((doc) =>
          withSelections(doc, (s) => {
            const cur = s[id];
            if (!cur || cur.tone === tone) return null;
            s[id] = { ...cur, tone };
            return s;
          }),
        ),

      setMuscleColor: (id, color) => {
        if (color !== null && !HEX_COLOR.test(color)) return;
        commit(
          (doc) =>
            withSelections(doc, (s) => {
              const cur = s[id];
              if (!cur || cur.color === color) return null;
              s[id] = { ...cur, color };
              return s;
            }),
          `muscle-color:${id}`,
        );
      },

      setPaintTone: (tone) => set({ paintTone: tone }),
      setHovered: (id) => {
        if (get().hoveredMuscleId !== id) set({ hoveredMuscleId: id });
      },
      setFocused: (id) => set({ focusedMuscleId: id }),

      setPaletteColor: (key, color) => {
        if (!HEX_COLOR.test(color)) return;
        commit(
          (doc) =>
            doc.palette[key] === color ? doc : { ...doc, palette: { ...doc.palette, [key]: color } },
          `palette:${key}`,
        );
      },
      resetPalette: () => commit((doc) => ({ ...doc, palette: { ...DEFAULT_PALETTE } })),
      setGender: (gender) => setField("gender", gender),
      setBackground: (bg) => setField("background", bg),
      setLighting: (v) => setField("lighting", clamp(v, 0, 3), true),
      setModelScale: (v) => setField("modelScale", clamp(v, 0.25, 3), true),
      setModelOffsetY: (v) => setField("modelOffsetY", clamp(v, -2, 2), true),
      setShowLabels: (v) => setField("showLabels", v),
      setShowSelectedNames: (v) => setField("showSelectedNames", v),
      setLabelLanguage: (v) => setField("labelLanguage", v),
      setDimUnselected: (v) => setField("dimUnselected", v),
      setMaterialMode: (v) => setField("materialMode", v),
      setLayer: (system, visible) =>
        commit((doc) =>
          doc.layers[system] === visible ? doc : { ...doc, layers: { ...doc.layers, [system]: visible } },
        ),

      undo: () => {
        const { past, future, doc } = get();
        if (!past.length) return;
        const prev = past[past.length - 1];
        set({
          doc: prev,
          past: past.slice(0, -1),
          future: [doc, ...future].slice(0, HISTORY_LIMIT),
          lastCommit: { key: null, at: 0 },
          dirty: true,
        });
      },
      redo: () => {
        const { past, future, doc } = get();
        if (!future.length) return;
        const [next, ...rest] = future;
        set({
          doc: next,
          past: [...past, doc].slice(-HISTORY_LIMIT),
          future: rest,
          lastCommit: { key: null, at: 0 },
          dirty: true,
        });
      },

      requestView: (view, animate = true) =>
        set({
          cameraCommand: { type: "view", view, animate, nonce: nextNonce() },
          currentView: view,
          assetView: view,
        }),
      requestReset: () =>
        set({ cameraCommand: { type: "reset", nonce: nextNonce() }, currentView: "front", assetView: "front" }),
      requestFrameSelection: () =>
        set({ cameraCommand: { type: "frame-selection", nonce: nextNonce() }, currentView: null }),
      setCurrentView: (view) => set({ currentView: view }),

      setAssetMode: (mode) => set({ assetMode: mode }),
      setLocalFile: (file) => set({ localFile: file, assetMode: file ? "local-file" : "manifest" }),

      newDocument: (gender = "male") =>
        set({
          doc: createDefaultDoc(gender),
          past: [],
          future: [],
          lastCommit: { key: null, at: 0 },
          projectId: null,
          projectName: "رسم توضيحي جديد",
          dirty: false,
          focusedMuscleId: null,
          hoveredMuscleId: null,
          cameraCommand: { type: "reset", nonce: nextNonce() },
          currentView: "front",
          assetView: "front",
        }),

      loadProject: (project) => {
        const entries = Object.entries(project.doc.selections);
        // Drop selections for muscle ids that do not exist in the current database.
        const kept = entries.filter(([id]) => KNOWN_IDS.has(id));
        set((state) => ({
          // A file loaded from disk cannot be reopened automatically; keep it if loaded.
          assetMode: state.assetMode === "local-file" ? "local-file" : "manifest",
          doc: { ...project.doc, selections: Object.fromEntries(kept) },
          past: [],
          future: [],
          lastCommit: { key: null, at: 0 },
          projectId: project.id,
          projectName: project.name,
          dirty: false,
          focusedMuscleId: null,
          hoveredMuscleId: null,
          cameraCommand: project.camera
            ? { type: "restore", camera: project.camera, nonce: nextNonce() }
            : { type: "reset", nonce: nextNonce() },
          currentView: project.camera?.view ?? "front",
          assetView: project.camera?.view ?? "front",
        }));
        return entries.length - kept.length;
      },

      markSaved: (id, name) => set({ projectId: id, projectName: name, dirty: false }),
      setProjectName: (name) => set({ projectName: name, dirty: true }),
      setExporting: (value) => set({ exporting: value }),
    };
  });
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

export type EditorStore = ReturnType<typeof createEditorStore>;

/** App-wide editor store instance. */
export const editorStore = createEditorStore();

export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStore(editorStore, selector);
}
