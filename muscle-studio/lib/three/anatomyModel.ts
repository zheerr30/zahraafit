import { Box3, BufferAttribute, Color, Group, Mesh, Raycaster, Vector3, type Material, type Object3D } from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import { MUSCLES } from "@/data/muscles/muscles";
import catalog from "@/data/models/open-anatomy-3d/catalog.json";
import { axisTangents, HD_MUSCLE_COLOR as HD_MUSCLE, principalAxis } from "@/lib/three/hdMaterials";
import { fibreTangents, orientFibres } from "@/lib/three/refine";
import { markRectusSheath, renderDepth } from "@/lib/three/abdomen";
import { mapMeshesToMuscles, type MappingReport } from "@/lib/anatomy/resolver";
import type { IllustrationDoc, Layers } from "@/lib/storage/schema";
import { SYSTEMS, type AnatomyAssetDefinition, type BodySide, type SystemId } from "@/types/anatomy";
import type { MaterialLibrary, MaterialVariant, MuscleLookName } from "./materials";
import { muscleTone, tissueOf, TISSUE } from "./tissue";

/** Normalized model height in scene units (meters). */
export const MODEL_HEIGHT = 1.8;

const GENERIC_NAME = /^(mesh|object|primitive|node|geometry|polysurface)?[\s_.-]*\d*$/i;
const SYSTEM_SET = new Set<string>(SYSTEMS);

/** Fallback display colours per system ("anatomical" colour mode and non-muscle systems). */
export const SYSTEM_COLORS: Record<Exclude<SystemId, "skin">, string> = {
  muscles: "#B5463D",
  muscles_context: "#8E4038",
  skeleton: "#E8E1D1",
  fasciae: "#D9D6D0",
  organs: "#C96F5D",
  vessels: "#B8322A",
  nerves: "#E9C04E",
};

const CATALOG_COLOR = new Map((catalog as { key: string; color: string }[]).map((c) => [c.key, c.color]));

const noRaycast: Mesh["raycast"] = () => {};

/** Bones shown by the "head" layer. */
export const HEAD_BONES = new Set(["skull", "mandible", "teeth"]);
/** Skull bones, jaws, teeth and the hyoid of the Z-Anatomy model (shown by the "head" layer). */
const HEAD_BONE_SOURCE = /^(Frontal|Parietal|Temporal|Occipital|Sphenoid|Ethmoid|Sinus_of|Anterior_cells|Middle_cells|Posterior_cells|Mandible|Maxilla|Zygomatic|Nasal_bone|Lacrimal|Palatine|Vomer|Inferior_nasal|Upper_|Lower_|Hyoid|Malleus|Incus|Stapes|Major_alar|Nasal_septal|Lateral_process_of_nasal)/;
function isHeadBone(mesh: Mesh, name: string): boolean {
  const src = mesh.userData.source as string | undefined;
  if (src) return mesh.userData.kind === "bone" && HEAD_BONE_SOURCE.test(src);
  return HEAD_BONES.has(name);
}

export interface PreparedModel {
  /** Normalized root: upright, feet at y=0, centered on X/Z, height = MODEL_HEIGHT. */
  root: Group;
  /** The asset's own scene inside the normalisation (optional system files are added here). */
  content: Object3D;
  meshes: Mesh[];
  meshByUid: Map<string, Mesh>;
  /** Name used for mapping (authored node name, or parent node name for generic mesh names). */
  meshNames: Map<string, string>;
  /** Body system of each mesh (null for assets without system groups). */
  systemOf: Map<string, SystemId | null>;
  systemGroups: Map<SystemId, Object3D[]>;
  hasSystems: boolean;
  /** HD: geometry carries fibre / collagen tangents for the HD materials. */
  hd?: boolean;
}

/**
 * GLTFLoader sanitizes object names for animation binding ("Biceps.L" →
 * "BicepsL") but keeps the authored name in `userData.name`. Prefer that.
 */
function authoredName(obj: Object3D): string {
  const original = obj.userData?.name;
  return typeof original === "string" && original ? original : obj.name;
}

/** Pick the most meaningful name for a mesh: its own, or its parent node's. */
export function meaningfulName(mesh: Object3D): string {
  const own = authoredName(mesh);
  if (own && !GENERIC_NAME.test(own)) return own;
  let p = mesh.parent;
  while (p) {
    const name = authoredName(p);
    if (name && !GENERIC_NAME.test(name)) return name;
    p = p.parent;
  }
  return own || mesh.uuid;
}

