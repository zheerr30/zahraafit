import type { BodySide, MuscleDefinition } from "@/types/anatomy";
import { normalizeKey, normalizeMeshName } from "./normalize";

export interface MeshDescriptor {
  /** Stable per-load identifier (e.g. Three.js object uuid). */
  uid: string;
  /** Raw mesh (or parent node) name from the asset. */
  name: string;
}

export interface MeshMapping {
  uid: string;
  name: string;
  muscleId: string;
  side: BodySide;
  /** How the mapping was found — useful for the asset inspector. */
  via: "asset-map" | "user-map" | "mesh-name" | "alias";
}

export interface MappingReport {
  mapped: MeshMapping[];
  unmapped: MeshDescriptor[];
  ignored: MeshDescriptor[];
  /** muscleId → mesh uids */
  byMuscle: Map<string, string[]>;
  /** uid → mapping */
  byMesh: Map<string, MeshMapping>;
  /** Muscle ids from the database with no mesh in the asset. */
  missingMuscles: string[];
  /** True when the asset cannot support per-muscle highlighting. */
  unsuitable: boolean;
  unsuitableReason: string | null;
}

export interface MappingOptions {
  /** Exact raw mesh name → muscle id (from the asset manifest). */
  assetMap?: Record<string, string>;
  /** Exact raw mesh name → muscle id (assigned by the user in the inspector). */
  userMap?: Record<string, string>;
  /** Normalized keys of meshes that are known non-muscle structures. */
  ignore?: string[];
}

interface KeyIndex {
  meshKeys: Map<string, string>;
  aliasKeys: Map<string, string>;
}

const indexCache = new WeakMap<readonly MuscleDefinition[], KeyIndex>();

export function buildKeyIndex(muscles: readonly MuscleDefinition[]): KeyIndex {
  const cached = indexCache.get(muscles);
  if (cached) return cached;
  const meshKeys = new Map<string, string>();
  const aliasKeys = new Map<string, string>();
  const ambiguous = new Set<string>();

  const add = (map: Map<string, string>, raw: string, id: string) => {
    const key = normalizeKey(raw);
    if (!key) return;
    const existing = map.get(key);
    if (existing && existing !== id) {
      // An alias that points at two muscles (e.g. "biceps") must never auto-map.
      ambiguous.add(key);
      return;
    }
    map.set(key, id);
  };

  for (const m of muscles) {
    add(meshKeys, m.id, m.id);
    for (const n of m.meshNames) add(meshKeys, n, m.id);
  }
  for (const m of muscles) {
    add(aliasKeys, m.displayName.en, m.id);
    for (const a of m.aliases) add(aliasKeys, a, m.id);
  }
  for (const key of ambiguous) {
    aliasKeys.delete(key);
    meshKeys.delete(key);
  }
  const index = { meshKeys, aliasKeys };
  indexCache.set(muscles, index);
  return index;
}

/**
 * Map asset meshes to muscle ids. Resolution order (first match wins):
 *   1. user-assigned overrides (exact raw name)
 *   2. asset manifest overrides (exact raw name)
 *   3. canonical mesh names / ids (normalized, side-stripped)
 *   4. unambiguous aliases (normalized)
 * Anything else is reported as unmapped — never guessed.
 */
export function mapMeshesToMuscles(
  meshes: readonly MeshDescriptor[],
  muscles: readonly MuscleDefinition[],
  options: MappingOptions = {},
): MappingReport {
  const { meshKeys, aliasKeys } = buildKeyIndex(muscles);
  const validIds = new Set(muscles.map((m) => m.id));
  const ignore = new Set((options.ignore ?? []).map(normalizeKey));

  const mapped: MeshMapping[] = [];
  const unmapped: MeshDescriptor[] = [];
  const ignored: MeshDescriptor[] = [];
  const byMuscle = new Map<string, string[]>();
  const byMesh = new Map<string, MeshMapping>();

  for (const mesh of meshes) {
    const { key, side } = normalizeMeshName(mesh.name);
    let muscleId: string | undefined;
    let via: MeshMapping["via"] | undefined;

    const user = options.userMap?.[mesh.name];
    const asset = options.assetMap?.[mesh.name];
    if (user && validIds.has(user)) {
      muscleId = user;
      via = "user-map";
    } else if (asset && validIds.has(asset)) {
      muscleId = asset;
      via = "asset-map";
    } else if (ignore.has(key)) {
      ignored.push(mesh);
      continue;
    } else if (meshKeys.has(key)) {
      muscleId = meshKeys.get(key);
      via = "mesh-name";
    } else if (aliasKeys.has(key)) {
      muscleId = aliasKeys.get(key);
      via = "alias";
    }

    if (!muscleId || !via) {
      unmapped.push(mesh);
      continue;
    }
    const mapping: MeshMapping = { uid: mesh.uid, name: mesh.name, muscleId, side, via };
    mapped.push(mapping);
    byMesh.set(mesh.uid, mapping);
    const list = byMuscle.get(muscleId);
    if (list) list.push(mesh.uid);
    else byMuscle.set(muscleId, [mesh.uid]);
  }

  const missingMuscles = muscles.filter((m) => !byMuscle.has(m.id)).map((m) => m.id);

  let unsuitableReason: string | null = null;
  if (meshes.length <= 1) {
    unsuitableReason =
      "النموذج شبكة واحدة مدموجة؛ لا يمكن تحديد العضلات أو تلوينها منفردة.";
  } else if (mapped.length === 0) {
    unsuitableReason =
      "لم تُطابَق أي شبكة مع عضلة. يمكن إعادة تسمية الشبكات وفق الأسماء القياسية أو ربطها من فاحص ربط الشبكات.";
  }

  return {
    mapped,
    unmapped,
    ignored,
    byMuscle,
    byMesh,
    missingMuscles,
    unsuitable: unsuitableReason !== null,
    unsuitableReason,
  };
}
