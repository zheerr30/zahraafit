"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group, Material } from "three";
import { getMuscle } from "@/data/muscles/muscles";
import {
  anchorWorldPosition,
  applyLayers,
  applyMaterials,
  buildAnchors,
  attachSystemFile,
  highlightColor,
  mapPreparedModel,
  nearestAnchor,
  prepareModel,
  releaseBvh,
  type LabelAnchor,
  type PreparedModel,
} from "@/lib/three/anatomyModel";
import { disposeObject3D } from "@/lib/three/dispose";
import { loadGltf } from "@/lib/three/loadGltf";
import { MaterialLibrary } from "@/lib/three/materials";
import { setCanvasCursor } from "@/lib/three/rendererSetup";
import { viewportBridge } from "@/lib/three/viewportBridge";
import { useAssetStore } from "@/stores/assetStore";
import { editorStore, useEditor } from "@/stores/editorStore";
import type { AnatomyAssetDefinition } from "@/types/anatomy";
import type { IllustrationDoc } from "@/lib/storage/schema";

/** Pixels the pointer may travel between down/up and still count as a click (not an orbit drag). */
const CLICK_TOLERANCE = 6;

function restoreOriginalMaterials(model: PreparedModel) {
  for (const mesh of model.meshes) {
    const original = mesh.userData.originalMaterial as Material | Material[] | undefined;
    if (original) mesh.material = original;
  }
}

export function AnatomyModel({ asset }: { asset: AnatomyAssetDefinition }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const [model, setModel] = useState<PreparedModel | null>(null);
  const userMap = useAssetStore((s) => s.userMeshMaps[asset.id]);
  const setLoadState = useAssetStore((s) => s.setLoadState);
  const setSummary = useAssetStore((s) => s.setSummary);
  const reloadToken = useAssetStore((s) => s.reloadToken);
  const modelScale = useEditor((s) => s.doc.modelScale);
  const modelOffsetY = useEditor((s) => s.doc.modelOffsetY);
  const showLabels = useEditor((s) => s.doc.showLabels);

  // ── Load + dispose ────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    let prepared: PreparedModel | null = null;
    setLoadState({ loadStatus: "loading", progress: 0, error: null });

    // Core file (muscles, tendons, ligaments, fasciae, bones); other systems load with their layer.
    loadGltf(asset.url, { renderer: gl, signal: controller.signal, onProgress: (p) => setLoadState({ progress: p }) })
      .then((body) => {
        prepared = prepareModel(body.scene, asset, { hd: true });
        // Visibility + picking structures before the first frame (muscles only by default).
        applyLayers(prepared, editorStore.getState().doc.layers);
        setModel(prepared);
        setLoadState({ loadStatus: "ready", progress: 1 });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[muscle-studio] model load failed", err);
        setLoadState({
          loadStatus: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      controller.abort();
      setModel(null);
      viewportBridge.loaded = null;
      useAssetStore.getState().setSummary(null);
      useAssetStore.getState().setLoadState({ loadStatus: "idle", progress: 0, error: null });
      if (prepared) {
        restoreOriginalMaterials(prepared);
        releaseBvh(prepared);
        disposeObject3D(prepared.root);
      }
    };
  }, [asset, gl, setLoadState, reloadToken]);

  // ── Mesh → muscle mapping ─────────────────────────────────────────
  const report = useMemo(
    () => (model ? mapPreparedModel(model, asset, userMap) : null),
    [model, asset, userMap],
  );
  const anchors = useMemo(
    () => (model && report ? buildAnchors(model, report) : null),
    [model, report],
  );

  useEffect(() => {
    if (!model || !report || !anchors) {
      setSummary(null);
      return;
    }
    viewportBridge.loaded = { asset, model, report, anchors };
    setSummary({
      assetId: asset.id,
      label: asset.label,
      attribution: asset.attribution ?? null,
      meshCount: model.meshes.length,
      mappedMuscleIds: [...report.byMuscle.keys()],
      unmappedMeshNames: report.unmapped.map((m) => m.name),
      missingMuscleIds: report.missingMuscles,
      unsuitableReason: report.unsuitableReason,
    });
    invalidate();
  }, [model, report, anchors, asset, setSummary, invalidate]);

  // ── Body-system layers (optional system files are loaded on first use) ──
  const [extraVersion, setExtraVersion] = useState(0);
  useEffect(() => {
    if (!model) return;
    const loaded = new Set<string>();
    const ensureFiles = (layers: IllustrationDoc["layers"]) => {
      for (const [sys, url] of Object.entries(asset.layerUrls ?? {})) {
        if (!url || loaded.has(sys) || !layers[sys as keyof typeof layers]) continue;
        loaded.add(sys);
        loadGltf(url, { renderer: gl })
          .then((gltf) => {
            attachSystemFile(model, gltf.scene);
            applyLayers(model, editorStore.getState().doc.layers);
            setExtraVersion((v) => v + 1);
            invalidate();
          })
          .catch((err: unknown) => {
            loaded.delete(sys);
            console.error("[muscle-studio] optional layer failed", sys, err);
          });
      }
    };
    applyLayers(model, editorStore.getState().doc.layers);
    ensureFiles(editorStore.getState().doc.layers);
    invalidate();
    return editorStore.subscribe((st, prev) => {
      if (st.doc.layers !== prev.doc.layers) {
        ensureFiles(st.doc.layers);
        applyLayers(model, st.doc.layers);
        invalidate();
      }
    });
  }, [model, asset, gl, invalidate]);

  // ── Materials (cached per model, disposed with it) ────────────────
  const library = useMemo(() => (model ? new MaterialLibrary({ hd: true }) : null), [model]);
  useEffect(() => () => library?.dispose(), [library]);

  useEffect(() => {
    if (!model || !report || !library) return;
    const apply = () => {
      const st = editorStore.getState();
      applyMaterials(
        model,
        report,
        { doc: st.doc, hoveredMuscleId: st.exporting ? null : st.hoveredMuscleId },
        library,
      );
      invalidate();
    };
    apply();
    const unsubscribe = editorStore.subscribe((st, prev) => {
      if (
        st.doc.selections !== prev.doc.selections ||
        st.doc.palette !== prev.doc.palette ||
        st.doc.dimUnselected !== prev.doc.dimUnselected ||
        st.hoveredMuscleId !== prev.hoveredMuscleId ||
        st.exporting !== prev.exporting
      ) {
        apply();
      }
    });
    return () => {
      unsubscribe();
      restoreOriginalMaterials(model);
    };
  }, [model, report, library, invalidate, extraVersion]);

  // ── Pointer interaction ───────────────────────────────────────────
  const setCursor = (c: string) => setCanvasCursor(gl, c);

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const mapping = report?.byMesh.get(e.object.uuid);
    editorStore.getState().setHovered(mapping?.muscleId ?? null);
    // Non-muscle structures (bones, organs…) show their name but are not paintable.
    const ud = e.object.userData as { ar?: string; source?: string; side?: string };
    // Z-Anatomy structures carry their Arabic name in the file.
    const structure = mapping
      ? null
      : ud.ar
        ? `za:${JSON.stringify({ ar: ud.ar, en: (ud.source ?? "").replace(/_/g, " ").replace(/[()]/g, ""), side: ud.side ?? "m" })}`
        : (model?.meshNames.get(e.object.uuid) ?? null);
    useAssetStore.getState().setHoveredStructure(structure);
    setCursor(mapping ? "pointer" : "grab");
  };

  const handleOut = () => {
    editorStore.getState().setHovered(null);
    useAssetStore.getState().setHoveredStructure(null);
    setCursor("grab");
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_TOLERANCE || !report || !model) return;
    const mapping = report.byMesh.get(e.object.uuid);
    if (mapping) {
      editorStore.getState().toggleMuscle(mapping.muscleId);
    } else {
      const name = model.meshNames.get(e.object.uuid) ?? e.object.name;
      if (report.unmapped.some((u) => u.uid === e.object.uuid)) {
        useAssetStore.getState().setInspectedMesh(name);
      }
    }
  };

  useEffect(() => () => setCanvasCursor(gl, "auto"), [gl]);

  if (!model) return null;

  return (
    <>
      <group scale={modelScale} position={[0, modelOffsetY, 0]}>
        <primitive
          object={model.root}
          onPointerMove={handleMove}
          onPointerOut={handleOut}
          onClick={handleClick}
        />
      </group>
      {showLabels && anchors && <MuscleLabels anchors={anchors} />}
    </>
  );
}

