import { AddEquation, BufferAttribute, Color, CustomBlending, DoubleSide, FrontSide, MeshPhysicalMaterial, OneFactor, Vector3, ZeroFactor, type BufferGeometry } from "three";
import type { MuscleLook } from "@/lib/three/muscleMaterial";

/** Base colour of skeletal muscle in the HD standard: muted rose (reference: professional atlas apps). */
export const HD_MUSCLE_COLOR = "#A0605F";

/** Tendon / aponeurosis colour of the HD standard: glossy silver-white (reference: medical atlas apps). */
const HD_TENDON = "#D3D0CC";
import { TISSUE, type TissueKind } from "@/lib/three/tissue";

/**
 * High-detail ("HD") anatomical materials.
 *
 * No image textures: every detail is computed in the shader from the
 * anatomy itself, so nothing repeats and nothing blurs when zooming in —
 * the detail is evaluated per pixel at any magnification, and each scale
 * fades out (to its mean) before it could alias when zooming out.
 *
 * Muscle (per muscle, oriented by that muscle's own baked fibre field `_fiber`):
 *  - three nested scales of anisotropic phasor noise running along the fibres:
 *    fascicle bundles (~6 mm), fascicles (~1.5 mm) with thin perimysium septa
 *    between them, and muscle fibres (~0.35 mm);
 *  - the cross-section of each scale is a rounded bulge (not a sine stripe), so
 *    fascicles read as packed cylinders separated by grooves;
 *  - a per-muscle seed (different noise domain) and a per-muscle scale (coarse
 *    fascicles in large muscles, fine ones in small muscles);
 *  - low-frequency mottling of colour and moisture (roughness);
 *  - a myotendinous junction where fascicles end at staggered positions into
 *    the author's tendon / aponeurosis faces (`_anat.y`), which turn pearly white
 *    with fine parallel collagen striation;
 *  - relief in metres (physically scaled bump), anisotropic specular along the
 *    fibres (tangent = fibre direction), satin sheen, baked + screen-space AO.
 *
 * Other tissues (bone, cartilage, tendon, ligament, fascia / aponeurosis,
 * bursa) get their own physically based parameters and micro-detail.
 */

const NOISE = /* glsl */ `
vec4 hzHash4(vec3 p) {
  vec4 q = vec4(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)),
                dot(p, vec3(113.5, 271.9, 124.6)), dot(p, vec3(201.7, 97.3, 157.9)));
  return fract(sin(q) * 43758.5453);
}
float hzHash1(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float hzValue(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hzHash1(i), hzHash1(i + vec3(1, 0, 0)), f.x), mix(hzHash1(i + vec3(0, 1, 0)), hzHash1(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hzHash1(i + vec3(0, 0, 1)), hzHash1(i + vec3(1, 0, 1)), f.x), mix(hzHash1(i + vec3(0, 1, 1)), hzHash1(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float hzFbm(vec3 p) { return 0.5 * hzValue(p) + 0.3 * hzValue(p * 2.03 + 7.1) + 0.2 * hzValue(p * 4.01 + 3.3); }
// Anisotropic phasor noise (Tricard et al. 2019): Gaussian kernels on a jittered
// grid, all oscillating across the local fibre direction F. Returns
// (phase 0..1 across one period, magnitude 0..1, per-kernel tone 0..1).
vec3 hzPhasor(vec3 p, vec3 F, vec3 A, vec3 N, float cell, float freq, vec3 sigma) {
  vec3 c = floor(p / cell);
  vec2 ph = vec2(0.0);
  float tone = 0.0, wsum = 1e-6;
  vec3 inv = 0.5 / (sigma * sigma);
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) {
    vec3 cc = c + vec3(float(i), float(j), float(k));
    vec4 h = hzHash4(cc);
    vec3 d = p - (cc + h.xyz) * cell;
    float da = dot(d, F), dc = dot(d, A), dn = dot(d, N);
    float g = exp(-(da * da * inv.x + dc * dc * inv.y + dn * dn * inv.z));
    float phase = 6.2831853 * (freq * dc + h.w);
    ph += g * vec2(cos(phase), sin(phase));
    tone += g * fract(h.w * 13.7);
    wsum += g;
  }
  float mag = smoothstep(0.0, 0.3, length(ph) / wsum);
  return vec3(atan(ph.y, ph.x) / 6.2831853 + 0.5, mag, tone / wsum);
}
// Rounded cross-section of one period: 0 at the septum, 1 on the crest, with a
// continuous slope everywhere (no kink, so no specular slivers along the
// septa); where the phase is undefined, the mean value (0.625) — no sparkle.
float hzBulge(vec3 r) {
  float c = 0.5 - 0.5 * cos(6.2831853 * r.x);
  return mix(0.625, 1.0 - (1.0 - c) * (1.0 - c), r.y);
}
// Bump with the relief given in metres (Mikkelsen's surface-gradient form with
// unnormalised derivatives): the same physical relief at every zoom level.
vec3 hzPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sx = dFdx(surfPos), sy = dFdy(surfPos);
  vec3 r1 = cross(sy, surfNorm), r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
// Local frame: F along the fibres (projected on the surface), A across, N normal.
void hzFrame(vec3 n, vec3 dir, out vec3 F, out vec3 A, out vec3 N) {
  N = normalize(n);
  A = cross(N, dir);
  float la = length(A);
  A = la > 1e-4 ? A / la : normalize(cross(N, vec3(0.0, 1.0, 0.0)) + 1e-4);
  F = cross(A, N);
}
`;

