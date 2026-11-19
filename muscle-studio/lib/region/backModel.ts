import { Box3, Color, Mesh, MeshPhysicalMaterial, NormalBlending, Raycaster, Vector3, type Material, type Object3D } from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import { REGION_MUSCLE_BY_ID, type RegionLayer } from "@/data/region/backShoulders";
import { dequantizeMesh } from "@/lib/three/anatomyModel";
import { createMuscleMaterial, HIGHLIGHT_LOOK, REALISTIC_LOOK, setMuscleLook } from "@/lib/three/muscleMaterial";
import { axisTangents, createMuscleMaterialHD, createTissueMaterialHD, muscleDetail, principalAxis, setCoverageBlending, setMuscleLookHD } from "@/lib/three/hdMaterials";
import { markRectusSheath, renderDepth } from "@/lib/three/abdomen";
import { fibreTangents, orientFibres, refineMeshInPlace } from "@/lib/three/refine";
import { createTissueMaterial, muscleTone, TISSUE, tissueOf } from "@/lib/three/tissue";
import type { DepthMode, PickedStructure } from "@/stores/backStore";

export type RegionKind = PickedStructure["kind"];

export interface RegionMesh {
  mesh: Mesh;
  kind: RegionKind;
  /** Unit id (muscles, attachments) or Z-Anatomy source name (everything else). */
  id: string;
  side: "l" | "r" | "m";
  ar: string;
  en: string;
  layer: RegionLayer;
  depth: 1 | 2 | 3;
  /** Study region (head-neck, chest, back, shoulders, arms, abdomen, pelvis, thigh, adductors, legs). */
  region: string;
  role?: "origin" | "insertion";
  bone?: string;
  /** Preserved Z-Anatomy metadata (node extras of the Blender export). */
  meta: {
    zaName: string;
    hierarchy: string[];
    ta2?: number;
    latin?: string;
    definition?: string;
    materials: string[];
    fibre?: string;
  };
  baseHex: string;
  /** Current / target opacity for fades. */
  opacity: number;
  target: number;
  styleKey: string;
}

/** One selectable muscle (both sides). */
export interface RegionUnit {
  id: string;
  ar: string;
  en: string;
  region: string;
  depth: 1 | 2 | 3;
}

export interface RegionModel {
  meshes: RegionMesh[];
  byUnit: Map<string, RegionMesh[]>;
  units: Map<string, RegionUnit>;
  bounds: Box3;
}

export const COLORS = {
  highlight: "#E8602C",
  origin: TISSUE.origin,
  insertion: TISSUE.insertion,
  nerve: TISSUE.nerve,
} as const;

export const REGIONS: { id: string; ar: string }[] = [
  { id: "head-neck", ar: "الرأس والعنق" },
  { id: "chest", ar: "الصدر" },
  { id: "back", ar: "الظهر" },
  { id: "shoulders", ar: "الكتفان" },
  { id: "arms", ar: "الذراعان والساعدان" },
  { id: "abdomen", ar: "البطن والجذع" },
  { id: "pelvis", ar: "الحوض والألوية" },
  { id: "thigh", ar: "الفخذ: الرباعية وأوتار المأبض" },
  { id: "adductors", ar: "المقرِّبات" },
  { id: "legs", ar: "الساق والقدم" },
];

const LAYER_OF: Record<RegionKind, RegionLayer> = {
  unit: "muscles",
  tendon: "tendons",
  ligament: "tendons",
  fascia: "fasciae",
  bone: "bones",
  attachment: "attachments",
  nerve: "nerves",
};

/** Readable English from a Z-Anatomy name: "Long_head_of_triceps_brachii" → "Long head of triceps brachii". */
const english = (src: string) => src.replace(/[()]/g, "").replace(/_/g, " ");

type Extras = {
  kind?: string; id?: string; side?: "l" | "r" | "m"; source?: string; ar?: string; depth?: 1 | 2 | 3; region?: string;
  role?: "origin" | "insertion"; bone?: string; za_name?: string; hierarchy?: string[]; ta2?: number; latin?: string;
  definition?: string; materials?: string[]; fibre?: string;
};

/**
 * HD rendering options (prototype). `refineRegions`: muscles of these study
 * regions get the interpolating PN refinement (original vertices unchanged).
 */
export interface PrepareOptions {
  hd?: boolean;
  refineRegions?: ReadonlySet<string>;
}

export { HD_MUSCLE_COLOR as HD_MUSCLE } from "@/lib/three/hdMaterials";
import { HD_MUSCLE_COLOR as HD_MUSCLE } from "@/lib/three/hdMaterials";

