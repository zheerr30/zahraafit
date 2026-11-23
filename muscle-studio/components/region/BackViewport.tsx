"use client";

import { CameraControls } from "@react-three/drei";
import { AtlasLighting } from "@/components/anatomy/AtlasLighting";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box3, CanvasTexture, Color, LinearSRGBColorSpace, Object3D, Raycaster, Sphere, SRGBColorSpace, Vector2, Vector3, type PerspectiveCamera } from "three";
import {
  applyStyle,
  disposeRegionModel,
  addMeshes,
  createRegionModel,
  pick,
  pickHit,
  prepareMeshes,
  regionBounds,
  targetOpacity,
  stepFades,
  structureBounds,
  unitBounds,
  type RegionMesh,
  type RegionModel,
} from "@/lib/region/backModel";
import { HDPipeline } from "@/components/anatomy/HDPipeline";
import { ProgressiveRefine } from "@/components/anatomy/ProgressiveRefine";
import { loadGltf } from "@/lib/three/loadGltf";
import { configureRenderer } from "@/lib/three/rendererSetup";
import { backStore, unitNames, useBack, type PickedStructure, type RegionView } from "@/stores/backStore";
import type { RegionLayer } from "@/data/region/backShoulders";
import { currentProfile } from "@/lib/region/profile";

/** Files of the body in use (lib/region/profile.ts): <base>/<sex>/<part>.glb. */
export const modelUrl = (sex: "male" | "female", part: string) => `${currentProfile().base}/${sex}/${part}.glb`;
/** The body shown by default: core.glb with refined muscle surfaces. */
export const BODY_PART = "core-smooth";
/**
 * The same body with fewer triangles (pipeline/lite/body.mjs: every muscle keeps its name
 * and id), about a fifth of the download: loaded on phones and tablets. `?lite=1` asks for
 * it anywhere, `?lite=0` for the full body.
 */
export const LITE_PART = "core-lite";
/** Whether this visit gets the lighter build: phones and tablets, or `?lite=1` (`?lite=0`: never). */
export function wantsLite(): boolean {
  const lite = new URLSearchParams(window.location.search).get("lite");
  if (lite === "1") return true;
  if (lite === "0") return false;
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}
export function bodyPart(): string {
  const p = currentProfile();
  // Z-Anatomy: muscle surfaces refined from the original meshes (pipeline/sculpt/body.mjs:
  // same nodes and vertices, bellies smoothed by ≤ 2 mm); `?sculpt=0` shows the original.
  if (p.id === "zanatomy" && new URLSearchParams(window.location.search).get("sculpt") === "0") return "core";
  return wantsLite() ? p.core.lite : p.core.full;
}
/** File of a layer that is loaded on first use. */
const lazyPart = (layer: RegionLayer): string | null => {
  const p = currentProfile();
  const part = p.lazy[layer];
  return part ? (p.lazyLite && wantsLite() ? `${part}-lite` : part) : null;
};
export const BACKGROUNDS = { black: "#0d0e10", navy: "#06142f", cream: "#F6F2EA" } as const;

/** Shared handles for overlays, tests and exports (one viewer per page). */
export const regionBridge: {
  model: RegionModel | null;
  camera: PerspectiveCamera | null;
  controls: CameraControls | null;
  canvas: HTMLCanvasElement | null;
  invalidate: () => void;
} = { model: null, camera: null, controls: null, canvas: null, invalidate: () => {} };

/** HD rendering: surfaces are refined on demand (ProgressiveRefine), not at load. */
const HD_OPTIONS = { hd: true } as const;

/** The store's visibility state with what it implies for this model (the selected muscle's depth). */
function visibility<S extends { selected: PickedStructure | null }>(model: RegionModel, st: S): S & { selectedDepth: number } {
  return { ...st, selectedDepth: st.selected?.kind === "unit" ? (model.units.get(st.selected.id)?.depth ?? 1) : 1 };
}

/**
 * The side of the body a muscle is seen from: front, back, left or right — whichever view
 * shows most of it (sample points of the muscle are looked at from each side; a point counts
 * when nothing else is in front of it). Front and back win a near tie.
 */
