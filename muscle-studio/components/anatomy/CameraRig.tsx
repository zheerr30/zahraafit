"use client";

import { CameraControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Box3, Vector3, type PerspectiveCamera } from "three";
import { MODEL_HEIGHT, boundsForMuscles } from "@/lib/three/anatomyModel";
import { poseForBox, poseForView, type CameraPose } from "@/lib/three/cameraPoses";
import { viewportBridge } from "@/lib/three/viewportBridge";
import { editorStore, useEditor } from "@/stores/editorStore";

/** Approximate bounds of a normalized model, used before a model has loaded. */
const DEFAULT_BOX = new Box3(new Vector3(-0.35, 0, -0.18), new Vector3(0.35, MODEL_HEIGHT, 0.18));

function modelBox(): Box3 {
  const loaded = viewportBridge.loaded;
  return loaded ? new Box3().setFromObject(loaded.model.root, true) : DEFAULT_BOX.clone();
}

/**
 * Owns the orbit/zoom/pan controls and executes camera commands from the
 * editor store (named views, reset, frame selection, restore saved camera)
 * with smooth transitions.
 */
export function CameraRig() {
  const ref = useRef<CameraControls>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const command = useEditor((s) => s.cameraCommand);

  useEffect(() => {
    if (viewportBridge.handles) viewportBridge.handles.controls = ref.current;
    const controls = ref.current;
    if (!controls) return;
    const onStart = () => editorStore.getState().setCurrentView(null);
    controls.addEventListener("controlstart", onStart);
    return () => {
      controls.removeEventListener("controlstart", onStart);
      if (viewportBridge.handles) viewportBridge.handles.controls = null;
    };
  }, []);

  useEffect(() => {
    const controls = ref.current;
    if (!controls || !command) return;
    const aspect = size.width / Math.max(1, size.height);
    let pose: CameraPose;
    let animate = true;
    switch (command.type) {
      case "view":
        pose = poseForView(command.view, modelBox(), camera.fov, aspect);
        animate = command.animate;
        break;
      case "reset":
        pose = poseForView("front", modelBox(), camera.fov, aspect);
        break;
      case "frame-selection": {
        const loaded = viewportBridge.loaded;
        const ids = Object.keys(editorStore.getState().doc.selections);
        const box = (loaded && ids.length && boundsForMuscles(loaded.model, loaded.report, ids)) || modelBox();
        const target = controls.getTarget(new Vector3());
        const dir = camera.position.clone().sub(target);
        pose = poseForBox(box, dir.lengthSq() > 1e-6 ? dir : new Vector3(0, 0, 1), camera.fov, aspect);
        break;
      }
      case "restore":
        pose = {
          position: new Vector3(...command.camera.position),
          target: new Vector3(...command.camera.target),
        };
        animate = false;
        break;
    }
    void controls.setLookAt(
      pose.position.x,
      pose.position.y,
      pose.position.z,
      pose.target.x,
      pose.target.y,
      pose.target.z,
      animate,
    );
    // Only react to new commands (nonce changes), not to resizes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);


  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={0.25}
      maxDistance={14}
      smoothTime={0.32}
      draggingSmoothTime={0.08}
      dollyToCursor
      maxPolarAngle={Math.PI * 0.92}
    />
  );
}
