"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Group, Object3D, type Camera } from "three";

/** The light rig of the mounted viewer (used by exports to aim it at the export camera). */
export const lightRig: { group: Group | null } = { group: null };

/** Aim the rig at a camera (exports render with their own camera). */
export function alignLightRig(camera: Camera): void {
  const g = lightRig.group;
  if (!g) return;
  g.position.copy(camera.position);
  g.quaternion.copy(camera.quaternion);
  g.updateMatrixWorld(true);
}

/**
 * ONE lighting standard for the atlas and the editor: key, fill, rim and under
 * lights that travel with the camera (every angle of a 360° turn is lit alike),
 * a soft hemisphere + ambient base and a procedural studio environment for the
 * satin / moist reflections. `intensity` scales everything.
 */
export function AtlasLighting({ intensity = 1 }: { intensity?: number }) {
  const camera = useThree((s) => s.camera);
  const group = useMemo(() => new Group(), []);
  const target = useMemo(() => {
    const t = new Object3D();
    t.position.set(0, 0, -3);
    return t;
  }, []);
  useEffect(() => {
    group.add(target);
    lightRig.group = group;
    return () => {
      if (lightRig.group === group) lightRig.group = null;
    };
  }, [group, target]);
  useFrame(() => {
    group.position.copy(camera.position);
    group.quaternion.copy(camera.quaternion);
  });
  return (
    <>
      <ambientLight intensity={0.22 * intensity} />
      <hemisphereLight args={["#fff8f2", "#20232a", 0.45 * intensity]} />
      <primitive object={group}>
        <directionalLight position={[1.6, 1.8, 0.6]} intensity={2.4 * intensity} color="#fff3e8" target={target} />
        <directionalLight position={[-2.2, 0.6, 0.8]} intensity={0.85 * intensity} color="#f2f5ff" target={target} />
        <directionalLight position={[0, 2.5, -3]} intensity={1.3 * intensity} color="#eef2ff" target={target} />
        <directionalLight position={[-1.5, -1.2, -1.5]} intensity={0.45 * intensity} target={target} />
      </primitive>
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={1.4} position={[0, 4, -2]} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[-4, 1.5, 0]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[4, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} />
        <Lightformer form="rect" intensity={0.6} position={[0, 2, 4]} scale={[5, 3, 1]} />
      </Environment>
    </>
  );
}
