"use client";

import { useEffect, useMemo } from "react";
import { assetsForGender, resolveAsset, TEST_RIG_ASSET } from "@/data/models/manifest";
import { useAssetStore } from "@/stores/assetStore";
import { useEditor } from "@/stores/editorStore";
import type { AnatomyAssetDefinition, Gender } from "@/types/anatomy";

export type ActiveAsset =
  | { status: "checking" }
  | { status: "missing"; gender: Gender; expected: AnatomyAssetDefinition[]; testRig: boolean }
  | { status: "ok"; asset: AnatomyAssetDefinition };

/** Decide which GLB the viewport should display for the current editor state. */
export function useActiveAsset(): ActiveAsset {
  const gender = useEditor((s) => s.doc.gender);
  // Last named view, so free orbiting does not swap front/back-specific assets.
  const effectiveView = useEditor((s) => s.assetView);
  const mode = useEditor((s) => s.assetMode);
  const localFile = useEditor((s) => s.localFile);
  const availability = useAssetStore((s) => s.availability);
  const checked = useAssetStore((s) => s.availabilityChecked);
  const check = useAssetStore((s) => s.checkAvailability);

  useEffect(() => {
    void check();
  }, [check]);

  // Stable definition for a user-supplied file so view changes never reload it.
  const localAsset = useMemo<AnatomyAssetDefinition | null>(
    () =>
      localFile
        ? {
            id: `local:${localFile.name}`,
            label: localFile.name,
            gender: "neutral",
            layer: "superficial",
            url: localFile.url,
            views: ["front", "back", "left", "right"],
            priority: 0,
          }
        : null,
    [localFile],
  );

  return useMemo<ActiveAsset>(() => {
    if (mode === "local-file" && localAsset) return { status: "ok", asset: localAsset };
    if (!checked) return { status: "checking" };
    if (mode === "test-rig") {
      return availability[TEST_RIG_ASSET.id]
        ? { status: "ok", asset: TEST_RIG_ASSET }
        : { status: "missing", gender, expected: [TEST_RIG_ASSET], testRig: true };
    }
    const available = new Set(Object.keys(availability).filter((id) => availability[id]));
    const asset = resolveAsset(gender, effectiveView, available);
    if (asset) return { status: "ok", asset };
    return { status: "missing", gender, expected: assetsForGender(gender), testRig: false };
  }, [mode, localAsset, checked, availability, gender, effectiveView]);
}
