"use client";

import { ContactShadows } from "@react-three/drei";
import { AtlasLighting } from "./AtlasLighting";
import { useEditor } from "@/stores/editorStore";

/**
 * The shared atlas lighting (camera-following key/fill/rim + studio
 * environment) plus soft contact shadows under the standing figure.
 */
export function StudioLights() {
  const intensity = useEditor((s) => s.doc.lighting);
  const offsetY = useEditor((s) => s.doc.modelOffsetY);
  const background = useEditor((s) => s.doc.background);

  return (
    <>
      <AtlasLighting intensity={intensity} />
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
