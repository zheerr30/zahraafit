import { Color, type MeshStandardMaterial, type Texture } from "three";

/**
 * Look of a textured model part (the Écorché model: its own base colour, normal and
 * occlusion-roughness maps are used as they are).
 *
 * Selection and the neutral "others" state are done on top of the texture, not instead
 * of it — the painted fibres, tendons and shading stay visible:
 *  - tint: the surface takes the accent colour, modulated by the texture's own light
 *    and dark;
 *  - quiet: most of the colour is taken out, towards a warm neutral.
 */
export interface TexturedLook {
  /** Accent colour (hex), or null for the part's own colours. */
  tint: string | null;
  /** Neutral state: shown while another muscle is selected. */
  quiet: boolean;
  hover: boolean;
}

const NEUTRAL = new Color("#B9ADA3");
type Uniforms = { uTint: { value: Color }; uTintAmt: { value: number }; uQuiet: { value: number }; uNeutral: { value: Color } };

/** One material per mesh (textures stay shared), with the tint / quiet controls. */
export function createTexturedMaterial(src: MeshStandardMaterial, anisotropy = 1): MeshStandardMaterial {
  const mat = src.clone();
  for (const t of [mat.map, mat.normalMap, mat.roughnessMap, mat.aoMap] as (Texture | null)[]) {
    if (t && t.anisotropy !== anisotropy) {
      t.anisotropy = anisotropy; // sharp fibres at grazing angles
      t.needsUpdate = true;
    }
  }
  const uniforms: Uniforms = { uTint: { value: new Color(1, 1, 1) }, uTintAmt: { value: 0 }, uQuiet: { value: 0 }, uNeutral: { value: NEUTRAL.clone() } };
  mat.userData.txUniforms = uniforms;
  mat.userData.textured = true;
  mat.userData.baseOpacity = 1;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uTint, uNeutral;\nuniform float uTintAmt, uQuiet;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        {
          float txL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = mix(diffuseColor.rgb, uNeutral * (0.5 + 1.9 * txL), uQuiet);
          diffuseColor.rgb = mix(diffuseColor.rgb, uTint * (0.7 + 1.2 * txL), uTintAmt);
        }`,
      );
  };
  mat.customProgramCacheKey = () => "textured-look-1";
  return mat;
}

/** How strongly the accent replaces the texture's colour (its light and dark stay). */
const TINT = 0.88;

export function setTexturedLook(mat: MeshStandardMaterial, look: TexturedLook): void {
  const u = mat.userData.txUniforms as Uniforms | undefined;
  if (!u) return;
  if (look.tint) u.uTint.value.set(look.tint);
  u.uTintAmt.value = look.tint ? TINT : 0;
  u.uQuiet.value = look.tint ? 0 : look.quiet ? 0.82 : 0;
  // the colour the part shows (tests and tools read it; the material's own colour stays white)
  mat.userData.lookHex = look.tint ? look.tint.toLowerCase() : look.quiet ? "quiet" : "own";
  const glow = look.tint ? 0.1 : 0;
  if (look.tint) mat.emissive.set(look.tint).multiplyScalar(glow + (look.hover ? 0.12 : 0));
  else mat.emissive.setScalar(look.hover ? 0.07 : 0);
}