const VERTEX_HEAD = /* glsl */ `
attribute vec2 _anat;
attribute vec3 _fiber;
attribute float _sheath;
varying float vSheath;
varying vec2 vAnat;
varying vec3 vFib;
varying vec3 vObjPos;
varying vec3 vObjNrm;
`;

function fibreColors(hex: string): { groove: Color; light: Color } {
  const s = new Color(hex).convertLinearToSRGB();
  // Perimysium grooves: deeper, slightly bluish crimson; crests: lighter, pinker.
  // Grooves: a little deeper and redder; crests: paler, towards a pinkish white (no saturation boost).
  const groove = new Color(s.r * 0.7, s.g * 0.6, s.b * 0.6).convertSRGBToLinear();
  const light = new Color(s.r + (1 - s.r) * 0.22, s.g + (1 - s.g) * 0.2, s.b + (1 - s.b) * 0.2).convertSRGBToLinear();
  return { groove, light };
}

export interface MuscleDetail {
  /** Per-muscle noise domain offset (metres). */
  seed: Vector3;
  /** Fascicle size multiplier (~0.75 small muscles … 1.35 large muscles). */
  scale: number;
  /** Strength of the surface detail (relief and fibre contrast), 1 = default. */
  detail?: number;
}

/** Deterministic per-muscle detail parameters from its id and size. */
export function muscleDetail(id: string, geometry: BufferGeometry): MuscleDetail {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const r = (k: number) => (((h >>> (k * 8)) & 255) / 255) * 7.3 + k * 1.37;
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  const scale = Math.min(1.35, Math.max(0.75, Math.sqrt(extent / 0.16)));
  return { seed: new Vector3(r(0), r(1), r(2)), scale };
}

