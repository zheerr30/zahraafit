import { Box3, Color, Mesh, MeshPhysicalMaterial, NormalBlending, Raycaster, Vector3, type Material, type MeshStandardMaterial, type Object3D } from "three";
import { createTexturedMaterial, setTexturedLook } from "@/lib/three/texturedLook";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import { REGION_MUSCLE_BY_ID, type RegionLayer } from "@/data/region/backShoulders";
import { dequantizeMesh } from "@/lib/three/anatomyModel";
import { createMuscleMaterial, REALISTIC_LOOK, setMuscleLook, type MuscleLook } from "@/lib/three/muscleMaterial";
import { plainArabic } from "@/lib/anatomy/normalize";
import { SELECTION_ACCENT, SELECTION_ACCENT_SOFT } from "@/lib/highlight";
import { axisTangents, createMuscleMaterialHD, createTissueMaterialHD, muscleDetail, principalAxis, setCoverageBlending, setMuscleLookHD } from "@/lib/three/hdMaterials";
import { markRectusSheath, renderDepth } from "@/lib/three/abdomen";
import { fibreTangents, orientFibres, refineMeshInPlace } from "@/lib/three/refine";
import { createTissueMaterial, muscleTone, TISSUE, tissueOf } from "@/lib/three/tissue";
import { muscleTones, neutralTone } from "@/lib/three/palette";
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
  /** Muscles: the neutral tone shown while another muscle is selected (see lib/three/palette.ts). */
  neutralHex?: string;
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
  highlight: SELECTION_ACCENT,
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
  { id: "adductors", ar: "المقربات" },
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
  fat: "fat",
  vessel: "vessels",
  skin: "skin",
};

/** Readable English from a Z-Anatomy name: "Long_head_of_triceps_brachii" → "Long head of triceps brachii". */
const english = (src: string) => src.replace(/[()]/g, "").replace(/_/g, " ");

type Extras = {
  kind?: string; id?: string; side?: "l" | "r" | "m"; source?: string; ar?: string; depth?: 1 | 2 | 3; region?: string;
  role?: "origin" | "insertion"; bone?: string; za_name?: string; hierarchy?: string[]; ta2?: number; latin?: string;
  definition?: string; materials?: string[]; fibre?: string;
  /** "ecorche": a textured part of the Écorché model (its own material is used). */
  src?: string; en?: string;
  /** Layer the part is shown with, when it is not its kind's own (the breast: with the muscles). */
  show?: RegionLayer;
};

/**
 * HD rendering options (prototype). `refineRegions`: muscles of these study
 * regions get the interpolating PN refinement (original vertices unchanged).
 */
export interface PrepareOptions {
  hd?: boolean;
  refineRegions?: ReadonlySet<string>;
  /** Anisotropic filtering of a textured model's maps (the renderer's maximum, capped). */
  anisotropy?: number;
  /** Base colour of the muscles drawn with the atlas's own material (default: the palette's). */
  muscleBase?: string;
}

export { HD_MUSCLE_COLOR as HD_MUSCLE } from "@/lib/three/hdMaterials";

export { refineReport } from "@/lib/three/refine";

/** Muscles of the head (facial, masticatory, epicranial, eye and tongue muscles): rendered quietly. */
const isFace = (hierarchy?: string[]) => !!hierarchy?.includes("Muscles of head");
/** Teeth and nose cartilages. */
const isFaceDetail = (hierarchy?: string[]) => !!hierarchy?.some((h) => h === "Teeth" || h === "Nasal cartilages");
const FACE_DETAIL_TONE = "#CDBBA4";

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
    let neutralHex: string | undefined;
    let material: Material;
    const face = isFace(x.hierarchy);
    if (x.src === "ecorche") {
      // Textured model: its own material (base colour, normal, occlusion-roughness maps).
      dequantizeMesh(mesh);
      material = createTexturedMaterial(mesh.material as MeshStandardMaterial, opts.anisotropy ?? 1);
      baseHex = "#ffffff";
      if (kind === "skin") {
        // the skin hides everything under it: clicks go through to nothing else, by design
        (material as MeshStandardMaterial).userData.baseOpacity = 1;
      }
    } else if (kind === "unit" && opts.hd) {
      const tones = muscleTones(x.id, { depth: x.depth, face, base: opts.muscleBase });
      baseHex = tones.base;
      neutralHex = tones.neutral;
      orientFibres(mesh.geometry);
      fibreTangents(mesh.geometry);
      if (opts.refineRegions?.has(x.region ?? "")) refineMeshInPlace(mesh);
      const detail = muscleDetail(x.id + (x.source ?? ""), mesh.geometry);
      // the face is kept quiet: little fibre contrast and relief
      if (face) detail.detail = 0.35;
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
      neutralHex = neutralTone(baseHex);
      material = createMuscleMaterial(baseHex, REALISTIC_LOOK, false);
    } else if (opts.hd) {
      const t = tissueOf(kind, source, x.role)!;
      const fibrous = t === "tendon" || t === "ligament" || t === "fascia" || t === "nerve";
      const axis = fibrous ? principalAxis(mesh.geometry) : undefined;
      if (axis) axisTangents(mesh.geometry, axis);
      // Nose cartilages and teeth are the brightest things on the face: toned down, so the
      // face does not pull the eye away from the body (the meshes themselves are untouched).
      const quiet = kind === "bone" && isFaceDetail(x.hierarchy);
      material = createTissueMaterialHD(t, { vertexColors: !quiet && kind === "bone" && !!mesh.geometry.getAttribute("color"), axis });
      if (quiet) (material as MeshPhysicalMaterial).color.set(FACE_DETAIL_TONE);
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
      ar: plainArabic(x.src === "ecorche" ? (x.ar ?? english(source)) : kind === "unit" ? (card?.ar ?? x.ar ?? english(source)) : (x.ar ?? english(source))),
      en: x.src === "ecorche" && x.en ? x.en : kind === "unit" && card ? card.en : english(source),
      layer: x.show ?? LAYER_OF[kind],
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
      neutralHex,
      opacity: 1,
      target: 1,
      styleKey: "",
    });
  }
  if (opts.hd) markRectusSheath(out.filter((m) => m.kind === "unit" && !(m.mesh.material as Material).userData.textured).map((m) => m.mesh));
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
  /** Depth of the selected muscle (1 superficial … 3 deep), when a muscle is selected. */
  selectedDepth?: number;
}

