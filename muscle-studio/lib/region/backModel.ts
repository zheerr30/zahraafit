import {
  Box3,
  Color,
  DoubleSide,
  Mesh,
  MeshPhysicalMaterial,
  Raycaster,
  Vector3,
  type Material,
  type Object3D,
} from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import { REGION_MUSCLE_BY_ID, type RegionLayer } from "@/data/region/backShoulders";
import { dequantizeMesh } from "@/lib/three/anatomyModel";
import { createMuscleMaterial, HIGHLIGHT_LOOK, REALISTIC_LOOK, setMuscleLook } from "@/lib/three/muscleMaterial";
import type { DepthMode, PickedStructure } from "@/stores/backStore";

export type RegionKind = PickedStructure["kind"];

export interface RegionMesh {
  mesh: Mesh;
  kind: RegionKind;
  /** Unit id (units, attachments) or Z-Anatomy source name (everything else). */
  id: string;
  side: "l" | "r" | "m";
  ar: string;
  en: string;
  layer: RegionLayer;
  depth: 1 | 2 | 3;
  role?: "origin" | "insertion";
  bone?: string;
  baseHex: string;
  /** Current / target opacity for fades. */
  opacity: number;
  target: number;
  styleKey: string;
}

export interface RegionModel {
  meshes: RegionMesh[];
  byUnit: Map<string, RegionMesh[]>;
  bounds: Box3;
}

export const COLORS = {
  highlight: "#E8602C",
  origin: "#B0203A",
  insertion: "#2F6BDB",
  muscle: "#C2575E",
  context: "#AE5257",
  bone: "#E6DCC5",
  disc: "#C9CFC4",
  tendon: "#E9E2D6",
  bursa: "#B9CEDB",
  nerve: "#E8C94C",
} as const;

const LAYER_OF: Record<RegionKind, RegionLayer> = {
  unit: "muscles",
  context: "muscles_context",
  bone: "bones",
  attachment: "attachments",
  tendon: "tendons",
  nerve: "nerves",
};

/** Depth of the non-selectable muscles, seen from behind (1 superficial … 3 deep). */
const CONTEXT_DEPTH: [RegExp, 1 | 2 | 3][] = [
  [/^(Multifidus|Interspinales|Levatores|Semispinalis|Rectus_posterior|Obliquus_(superior|inferior)_capitis|Quadratus_lumborum|External_intercostal)/, 3],
  [/^(Splenius|Scalenus|Serratus|Pectoralis_minor|Subclavius|Brachialis|Coracobrachialis|Medial_head_of_triceps)/, 2],
];
const contextDepth = (src: string): 1 | 2 | 3 => CONTEXT_DEPTH.find(([re]) => re.test(src))?.[1] ?? 1;

/** Readable English from a Z-Anatomy name: "Long_head_of_triceps_brachii" → "Long head of triceps brachii". */
const english = (src: string) => src.replace(/[()]/g, "").replace(/_/g, " ");

/** Small deterministic tone variation so neighbouring muscles read as separate tissue. */
function tone(base: string, key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const c = new Color(base);
  c.offsetHSL(((h % 7) - 3) * 0.004, (((h >> 3) % 5) - 2) * 0.02, (((h >> 6) % 7) - 3) * 0.01);
  return `#${c.getHexString()}`;
}

function plainMaterial(kind: RegionKind, src: string, role?: string): MeshPhysicalMaterial {
  const bursa = /bursa|sheath/i.test(src);
  const disc = /Intervertebral_disc/.test(src);
  const hex =
    kind === "bone" ? (disc ? COLORS.disc : COLORS.bone)
    : kind === "attachment" ? (role === "insertion" ? COLORS.insertion : COLORS.origin)
    : kind === "nerve" ? COLORS.nerve
    : bursa ? COLORS.bursa
    : COLORS.tendon;
  const mat = new MeshPhysicalMaterial({
    color: new Color(hex),
    roughness: kind === "bone" ? 0.62 : kind === "nerve" ? 0.42 : kind === "attachment" ? 0.55 : 0.34,
    metalness: 0,
    clearcoat: kind === "tendon" ? 0.45 : kind === "nerve" ? 0.3 : kind === "bone" ? 0.08 : 0,
    clearcoatRoughness: 0.35,
    sheen: kind === "bone" ? 0.25 : 0,
    sheenColor: new Color("#fff6e6"),
    envMapIntensity: 0.9,
    side: kind === "tendon" ? DoubleSide : undefined,
  });
  if (kind === "attachment") {
    // footprints are lifted 0.3 mm off the bone; polygon offset removes any remaining z-fighting
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -2;
  }
  if (bursa) {
    mat.transparent = true;
    mat.opacity = 0.55;
  }
  mat.userData.baseOpacity = bursa ? 0.55 : 1;
  return mat;
}