export function createMuscleMaterialHD(hex: string, look: MuscleLook, hover: boolean, detail: MuscleDetail): MeshPhysicalMaterial {
  const color = new Color(hex);
  const { groove, light } = fibreColors(hex);
  const mat = new MeshPhysicalMaterial({
    color,
    roughness: 0.4,
    metalness: 0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.22,
    sheen: 0.35,
    sheenRoughness: 0.5,
    sheenColor: light.clone().lerp(new Color(1, 0.85, 0.85), 0.4),
    specularIntensity: 0.85,
    anisotropy: 0.35,
    envMapIntensity: 1.35,
  });
  if (hover) mat.emissive = color.clone().multiplyScalar(0.25);
  const uniforms = {
    uTendon: { value: look.tendon },
    uBump: { value: look.bump },
    uStripe: { value: look.stripe },
    uAo: { value: look.ao },
    uTendonColor: { value: new Color(HD_TENDON) },
    uGroove: { value: groove },
    uLight: { value: light },
    uSeed: { value: detail.seed },
    uScale: { value: detail.scale },
    uDetail: { value: detail.detail ?? 1 },
  };
  mat.userData.msUniforms = uniforms;
  mat.userData.hd = true;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERTEX_HEAD}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvAnat = _anat; vFib = _fiber; vSheath = _sheath; vObjPos = transformed; vObjNrm = objectNormal;`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uTendon, uBump, uStripe, uAo, uScale, uDetail;
        uniform vec3 uTendonColor, uGroove, uLight, uSeed;
        varying float vSheath;
        varying vec2 vAnat;
        varying vec3 vFib;
        varying vec3 vObjPos;
        varying vec3 vObjNrm;
        ${NOISE}
        // Muscle relief (metres), colour contrast, tendon factor and a moisture term.
        float hzH, hzK, hzTendon, hzWet;
        void hzMuscle() {
          vec3 F, A, N;
          hzFrame(vObjNrm, vFib, F, A, N);
          vec3 p = vObjPos + uSeed;
          float px = length(fwidth(vObjPos));          // metres per pixel
          float s = uScale;
          float fB = 1.0 / (0.007 * s), fF = 1.0 / (0.002 * s), fM = 1.0 / (0.0004 * s);
          // Each scale fades to its mean before its period drops under ~4 px.
          float wB = 1.0 - smoothstep(0.12, 0.3, px * fB);
          float wF = 1.0 - smoothstep(0.12, 0.3, px * fF);
          float wM = 1.0 - smoothstep(0.1, 0.22, px * fM);
          float bB = 0.625, bF = 0.625, bM = 0.625, tB = 0.5, tF = 0.5;
          if (wB > 0.0) { vec3 r = hzPhasor(p, F, A, N, 0.018 * s, fB, vec3(0.0095, 0.0038, 0.007) * s); bB = mix(0.625, hzBulge(r), wB); tB = mix(0.5, r.z, wB); }
          if (wF > 0.0) { vec3 r = hzPhasor(p + 0.37, F, A, N, 0.0065 * s, fF, vec3(0.0034, 0.0013, 0.0026) * s); bF = mix(0.625, hzBulge(r), wF); tF = mix(0.5, r.z, wF); }
          if (wM > 0.0) { vec3 r = hzPhasor(p + 0.71, F, A, N, 0.0014 * s, fM, vec3(0.0007, 0.00028, 0.0005) * s); bM = mix(0.625, hzBulge(r), wM); }
          // Large-scale mottling (cm): colour and moisture vary across the belly.
          float mott = hzFbm(p * 28.0) - 0.5;
          float mott2 = hzValue(p * 110.0) - 0.5;
          // Relief: bundles 0.35 mm, fascicles 0.12 mm, fibres 0.02 mm.
          float hm = (bB - 0.625) * 0.35e-3 * s + (bF - 0.625) * 0.12e-3 * s + (bM - 0.625) * 0.012e-3 * s;
          // Myotendinous junction: fascicles end at staggered positions.
          float t = clamp(vAnat.y * uTendon, 0.0, 1.0);
          t = smoothstep(0.12, 0.88, t + (tF - 0.5) * 1.6 * t * (1.0 - t));
          // Tendon: fine parallel collagen striation, much lower relief.
          float ht = (bF - 0.625) * 0.05e-3 + (bM - 0.625) * 0.02e-3 + mott * 0.04e-3;
          hzH = mix(hm * uDetail, ht, t);
          float k = (bF - 0.625) * 0.7 * wF + (bB - 0.625) * 0.6 * wB + (bM - 0.625) * 0.25 * wM
                  + (tF - 0.5) * 0.3 + (tB - 0.5) * 0.25 + mott * 0.25 + mott2 * 0.06;
          hzK = k * mix(1.0, uDetail, 0.7);
          hzTendon = t;
          hzWet = clamp(0.5 + mott * 0.9 + (bF - 0.625) * 0.8, 0.0, 1.0);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        hzMuscle();
        float msK = hzK * uStripe;
        vec3 msTissue = msK < 0.0 ? mix(diffuseColor.rgb, uGroove, clamp(-msK * 1.15, 0.0, 1.0)) : mix(diffuseColor.rgb, uLight, clamp(msK * 0.85, 0.0, 1.0));
        // Junction: pale pink where the last fascicles meet the tendon.
        vec3 msJunction = mix(diffuseColor.rgb, uTendonColor, 0.55);
        vec3 msTendonCol = uTendonColor * (0.88 + 0.16 * hzK);
        diffuseColor.rgb = mix(msTissue, mix(msJunction, msTendonCol, smoothstep(0.35, 0.8, hzTendon)), smoothstep(0.0, 0.45, hzTendon));
        // Rectus sheath (lib/three/abdomen.ts): the external oblique aponeurosis is a
        // translucent pearly sheet over the rectus; the internal oblique lamina fused
        // into it is not drawn a second time. Alpha-to-coverage: no sorting needed.
        float hzSheath = smoothstep(0.25, 0.85, min(abs(vSheath), 1.0));
        float hzOver = clamp(abs(vSheath) - 1.0, 0.0, 1.0); // in front of the rectus
        if (vSheath > 0.0) {
          vec3 sheathCol = uTendonColor * vec3(1.0, 0.9, 0.9) * (0.96 + 0.08 * hzK);
          diffuseColor.rgb = mix(diffuseColor.rgb, sheathCol, hzSheath);
          diffuseColor.a *= 1.0 - (0.42 + 0.36 * hzOver) * hzSheath;
        } else if (vSheath < 0.0) {
          diffuseColor.a *= 1.0 - hzSheath;
        }
        hzTendon = max(hzTendon, hzSheath);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(clamp(roughnessFactor + (0.5 - hzWet) * 0.14, 0.26, 0.56), 0.16, hzTendon);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = hzPerturb(-vViewPosition, normal, vec2(dFdx(hzH), dFdy(hzH)) * (uBump / 0.75) * (1.0 - 0.8 * hzSheath), faceDirection);`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
        #ifdef USE_ANISOTROPY
          // Collagen is far more anisotropic than muscle.
          material.anisotropy = mix(material.anisotropy, 0.8, hzTendon);
          material.alphaT = mix(pow2(material.roughness), 1.0, pow2(material.anisotropy));
        #endif
        #ifdef USE_CLEARCOAT
          material.clearcoat = mix(material.clearcoat, 0.95, hzTendon);
        #endif`,
      )
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        float msAo = mix(1.0, smoothstep(0.0, 0.85, vAnat.x), uAo);
        reflectedLight.indirectDiffuse *= msAo;
        reflectedLight.indirectSpecular *= msAo;
        reflectedLight.directDiffuse *= mix(1.0, msAo, 0.55);
        reflectedLight.directSpecular *= mix(1.0, msAo, 0.45);`,
      );
  };
  // Sheath translucency by alpha-to-coverage (MSAA); colour replaces, alpha accumulates,
  // so transparent-background exports keep an opaque body.
  mat.alphaToCoverage = true;
  setCoverageBlending(mat);
  mat.userData.coverageBlend = true;
  mat.customProgramCacheKey = () => "muscle-hd2";
  mat.name = `muscle-hd:${hex}`;
  return mat;
}

/** PBR parameters of the other tissues (HD standard). */
const HD_TISSUE: Record<TissueKind, { hex: string; roughness: number; clearcoat: number; sheen: number; specular: number; anisotropy: number; opacity: number; relief: number; period: number }> = {
  bone: { hex: "#E3D6BC", roughness: 0.62, clearcoat: 0.05, sheen: 0.2, specular: 0.45, anisotropy: 0, opacity: 1, relief: 0.03e-3, period: 0.0006 },
  tendon: { hex: "#D3D0CC", roughness: 0.16, clearcoat: 0.9, sheen: 0.25, specular: 0.65, anisotropy: 0.75, opacity: 1, relief: 0.05e-3, period: 0.0007 },
  ligament: { hex: "#CFC8BD", roughness: 0.32, clearcoat: 0.55, sheen: 0.2, specular: 0.6, anisotropy: 0.6, opacity: 1, relief: 0.04e-3, period: 0.0008 },
  fascia: { hex: "#E4E1DA", roughness: 0.32, clearcoat: 0.45, sheen: 0.15, specular: 0.7, anisotropy: 0.4, opacity: 0.5, relief: 0.015e-3, period: 0.0006 },
  bursa: { hex: "#C3D5E0", roughness: 0.22, clearcoat: 0.6, sheen: 0, specular: 0.8, anisotropy: 0, opacity: 0.5, relief: 0, period: 0.001 },
  nerve: { hex: TISSUE.nerve, roughness: 0.42, clearcoat: 0.3, sheen: 0, specular: 0.5, anisotropy: 0.3, opacity: 1, relief: 0.02e-3, period: 0.0006 },
  vessel: { hex: TISSUE.vessel, roughness: 0.35, clearcoat: 0.3, sheen: 0, specular: 0.5, anisotropy: 0, opacity: 1, relief: 0, period: 0.001 },
  organ: { hex: TISSUE.organ, roughness: 0.4, clearcoat: 0.3, sheen: 0, specular: 0.5, anisotropy: 0, opacity: 1, relief: 0, period: 0.001 },
  skin: { hex: TISSUE.skin, roughness: 0.55, clearcoat: 0, sheen: 0, specular: 0.4, anisotropy: 0, opacity: 0.35, relief: 0, period: 0.001 },
  origin: { hex: TISSUE.origin, roughness: 0.55, clearcoat: 0, sheen: 0, specular: 0.4, anisotropy: 0, opacity: 1, relief: 0, period: 0.001 },
  insertion: { hex: TISSUE.insertion, roughness: 0.55, clearcoat: 0, sheen: 0, specular: 0.4, anisotropy: 0, opacity: 1, relief: 0, period: 0.001 },
};

/** Dominant direction of a mesh (principal axis), used as the collagen direction of tendons / ligaments / fasciae. */
export function principalAxis(g: BufferGeometry): Vector3 {
  const p = g.getAttribute("position");
  const c = new Vector3();
  const step = Math.max(1, Math.floor(p.count / 4000));
  let n = 0;
  for (let i = 0; i < p.count; i += step, n++) c.add(new Vector3(p.getX(i), p.getY(i), p.getZ(i)));
  c.divideScalar(Math.max(1, n));
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (let i = 0; i < p.count; i += step) {
    const x = p.getX(i) - c.x, y = p.getY(i) - c.y, z = p.getZ(i) - c.z;
    xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z;
  }
  // Power iteration for the largest eigenvector.
  const v = new Vector3(1, 0.7, 0.3).normalize();
  for (let k = 0; k < 32; k++) {
    v.set(xx * v.x + xy * v.y + xz * v.z, xy * v.x + yy * v.y + yz * v.z, xz * v.x + yz * v.y + zz * v.z);
    const l = v.length();
    if (l < 1e-12) return new Vector3(0, 1, 0);
    v.divideScalar(l);
  }
  return v;
}

/**
 * HD material for a non-muscle tissue. `axis` (object space) orients the collagen
 * striation of tendons, ligaments and fasciae; bones get porous micro-relief and
 * mottling, and their authored cartilage faces (vertex colour) turn smooth, glossy
 * and bluish-white.
 */
export function createTissueMaterialHD(t: TissueKind, opts: { vertexColors?: boolean; axis?: Vector3; seed?: Vector3 } = {}): MeshPhysicalMaterial {
  const P = HD_TISSUE[t];
  const mat = new MeshPhysicalMaterial({
    color: new Color(opts.vertexColors ? "#ffffff" : P.hex),
    vertexColors: !!opts.vertexColors,
    roughness: P.roughness,
    metalness: 0,
    clearcoat: P.clearcoat,
    clearcoatRoughness: 0.3,
    sheen: P.sheen,
    sheenRoughness: 0.5,
    sheenColor: new Color("#fff4e8"),
    specularIntensity: P.specular,
    envMapIntensity: t === "tendon" || t === "ligament" || t === "fascia" ? 1.6 : t === "bone" ? 0.8 : 1,
    side: t === "tendon" || t === "fascia" || t === "bursa" || t === "ligament" ? DoubleSide : FrontSide,
  });
  if (t === "origin" || t === "insertion") {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -2;
  }
  if (P.opacity < 1) {
    mat.transparent = true;
    mat.opacity = P.opacity;
    mat.depthWrite = false;
  }
  mat.userData.baseOpacity = P.opacity;
  mat.userData.hd = true;
  const isBone = t === "bone";
  const fibrous = P.anisotropy > 0 && !isBone;
  const uniforms = {
    uAxis: { value: (opts.axis ?? new Vector3(0, 1, 0)).clone().normalize() },
    uSeed: { value: opts.seed ?? new Vector3(1.7, 3.1, 5.3) },
    uRelief: { value: P.relief },
    uPeriod: { value: P.period },
  };
  mat.userData.hdUniforms = uniforms;
  if (P.relief === 0 && !isBone) {
    mat.name = `tissue-hd:${t}`;
    return mat;
  }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uAxis;\nvarying vec3 vObjPos;\nvarying vec3 vObjNrm;\nvarying vec3 vObjAxis;")
      .replace(
        "#include <begin_vertex>",
        // Per-mesh collagen direction: the tangent attribute (shared materials), else the uniform.
        "#include <begin_vertex>\nvObjPos = transformed; vObjNrm = objectNormal;\n#ifdef USE_TANGENT\nvObjAxis = tangent.xyz;\n#else\nvObjAxis = uAxis;\n#endif",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uAxis, uSeed;
        uniform float uRelief, uPeriod;
        varying vec3 vObjPos;
        varying vec3 vObjNrm;
        varying vec3 vObjAxis;
        ${NOISE}
        float hzH, hzK, hzCart;
        void hzTissue() {
          vec3 p = vObjPos + uSeed;
          float px = length(fwidth(vObjPos));
          float f = 1.0 / uPeriod;
          float w = 1.0 - smoothstep(0.18, 0.4, px * f);
          float mott = hzFbm(p * 40.0) - 0.5;
          hzH = 0.0; hzK = mott * 0.5;
          #if ${isBone ? 1 : 0}
            // Cortical bone: fine pores / vascular canals and gentle mottling.
            float por = w > 0.0 ? hzFbm(p * f * 0.9) - 0.5 : 0.0;
            float por2 = (1.0 - smoothstep(0.18, 0.4, px * f * 4.0)) > 0.0 ? hzValue(p * f * 3.7) - 0.5 : 0.0;
            hzH = (por * w + por2 * 0.4 * w) * uRelief;
            hzK = mott * 0.7 + por * 0.25 * w;
          #else
            vec3 F, A, N;
            hzFrame(vObjNrm, normalize(vObjAxis + 1e-6), F, A, N);
            float bF = 0.625, bM = 0.625;
            if (w > 0.0) { vec3 r = hzPhasor(p, F, A, N, uPeriod * 3.4, f, vec3(1.6, 0.75, 1.3) * uPeriod); bF = mix(0.625, hzBulge(r), w); }
            float w2 = 1.0 - smoothstep(0.18, 0.4, px * f * 3.0);
            if (w2 > 0.0) { vec3 r = hzPhasor(p + 0.53, F, A, N, uPeriod * 1.2, f * 3.0, vec3(0.55, 0.25, 0.45) * uPeriod); bM = mix(0.625, hzBulge(r), w2); }
            hzH = ((bF - 0.625) + (bM - 0.625) * 0.4) * uRelief;
            hzK = mott * 0.6 + (bF - 0.625) * 0.5;
          #endif
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        hzTissue();
        hzCart = 0.0;
        #if defined(USE_COLOR) && ${isBone ? 1 : 0}
          hzCart = smoothstep(-0.01, 0.05, vColor.b - vColor.r);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.84, 0.87), hzCart);
        #endif
        diffuseColor.rgb *= 1.0 + hzK * mix(0.22, 0.06, hzCart);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.24, hzCart);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = hzPerturb(-vViewPosition, normal, vec2(dFdx(hzH), dFdy(hzH)) * (1.0 - hzCart), faceDirection);`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoat = mix(material.clearcoat, 0.6, hzCart);
        #endif`,
      );
  };
  if (fibrous) mat.anisotropy = P.anisotropy;
  mat.customProgramCacheKey = () => `tissue-hd1:${t}:${opts.vertexColors ? 1 : 0}`;
  mat.name = `tissue-hd:${t}`;
  return mat;
}

