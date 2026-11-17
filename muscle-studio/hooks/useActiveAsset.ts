"use client";

import { useMemo } from "react";
import { resolveAsset } from "@/data/models/manifest";
import { useEditor } from "@/stores/editorStore";
import type { AnatomyAssetDefinition } from "@/types/anatomy";

export type ActiveAsset = { status: "ok"; asset: AnatomyAssetDefinition } | { status: "none" };

/**
 * Decide which GLB the viewport should display for the current editor state.
 * There is no fallback geometry: if the file fails to load, the viewport shows
 * an error (see LoadErrorOverlay).
 */
export function useActiveAsset(): ActiveAsset {
  const gender = useEditor((s) => s.doc.gender);
  const view = useEditor((s) => s.assetView);
  const mode = useEditor((s) => s.assetMode);
  const localFile = useEditor((s) => s.localFile);

  // Stable definition for a user-supplied file so view changes never reload it.
  const localAsset = useMemo<AnatomyAssetDefinition | null>(
    () =>
      localFile
        ? {
            id: `local:${localFile.name}`,
            label: localFile.name,
            gender: "neutral",
            layer: "full-body",
            url: localFile.url,
            views: ["front", "back", "left", "right"],
            priority: 0,
          }
        : null,
    [localFile],
  );

  return useMemo<ActiveAsset>(() => {
    if (mode === "local-file" && localAsset) return { status: "ok", asset: localAsset };
    const asset = resolveAsset(gender, view);
    return asset ? { status: "ok", asset } : { status: "none" };
  }, [mode, localAsset, gender, view]);
}
