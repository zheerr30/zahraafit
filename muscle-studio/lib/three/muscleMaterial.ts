import { Color, MeshPhysicalMaterial } from "three";

/**
 * Realistic muscle shading for meshes that carry the baked `_anat` / `_fiber`
 * attributes (pipeline/bodyparts3d/bake.mjs):
 *  - baked ambient occlusion darkens the grooves between muscles,
 *  - thin tissue (tendons, aponeuroses) turns pale and glossier,
 *  - fine striations run along each muscle's fibre direction,
 *  - a light clearcoat gives the moist sheen of real muscle.
 * Everything is computed in the shader from per-vertex data — no textures,
 * so it renders identically on screen and in exports.
 */

export interface MuscleLook {
  /** 0..1 strength of the pale tendon colour. */
  tendon: number;
  /** Striation normal-bump strength. */
  bump: number;
  /** Striation darkening of the colour. */
  stripeShade: number;
  /** 0..1 strength of the baked ambient occlusion. */
  ao: number;
  clearcoat: number;
  roughness: number;
}

export const REALISTIC_LOOK: MuscleLook = { tendon: 0.9, bump: 1, stripeShade: 0.22, ao: 0.85, clearcoat: 0.35, roughness: 0.5 };
export const STUDIO_LOOK: MuscleLook = { tendon: 0, bump: 0.45, stripeShade: 0.04, ao: 0.75, clearcoat: 0, roughness: 0.62 };
/** Highlighted muscles keep their shape cues but stay clearly coloured. */
export const HIGHLIGHT_LOOK: MuscleLook = { tendon: 0.45, bump: 0.7, stripeShade: 0.1, ao: 0.7, clearcoat: 0.25, roughness: 0.5 };

export const TENDON_COLOR = "#E8DFCF";

export function createMuscleMaterial(hex: string, look: MuscleLook, hover: boolean): MeshPhysicalMaterial {
  const color = new Color(hex);
  const mat = new MeshPhysicalMaterial({
    color,
    roughness: look.roughness,
    metalness: 0,
    clearcoat: look.clearcoat,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.85,
  });
  if (hover) mat.emissive = color.clone().multiplyScalar(0.22);

  const uniforms = {
    uTendon: { value: look.tendon },
    uBump: { value: look.bump },
    uStripeShade: { value: look.stripeShade },
    uAo: { value: look.ao },
    uTendonColor: { value: new Color(TENDON_COLOR) },
    uAcross: { value: 650 }, // fibre bundles ≈1.5 mm wide
    uAlong: { value: 14 }, // …and several cm long
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute vec2 _anat;
        attribute vec3 _fiber;
        varying vec2 vAnat;
        varying vec3 vWorldPosM;
        varying vec3 vFiber;`,
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vAnat = _anat;
        vWorldPosM = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vFiber = _fiber;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uTendon;
        uniform float uBump;
        uniform float uStripeShade;
        uniform float uAo;
        uniform vec3 uTendonColor;
        uniform float uAcross;
        uniform float uAlong;
        varying vec2 vAnat;
        varying vec3 vWorldPosM;
        varying vec3 vFiber;
        float msHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float msNoise(vec3 p) {
          vec3 i = floor(p); vec3 fr = fract(p); fr = fr * fr * (3.0 - 2.0 * fr);
          return mix(mix(mix(msHash(i), msHash(i + vec3(1,0,0)), fr.x), mix(msHash(i + vec3(0,1,0)), msHash(i + vec3(1,1,0)), fr.x), fr.y),
                     mix(mix(msHash(i + vec3(0,0,1)), msHash(i + vec3(1,0,1)), fr.x), mix(msHash(i + vec3(0,1,1)), msHash(i + vec3(1,1,1)), fr.x), fr.y), fr.z);
        }
        // Fibre texture: noise stretched along the muscle's fibre axis, so it
        // reads as long bundles. Coordinates are constant per muscle (no seams).
        float msFibreFade;
        float msFibre() {
          vec3 F = normalize(vFiber + vec3(1e-5));
          vec3 a1 = normalize(cross(F, abs(F.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
          vec3 a2 = cross(F, a1);
          vec3 q = vec3(dot(vWorldPosM, a1) * uAcross, dot(vWorldPosM, a2) * uAcross, dot(vWorldPosM, F) * uAlong);
          // Fade out where bundles get smaller than a pixel (no shimmering).
          msFibreFade = 1.0 - smoothstep(0.35, 1.0, length(fwidth(q.xy)));
          float h = msNoise(q) * 0.65 + msNoise(q * vec3(2.1, 2.1, 1.7) + 7.3) * 0.35;
          return h;
        }
        vec3 msPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
          vec3 sx = normalize(dFdx(surfPos));
          vec3 sy = normalize(dFdy(surfPos));
          vec3 r1 = cross(sy, surfNorm);
          vec3 r2 = cross(surfNorm, sx);
          float det = dot(sx, r1) * faceDir;
          vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
          return normalize(abs(det) * surfNorm - grad);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float msTendon = clamp(vAnat.y * uTendon, 0.0, 1.0);
        float msH = msFibre();
        float msMuscle = (1.0 - msTendon) * msFibreFade;
        diffuseColor.rgb = mix(diffuseColor.rgb, uTendonColor, msTendon);
        diffuseColor.rgb *= 1.0 - uStripeShade * (1.0 - msH) * msMuscle;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.32, msTendon);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = msPerturb(-vViewPosition, normal, vec2(dFdx(msH), dFdy(msH)) * uBump * msMuscle, faceDirection);`,
      )
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        float msAo = mix(1.0, smoothstep(0.0, 0.85, vAnat.x), uAo);
        reflectedLight.indirectDiffuse *= msAo;
        reflectedLight.indirectSpecular *= msAo;
        reflectedLight.directDiffuse *= mix(1.0, msAo, 0.55);
        reflectedLight.directSpecular *= mix(1.0, msAo, 0.4);`,
      );
  };
  // Distinct program cache key per look so three.js does not share shaders wrongly.
  mat.customProgramCacheKey = () => `muscle:${look.tendon}:${look.bump}:${look.stripeShade}:${look.ao}`;
  mat.name = `muscle:${hex}`;
  return mat;
}