export { refineReport } from "@/lib/three/refine";

/** Prepare the meshes of one loaded file (core, attachments or nerves). */
export function prepareMeshes(scene: Object3D, opts: PrepareOptions = {}): RegionMesh[] {
  const out: RegionMesh[] = [];
  scene.updateMatrixWorld(true);
  const all: Mesh[] = [];
  scene.traverse((o) => {
    if ((o as Mesh).isMesh) all.push(o as Mesh);
  });
  for (const mesh of all) {
    const x = mesh.userData as Extras;
    if (!x.kind || !x.id || !(x.kind in LAYER_OF)) continue;
    const kind = x.kind as RegionKind;
    if (mesh.geometry.getAttribute("_fiber")) dequantizeMesh(mesh);
    const card = kind === "unit" || kind === "attachment" ? REGION_MUSCLE_BY_ID.get(x.id) : undefined;
    const source = x.source ?? x.id;
    let baseHex: string;
    let material: Material;
    if (kind === "unit" && opts.hd) {
      baseHex = muscleTone(x.id, HD_MUSCLE, 0.5);
      orientFibres(mesh.geometry);
      fibreTangents(mesh.geometry);
      if (opts.refineRegions?.has(x.region ?? "")) refineMeshInPlace(mesh);
      const detail = muscleDetail(x.id + (x.source ?? ""), mesh.geometry);
      material = createMuscleMaterialHD(baseHex, REALISTIC_LOOK, false, detail);
      // Where layers nearly coincide, the more superficial muscle wins the depth test
      // (render order only — no geometry is moved).
      const d = renderDepth(x.za_name ?? "", x.depth) - 1;
      if (d > 0) {
        material.polygonOffset = true;
        material.polygonOffsetFactor = d;
        material.polygonOffsetUnits = 2 * d;
      }
    } else if (kind === "unit") {
      baseHex = muscleTone(x.id);
      material = createMuscleMaterial(baseHex, REALISTIC_LOOK, false);
    } else if (opts.hd) {
      const t = tissueOf(kind, source, x.role)!;
      const fibrous = t === "tendon" || t === "ligament" || t === "fascia" || t === "nerve";
      const axis = fibrous ? principalAxis(mesh.geometry) : undefined;
      if (axis) axisTangents(mesh.geometry, axis);
      material = createTissueMaterialHD(t, { vertexColors: kind === "bone" && !!mesh.geometry.getAttribute("color"), axis });
      baseHex = `#${(material as MeshPhysicalMaterial).color.getHexString()}`;
    } else {
      const t = tissueOf(kind, source, x.role)!;
      material = createTissueMaterial(t, { vertexColors: kind === "bone" && !!mesh.geometry.getAttribute("color") });
      baseHex = `#${(material as MeshPhysicalMaterial).color.getHexString()}`;
    }
    mesh.material = material;
    mesh.raycast = acceleratedRaycast;
    computeBoundsTree.call(mesh.geometry);
    out.push({
      mesh,
      kind,
      id: x.id,
      side: x.side ?? "m",
      ar: kind === "unit" ? (card?.ar ?? x.ar ?? english(source)) : (x.ar ?? english(source)),
      en: kind === "unit" && card ? card.en : english(source),
      layer: LAYER_OF[kind],
      depth: kind === "unit" ? (x.depth ?? 1) : 1,
      region: x.region ?? "other",
      role: x.role,
      bone: x.bone,
      meta: {
        zaName: x.za_name ?? source,
        hierarchy: x.hierarchy ?? [],
        ta2: x.ta2,
        latin: x.latin,
        definition: x.definition,
        materials: x.materials ?? [],
        fibre: x.fibre,
      },
      baseHex,
      opacity: 1,
      target: 1,
      styleKey: "",
    });
  }
  if (opts.hd) markRectusSheath(out.filter((m) => m.kind === "unit").map((m) => m.mesh));
  return out;
}

export function createRegionModel(): RegionModel {
  return { meshes: [], byUnit: new Map(), units: new Map(), bounds: new Box3() };
}

/** Add prepared meshes (a newly loaded file) to the model. */
export function addMeshes(model: RegionModel, meshes: RegionMesh[]): void {
  for (const m of meshes) {
    model.meshes.push(m);
    if (m.kind === "unit" || m.kind === "attachment") {
      if (!model.byUnit.has(m.id)) model.byUnit.set(m.id, []);
      model.byUnit.get(m.id)!.push(m);
    }
    if (m.kind === "unit") {
      const u = model.units.get(m.id);
      if (!u) model.units.set(m.id, { id: m.id, ar: m.ar, en: m.en, region: m.region, depth: m.depth });
      else if (m.depth < u.depth) u.depth = m.depth;
      model.bounds.expandByObject(m.mesh);
    }
  }
}

