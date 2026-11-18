"use client";

import { ContactShadows } from "@react-three/drei";
import type { Mesh, Vector3 } from "three";
import { viewportBridge } from "@/lib/three/viewportBridge";
import { useEditor } from "@/stores/editorStore";
import { AtlasLighting } from "./AtlasLighting";
import { HDPipeline } from "./HDPipeline";
import { ProgressiveRefine } from "./ProgressiveRefine";

const editorTarget = (out: Vector3) => {
  const c = viewportBridge.handles?.controls;
  if (c) c.getTarget(out);
  else out.set(0, 0.9, 0);
};
const editorMeshes = (): Mesh[] => viewportBridge.loaded?.model.meshes ?? [];
const editorMuscles = (): Mesh[] => editorMeshes().filter((m) => !!m.geometry.getAttribute("_fiber"));

/**
 * The shared HD standard of the atlas (camera-following fill/rim + studio
 * environment, shadow-casting key, AO, on-demand surface refinement) plus
 * soft contact shadows under the standing figure.
 */
export function StudioLights() {
  const intensity = useEditor((s) => s.doc.lighting);
  const offsetY = useEditor((s) => s.doc.modelOffsetY);
  const background = useEditor((s) => s.doc.background);

  return (
    <>
      <AtlasLighting keyLight={false} warmFill intensity={0.85 * intensity} />
      <HDPipeline getTarget={editorTarget} getMeshes={editorMeshes} />
      <ProgressiveRefine getTarget={editorTarget} getCandidates={editorMuscles} />
      <ContactShadows
        position={[0, offsetY + 0.001, 0]}
        opacity={background === "white" ? 0.35 : 0.7}
        scale={3.2}
        blur={2.4}
        far={1.2}
        resolution={512}
        color="#000000"
      />
    </>
  );
}