function facingOf(model: RegionModel, unitId: string, side: "l" | "r" | "m" | null): Vector3 {
  const meshes = (model.byUnit.get(unitId) ?? []).filter((m) => m.kind === "unit" && (!side || side === "m" || m.side === side || m.side === "m"));
  const points: Vector3[] = [];
  for (const m of meshes) {
    const pos = m.mesh.geometry.getAttribute("position");
    const step = Math.max(1, Math.floor(pos.count / Math.ceil(70 / meshes.length)));
    for (let i = 0; i < pos.count; i += step) points.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.mesh.matrixWorld));
  }
  const views: [Vector3, number][] = [[new Vector3(0, 0, 1), 1], [new Vector3(0, 0, -1), 1], [new Vector3(1, 0, 0), 0.8], [new Vector3(-1, 0, 0), 0.8]];
  const ray = new Raycaster().ray;
  // A deep muscle is not seen from anywhere until the muscles over it turn into a ghost:
  // it is shown from the side where the least lies over it.
  const deep = meshes.some((m) => m.depth > 1);
  let best = views[0][0], score = -Infinity;
  for (const [dir, weight] of views) {
    let seen = 0, over = 0;
    for (const p of points) {
      ray.origin.copy(p).addScaledVector(dir, 2.5);
      ray.direction.copy(dir).negate();
      const hit = pickHit(model, ray);
      if (hit && hit.m.kind === "unit" && hit.m.id === unitId) seen++;
      else over += hit ? Math.max(0, 2.5 - hit.d) : 0;
    }
    const s = deep ? -(over / Math.max(1, points.length)) / weight : seen * weight;
    if (s > score) { score = s; best = dir; }
  }
  return best.clone();
}

/**
 * Framing. The subject is centred in the part of the view that is really free: under
 * the hint at the top, above the view controls (or the sheet / panel that covers the
 * bottom). Of that free height the whole body takes FILL.body — about 80 % of the
 * view — with head and feet inside; a region or a single structure is framed closer.
 */
const FILL = { body: 0.96, region: 0.9, closeup: 0.94 };
const TOP_RESERVE = 52; // px: the hint / the chip of the open region
const CONTROLS_RESERVE = 62; // px: the floating view controls
export function freeArea(ins: { bottom: number }, height: number): { top: number; bottom: number; height: number } {
  // short views (a phone in landscape, a small embed) keep proportionally smaller margins
  const k = Math.min(1, height / 640);
  const top = TOP_RESERVE * k;
  const bottom = Math.max(ins.bottom, CONTROLS_RESERVE * k);
  return { top, bottom, height: Math.max(1, height - top - bottom) };
}

export type LoadState = { status: "loading"; progress: number } | { status: "ready" } | { status: "error"; message: string };

const asPicked = (m: RegionMesh): PickedStructure => ({ kind: m.kind, id: m.id, side: m.side, ar: m.ar, en: m.en });

