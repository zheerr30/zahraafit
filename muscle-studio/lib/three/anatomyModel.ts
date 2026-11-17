import { Box3, Group, Mesh, Vector3, type Material, type Object3D } from "three";
import { MUSCLES } from "@/data/muscles/muscles";
import { mapMeshesToMuscles, type MappingReport } from "@/lib/anatomy/resolver";
import type { IllustrationDoc } from "@/lib/storage/schema";
import type { AnatomyAssetDefinition, BodySide } from "@/types/anatomy";
import type { MaterialLibrary } from "./materials";

/** Normalized model height in scene units (meters). */
export const MODEL_HEIGHT = 1.8;

const GENERIC_NAME = /^(mesh|object|primitive|node|geometry|polysurface)?[\s_.-]*\d*$/i;

export interface PreparedModel {
  /** Normalized root: upright, feet at y=0, centered on X/Z, height = MODEL_HEIGHT. */
  root: Group;
  meshes: Mesh[];
  meshByUid: Map<string, Mesh>;
  /** Name used for mapping (mesh name, or parent node name for generic mesh names). */
  meshNames: Map<string, string>;
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

/**
 * Normalize a loaded scene into a predictable frame and collect its meshes.
 * Original materials are preserved on `mesh.userData.originalMaterial`.
 */
export function prepareModel(scene: Group, asset: AnatomyAssetDefinition): PreparedModel {
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
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    if (!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
    obj.geometry.computeBoundingBox();
    obj.userData.originalMaterial = obj.material;
    meshes.push(obj);
    meshByUid.set(obj.uuid, obj);
    meshNames.set(obj.uuid, meaningfulName(obj));
  });

  return { root, meshes, meshByUid, meshNames };
}

export function mapPreparedModel(
  model: PreparedModel,
  asset: AnatomyAssetDefinition,
  userMap: Record<string, string> | undefined,
): MappingReport {
  const descriptors = model.meshes.map((m) => ({
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

/**
 * Assign materials to every mesh based on selection state. Highlighted meshes
 * use cached studio materials; unselected meshes either use the studio base
 * color or their preserved original material.
 */
export function applyMaterials(
  model: PreparedModel,
  report: MappingReport,
  ctx: MaterialContext,
  library: MaterialLibrary,
): void {
  const { doc, hoveredMuscleId } = ctx;
  const anySelected = Object.keys(doc.selections).length > 0;
  for (const mesh of model.meshes) {
    const mapping = report.byMesh.get(mesh.uuid);
    const original = mesh.userData.originalMaterial as Material | Material[];
    const hovered = mapping !== undefined && mapping.muscleId === hoveredMuscleId;
    const variant = hovered ? "hover" : "normal";

    let next: Material | Material[];
    const hl = mapping ? highlightColor(mapping.muscleId, doc) : null;
    if (hl) {
      next = library.get(hl, variant);
    } else if (doc.materialMode === "original") {
      next = hovered ? library.get(doc.palette.base, "hover") : original;
    } else if (!mapping) {
      // Non-muscle structures (tendons, bones, unmapped meshes).
      next = library.get(doc.palette.shadow, "normal");
    } else {
      const base = doc.dimUnselected && anySelected ? doc.palette.shadow : doc.palette.base;
      next = library.get(base, variant);
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
    // Use the largest mesh of the group as the anchor.
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
