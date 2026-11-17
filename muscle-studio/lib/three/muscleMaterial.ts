import { Color, MeshPhysicalMaterial } from "three";

/**
 * Écorché muscle shading for meshes that carry the baked `_anat` / `_fiber`
 * attributes (pipeline/bodyparts3d/bake.mjs):
 *  - `_fiber` is the fibre direction at each vertex, derived from the muscle's
 *    own geometry (surface gradient of the geodesic distance to its tendons).
 *    Striations are anisotropic phasor noise oriented by that direction, so
 *    they fan out, converge and curve with each muscle — with no seams and no
 *    global parametrisation. Two scales: fibre bundles (≈1.3 mm) and
 *    fascicles (≈5 mm), each faded out before it would alias.
 *  - `_anat.y`: thin tissue (tendons, aponeuroses) turns ivory and glossier,
 *  - `_anat.x`: baked ambient occlusion deepens the grooves between muscles,
 *  - a satin sheen + light clearcoat give the moist look of fresh tissue.
 * Everything is computed in the shader from per-vertex data — no textures —
 * so it renders identically on screen and in tiled high-resolution exports.
 */

export interface MuscleLook {
  /** 0..1 strength of the ivory tendon colour. */
  tendon: number;
  /** Striation normal-bump strength. */
  bump: number;
  /** 0..1 strength of the fibre colour variation (grooves ↔ highlights). */
  stripe: number;
  /** 0..1 strength of the baked ambient occlusion. */
  ao: number;
  sheen: number;
  clearcoat: number;
  roughness: number;
}

/** Natural tissue: the default for every muscle. */
export const REALISTIC_LOOK: MuscleLook = { tendon: 1, bump: 0.75, stripe: 1, ao: 0.9, sheen: 0.55, clearcoat: 0.3, roughness: 0.52 };
/** Highlighted muscles: same anatomy cues, colour kept clearly readable. */
export const HIGHLIGHT_LOOK: MuscleLook = { tendon: 0.55, bump: 0.6, stripe: 0.6, ao: 0.8, sheen: 0.35, clearcoat: 0.25, roughness: 0.5 };

/** Colours sampled from the reference écorché images (sRGB). */
export const TENDON_COLOR = "#E4DDD8";

/** Fibre groove / highlight colours derived from a muscle colour (sRGB maths). */
function fibreColors(hex: string): { groove: Color; light: Color } {
  const base = new Color(hex);
  const s = base.clone().convertLinearToSRGB();
  // Reference ratios: tissue #B0565A → grooves #6B2F33, fibre highlights #D69089.
  const groove = new Color(s.r * 0.6, s.g * 0.55, s.b * 0.57).convertSRGBToLinear();
  const lift = new Color(Math.min(1, s.r * 1.13), Math.min(1, s.g * 1.13), Math.min(1, s.b * 1.13));
  const light = lift.lerp(new Color(1, 1, 1), 0.3).convertSRGBToLinear();
  return { groove, light };
}

