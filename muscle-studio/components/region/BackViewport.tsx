"use client";

import { CameraControls, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box3, Group, Object3D, Sphere, Vector2, Vector3, type PerspectiveCamera, type Raycaster } from "three";
import {
  applyStyle,
  disposeRegionModel,
  pick,
  prepareRegionModel,
  targetOpacity,
  stepFades,
  structureBounds,
  unitBounds,
  type RegionMesh,
  type RegionModel,
} from "@/lib/region/backModel";
import { loadGltf } from "@/lib/three/loadGltf";
import { configureRenderer } from "@/lib/three/rendererSetup";
import { backStore, useBack, type PickedStructure, type RegionView } from "@/stores/backStore";

export const MODEL_URL = "/models/back-shoulders/back-shoulders.glb";
export const BACKGROUNDS = { black: "#000000", navy: "#06142f" } as const;

/** Shared handles for overlays, tests and exports (one viewer per page). */
export const regionBridge: {
  model: RegionModel | null;
  camera: PerspectiveCamera | null;
  controls: CameraControls | null;
  canvas: HTMLCanvasElement | null;
  invalidate: () => void;
} = { model: null, camera: null, controls: null, canvas: null, invalidate: () => {} };

export type LoadState = { status: "loading"; progress: number } | { status: "ready" } | { status: "error"; message: string };

const asPicked = (m: RegionMesh): PickedStructure => ({ kind: m.kind, id: m.id, side: m.side, ar: m.ar, en: m.en });

function Model({ onState }: { onState: (s: LoadState) => void }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const [root, setRoot] = useState<Object3D | null>(null);
  const modelRef = useRef<RegionModel | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let model: RegionModel | null = null;
    loadGltf(MODEL_URL, { renderer: gl, signal: ctrl.signal, onProgress: (p) => onState({ status: "loading", progress: p }) })
      .then((gltf) => {
        model = prepareRegionModel(gltf.scene);
        modelRef.current = model;
        regionBridge.model = model;
        const st = backStore.getState();
        for (const m of model.meshes) {
          m.target = targetOpacity(m, st);
          m.opacity = m.target;
          m.mesh.visible = m.target > 0;
          applyStyle(m, st.selected, st.hovered);
        }
        setRoot(gltf.scene);
        onState({ status: "ready" });
        backStore.getState().view("back");
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        onState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      ctrl.abort();
      if (model) disposeRegionModel(model);
      regionBridge.model = null;
    };
  }, [gl, onState]);

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
      if (st.selected !== prev.selected || st.hovered !== prev.hovered) {
        for (const m of model.meshes) changed = applyStyle(m, st.selected, st.hovered) || changed;
      }
      if (changed || st.background !== prev.background || st.autoRotate !== prev.autoRotate) invalidate();
    });
  }, [invalidate]);

  useFrame((_, dt) => {
    const model = modelRef.current;
    if (model && stepFades(model, Math.min(dt, 0.25))) invalidate();
  });

  return root ? <primitive object={root} /> : null;
}

/** Key, fill and rim lights that travel with the camera: every angle of the 360° turn is lit alike. */
function CameraLights() {
  const camera = useThree((s) => s.camera);
  const group = useMemo(() => new Group(), []);
  const targets = useMemo(() => {
    const t = new Object3D();
    t.position.set(0, 0, -3);
    return t;
  }, []);
  useEffect(() => {
    group.add(targets);
  }, [group, targets]);
  useFrame(() => {
    group.position.copy(camera.position);
    group.quaternion.copy(camera.quaternion);
  });
  return (
    <primitive object={group}>
      <directionalLight position={[1.6, 1.8, 0.6]} intensity={2.4} color="#fff3e8" target={targets} />
      <directionalLight position={[-2.2, 0.6, 0.8]} intensity={0.85} color="#f2f5ff" target={targets} />
      <directionalLight position={[0, 2.5, -3]} intensity={1.3} color="#eef2ff" target={targets} />
      <directionalLight position={[-1.5, -1.2, -1.5]} intensity={0.45} target={targets} />
    </primitive>
  );
}

function Rig() {
  const ref = useRef<CameraControls>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const command = useBack((s) => s.cameraCommand);
  const autoRotate = useBack((s) => s.autoRotate);

  useEffect(() => {
    regionBridge.controls = ref.current;
    regionBridge.camera = camera;
    regionBridge.invalidate = invalidate;
    const c = ref.current;
    if (!c) return;
    const stop = () => backStore.getState().autoRotate && backStore.getState().setAutoRotate(false);
    c.addEventListener("controlstart", stop);
    return () => c.removeEventListener("controlstart", stop);
  }, [camera, invalidate]);

  useEffect(() => {
    const c = ref.current;
    const model = regionBridge.model;
    if (!c || !command || !model) return;
    const aspect = size.width / Math.max(1, size.height);
    const fit = (box: Box3, dir: Vector3, margin: number) => {
      const center = box.getCenter(new Vector3());
      const s = box.getSize(new Vector3());
      const vfov = (camera.fov * Math.PI) / 180;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
      const across = Math.abs(dir.x) > 0.5 ? s.z : s.x;
      const dist = Math.max(s.y / 2 / Math.tan(vfov / 2), across / 2 / Math.tan(hfov / 2)) * margin + Math.max(s.x, s.z) / 2;
      const pos = center.clone().addScaledVector(dir, dist);
      void c.setLookAt(pos.x, pos.y, pos.z, center.x, center.y, center.z, true);
    };
    if (command.type === "view") {
      const dirs: Record<RegionView, Vector3> = {
        back: new Vector3(0, 0.08, -1).normalize(),
        front: new Vector3(0, 0.08, 1).normalize(),
        left: new Vector3(1, 0.05, 0).normalize(),
        right: new Vector3(-1, 0.05, 0).normalize(),
      };
      // Frame the back & shoulders: muscles of the region (not the skull).
      const box = new Box3();
      for (const m of model.meshes) if (m.kind === "unit") box.expandByObject(m.mesh);
      fit(box, dirs[command.view], 1.22);
    } else {
      const box = command.type === "focus" ? unitBounds(model, command.unitId, command.side) : null;
      const sel = backStore.getState().selected;
      const b = box ?? (sel ? structureBounds(model, sel) : null);
      if (!b) return;
      const sphere = b.getBoundingSphere(new Sphere());
      sphere.radius = Math.max(sphere.radius, 0.05);
      void c.fitToSphere(sphere, true);
    }
    invalidate();
  }, [command, camera, size, invalidate]);

  useFrame((_, dt) => {
    const c = ref.current;
    if (!c) return;
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

function Background() {
  const bg = useBack((s) => s.background);
  return <color attach="background" args={[BACKGROUNDS[bg]]} />;
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
      <ambientLight intensity={0.22} />
      <hemisphereLight args={["#fff8f2", "#20232a", 0.45]} />
      <CameraLights />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={1.4} position={[0, 4, -2]} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[-4, 1.5, 0]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[4, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} />
        <Lightformer form="rect" intensity={0.6} position={[0, 2, 4]} scale={[5, 3, 1]} />
      </Environment>
      <Model onState={onState} />
      <Rig />
      <Pointer />
    </Canvas>
  );
}

export const _tmpBox = new Box3();