function findSystem(mesh: Object3D, groups: Map<SystemId, Object3D[]>): SystemId | null {
  let p: Object3D | null = mesh.parent;
  while (p) {
    for (const [id, list] of groups) if (list.includes(p)) return id;
    p = p.parent;
  }
  return null;
}

function ensureBvh(mesh: Mesh) {
  const g = mesh.geometry as Mesh["geometry"] & { boundsTree?: unknown };
  if (!g.boundsTree) computeBoundsTree.call(g);
}

/**
 * Replace a body's own (merged) "muscles" node with the separated muscles
 * GLB. Both files share the same coordinate frame, so no transform is needed.
 * Returns the removed nodes so the caller can dispose them.
 */
/**
 * The muscles GLB is quantized (KHR_mesh_quantization): each mesh stores
 * integer positions plus a per-node scale/offset. The fibre shader works in
 * millimetre-scale object space, so bake that node transform into float
 * positions — every muscle then shares one metric frame (the GLB's metres).
 */
export function dequantizeMesh(mesh: Mesh): void {
  const g = mesh.geometry;
  for (const name of ["position", "normal"] as const) {
    const attr = g.getAttribute(name);
    if (!attr || attr.array instanceof Float32Array) continue;
    const out = new Float32Array(attr.count * 3);
    for (let i = 0; i < attr.count; i++) {
      out[i * 3] = attr.getX(i);
      out[i * 3 + 1] = attr.getY(i);
      out[i * 3 + 2] = attr.getZ(i);
    }
    g.setAttribute(name, new BufferAttribute(out, 3));
  }
  mesh.updateMatrix();
  g.applyMatrix4(mesh.matrix);
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
  mesh.updateMatrix();
}

export function combineBodyAndMuscles(body: Group, muscles: Group): Object3D[] {
  const provided = new Set(muscles.children.map(authoredName));
  const removed: Object3D[] = [];
  const old = body.children.find((c) => authoredName(c) === "muscles");
  if (old) {
    body.remove(old);
    removed.push(old);
  }
  // The female muscles file also carries the skeleton fitted with the same
  // warp, so bones (skull included) sit exactly under the muscles.
  if (provided.has("skeleton")) {
    const bones = body.children.find((c) => authoredName(c) === "skeleton");
    if (bones) {
      body.remove(bones);
      removed.push(bones);
    }
  }
  for (const child of [...muscles.children]) {
    const name = authoredName(child);
    if (name !== "muscles" && name !== "muscles_context" && name !== "skeleton") continue;
    child.traverse((o) => {
      if ((o as Mesh).isMesh && (o as Mesh).geometry.getAttribute("_fiber")) dequantizeMesh(o as Mesh);
    });
    body.add(child);
  }
  return removed;
}

/**
 * Normalize a loaded scene into a predictable frame and collect its meshes.
 * Original materials are preserved on `mesh.userData.originalMaterial`.
 */
/** Top-level groups of the Z-Anatomy files that belong to an editor system. */
const SYSTEM_ALIASES: Record<string, SystemId> = { tendons: "muscles_context", ligaments: "skeleton" };

function systemOfGroup(name: string): SystemId | null {
  if (SYSTEM_SET.has(name)) return name as SystemId;
  return SYSTEM_ALIASES[name] ?? null;
}

function collectSystemGroups(scene: Object3D, into: Map<SystemId, Object3D[]>): void {
  for (const child of scene.children) {
    const sys = systemOfGroup(authoredName(child));
    if (!sys) continue;
    if (!into.has(sys)) into.set(sys, []);
    into.get(sys)!.push(child);
  }
}

export function prepareModel(scene: Group, asset: AnatomyAssetDefinition, opts: { hd?: boolean } = {}): PreparedModel {
  // Top-level children of the glTF scene are the body systems.
  const systemGroups = new Map<SystemId, Object3D[]>();
  collectSystemGroups(scene, systemGroups);
  const hasSystems = systemGroups.has("muscles");

  const inner = new Group();
  inner.name = "AssetOrientation";
  inner.add(scene);
  if (asset.rotation) inner.rotation.set(...asset.rotation);
  inner.updateMatrixWorld(true);

  const box = new Box3().setFromObject(inner, true);
  const size = box.getSize(new Vector3());
  const height = size.y > 1e-6 ? size.y : 1;
  const scale = MODEL_HEIGHT / height;
  const center = box.getCenter(new Vector3());

  const root = new Group();
  root.name = "NormalizedModel";
  inner.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  inner.scale.setScalar(scale);
  root.add(inner);
  root.updateMatrixWorld(true);

  const model: PreparedModel = { root, content: scene, meshes: [], meshByUid: new Map(), meshNames: new Map(), systemOf: new Map(), systemGroups, hasSystems, hd: !!opts.hd };
  registerMeshes(model, root);
  return model;
}

