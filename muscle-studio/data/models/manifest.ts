import { ZANATOMY_ATTRIBUTION } from "@/lib/attribution";
import type { AnatomyAssetDefinition, Gender, ViewId } from "@/types/anatomy";

/**
 * Anatomical asset manifest — one model, one visual standard for the whole app.
 *
 * Both bodies are the original Z-Anatomy Blender model exported without
 * changing the geometry (pipeline/blender/export_body.py + postprocess-body.mjs):
 * core.glb holds muscles, tendons, ligaments, fasciae and bones; nerves,
 * organs, vessels and skin are separate files loaded when their layer is
 * switched on. The female body is the same anatomy warped to female skeletal
 * proportions (approximation; no open female musculature exists). If a file
 * fails to load the editor shows an error; it never substitutes other geometry.
 */
const zaParts = (sex: Gender) => ({
  nerves: `/models/zanatomy/${sex}/nerves.glb`,
  organs: `/models/zanatomy/${sex}/organs.glb`,
  vessels: `/models/zanatomy/${sex}/vessels.glb`,
  skin: `/models/zanatomy/${sex}/skin.glb`,
});
export const ANATOMY_ASSETS: AnatomyAssetDefinition[] = (["male", "female"] as Gender[]).map((g) => ({
  id: `zanatomy-${g}`,
  label: g === "male" ? "Z-Anatomy · نموذج ذكر" : "Z-Anatomy · نموذج أنثى (تقريب)",
  gender: g,
  layer: "full-body",
  url: `/models/zanatomy/${g}/core.glb`,
  layerUrls: zaParts(g),
  views: ["front", "back", "left", "right"],
  priority: 10,
  hasSystems: true,
  attribution: ZANATOMY_ATTRIBUTION,
}));

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