export function prepareRegionModel(scene: Object3D): RegionModel {
  const meshes: RegionMesh[] = [];
  scene.updateMatrixWorld(true);
  const all: Mesh[] = [];
  scene.traverse((o) => {
    if ((o as Mesh).isMesh) all.push(o as Mesh);
  });
  for (const mesh of all) {
    const x = mesh.userData as { kind?: RegionKind; id?: string; side?: "l" | "r" | "m"; source?: string; ar?: string; depth?: 1 | 2 | 3; role?: "origin" | "insertion"; bone?: string };
    if (!x.kind || !x.id) continue;
    if (mesh.geometry.getAttribute("_fiber")) dequantizeMesh(mesh);
    const unit = x.kind === "unit" || x.kind === "attachment" ? REGION_MUSCLE_BY_ID.get(x.id) : undefined;
    const source = x.source ?? x.id;
    let baseHex = "";
    let material: Material;
    if (x.kind === "unit" || x.kind === "context") {
      baseHex = tone(x.kind === "unit" ? COLORS.muscle : COLORS.context, x.kind === "unit" ? x.id : source);
      material = createMuscleMaterial(baseHex, REALISTIC_LOOK, false);
    } else {
      material = plainMaterial(x.kind, source, x.role);
      baseHex = `#${(material as MeshPhysicalMaterial).color.getHexString()}`;
    }
    mesh.material = material;
    mesh.raycast = acceleratedRaycast;
    computeBoundsTree.call(mesh.geometry);
    meshes.push({
      mesh,
      kind: x.kind,
      id: x.id,
      side: x.side ?? "m",
      ar: unit && x.kind === "unit" ? unit.ar : x.kind === "attachment" ? `${x.role === "insertion" ? "مرتكز" : "منشأ"} ${unit?.ar ?? x.id}` : (x.ar ?? english(source)),
      en: unit && x.kind === "unit" ? unit.en : english(source),
      layer: LAYER_OF[x.kind],
      depth: x.kind === "unit" ? (x.depth ?? 1) : x.kind === "context" ? contextDepth(source) : 1,
      role: x.role,
      bone: x.bone,
      baseHex,
      opacity: 1,
      target: 1,
      styleKey: "",
    });
  }
  const byUnit = new Map<string, RegionMesh[]>();
  for (const m of meshes) {
    if (m.kind !== "unit" && m.kind !== "attachment") continue;
    if (!byUnit.has(m.id)) byUnit.set(m.id, []);
    byUnit.get(m.id)!.push(m);
  }
  const bounds = new Box3();
  for (const m of meshes) if (m.kind === "unit" || m.kind === "bone") bounds.expandByObject(m.mesh);
  return { meshes, byUnit, bounds };
}

export interface VisibilityState {
  layers: Record<RegionLayer, boolean>;
  hiddenUnits: Record<string, true>;
  depthMode: DepthMode;
  isolate: boolean;
  selected: PickedStructure | null;
}

const FASCIA = /thoracolumbar_fascia/i;

/** Target opacity (0 hidden … 1 shown) for the current layer / depth / isolation state. */
export function targetOpacity(m: RegionMesh, s: VisibilityState): number {
  const sel = s.selected;
  const isSelected = !!sel && sel.kind === m.kind && sel.id === m.id && (m.kind === "unit" || sel.side === m.side);
  if (s.isolate && sel) {
    // Showing a muscle's attachments: the muscle turns translucent over its footprints.
    if (isSelected) return m.kind === "unit" && s.layers.attachments ? 0.32 : 1;
    if (m.kind === "bone") return 1; // the skeleton stays as reference
    return m.kind === "attachment" && sel.kind === "unit" && m.id === sel.id ? 1 : 0;
  }
  return shouldShow(m, s) ? 1 : 0;
}

/** Whether a mesh is shown for the current layer / depth state (outside isolation). */
export function shouldShow(m: RegionMesh, s: VisibilityState): boolean {
  const sel = s.selected;
  const minDepth = s.depthMode === "all" ? 1 : s.depthMode === "no-superficial" ? 2 : 3;
  switch (m.kind) {
    case "unit":
      return s.layers.muscles && !s.hiddenUnits[m.id] && m.depth >= minDepth;
    case "context":
      return s.layers.muscles_context && m.depth >= minDepth;
    case "bone":
      return s.layers.bones;
    case "attachment":
      return s.layers.bones && (s.layers.attachments || (sel?.kind === "unit" && sel.id === m.id));
    case "tendon":
      // the posterior thoracolumbar fascia covers the erector spinae
      return s.layers.tendons && !(minDepth >= 2 && FASCIA.test(m.en.replace(/ /g, "_")));
    case "nerve":
      return s.layers.nerves;
  }
}