/** Opacity of the muscles lying over a selected deep muscle. */
const DEEP_GHOST = 0.14;
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
  // A deep muscle is selected: the muscles lying over it turn into a faint ghost (and let
  // clicks through), so it can be seen in its place.
  if (m.kind === "unit" && sel?.kind === "unit" && !isSelected && (s.selectedDepth ?? 1) > m.depth) return shouldShow(m, s) ? DEEP_GHOST : 0;
  // The breast lies over the chest muscles: while a muscle is selected it turns translucent
  // (and lets clicks through), so the muscle under it can be seen.
  if (m.kind === "fat" && m.layer === "muscles" && sel?.kind === "unit") return shouldShow(m, s) ? 0.28 : 0;
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
    case "fat":
      // (the breast is part of the female figure: it is shown with the muscles)
      return m.layer === "muscles" ? s.layers.muscles : s.layers.fat;
    case "vessel":
      return s.layers.vessels;
    case "skin":
      return s.layers.skin;
  }
}

/** Target muscles of an exercise, as sets (see the store's `spotlight`). */
export interface SpotlightSets {
  primary: Set<string>;
  secondary: Set<string>;
}

/** Colour of the helper (secondary) muscles of an exercise: the highlight, lightened. */
export function secondaryHighlight(highlight: string): string {
  if (highlight.toLowerCase() === SELECTION_ACCENT.toLowerCase()) return SELECTION_ACCENT_SOFT;
  return `#${new Color(highlight).lerp(new Color("#ffffff"), 0.42).getHexString()}`;
}

/**
 * Look of the selected muscle: one clean colour over the whole muscle. Fibre
 * striping, the pale tendon ends and the baked shading are held back, so the
 * selection reads as a single shape from every side.
 */
export const SELECT_LOOK: MuscleLook = { tendon: 0.3, bump: 0.5, stripe: 0.28, ao: 0.55, sheen: 0.18, clearcoat: 0.25, roughness: 0.5 };
/** Part of its own colour the selected muscle emits, so it stays readable in shadow and from behind the key light. */
const SELECT_GLOW = 0.12;

/**
 * Colour / look of a mesh for the current selection, hover and highlight colour.
 * With a spotlight (an exercise is being looked at) the prime movers take the
 * highlight colour and the helpers a lighter tint of it, instead of the selection.
 */
export function applyStyle(m: RegionMesh, selected: PickedStructure | null, hovered: PickedStructure | null, highlight: string = COLORS.highlight, spot: SpotlightSets | null = null): boolean {
  const same = (p: PickedStructure | null) => !!p && p.kind === m.kind && p.id === m.id && (m.kind === "unit" || p.side === m.side);
  const role = spot && m.kind === "unit" ? (spot.primary.has(m.id) ? 2 : spot.secondary.has(m.id) ? 1 : 0) : -1;
  const isSel = spot ? role === 2 : same(selected);
  const isHover = same(hovered);
  // While a muscle is selected (or an exercise lights its muscles), the other muscles
  // step back into their neutral tones, so the accent is the only strong colour.
  const textured = !!(m.mesh.material as Material).userData.textured;
  const quiet = (m.kind === "unit" || (textured && m.kind === "fat")) && (!!m.neutralHex || textured) && (spot ? true : selected?.kind === "unit");
  const key = `${isSel}|${isHover}|${isSel || role === 1 ? highlight : ""}|${role}|${quiet}`;
  if (key === m.styleKey) return false;
  m.styleKey = key;
  const mat = m.mesh.material as MeshPhysicalMaterial;
  if (mat.userData.textured) {
    // Textured model: the accent and the neutral state are laid over the part's own texture.
    const lit = m.kind === "unit" ? isSel || role === 1 : isSel;
    const tint = lit ? (role === 1 ? secondaryHighlight(highlight) : highlight) : null;
    const others = (m.kind === "unit" || m.kind === "fat") && (spot ? true : selected?.kind === "unit");
    setTexturedLook(mat, { tint, quiet: !lit && others, hover: isHover });
    return true;
  }
  if (m.kind === "unit") {
    const lit = isSel || role === 1;
    const hex = isSel ? highlight : role === 1 ? secondaryHighlight(highlight) : quiet ? m.neutralHex! : m.baseHex;
    (mat.userData.hd ? setMuscleLookHD : setMuscleLook)(mat, hex, lit ? SELECT_LOOK : REALISTIC_LOOK, isHover);
    if (lit) mat.emissive.set(hex).multiplyScalar(SELECT_GLOW + (isHover ? 0.12 : 0));
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
    if (mat.userData.textured && transparent) mat.alphaTest = 0;
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