/** Back-compat helper (tests): prepare a whole scene as one model. */
export function prepareRegionModel(scene: Object3D, opts: PrepareOptions = {}): RegionModel {
  const model = createRegionModel();
  addMeshes(model, prepareMeshes(scene, opts));
  return model;
}

export interface VisibilityState {
  layers: Record<RegionLayer, boolean>;
  hiddenUnits: Record<string, true>;
  depthMode: DepthMode;
  isolate: boolean;
  selected: PickedStructure | null;
}

/** Opacity of the surrounding anatomy while one structure is isolated. */
export const GHOST = 0.13;

/** Target opacity (0 hidden … 1 shown) for the current layer / depth / isolation state. */
export function targetOpacity(m: RegionMesh, s: VisibilityState): number {
  const sel = s.selected;
  const isSelected = !!sel && sel.kind === m.kind && sel.id === m.id && (m.kind === "unit" || sel.side === m.side);
  if (s.isolate && sel) {
    // Showing a muscle's attachments: the muscle turns translucent over its footprints.
    if (isSelected) return m.kind === "unit" && s.layers.attachments ? 0.32 : 1;
    if (m.kind === "bone") return s.layers.bones || s.layers.attachments ? 1 : GHOST; // the skeleton stays as reference
    if (m.kind === "attachment") return sel.kind === "unit" && m.id === sel.id ? 1 : 0;
    // the surrounding anatomy stays visible as a faint ghost (not pickable)
    return m.kind === "unit" && shouldShow(m, { ...s, isolate: false }) ? GHOST : 0;
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
    case "bone":
      return s.layers.bones;
    case "attachment":
      return s.layers.bones && (s.layers.attachments || (sel?.kind === "unit" && sel.id === m.id));
    case "tendon":
    case "ligament":
      return s.layers.tendons && (m.kind === "ligament" ? s.layers.bones : true);
    case "fascia":
      return s.layers.fasciae;
    case "nerve":
      return s.layers.nerves;
  }
}

/** Colour / look of a mesh for the current selection, hover and highlight colour. */
export function applyStyle(m: RegionMesh, selected: PickedStructure | null, hovered: PickedStructure | null, highlight: string = COLORS.highlight): boolean {
  const same = (p: PickedStructure | null) => !!p && p.kind === m.kind && p.id === m.id && (m.kind === "unit" || p.side === m.side);
  const isSel = same(selected);
  const isHover = same(hovered);
  const key = `${isSel}|${isHover}|${isSel ? highlight : ""}`;
  if (key === m.styleKey) return false;
  m.styleKey = key;
  const mat = m.mesh.material as MeshPhysicalMaterial;
  if (m.kind === "unit") {
    (mat.userData.hd ? setMuscleLookHD : setMuscleLook)(mat, isSel ? highlight : m.baseHex, isSel ? HIGHLIGHT_LOOK : REALISTIC_LOOK, isHover);
  } else if (m.kind !== "attachment") {
    const c = new Color(isSel ? highlight : m.baseHex);
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
      if (mat.userData.coverageBlend) {
        if (transparent) mat.blending = NormalBlending;
        else setCoverageBlending(mat);
      }
      mat.needsUpdate = true;
    }
    mat.depthWrite = base >= 1 && m.opacity > 0.6 && m.target > GHOST;
    m.mesh.visible = m.opacity > 0.001;
  }
  return animating;
}

const raycaster = new Raycaster();
raycaster.firstHitOnly = true;

/** First visible structure under the pointer (fading-out and ghosted meshes are not pickable). */
export function pick(model: RegionModel, ray: Raycaster["ray"]): RegionMesh | null {
  raycaster.ray.copy(ray);
  let best: { m: RegionMesh; d: number } | null = null;
  for (const m of model.meshes) {
    if (m.target < 0.3 || !m.mesh.visible) continue;
    const hits = raycaster.intersectObject(m.mesh, false);
    if (hits.length && (!best || hits[0].distance < best.d)) best = { m, d: hits[0].distance };
  }
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

/** Bounds of all muscles of a study region. */
export function regionBounds(model: RegionModel, region: string): Box3 | null {
  const b = new Box3();
  for (const m of model.meshes) if (m.kind === "unit" && m.region === region) b.expandByObject(m.mesh);
  return b.isEmpty() ? null : b;
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