function Model({ onState }: { onState: (s: LoadState) => void }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const sex = useBack((s) => s.sex);
  const hd = useBack((s) => s.hd);
  const [roots, setRoots] = useState<Object3D[]>([]);
  const modelRef = useRef<RegionModel | null>(null);
  const loaded = useRef(new Set<string>());

  const syncNew = (model: RegionModel, meshes: RegionMesh[]) => {
    const st = visibility(model, backStore.getState());
    for (const m of meshes) {
      m.target = targetOpacity(m, st);
      m.opacity = m.target;
      m.mesh.visible = m.target > 0;
      (m.mesh.material as { opacity: number }).opacity = ((m.mesh.material as { userData: { baseOpacity?: number } }).userData.baseOpacity ?? 1) * m.opacity;
      applyStyle(m, st.selected, st.hovered, st.highlightColor, st.spotlight ? { primary: new Set(st.spotlight.primary), secondary: new Set(st.spotlight.secondary) } : null);
    }
    void model;
  };

  useEffect(() => {
    if (hd === null) return; // the page has not chosen the rendering quality yet
    const ctrl = new AbortController();
    const model = createRegionModel();
    loaded.current = new Set(["core"]);
    onState({ status: "loading", progress: 0 });
    const part = bodyPart();
    loadGltf(modelUrl(sex, part), { renderer: gl, signal: ctrl.signal, onProgress: (p) => onState({ status: "loading", progress: p }) })
      .then((gltf) => {
        const prep = { ...(hd ? HD_OPTIONS : {}), anisotropy: Math.min(8, gl.capabilities.getMaxAnisotropy()), muscleBase: currentProfile().muscleBase };
        const meshes = prepareMeshes(gltf.scene, prep);
        addMeshes(model, meshes);
        modelRef.current = model;
        // further parts of the body (deep muscles): added as soon as they arrive
        for (const extra of currentProfile().also) {
          const file = currentProfile().lazyLite && wantsLite() ? `${extra}-lite` : extra;
          loadGltf(modelUrl(sex, file), { renderer: gl, signal: ctrl.signal })
            .then((g) => {
              if (modelRef.current !== model) return;
              const more = prepareMeshes(g.scene, prep);
              addMeshes(model, more);
              syncNew(model, more);
              setRoots((r) => [...r, g.scene]);
              for (const u of model.units.values()) unitNames.set(u.id, { ar: u.ar, en: u.en });
              backStore.setState({ unitsVersion: Date.now() });
              invalidate();
            })
            .catch((err: unknown) => { if (!ctrl.signal.aborted) console.error("[atlas] part failed", extra, err); });
        }
        regionBridge.model = model;
        syncNew(model, meshes);
        setRoots([gltf.scene]); // replaces the previous body's roots
        onState({ status: "ready" });
        for (const u of model.units.values()) unitNames.set(u.id, { ar: u.ar, en: u.en });
        backStore.setState({ unitsVersion: Date.now() });
        const st = backStore.getState();
        if (st.region) st.focusRegion(st.region);
        else st.view("front");
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        onState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      ctrl.abort();
      disposeRegionModel(model);
      if (regionBridge.model === model) regionBridge.model = null;
      modelRef.current = null;
    };
  }, [gl, onState, sex, hd]);

  // Optional layers (attachment patches, nerves) are loaded the first time they are needed.
  useEffect(() => {
    const profile = currentProfile();
    const need = (st: ReturnType<typeof backStore.getState>): RegionLayer[] =>
      (Object.keys(profile.lazy) as RegionLayer[]).filter((l) => st.layers[l] || (l === "attachments" && st.selected?.kind === "unit"));
    const load = (layer: RegionLayer) => {
      const model = modelRef.current;
      const part = lazyPart(layer);
      if (!model || !part || loaded.current.has(part)) return;
      loaded.current.add(part);
      const forSex = backStore.getState().sex;
      loadGltf(modelUrl(forSex, part), { renderer: gl })
        .then((gltf) => {
          if (modelRef.current !== model) return;
          const meshes = prepareMeshes(gltf.scene, { ...(backStore.getState().hd ? HD_OPTIONS : {}), anisotropy: Math.min(8, gl.capabilities.getMaxAnisotropy()) });
          addMeshes(model, meshes);
          syncNew(model, meshes);
          setRoots((r) => [...r, gltf.scene]);
          invalidate();
        })
        .catch((err: unknown) => {
          loaded.current.delete(part);
          console.error("[atlas] optional layer failed", part, err);
        });
    };
    const check = () => { for (const l of need(backStore.getState())) load(l); };
    check();
    return backStore.subscribe((st, prev) => {
      if (st.layers !== prev.layers || st.selected !== prev.selected) check();
    });
  }, [gl, invalidate, sex]);

  // Visibility targets and styles follow the store.
  useEffect(() => {
    return backStore.subscribe((st, prev) => {
      const model = modelRef.current;
      if (!model) return;
      let changed = false;
      if (st.layers !== prev.layers || st.hiddenUnits !== prev.hiddenUnits || st.depthMode !== prev.depthMode || st.isolate !== prev.isolate || st.selected !== prev.selected) {
        const vis = visibility(model, st);
        for (const m of model.meshes) {
          const t = targetOpacity(m, vis);
          if (t !== m.target) { m.target = t; changed = true; }
        }
      }
      if (st.selected !== prev.selected || st.hovered !== prev.hovered || st.highlightColor !== prev.highlightColor || st.spotlight !== prev.spotlight) {
        const spot = st.spotlight ? { primary: new Set(st.spotlight.primary), secondary: new Set(st.spotlight.secondary) } : null;
        for (const m of model.meshes) changed = applyStyle(m, st.selected, st.hovered, st.highlightColor, spot) || changed;
      }
      if (changed || st.background !== prev.background || st.autoRotate !== prev.autoRotate || st.insets !== prev.insets) invalidate();
    });
  }, [invalidate]);

  useFrame((_, dt) => {
    const model = modelRef.current;
    if (model && stepFades(model, Math.min(dt, 0.25))) invalidate();
  });

  return (
    <>
      {roots.map((r) => (
        <primitive key={r.uuid} object={r} />
      ))}
    </>
  );
}

function Rig() {
  const ref = useRef<CameraControls>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const command = useBack((s) => s.cameraCommand);
  const autoRotate = useBack((s) => s.autoRotate);
  const insets = useBack((s) => s.insets);
  // The last framing is applied again when the free part of the view changes (a panel
  // opened or closed, the window resized) — unless the user has moved the camera since.
  const done = useRef(0);
  const moved = useRef(false);

  useEffect(() => {
    regionBridge.controls = ref.current;
    regionBridge.camera = camera;
    regionBridge.invalidate = invalidate;
    const c = ref.current;
    if (!c) return;
    const stop = () => {
      moved.current = true;
      if (backStore.getState().autoRotate) backStore.getState().setAutoRotate(false);
    };
    c.addEventListener("controlstart", stop);
    return () => c.removeEventListener("controlstart", stop);
  }, [camera, invalidate]);

  useEffect(() => {
    const c = ref.current;
    const model = regionBridge.model;
    if (!c || !command || !model) return;
    const again = done.current === command.nonce;
    done.current = command.nonce;
    if (command.type === "zoom") {
      if (again) return;
      moved.current = true;
      // one step: about a third of the way in, or the same back out (smooth)
      void c.dolly(command.dir > 0 ? c.distance * 0.3 : -c.distance * 0.43, true);
      invalidate();
      return;
    }
    if (again && moved.current) return;
    if (!again) moved.current = false;
    const aspect = size.width / Math.max(1, size.height);
    // the part of the view not covered by panels: the subject is framed in it
    const ins = insets;
    const free = freeArea(ins, size.height);
    const freeH = Math.max(0.35, free.height / Math.max(1, size.height));
    const freeW = Math.max(0.35, 1 - (ins.left + ins.right) / Math.max(1, size.width));
    // `fill`: the share of the free height (or width) the subject takes. The distance is
    // measured to the subject's nearest face, so nothing is cut off by perspective.
    const fit = (box: Box3, dir: Vector3, fill: number) => {
      const center = box.getCenter(new Vector3());
      const s = box.getSize(new Vector3());
      const vfov = (camera.fov * Math.PI) / 180;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
      const side = Math.abs(dir.x) > 0.5;
      const across = side ? s.z : s.x, depth = side ? s.x : s.z;
      const dist = Math.max(s.y / 2 / (Math.tan(vfov / 2) * freeH * fill), across / 2 / (Math.tan(hfov / 2) * freeW * Math.min(0.96, fill + 0.04))) + depth / 2;
      const pos = center.clone().addScaledVector(dir, dist);
      void c.setLookAt(pos.x, pos.y, pos.z, center.x, center.y, center.z, true);
    };
    if (command.type === "region") {
      const box = regionBounds(model, command.region);
      if (!box) return;
      const back = ["back", "pelvis", "legs"].includes(command.region);
      fit(box, new Vector3(0, 0.1, back ? -1 : 1).normalize(), FILL.region);
      invalidate();
      return;
    }
    if (command.type === "view" && command.view === "closeup") {
      // Close-up: the selected structure, or the left shoulder (rotator cuff + deltoid) from behind and outside.
      const sel = backStore.getState().selected;
      let box = sel ? structureBounds(model, sel) : null;
      if (!box) {
        box = new Box3();
        for (const m of model.meshes) {
          if (m.kind === "unit" && m.side === "l" && /^(deltoid|supraspinatus|infraspinatus|teres)/.test(m.id)) box.expandByObject(m.mesh);
        }
      }
      fit(box, new Vector3(0.55, 0.18, -0.82).normalize(), FILL.closeup);
    } else if (command.type === "view") {
      const dirs: Record<Exclude<RegionView, "closeup">, Vector3> = {
        back: new Vector3(0, 0.08, -1).normalize(),
        front: new Vector3(0, 0.08, 1).normalize(),
        left: new Vector3(1, 0.05, 0).normalize(),
        right: new Vector3(-1, 0.05, 0).normalize(),
      };
      // Frame the current study region, or the whole body.
      const region = backStore.getState().region;
      const box = (region && regionBounds(model, region)) || model.bounds.clone();
      fit(box, dirs[command.view as Exclude<RegionView, "closeup">], region ? FILL.region : FILL.body);
    } else if (command.type === "face") {
      // A link opened on a muscle: turn to the side of the body it is on, and frame it with
      // its surroundings (the direction its surface looks, snapped to front / back / a side).
      const box = unitBounds(model, command.unitId, command.side);
      if (!box) return;
      const n = facingOf(model, command.unitId, command.side);
      const ax = Math.abs(n.x), az = Math.abs(n.z);
      const dir = az >= ax * 0.9 ? new Vector3(0, 0.08, n.z >= 0 ? 1 : -1) : new Vector3(n.x >= 0 ? 1 : -1, 0.05, 0);
      const s = box.getSize(new Vector3());
      fit(box.clone().expandByScalar(Math.max(s.x, s.y, s.z) * 0.55), dir.normalize(), FILL.closeup);
    } else {
      const box = command.type === "focus" ? unitBounds(model, command.unitId, command.side) : null;
      const sel = backStore.getState().selected;
      const b = box ?? (sel ? structureBounds(model, sel) : null);
      if (!b) return;
      const sphere = b.getBoundingSphere(new Sphere());
      sphere.radius = Math.max(sphere.radius, 0.05) / Math.min(freeH, freeW);
      void c.fitToSphere(sphere, true);
    }
    invalidate();
  }, [command, camera, size, insets, invalidate]);

  // Panels cover part of the view (a sheet at the bottom on a phone, the muscle panel at the
  // side on desktop): the picture is shifted so its centre is the centre of the free part.
  // Done in the projection (view offset), so picking and the camera controls stay exact.
  const shift = useRef({ x: 0, y: 0 });
  useFrame((_, dt) => {
    const c = ref.current;
    if (!c) return;
    const ins = backStore.getState().insets;
    const free = freeArea(ins, size.height);
    const tx = (ins.right - ins.left) / 2, ty = (free.bottom - free.top) / 2;
    const s = shift.current;
    if (Math.abs(tx - s.x) > 0.5 || Math.abs(ty - s.y) > 0.5) {
      const k = 1 - Math.exp(-Math.min(dt, 0.5) * 14); // time-based: a slow device arrives in a frame or two
      s.x += (tx - s.x) * k;
      s.y += (ty - s.y) * k;
      invalidate();
    } else if (s.x !== tx || s.y !== ty) {
      s.x = tx;
      s.y = ty;
      invalidate();
    }
    const want = Math.abs(s.x) > 0.25 || Math.abs(s.y) > 0.25;
    const v = camera.view;
    if (want) {
      if (!v || !v.enabled || v.offsetX !== s.x || v.offsetY !== s.y || v.fullWidth !== size.width || v.fullHeight !== size.height) camera.setViewOffset(size.width, size.height, s.x, s.y, size.width, size.height);
    } else if (v?.enabled) camera.clearViewOffset();
    if (autoRotate) {
      c.azimuthAngle += Math.min(dt, 0.05) * 0.45;
      invalidate();
    }
    if (c.update(dt)) invalidate();
  });

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={0.04}
      maxDistance={5}
      smoothTime={0.35}
      draggingSmoothTime={0.08}
      dollyToCursor
      dollySpeed={0.6}
    />
  );
}

