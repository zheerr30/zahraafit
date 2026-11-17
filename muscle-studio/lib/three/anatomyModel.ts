import { Box3, Color, Group, Mesh, Raycaster, Vector3, type Material, type Object3D } from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import { MUSCLES } from "@/data/muscles/muscles";
import catalog from "@/data/models/open-anatomy-3d/catalog.json";
import { mapMeshesToMuscles, type MappingReport } from "@/lib/anatomy/resolver";
import type { IllustrationDoc, Layers } from "@/lib/storage/schema";
import { SYSTEMS, type AnatomyAssetDefinition, type BodySide, type SystemId } from "@/types/anatomy";
import type { MaterialLibrary, MaterialVariant, MuscleLookName } from "./materials";

/** Normalized model height in scene units (meters). */
export const MODEL_HEIGHT = 1.8;

const GENERIC_NAME = /^(mesh|object|primitive|node|geometry|polysurface)?[\s_.-]*\d*$/i;
const SYSTEM_SET = new Set<string>(SYSTEMS);

/** Fallback display colours per system ("anatomical" colour mode and non-muscle systems). */
export const SYSTEM_COLORS: Record<Exclude<SystemId, "skin">, string> = {
  muscles: "#B5463D",
  muscles_context: "#8E4038",
  skeleton: "#E8E1D1",
  organs: "#C96F5D",
  vessels: "#B8322A",
  nerves: "#E9C04E",
};

const CATALOG_COLOR = new Map((catalog as { key: string; color: string }[]).map((c) => [c.key, c.color]));

const noRaycast: Mesh["raycast"] = () => {};

/** Bones shown by the "head" layer. */
export const HEAD_BONES = new Set(["skull", "mandible", "teeth"]);

export interface PreparedModel {
  /** Normalized root: upright, feet at y=0, centered on X/Z, height = MODEL_HEIGHT. */
  root: Group;
  meshes: Mesh[];
  meshByUid: Map<string, Mesh>;
  /** Name used for mapping (authored node name, or parent node name for generic mesh names). */
  meshNames: Map<string, string>;
  /** Body system of each mesh (null for assets without system groups). */
  systemOf: Map<string, SystemId | null>;
  systemGroups: Map<SystemId, Object3D>;
  hasSystems: boolean;
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

function findSystem(mesh: Object3D, groups: Map<SystemId, Object3D>): SystemId | null {
  let p: Object3D | null = mesh.parent;
  while (p) {
    for (const [id, g] of groups) if (g === p) return id;
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
 * Returns the removed node so the caller can dispose it.
 */
export function combineBodyAndMuscles(body: Group, muscles: Group): Object3D | null {
  const old = body.children.find((c) => authoredName(c) === "muscles") ?? null;
  if (old) body.remove(old);
  for (const child of [...muscles.children]) {
    const name = authoredName(child);
    if (name === "muscles" || name === "muscles_context") body.add(child);
  }
  return old;
}

/**
 * Normalize a loaded scene into a predictable frame and collect its meshes.
 * Original materials are preserved on `mesh.userData.originalMaterial`.
 */
export function prepareModel(scene: Group, asset: AnatomyAssetDefinition): PreparedModel {
  // Open Anatomy 3D: top-level children of the glTF scene are the body systems.
  const systemGroups = new Map<SystemId, Object3D>();
  for (const child of scene.children) {
    const name = authoredName(child);
    if (SYSTEM_SET.has(name)) systemGroups.set(name as SystemId, child);
  }
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

  const meshes: Mesh[] = [];
  const meshByUid = new Map<string, Mesh>();
  const meshNames = new Map<string, string>();
  const systemOf = new Map<string, SystemId | null>();
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
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

  return { root, meshes, meshByUid, meshNames, systemOf, systemGroups, hasSystems };
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
  for (const [system, group] of model.systemGroups) {
    group.visible = layers[system] || (system === "skeleton" && layers.head);
  }
  for (const mesh of model.meshes) {
    const system = model.systemOf.get(mesh.uuid);
    let visible = system ? layers[system] : true;
    if (system === "skeleton") {
      visible = layers.skeleton || (layers.head && HEAD_BONES.has(model.meshNames.get(mesh.uuid) ?? ""));
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
  doc: Pick<IllustrationDoc, "selections" | "palette" | "materialMode" | "dimUnselected">;
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
 * Assign materials to every mesh. Highlighted muscles use cached studio
 * materials; unselected muscles use the base (or anatomical) colour; other
 * systems use their anatomical colours and the skin a translucent shader.
 */
/** Realistic muscle colour, with a small deterministic per-muscle variation. */
export const REALISTIC_MUSCLE = "#A33A30";
export const REALISTIC_CONTEXT = "#86342C";
const toneCache = new Map<string, string>();
function realisticTone(muscleId: string): string {
  let hex = toneCache.get(muscleId);
  if (!hex) {
    let h = 0;
    for (const ch of muscleId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const c = new Color(REALISTIC_MUSCLE);
    c.offsetHSL(((h % 7) - 3) * 0.004, ((h >> 3) % 5 - 2) * 0.02, ((h >> 6) % 7 - 3) * 0.012);
    hex = `#${c.getHexString()}`;
    toneCache.set(muscleId, hex);
  }
  return hex;
}

/** Shaded muscle material when the mesh carries baked appearance data, plain otherwise. */
function muscleMat(library: MaterialLibrary, mesh: Mesh, hex: string, look: MuscleLookName, variant: MaterialVariant): Material {
  return mesh.geometry.getAttribute("_anat") ? library.muscle(hex, look, variant) : library.get(hex, variant);
}

export function applyMaterials(
  model: PreparedModel,
  report: MappingReport,
  ctx: MaterialContext,
  library: MaterialLibrary,
): void {
  const { doc, hoveredMuscleId } = ctx;
  const anySelected = Object.keys(doc.selections).length > 0;
  for (const mesh of model.meshes) {
    const system = model.systemOf.get(mesh.uuid) ?? null;
    let next: Material | Material[];

    if (system === "skin") {
      next = library.skin();
    } else if (system === "muscles_context") {
      // Non-separated muscles: shown for anatomical completeness, never painted.
      next =
        doc.materialMode === "anatomical"
          ? muscleMat(library, mesh, REALISTIC_CONTEXT, "realistic", "normal")
          : muscleMat(library, mesh, doc.palette.shadow, "studio", "normal");
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
        next = muscleMat(library, mesh, doc.palette.shadow, "studio", "normal");
      } else if (doc.dimUnselected && anySelected) {
        next = muscleMat(library, mesh, doc.palette.shadow, "studio", variant);
      } else if (doc.materialMode === "anatomical") {
        next = muscleMat(library, mesh, realisticTone(mapping.muscleId), "realistic", variant);
      } else {
        next = muscleMat(library, mesh, doc.palette.base, "studio", variant);
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
    if (system && model.systemGroups.get(system)?.visible === false) continue;
    box.expandByObject(mesh, true);
  }
  return box.isEmpty() ? new Box3().setFromObject(model.root, true) : box;
}

/** Nearest pickable hit of a ray, honouring layer visibility (used for export occlusion). */
export function raycastPickable(model: PreparedModel, raycaster: Raycaster) {
  const targets = model.meshes.filter(isPickable);
  return raycaster.intersectObjects(targets, false)[0];
}