function MuscleLabels({ anchors }: { anchors: Map<string, LabelAnchor[]> }) {
  const selections = useEditor((s) => s.doc.selections);
  const palette = useEditor((s) => s.doc.palette);
  const language = useEditor((s) => s.doc.labelLanguage);
  return (
    <>
      {Object.keys(selections).map((id) => {
        const list = anchors.get(id);
        const muscle = getMuscle(id);
        if (!list?.length || !muscle) return null;
        const color = highlightColor(id, { selections, palette }) ?? palette.primary;
        return <MuscleLabel key={id} anchors={list} color={color} muscleId={id} language={language} />;
      })}
    </>
  );
}

function MuscleLabel({
  anchors,
  color,
  muscleId,
  language,
}: {
  anchors: LabelAnchor[];
  color: string;
  muscleId: string;
  language: "en" | "ar" | "both";
}) {
  const ref = useRef<Group>(null);
  const muscle = getMuscle(muscleId);
  useFrame(({ camera }) => {
    if (!ref.current) return;
    anchorWorldPosition(nearestAnchor(anchors, camera.position), ref.current.position);
  });
  if (!muscle) return null;
  return (
    <group ref={ref}>
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div
          className="whitespace-nowrap rounded-md border bg-panel/90 px-2 py-1 text-[11px] font-medium leading-tight text-fg shadow-lg backdrop-blur-sm"
          style={{ borderColor: color }}
        >
          {language !== "en" && <div dir="rtl">{muscle.displayName.ar}</div>}
          {language !== "ar" && (
            <div dir="ltr" className={language === "both" ? "text-[10px] text-muted" : ""}>
              {muscle.displayName.en}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
