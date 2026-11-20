"use client";

import { useCallback, useState } from "react";
import { Vector3 } from "three";
import { getProjectRepository } from "@/lib/storage";
import { ProjectNotFoundError } from "@/lib/storage/repository";
import type { CameraState, Project } from "@/lib/storage/schema";
import { captureThumbnail } from "@/lib/three/capture";
import { viewportBridge } from "@/lib/three/viewportBridge";
import { editorStore } from "@/stores/editorStore";
import { toast } from "@/stores/toastStore";

export function readCameraState(): CameraState | null {
  const h = viewportBridge.handles;
  if (!h) return null;
  const pos = h.camera.position;
  const target = new Vector3();
  if (h.controls) h.controls.getTarget(target);
  return {
    view: editorStore.getState().currentView,
    position: [pos.x, pos.y, pos.z],
    target: [target.x, target.y, target.z],
  };
}

/** Saves the current editor document (with camera + thumbnail) to the active repository. */
export function useSaveProject() {
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (opts: { name?: string; asNew?: boolean } = {}): Promise<Project | null> => {
    const st = editorStore.getState();
    setSaving(true);
    try {
      st.setExporting(true);
      let thumbnail: string | null = null;
      try {
        thumbnail = await captureThumbnail(st.doc, st.doc.background);
      } catch (e) {
        console.warn("[muscle-studio] thumbnail capture failed", e);
      } finally {
        st.setExporting(false);
      }
      const repo = await getProjectRepository();
      const input = {
        name: opts.name ?? st.projectName,
        assetId: viewportBridge.loaded?.asset.id ?? null,
        doc: editorStore.getState().doc,
        camera: readCameraState(),
        thumbnail,
      };
      let project: Project;
      if (st.projectId && !opts.asNew) {
        try {
          project = await repo.update(st.projectId, input);
        } catch (e) {
          if (!(e instanceof ProjectNotFoundError)) throw e;
          project = await repo.create(input);
        }
      } else {
        project = await repo.create(input);
      }
      editorStore.getState().markSaved(project.id, project.name);
      // Keep the URL shareable/reloadable without re-initializing the editor.
      window.history.replaceState(null, "", `/editor?project=${encodeURIComponent(project.id)}`);
      toast.success(`حفظ «${project.name}»${repo.kind === "local" ? " في هذا المتصفح" : " في السحابة"}.`);
      return project;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ.");
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { save, saving };
}