function Pointer() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const raycaster = useThree((s) => s.raycaster) as Raycaster;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const el = gl.domElement;
    regionBridge.canvas = el;
    const ndc = new Vector2();
    let down: { x: number; y: number } | null = null;
    let raf = 0;
    const hit = (e: PointerEvent | MouseEvent) => {
      const model = regionBridge.model;
      if (!model) return null;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return pick(model, raycaster.ray);
    };
    const move = (e: PointerEvent) => {
      if (e.buttons) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const m = hit(e);
        backStore.getState().setHovered(m ? asPicked(m) : null);
        el.style.cursor = m ? "pointer" : "grab";
      });
    };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      down = null;
      const m = hit(e);
      const st = backStore.getState();
      if (!m) {
        st.select(null);
      } else {
        // a footprint belongs to its muscle: select the muscle
        const owner = m.kind === "attachment" ? regionBridge.model?.byUnit.get(m.id)?.find((x) => x.kind === "unit" && x.side === m.side) : null;
        const p = asPicked(owner ?? m);
        if (st.selected && st.selected.kind === p.kind && st.selected.id === p.id && (p.kind === "unit" || st.selected.side === p.side)) st.select(null);
        else st.select(p);
      }
      invalidate();
    };
    const leave = () => backStore.getState().setHovered(null);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, [gl, camera, raycaster, invalidate]);
  return null;
}