/** Colour / look of a mesh for the current selection and hover. */
export function applyStyle(m: RegionMesh, selected: PickedStructure | null, hovered: PickedStructure | null): boolean {
  const same = (p: PickedStructure | null) => !!p && p.kind === m.kind && p.id === m.id && (m.kind === "unit" || p.side === m.side);
  const isSel = same(selected);
  const isHover = same(hovered);
  const key = `${isSel}|${isHover}`;
  if (key === m.styleKey) return false;
  m.styleKey = key;
  const mat = m.mesh.material as MeshPhysicalMaterial;
  if (m.kind === "unit" || m.kind === "context") {
    setMuscleLook(mat, isSel ? COLORS.highlight : m.baseHex, isSel ? HIGHLIGHT_LOOK : REALISTIC_LOOK, isHover);
  } else if (m.kind !== "attachment") {
    const c = new Color(isSel ? COLORS.highlight : m.baseHex);
    mat.color.copy(c);
    mat.emissive.copy(isHover ? c.clone().multiplyScalar(0.22) : new Color(0, 0, 0));
  } else {
    mat.emissive.copy(isHover ? mat.color.clone().multiplyScalar(0.25) : new Color(0, 0, 0));
  }
  return true;
}

/** Fade duration (s). Time-based, so it ends on time even when frames are slow. */
const FADE = 0.35;

/** Advance opacity fades; returns true while something is still animating. */
export function stepFades(model: RegionModel, dt: number): boolean {
  let animating = false;
  const step = dt / FADE;
  for (const m of model.meshes) {
    if (m.opacity === m.target) continue;
    const d = m.target - m.opacity;
    m.opacity = Math.abs(d) <= step ? m.target : m.opacity + Math.sign(d) * step;
    if (m.opacity !== m.target) animating = true;
    const mat = m.mesh.material as MeshPhysicalMaterial;
    const base = (mat.userData.baseOpacity as number | undefined) ?? 1;
    mat.opacity = base * m.opacity;
    const transparent = m.opacity < 1 || base < 1;
    if (mat.transparent !== transparent) {
      mat.transparent = transparent;
      mat.needsUpdate = true;
    }
    mat.depthWrite = m.opacity > 0.6;
    m.mesh.visible = m.opacity > 0.001;
  }
  return animating;
}

const raycaster = new Raycaster();
raycaster.firstHitOnly = true;

/** First visible structure under the pointer (fading-out meshes are not pickable). */
export function pick(model: RegionModel, ray: Raycaster["ray"]): RegionMesh | null {
  raycaster.ray.copy(ray);
  let best: { m: RegionMesh; d: number } | null = null;
  for (const m of model.meshes) {
    if (m.target < 0.3 || !m.mesh.visible) continue;
    const hits = raycaster.intersectObject(m.mesh, false);
    if (hits.length && (!best || hits[0].distance < best.d)) best = { m, d: hits[0].distance };
  }
  // A footprint is drawn on its bone: prefer it when it is hit at (almost) the same depth.
  return best?.m ?? null;
}

/** Bounds of a unit (one side, or both when side is null). */
export function unitBounds(model: RegionModel, unitId: string, side: "l" | "r" | "m" | null): Box3 | null {
  const list = (model.byUnit.get(unitId) ?? []).filter((m) => m.kind === "unit" && (!side || side === "m" || m.side === side));
  if (!list.length) return null;
  const b = new Box3();
  for (const m of list) b.expandByObject(m.mesh);
  return b;
}

export function structureBounds(model: RegionModel, p: PickedStructure): Box3 | null {
  if (p.kind === "unit") return unitBounds(model, p.id, p.side);
  const list = model.meshes.filter((m) => m.kind === p.kind && m.id === p.id && m.side === p.side);
  if (!list.length) return null;
  const b = new Box3();
  for (const m of list) b.expandByObject(m.mesh);
  return b;
}

export function disposeRegionModel(model: RegionModel): void {
  for (const m of model.meshes) {
    disposeBoundsTree.call(m.mesh.geometry);
    m.mesh.geometry.dispose();
    (m.mesh.material as Material).dispose();
  }
}

export const tmpVec = new Vector3();
