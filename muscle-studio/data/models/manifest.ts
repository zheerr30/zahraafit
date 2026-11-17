import { OPEN_ANATOMY_ATTRIBUTION } from "@/lib/attribution";
import type { AnatomyAssetDefinition, Gender, ViewId } from "@/types/anatomy";

/**
 * Anatomical asset manifest.
 *
 * Each body = the original, unmodified Open Anatomy 3D GLB (skin, skeleton,
 * organs, vessels, nerves) + a BodyParts3D muscles GLB built by
 * pipeline/bodyparts3d, whose "muscles" (separated, selectable) and
 * "muscles_context" nodes replace the body's own merged muscle groups. Both
 * files share one coordinate frame. If either file fails to load the editor
 * shows an error; it never substitutes other geometry.
 */
export const ANATOMY_ASSETS: AnatomyAssetDefinition[] = [
  {
    id: "bodyparts3d-male",
    label: "BodyParts3D · نموذج ذكر",
    gender: "male",
    layer: "full-body",
    url: "/models/open-anatomy-3d/anatomy-male.glb",
    musclesUrl: "/models/bodyparts3d/muscles-male.glb",
    views: ["front", "back", "left", "right"],
    priority: 10,
    hasSystems: true,
    attribution: OPEN_ANATOMY_ATTRIBUTION,
  },
  {
    id: "bodyparts3d-female",
    label: "BodyParts3D · نموذج أنثى",
    gender: "female",
    layer: "full-body",
    url: "/models/open-anatomy-3d/anatomy-female.glb",
    musclesUrl: "/models/bodyparts3d/muscles-female.glb",
    views: ["front", "back", "left", "right"],
    priority: 10,
    hasSystems: true,
    attribution: OPEN_ANATOMY_ATTRIBUTION,
  },
];

export function assetsForGender(gender: Gender): AnatomyAssetDefinition[] {
  return ANATOMY_ASSETS.filter((a) => a.gender === gender).sort((a, b) => a.priority - b.priority);
}

/** The asset to display for a gender + view. */
export function resolveAsset(gender: Gender, view: ViewId): AnatomyAssetDefinition | null {
  const candidates = assetsForGender(gender);
  return candidates.find((a) => a.views.includes(view)) ?? candidates[0] ?? null;
}

export function primaryAssetFor(gender: Gender): AnatomyAssetDefinition {
  const asset = assetsForGender(gender)[0];
  if (!asset) throw new Error(`No asset configured for ${gender}`);
  return asset;
}