const atlasTarget = (out: Vector3) => {
  if (regionBridge.controls) regionBridge.controls.getTarget(out);
  else out.set(0, 1, 0);
};
const atlasMeshes = () => (regionBridge.model?.meshes ?? []).map((m) => m.mesh);
/** Only the outermost visible layer is refined (deeper muscles are hidden behind it). */
const atlasMuscles = () => {
  const mode = backStore.getState().depthMode;
  const top = mode === "deep" ? 3 : mode === "no-superficial" ? 2 : 1;
  // (a textured model carries its surface detail in normal maps: nothing to refine)
  return (regionBridge.model?.meshes ?? []).filter((m) => m.kind === "unit" && m.target > 0.5 && m.depth <= top && !(m.mesh.material as { userData: { textured?: boolean } }).userData.textured).map((m) => m.mesh);
};
const refineOff = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("refine") === "0";

function Lighting() {
  const hd = useBack((s) => s.hd);
  return hd === true ? (
    <>
      <AtlasLighting keyLight={false} warmFill studio intensity={1.2} />
      <HDPipeline getTarget={atlasTarget} getMeshes={atlasMeshes} />
      {!refineOff() && <ProgressiveRefine getTarget={atlasTarget} getCandidates={atlasMuscles} />}
    </>
  ) : (
    <AtlasLighting />
  );
}

