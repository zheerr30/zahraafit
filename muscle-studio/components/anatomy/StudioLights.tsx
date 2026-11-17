"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { useEditor } from "@/stores/editorStore";

/**
 * Three-point studio lighting with a procedural environment (no HDR download)
 * and soft contact shadows under the model.
 */
export function StudioLights() {
  const intensity = useEditor((s) => s.doc.lighting);
  const offsetY = useEditor((s) => s.doc.modelOffsetY);
  const background = useEditor((s) => s.doc.background);

  return (
    <>
      <ambientLight intensity={0.18 * intensity} />
      <hemisphereLight args={["#ffffff", "#2a2b2e", 0.35 * intensity]} />
      {/* Key light */}
      <directionalLight
        position={[2.6, 4.2, 3.4]}
        intensity={2.1 * intensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-1.5}
        shadow-camera-right={1.5}
        shadow-camera-top={2.4}
        shadow-camera-bottom={-0.4}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
      />
      {/* Fill light */}
      <directionalLight position={[-3, 2, 2]} intensity={0.55 * intensity} />
      {/* Rim lights for silhouette separation on a dark background */}
      <directionalLight position={[-2.5, 3, -3.5]} intensity={1.1 * intensity} />
      <directionalLight position={[2.5, 2, -3]} intensity={0.7 * intensity} />

      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={1.6} position={[0, 4, 2]} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={0.7} position={[-4, 1.5, 1]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} />
        <Lightformer form="rect" intensity={0.9} position={[4, 1.5, -1]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} />
        <Lightformer form="ring" intensity={0.6} position={[0, 2, -4]} scale={2} />
      </Environment>

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