export function createMuscleMaterial(hex: string, look: MuscleLook, hover: boolean): MeshPhysicalMaterial {
  const color = new Color(hex);
  const { groove, light } = fibreColors(hex);
  const mat = new MeshPhysicalMaterial({
    color,
    roughness: look.roughness,
    metalness: 0,
    clearcoat: look.clearcoat,
    clearcoatRoughness: 0.38,
    sheen: look.sheen,
    sheenRoughness: 0.45,
    sheenColor: light.clone().lerp(new Color(1, 1, 1), 0.35),
    envMapIntensity: 1,
  });
  if (hover) mat.emissive = color.clone().multiplyScalar(0.25);

  const uniforms = {
    uTendon: { value: look.tendon },
    uBump: { value: look.bump },
    uStripe: { value: look.stripe },
    uAo: { value: look.ao },
    uTendonColor: { value: new Color(TENDON_COLOR) },
    uGroove: { value: groove },
    uLight: { value: light },
  };

  mat.userData.msUniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute vec2 _anat;
        attribute vec3 _fiber;
        varying vec2 vAnat;
        varying vec3 vFib;
        varying vec3 vObjPos;
        varying vec3 vObjNrm;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vAnat = _anat;
        vFib = _fiber;
        vObjPos = transformed;
        vObjNrm = objectNormal;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uTendon;
        uniform float uBump;
        uniform float uStripe;
        uniform float uAo;
        uniform vec3 uTendonColor;
        uniform vec3 uGroove;
        uniform vec3 uLight;
        varying vec2 vAnat;
        varying vec3 vFib;
        varying vec3 vObjPos;
        varying vec3 vObjNrm;
        vec4 msHash4(vec3 p) {
          vec4 q = vec4(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)),
                        dot(p, vec3(113.5, 271.9, 124.6)), dot(p, vec3(201.7, 97.3, 157.9)));
          return fract(sin(q) * 43758.5453);
        }
        // Anisotropic phasor noise (Tricard et al. 2019): kernels on a jittered
        // grid, all oscillating across the local fibre direction F.
        // Returns (stripe -1..1, bundle tone 0..1).
        vec2 msPhasor(vec3 p, vec3 F, vec3 A, vec3 N, float cell, float freq, vec3 sigma) {
          vec3 c = floor(p / cell);
          vec2 ph = vec2(0.0);
          float tone = 0.0, wsum = 1e-6;
          vec3 inv = 0.5 / (sigma * sigma);
          for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) {
            vec3 cc = c + vec3(float(i), float(j), float(k));
            vec4 h = msHash4(cc);
            vec3 d = p - (cc + h.xyz) * cell;
            float da = dot(d, F), dc = dot(d, A), dn = dot(d, N);
            float g = exp(-(da * da * inv.x + dc * dc * inv.y + dn * dn * inv.z));
            float phase = 6.2831853 * (freq * dc + h.w);
            ph += g * vec2(cos(phase), sin(phase));
            tone += g * fract(h.w * 13.7);
            wsum += g;
          }
          // Where kernels cancel out the phase is undefined: fade the stripe there
          // instead of letting the singularity sparkle.
          float mag = smoothstep(0.04, 0.3, length(ph) / wsum);
          return vec2(sin(atan(ph.y, ph.x)) * mag, tone / wsum);
        }
        float msFibre() {
          vec3 N = normalize(vObjNrm);
          vec3 A = cross(N, vFib);
          float la = length(A);
          A = la > 1e-4 ? A / la : normalize(cross(N, vec3(0.0, 1.0, 0.0)) + 1e-4);
          vec3 F = cross(A, N);
          float px = length(fwidth(vObjPos)); // metres per pixel
          // Fibre bundles ≈1.3 mm, fascicles ≈5 mm; each fades out before it aliases.
          float fineFade = 1.0 - smoothstep(0.15, 0.4, px * 770.0);
          float coarseFade = 1.0 - smoothstep(0.25, 0.6, px * 200.0);
          float h = 0.0;
          if (coarseFade > 0.0) {
            vec2 c = msPhasor(vObjPos, F, A, N, 0.018, 200.0, vec3(0.007, 0.0045, 0.006));
            h += coarseFade * (c.x * 0.28 + (c.y - 0.5) * 0.6);
          }
          if (fineFade > 0.0) {
            vec2 f = msPhasor(vObjPos + 0.37, F, A, N, 0.006, 770.0, vec3(0.0024, 0.0013, 0.0024));
            h += fineFade * (f.x * 0.45 + (f.y - 0.5) * 0.25);
          }
          return clamp(0.5 + 0.5 * h, 0.0, 1.0);
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
        float msK = (msH - 0.5) * 2.0 * uStripe;
        vec3 msTissue = msK < 0.0 ? mix(diffuseColor.rgb, uGroove, -msK) : mix(diffuseColor.rgb, uLight, msK * 0.75);
        // Tendons are fibrous too, only paler and much finer in contrast.
        vec3 msTendonCol = uTendonColor * (0.93 + 0.1 * msH);
        diffuseColor.rgb = mix(msTissue, msTendonCol, msTendon);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.3, msTendon);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = msPerturb(-vViewPosition, normal, vec2(dFdx(msH), dFdy(msH)) * uBump * mix(1.0, 0.35, msTendon), faceDirection);`,
      )
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        float msAo = mix(1.0, smoothstep(0.0, 0.85, vAnat.x), uAo);
        reflectedLight.indirectDiffuse *= msAo;
        reflectedLight.indirectSpecular *= msAo;
        reflectedLight.directDiffuse *= mix(1.0, msAo, 0.6);
        reflectedLight.directSpecular *= mix(1.0, msAo, 0.45);`,
      );
  };
  // Distinct program cache key per look so three.js does not share shaders wrongly.
  mat.customProgramCacheKey = () => `muscle3:${look.tendon}:${look.bump}:${look.stripe}:${look.ao}`;
  mat.name = `muscle:${hex}`;
  return mat;
}

/**
 * Re-colour / re-style a material made by createMuscleMaterial in place
 * (no shader recompile): used when a single mesh owns its material, e.g. to
 * highlight, hover or fade one muscle of the region viewer.
 */
export function setMuscleLook(mat: MeshPhysicalMaterial, hex: string, look: MuscleLook, hover: boolean): void {
  const u = mat.userData.msUniforms as Record<string, { value: unknown }> | undefined;
  if (!u) return;
  const color = new Color(hex);
  const { groove, light } = fibreColors(hex);
  mat.color.copy(color);
  mat.roughness = look.roughness;
  mat.clearcoat = look.clearcoat;
  mat.sheen = look.sheen;
  mat.sheenColor.copy(light).lerp(new Color(1, 1, 1), 0.35);
  mat.emissive.copy(hover ? color.clone().multiplyScalar(0.25) : new Color(0, 0, 0));
  u.uTendon.value = look.tendon;
  u.uBump.value = look.bump;
  u.uStripe.value = look.stripe;
  u.uAo.value = look.ao;
  (u.uGroove.value as Color).copy(groove);
  (u.uLight.value as Color).copy(light);
}
