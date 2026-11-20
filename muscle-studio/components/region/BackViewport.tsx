"use client";

import { CameraControls } from "@react-three/drei";
import { AtlasLighting } from "@/components/anatomy/AtlasLighting";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box3, CanvasTexture, Object3D, Sphere, SRGBColorSpace, Vector2, Vector3, type PerspectiveCamera, type Raycaster } from "three";
import {
  applyStyle,
  disposeRegionModel,
  addMeshes,
  createRegionModel,
  pick,
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

/** Original Z-Anatomy geometry exported from Blender (pipeline/blender/export_body.py + postprocess-body.mjs). */
export const MODEL_BASE = "/models/zanatomy";
export const modelUrl = (sex: "male" | "female", part: string) => `${MODEL_BASE}/${sex}/${part}.glb`;
/** The body shown by default: core.glb with refined muscle surfaces. */
export const BODY_PART = "core-smooth";
/** Optional layers loaded on first use. */
const LAZY_PARTS = { attachments: "attachments", nerves: "nerves" } as const;
export const BACKGROUNDS = { black: "#0d0e10", navy: "#06142f" } as const;

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
    const st = backStore.getState();
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
    // Muscle surfaces refined from the original Z-Anatomy meshes (pipeline/sculpt/body.mjs:
    // same nodes and vertices, bellies smoothed by ≤ 2 mm); `?sculpt=0` shows the original.
    const part = new URLSearchParams(window.location.search).get("sculpt") === "0" ? "core" : BODY_PART;
    loadGltf(modelUrl(sex, part), { renderer: gl, signal: ctrl.signal, onProgress: (p) => onState({ status: "loading", progress: p }) })
      .then((gltf) => {
        const meshes = prepareMeshes(gltf.scene, hd ? HD_OPTIONS : {});
        addMeshes(model, meshes);
        modelRef.current = model;
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
    const need = (st: ReturnType<typeof backStore.getState>) => [
      ...(st.layers.attachments || st.selected?.kind === "unit" ? ["attachments"] : []),
      ...(st.layers.nerves ? ["nerves"] : []),
    ];
    const load = (part: keyof typeof LAZY_PARTS) => {
      const model = modelRef.current;
      if (!model || loaded.current.has(part)) return;
      loaded.current.add(part);
      const forSex = backStore.getState().sex;
      loadGltf(modelUrl(forSex, LAZY_PARTS[part]), { renderer: gl })
        .then((gltf) => {
          if (modelRef.current !== model) return;
          const meshes = prepareMeshes(gltf.scene, backStore.getState().hd ? HD_OPTIONS : {});
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
    const check = () => { for (const p of need(backStore.getState())) load(p as keyof typeof LAZY_PARTS); };
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
        for (const m of model.meshes) {
          const t = targetOpacity(m, st);
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
    const freeH = Math.max(0.35, 1 - ins.bottom / Math.max(1, size.height));
    const freeW = Math.max(0.35, 1 - (ins.left + ins.right) / Math.max(1, size.width));
    const fit = (box: Box3, dir: Vector3, margin: number) => {
      const center = box.getCenter(new Vector3());
      const s = box.getSize(new Vector3());
      const vfov = (camera.fov * Math.PI) / 180;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
      const across = Math.abs(dir.x) > 0.5 ? s.z : s.x;
      const dist = Math.max(s.y / 2 / (Math.tan(vfov / 2) * freeH), across / 2 / (Math.tan(hfov / 2) * freeW)) * margin + Math.max(s.x, s.z) / 2;
      const pos = center.clone().addScaledVector(dir, dist);
      void c.setLookAt(pos.x, pos.y, pos.z, center.x, center.y, center.z, true);
    };
    if (command.type === "region") {
      const box = regionBounds(model, command.region);
      if (!box) return;
      const back = ["back", "pelvis", "legs"].includes(command.region);
      fit(box, new Vector3(0, 0.1, back ? -1 : 1).normalize(), 1.15);
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
      fit(box, new Vector3(0.55, 0.18, -0.82).normalize(), 1.05);
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
      fit(box, dirs[command.view as Exclude<RegionView, "closeup">], 1.22);
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
    const tx = (ins.right - ins.left) / 2, ty = ins.bottom / 2;
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
  return (regionBridge.model?.meshes ?? []).filter((m) => m.kind === "unit" && m.target > 0.5 && m.depth <= top).map((m) => m.mesh);
};
const refineOff = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("refine") === "0";

function Lighting() {
  const hd = useBack((s) => s.hd);
  return hd === true ? (
    <>
      <AtlasLighting keyLight={false} warmFill intensity={1.3} />
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

function Background() {
  const bg = useBack((s) => s.background);
  const hd = useBack((s) => s.hd);
  const backdrop = useMemo(() => (bg === "black" ? studioBackdrop(hd === true) : null), [bg, hd]);
  useEffect(() => () => backdrop?.dispose(), [backdrop]);
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