/**
 * Studio backdrop for the default (dark) background: a soft charcoal vignette, as in
 * a photographed anatomical sculpt, instead of flat black. Slightly dithered (no banding).
 */
function studioBackdrop(toneMapped: boolean): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(256, 225, 20, 256, 256, 380);
  // Target on screen: #2e2e2e → #181818 → #090909. In HD the backdrop passes through
  // the neutral tone mapper, whose toe crushes dark greys (y = 6.25·x²): pre-compensated.
  const stops = toneMapped ? ["#484848", "#373737", "#282828"] : ["#2e2e2e", "#181818", "#090909"];
  g.addColorStop(0, stops[0]);
  g.addColorStop(0.55, stops[1]);
  g.addColorStop(1, stops[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const img = ctx.getImageData(0, 0, 512, 512);
  let seed = 7;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = ((seed >>> 24) / 255 - 0.5) * 3;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * Light cream backdrop of the ZahraaFit theme. In HD the frame passes through the neutral
 * tone mapper, which darkens and greys near-white: the colour is given already inverted
 * through it (linear values above 1), so that the screen shows exactly BACKGROUNDS.cream.
 */
const CREAM_HD = new Color().setRGB(1.2938, 1.2459, 1.1527, LinearSRGBColorSpace);

function Background() {
  const bg = useBack((s) => s.background);
  const hd = useBack((s) => s.hd);
  const backdrop = useMemo(() => (bg === "black" ? studioBackdrop(hd === true) : null), [bg, hd]);
  useEffect(() => () => backdrop?.dispose(), [backdrop]);
  if (bg === "cream" && hd === true) return <primitive attach="background" object={CREAM_HD} />;
  return backdrop ? <primitive attach="background" object={backdrop} /> : <color attach="background" args={[BACKGROUNDS[bg]]} />;
}

export function BackViewport({ onState }: { onState: (s: LoadState) => void }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 30, near: 0.005, far: 30, position: [0, 1.3, -2.6] }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => configureRenderer(gl)}
      data-viewport=""
    >
      <Background />
      <Lighting />
      <Model onState={onState} />
      <Rig />
      <Pointer />
    </Canvas>
  );
}

export const _tmpBox = new Box3();
