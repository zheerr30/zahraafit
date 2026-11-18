"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { DirectionalLight, HalfFloatType, Material, Mesh, Object3D, PCFShadowMap, Vector2, Vector3, WebGLRenderTarget, type Scene, type WebGLRenderer } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { KEY_LIGHT } from "@/components/anatomy/AtlasLighting";
import { regionBridge } from "@/components/region/BackViewport";

/**
 * HD rendering for the atlas (prototype):
 *  - multisampled half-float HDR render target, tone mapped once in OutputPass;
 *  - ground-truth ambient occlusion (GTAO) for the contact darkening between
 *    neighbouring muscles, tendons and bones; its radius follows the viewing
 *    distance so it works from the full body down to a few centimetres;
 *  - the key light casts soft shadows: a directional light aimed like the
 *    camera-attached key light, whose shadow frustum is fitted to what is on
 *    screen every frame (sharp shadows in close-ups, full coverage zoomed out);
 *  - ghosted (isolation) and translucent structures neither cast shadows nor
 *    occlude in the AO, so isolation reads exactly as before.
 */
function enableShadows(gl: WebGLRenderer, scene: Scene, key: DirectionalLight): () => void {
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = PCFShadowMap;
  scene.add(key);
  scene.add(key.target);
  return () => {
    scene.remove(key);
    scene.remove(key.target);
    gl.shadowMap.enabled = false;
  };
}

/** Aim the shadow-casting key at the subject and fit its frustum to what is on screen. */
function fitKeyLight(key: DirectionalLight, subject: Vector3, dir: Vector3, half: number): void {
  key.position.copy(subject).addScaledVector(dir, half * 4);
  key.target.position.copy(subject);
  key.target.updateMatrixWorld();
  const sc = key.shadow.camera;
  sc.left = -half;
  sc.right = half;
  sc.top = half;
  sc.bottom = -half;
  sc.near = half * 0.5;
  sc.far = half * 8;
  sc.updateProjectionMatrix();
  key.shadow.normalBias = ((2 * half) / 4096) * 1.5;
}

export function HDPipeline() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const key = useMemo(() => {
    const l = new DirectionalLight(KEY_LIGHT.color, KEY_LIGHT.intensity);
    l.castShadow = true;
    l.shadow.mapSize.set(4096, 4096);
    l.shadow.radius = 6;
    l.shadow.bias = -0.0004;
    // Soft-tissue shadows are never black: keep 30 % of the key light in shadow.
    l.shadow.intensity = 0.45;
    return l;
  }, []);

  const { composer, gtao } = useMemo(() => {
    const rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, rt);
    composer.addPass(new RenderPass(scene, camera));
    const gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.blendIntensity = 1;
    gtao.updateGtaoMaterial({ radius: 0.03, distanceExponent: 1.6, thickness: 1, scale: 1.45, samples: 16 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    // Hide ghosted / translucent meshes from the AO depth-normal pass.
    const hidden: Object3D[] = [];
    const base = (gtao as unknown as { _overrideVisibility: () => void })._overrideVisibility.bind(gtao);
    const restore = (gtao as unknown as { _restoreVisibility: () => void })._restoreVisibility.bind(gtao);
    (gtao as unknown as { _overrideVisibility: () => void })._overrideVisibility = () => {
      base();
      scene.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh && m.visible && (m.material as Material).transparent) {
          m.visible = false;
          hidden.push(m);
        }
      });
    };
    (gtao as unknown as { _restoreVisibility: () => void })._restoreVisibility = () => {
      restore();
      for (const o of hidden) o.visible = true;
      hidden.length = 0;
    };
    composer.addPass(gtao);
    composer.addPass(new OutputPass());
    return { composer, gtao };
  }, [gl, scene, camera]);

  useEffect(() => enableShadows(gl, scene, key), [gl, scene, key]);

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
    gtao.setSize(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio());
    invalidate();
  }, [composer, gtao, gl, size, invalidate]);

  useEffect(() => () => composer.dispose(), [composer]);

  const tmp = useMemo(() => ({ s: new Vector3(), d: new Vector3(), t: new Vector3(), v: new Vector2() }), []);

  useFrame(() => {
    // Subject point: the orbit target (what the user is looking at).
    const controls = regionBridge.controls;
    if (controls) controls.getTarget(tmp.s);
    else tmp.s.set(0, 1, 0);
    const dist = camera.position.distanceTo(tmp.s);
    const fov = ((camera as unknown as { fov?: number }).fov ?? 30) * (Math.PI / 180);
    const half = Math.max(0.05, dist * Math.tan(fov / 2) * 1.6);
    // Key light direction = camera-space KEY_LIGHT.position, rotated with the camera.
    tmp.d.copy(KEY_LIGHT.position).normalize().applyQuaternion(camera.quaternion);
    fitKeyLight(key, tmp.s, tmp.d, half);
    // AO radius follows the viewing distance (≈ 2 cm at 1 m).
    gtao.updateGtaoMaterial({ radius: Math.min(0.06, Math.max(0.003, dist * 0.022)) });
    // Ghosted / translucent / faded meshes do not cast shadows.
    for (const m of regionBridge.model?.meshes ?? []) {
      const mat = m.mesh.material as Material;
      const cast = m.mesh.visible && !mat.transparent && m.kind !== "attachment";
      m.mesh.castShadow = cast;
      m.mesh.receiveShadow = m.kind !== "attachment";
    }
    composer.render();
  }, 1);

  return null;
}