/**
 * Add an optional system file (nerves, organs, vessels, skin) to a prepared
 * model: its groups join the asset content, so they share the normalisation.
 */
export function attachSystemFile(model: PreparedModel, scene: Object3D): Object3D[] {
  const added: Object3D[] = [];
  const groups = new Map<SystemId, Object3D[]>();
  collectSystemGroups(scene, groups);
  for (const [sys, list] of groups) {
    for (const g of list) {
      model.content.add(g);
      added.push(g);
    }
    model.systemGroups.set(sys, [...(model.systemGroups.get(sys) ?? []), ...list]);
  }
  model.root.updateMatrixWorld(true);
  for (const g of added) registerMeshes(model, g);
  return added;
}

/** HD: consistently oriented fibres + tangents (muscles), collagen axis tangents (tendons, ligaments, fasciae, nerves). */
function prepareHdGeometry(mesh: Mesh): void {
  const g = mesh.geometry;
  if (g.getAttribute("tangent")) return;
  if (g.getAttribute("_fiber")) {
    orientFibres(g);
    fibreTangents(g);
  } else if (/^(tendon|ligament|fascia|nerve)$/.test((mesh.userData.kind as string) ?? "") && g.getAttribute("normal")) {
    axisTangents(g, principalAxis(g));
  }
}

