"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Group, Object3D, Vector3, type Camera } from "three";

/** The key light (camera space), shared with the HD pipeline's shadow-casting key. */
export const KEY_LIGHT = { position: new Vector3(-1.5, 1.9, 0.9), intensity: 5.0, color: "#fff1e2" };

/** Levels of the rig: the even standard, and the studio set-up of the HD view. */
const FLAT = { ambient: 0.2, hemisphere: 0.38, fill: 0.55, rim: 1.5, bounce: 0.25, env: 1 };
const STUDIO = { ambient: 0.1, hemisphere: 0.26, fill: 0.42, rim: 2.3, bounce: 0.2, env: 0.8 };

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
 * ONE lighting standard for the atlas and the editor: a studio set-up — one large
 * warm key from the upper left, a weak cool fill, a rim and a faint bounce — that
 * travels with the camera (every angle of a 360° turn is lit alike),
 * a soft hemisphere + ambient base and a procedural studio environment for the
 * satin / moist reflections. `intensity` scales everything. With
 * `keyLight={false}` the key is provided elsewhere (HD pipeline: shadow-casting key).
 *
 * `studio` (HD): the base light is lowered and the rim raised, so the key models the
 * muscles — lit side, soft shadow side, a bright edge that lifts the body off the
 * backdrop — instead of an even, flat wash.
 */
export function AtlasLighting({ intensity = 1, keyLight = true, warmFill = false, studio = false }: { intensity?: number; keyLight?: boolean; warmFill?: boolean; studio?: boolean }) {
  const L = studio ? STUDIO : FLAT;
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
      <ambientLight intensity={L.ambient * intensity} />
      <hemisphereLight args={["#fff8f2", warmFill ? "#3a2c2a" : "#20232a", L.hemisphere * intensity]} />
      <primitive object={group}>
        {keyLight && <directionalLight position={KEY_LIGHT.position.toArray()} intensity={KEY_LIGHT.intensity * intensity} color={KEY_LIGHT.color} target={target} />}
        {/* soft cool fill opposite the key, a rim from behind for separation, a faint bounce from below */}
        <directionalLight position={[2.2, 0.5, 0.8]} intensity={L.fill * intensity} color="#e8eeff" target={target} />
        <directionalLight position={[0.8, 2.4, -3]} intensity={L.rim * intensity} color="#eef2ff" target={target} />
        {studio && <directionalLight position={[-2.6, 0.9, -2.4]} intensity={L.rim * 0.55 * intensity} color="#fff3e6" target={target} />}
        <directionalLight position={[1.5, -1.2, -1.5]} intensity={L.bounce * intensity} target={target} />
      </primitive>
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={1.4 * L.env} position={[0, 4, -2]} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={0.8 * L.env} position={[-4, 1.5, 0]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} />
        <Lightformer form="rect" intensity={0.8 * L.env} position={[4, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} />
        <Lightformer form="rect" intensity={0.6 * L.env} position={[0, 2, 4]} scale={[5, 3, 1]} />
      </Environment>
    </>
  );
}