/** Per-vertex tangents along a fixed object-space axis (anisotropic specular of collagen). */
export function axisTangents(g: BufferGeometry, axis: Vector3): void {
  const n = g.getAttribute("normal");
  if (!n) return;
  const t = new Float32Array(n.count * 4);
  const N = new Vector3(), T = new Vector3();
  for (let i = 0; i < n.count; i++) {
    N.set(n.getX(i), n.getY(i), n.getZ(i));
    T.copy(axis).addScaledVector(N, -axis.dot(N));
    if (T.lengthSq() < 1e-8) T.set(1, 0, 0).addScaledVector(N, -N.x);
    T.normalize();
    t.set([T.x, T.y, T.z, 1], i * 4);
  }
  g.setAttribute("tangent", new BufferAttribute(t, 4));
}

/** Re-colour / re-style an HD muscle material in place (selection, hover, highlight colour). */
export function setMuscleLookHD(mat: MeshPhysicalMaterial, hex: string, look: MuscleLook, hover: boolean): void {
  const u = mat.userData.msUniforms as Record<string, { value: unknown }> | undefined;
  if (!u) return;
  const color = new Color(hex);
  const { groove, light } = fibreColors(hex);
  mat.color.copy(color);
  mat.clearcoat = look.clearcoat * 1.33;
  mat.sheen = look.sheen * 0.8;
  mat.sheenColor.copy(light).lerp(new Color(1, 0.85, 0.85), 0.4);
  mat.emissive.copy(hover ? color.clone().multiplyScalar(0.25) : new Color(0, 0, 0));
  u.uTendon.value = look.tendon;
  u.uBump.value = look.bump;
  u.uStripe.value = look.stripe;
  u.uAo.value = look.ao;
  (u.uGroove.value as Color).copy(groove);
  (u.uLight.value as Color).copy(light);
}

/** Blending used with alpha-to-coverage: replace colour, accumulate alpha (opaque body on transparent backgrounds). */
export function setCoverageBlending(mat: MeshPhysicalMaterial): void {
  mat.blending = CustomBlending;
  mat.blendEquation = AddEquation;
  mat.blendSrc = OneFactor;
  mat.blendDst = ZeroFactor;
  mat.blendEquationAlpha = AddEquation;
  mat.blendSrcAlpha = OneFactor;
  mat.blendDstAlpha = OneFactor;
}