function registerMeshes(model: PreparedModel, from: Object3D): void {
  const { meshes, meshByUid, meshNames, systemOf, systemGroups, hasSystems } = model;
  from.traverse((obj) => {
    if (!(obj instanceof Mesh) || meshByUid.has(obj.uuid)) return;
    if (obj.geometry.getAttribute("_fiber")) dequantizeMesh(obj);
    if (model.hd) prepareHdGeometry(obj);
    const system = hasSystems ? findSystem(obj, systemGroups) : null;
    const isSkin = system === "skin";
    obj.castShadow = !isSkin;
    obj.receiveShadow = !isSkin;
    if (isSkin) obj.renderOrder = 10; // translucent, drawn last
    if (!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
    obj.geometry.computeBoundingBox();
    obj.userData.originalMaterial = obj.material;
    obj.userData.pickable = !isSkin;
    meshes.push(obj);
    meshByUid.set(obj.uuid, obj);
    meshNames.set(obj.uuid, meaningfulName(obj));
    systemOf.set(obj.uuid, system);
  });
  if (model.hd) markRectusSheath(meshes);
}

/**
 * Show/hide body systems. Hidden systems are also excluded from picking, and
 * BVH acceleration structures are built lazily the first time a system is shown.
 */
export function applyLayers(model: PreparedModel, layers: Layers): void {
  if (!model.hasSystems) {
    for (const mesh of model.meshes) {
      ensureBvh(mesh);
      mesh.raycast = acceleratedRaycast;
    }
    return;
  }
  // The source has no head muscles; the skull can complete the head on its own
  // ("head" layer) even when the rest of the skeleton is hidden.
  for (const [system, groups] of model.systemGroups) {
    for (const group of groups) group.visible = layers[system] || (system === "skeleton" && layers.head);
  }
  for (const mesh of model.meshes) {
    const system = model.systemOf.get(mesh.uuid);
    let visible = system ? layers[system] : true;
    if (system === "skeleton") {
      visible = layers.skeleton || (layers.head && isHeadBone(mesh, model.meshNames.get(mesh.uuid) ?? ""));
      mesh.visible = visible;
    }
    const pickable = visible && system !== "skin";
    mesh.userData.pickable = pickable;
    if (pickable) {
      ensureBvh(mesh);
      mesh.raycast = acceleratedRaycast;
    } else {
      mesh.raycast = noRaycast;
    }
  }
}

export function isPickable(mesh: Mesh): boolean {
  return mesh.userData.pickable === true;
}

export function releaseBvh(model: PreparedModel): void {
  for (const mesh of model.meshes) {
    const g = mesh.geometry as Mesh["geometry"] & { boundsTree?: unknown };
    if (g.boundsTree) disposeBoundsTree.call(g);
  }
}

export function mapPreparedModel(
  model: PreparedModel,
  asset: AnatomyAssetDefinition,
  userMap: Record<string, string> | undefined,
): MappingReport {
  // In system-structured assets only meshes of the muscle system can be muscles.
  const candidates = model.hasSystems
    ? model.meshes.filter((m) => model.systemOf.get(m.uuid) === "muscles")
    : model.meshes;
  const descriptors = candidates.map((m) => ({
    uid: m.uuid,
    name: model.meshNames.get(m.uuid) ?? m.name,
  }));
  return mapMeshesToMuscles(descriptors, MUSCLES, {
    assetMap: asset.meshMap,
    userMap,
    ignore: asset.ignoreMeshes,
  });
}

export interface MaterialContext {
  doc: Pick<IllustrationDoc, "selections" | "palette" | "dimUnselected">;
  hoveredMuscleId: string | null;
}

/** Resolve the display color of a muscle given the document (null = not highlighted). */
export function highlightColor(
  muscleId: string,
  doc: Pick<IllustrationDoc, "selections" | "palette">,
): string | null {
  const sel = doc.selections[muscleId];
  if (!sel) return null;
  return sel.color ?? doc.palette[sel.tone];
}

function structureColor(model: PreparedModel, mesh: Mesh, system: Exclude<SystemId, "skin">): string {
  const key = model.meshNames.get(mesh.uuid) ?? "";
  return CATALOG_COLOR.get(key) ?? SYSTEM_COLORS[system];
}

/**
 * Assign materials to every mesh. Every muscle keeps its natural tissue
 * colour (écorché look); only selected muscles take the target colours.
 * Other systems use their anatomical colours and the skin a translucent shader.
 */
/**
 * Natural muscle albedo, tuned so the lit render matches the tissue colour
 * sampled from the reference écorché images (#B0565A mid-tone); with a small
 * per-muscle variation.
 */
export const REALISTIC_MUSCLE = TISSUE.muscle;
/** Deeper, non-separated muscles: slightly darker tissue. */
export const REALISTIC_CONTEXT = "#AE5257";
/** Unselected muscles when "dim unselected" is on: the same tissue, muted. */
export const DIMMED_MUSCLE = TISSUE.dimmed;
const toneCache = new Map<string, string>();
function realisticTone(muscleId: string): string {
  let hex = toneCache.get(muscleId);
  if (!hex) {
    let h = 0;
    for (const ch of muscleId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const c = new Color(REALISTIC_MUSCLE);
    c.offsetHSL(((h % 7) - 3) * 0.004, ((h >> 3) % 5 - 2) * 0.02, ((h >> 6) % 7 - 3) * 0.01);
    hex = `#${c.getHexString()}`;
    toneCache.set(muscleId, hex);
  }
  return hex;
}

/** Shaded muscle material when the mesh carries baked appearance data, plain otherwise. */
function muscleMat(library: MaterialLibrary, mesh: Mesh, hex: string, look: MuscleLookName, variant: MaterialVariant): Material {
  if (!mesh.geometry.getAttribute("_anat")) return library.get(hex, variant);
  // HD: deeper layers yield in the depth test where layers nearly coincide (render order only).
  const layer = library.hd ? renderDepth((mesh.userData.za_name ?? mesh.userData.source ?? "") as string, mesh.userData.depth as number | undefined) - 1 : 0;
  return library.muscle(hex, look, variant, layer);
}

export function applyMaterials(
  model: PreparedModel,
  report: MappingReport,
  ctx: MaterialContext,
  library: MaterialLibrary,
): void {
  const { doc, hoveredMuscleId } = ctx;
  const anySelected = Object.keys(doc.selections).length > 0;
  const dim = doc.dimUnselected && anySelected;
  for (const mesh of model.meshes) {
    const system = model.systemOf.get(mesh.uuid) ?? null;
    let next: Material | Material[];

    const zKind = mesh.userData.kind as string | undefined;
    const tissue = zKind && zKind !== "unit" ? tissueOf(zKind, mesh.userData.source as string | undefined, mesh.userData.role as string | undefined) : null;
    // Natural tone of a Z-Anatomy muscle: same per-muscle variation as the atlas.
    const zTone = typeof mesh.userData.id === "string" ? muscleTone(mesh.userData.id, library.hd ? HD_MUSCLE : undefined) : null;
    if (tissue) {
      // Z-Anatomy tendons, ligaments, fasciae, bones, nerves, vessels, organs, skin: the shared tissue standard.
      next = library.tissue(tissue, zKind === "bone" && !!mesh.geometry.getAttribute("color"));
    } else if (system === "skin") {
      next = library.skin();
    } else if (system === "muscles_context") {
      // Muscles that are not editor units: shown for anatomical completeness, never painted.
      next = muscleMat(library, mesh, dim ? DIMMED_MUSCLE : (zTone ?? REALISTIC_CONTEXT), "realistic", "normal");
    } else if (system && system !== "muscles") {
      next = library.get(structureColor(model, mesh, system), "normal");
    } else {
      const mapping = report.byMesh.get(mesh.uuid);
      const hovered = mapping !== undefined && mapping.muscleId === hoveredMuscleId;
      const variant = hovered ? "hover" : "normal";
      const hl = mapping ? highlightColor(mapping.muscleId, doc) : null;
      if (hl) {
        next = muscleMat(library, mesh, hl, "highlight", variant);
      } else if (!mapping) {
        // Muscle-system meshes that are not mapped, or meshes of unstructured assets.
        next = muscleMat(library, mesh, zTone ?? REALISTIC_CONTEXT, "realistic", "normal");
      } else if (dim) {
        next = muscleMat(library, mesh, DIMMED_MUSCLE, "realistic", variant);
      } else {
        next = muscleMat(library, mesh, zTone ?? realisticTone(mapping.muscleId), "realistic", variant);
      }
    }
    if (mesh.material !== next) mesh.material = next;
  }
}

export interface LabelAnchor {
  muscleId: string;
  side: BodySide;
  mesh: Mesh;
  /** Bounding-box center in mesh local space. */
  localCenter: Vector3;
}

/** One anchor per muscle+side; L/R meshes of the same muscle get separate anchors. */
export function buildAnchors(model: PreparedModel, report: MappingReport): Map<string, LabelAnchor[]> {
  const groups = new Map<string, { muscleId: string; side: BodySide; meshes: Mesh[] }>();
  for (const m of report.mapped) {
    const mesh = model.meshByUid.get(m.uid);
    if (!mesh) continue;
    const key = `${m.muscleId}|${m.side}`;
    const g = groups.get(key);
    if (g) g.meshes.push(mesh);
    else groups.set(key, { muscleId: m.muscleId, side: m.side, meshes: [mesh] });
  }
  const out = new Map<string, LabelAnchor[]>();
  for (const g of groups.values()) {
    let best = g.meshes[0];
    let bestVol = -1;
    for (const mesh of g.meshes) {
      const s = mesh.geometry.boundingBox?.getSize(new Vector3()) ?? new Vector3();
      const vol = s.x * s.y * s.z;
      if (vol > bestVol) {
        bestVol = vol;
        best = mesh;
      }
    }
    const anchor: LabelAnchor = {
      muscleId: g.muscleId,
      side: g.side,
      mesh: best,
      localCenter: best.geometry.boundingBox?.getCenter(new Vector3()) ?? new Vector3(),
    };
    const list = out.get(g.muscleId);
    if (list) list.push(anchor);
    else out.set(g.muscleId, [anchor]);
  }
  return out;
}

export function anchorWorldPosition(anchor: LabelAnchor, target = new Vector3()): Vector3 {
  return target.copy(anchor.localCenter).applyMatrix4(anchor.mesh.matrixWorld);
}

/** Choose the anchor closest to the camera (the visible side of a bilateral muscle). */
export function nearestAnchor(anchors: LabelAnchor[], cameraPos: Vector3): LabelAnchor {
  let best = anchors[0];
  let bestD = Infinity;
  const tmp = new Vector3();
  for (const a of anchors) {
    const d = anchorWorldPosition(a, tmp).distanceToSquared(cameraPos);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** World-space bounds of the meshes belonging to the given muscles. */
export function boundsForMuscles(
  model: PreparedModel,
  report: MappingReport,
  muscleIds: string[],
): Box3 | null {
  const box = new Box3();
  let any = false;
  for (const id of muscleIds) {
    for (const uid of report.byMuscle.get(id) ?? []) {
      const mesh = model.meshByUid.get(uid);
      if (!mesh) continue;
      box.expandByObject(mesh, true);
      any = true;
    }
  }
  return any ? box : null;
}

/** Bounds of visible geometry only (hidden systems do not affect framing). */
export function visibleBounds(model: PreparedModel): Box3 {
  const box = new Box3();
  for (const mesh of model.meshes) {
    const system = model.systemOf.get(mesh.uuid);
    if (system && model.systemGroups.get(system)?.every((g) => !g.visible)) continue;
    if (!mesh.visible) continue;
    box.expandByObject(mesh, true);
  }
  return box.isEmpty() ? new Box3().setFromObject(model.root, true) : box;
}

/** Nearest pickable hit of a ray, honouring layer visibility (used for export occlusion). */
export function raycastPickable(model: PreparedModel, raycaster: Raycaster) {
  const targets = model.meshes.filter(isPickable);
  return raycaster.intersectObjects(targets, false)[0];
}
