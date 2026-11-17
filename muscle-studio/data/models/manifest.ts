import { OPEN_ANATOMY_ATTRIBUTION } from "@/lib/attribution";
import type { AnatomyAssetDefinition, Gender, ViewId } from "@/types/anatomy";

/**
 * Anatomical asset manifest.
 *
 * The bundled models are the original, unmodified Open Anatomy 3D GLB files
 * (CC BY 4.0, see public/models/open-anatomy-3d/). Each body has its systems
 * (skin, skeleton, muscles, organs, vessels, nerves) as top-level nodes and one
 * named mesh per structure. If a file fails to load the editor shows an error;
 * it never substitutes other geometry.
 */
export const ANATOMY_ASSETS: AnatomyAssetDefinition[] = [
  {
    id: "open-anatomy-3d-male",
    label: "Open Anatomy 3D · نموذج ذكر",
    gender: "male",
    layer: "full-body",
    url: "/models/open-anatomy-3d/anatomy-male.glb",
    views: ["front", "back", "left", "right"],
    priority: 10,
    hasSystems: true,
    attribution: OPEN_ANATOMY_ATTRIBUTION,
  },
  {
    id: "open-anatomy-3d-female",
    label: "Open Anatomy 3D · نموذج أنثى",
    gender: "female",
    layer: "full-body",
    url: "/models/open-anatomy-3d/anatomy-female.glb",
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
