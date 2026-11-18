import { Color, DoubleSide, FrontSide, MeshPhysicalMaterial } from "three";

/**
 * ONE visual standard for every non-muscle tissue, shared by the atlas and the
 * editor (muscles use createMuscleMaterial with the same base colour).
 * Colours are sampled from the reference écorché images / Z-Anatomy's own
 * material colours, kept natural (no white/grey recolouring of muscles).
 */
export const TISSUE = {
  muscle: "#C2575E",
  bone: "#E6DCC5",
  cartilage: "#CBD6D8",
  tendon: "#E9E2D6",
  ligament: "#DCD3C2",
  fascia: "#D9D6D0",
  bursa: "#B9CEDB",
  nerve: "#E8C94C",
  vessel: "#B5333A",
  organ: "#B87A6E",
  skin: "#E2B8A0",
  origin: "#B0203A",
  insertion: "#2F6BDB",
  dimmed: "#7A4C4E",
} as const;

export type TissueKind = "bone" | "tendon" | "ligament" | "fascia" | "bursa" | "nerve" | "vessel" | "organ" | "skin" | "origin" | "insertion";

/** Tissue kind of a Z-Anatomy structure (node extras `kind` + source name). */
export function tissueOf(kind: string | undefined, source = "", role?: string): TissueKind | null {
  switch (kind) {
    case "bone":
      return "bone";
    case "tendon":
      return "tendon";
    case "ligament":
      return "ligament";
    case "fascia":
      return /bursa|sheath/i.test(source) ? "bursa" : "fascia";
    case "nerve":
      return "nerve";
    case "vessel":
      return "vessel";
    case "organ":
      return "organ";
    case "skin":
      return "skin";
    case "attachment":
      return role === "insertion" ? "insertion" : "origin";
    default:
      return null;
  }
}

/**
 * Physically based material for one tissue kind. `vertexColors` is used by
 * bones whose articular cartilage faces (authored in Z-Anatomy) are carried
 * as vertex colours.
 */
export function createTissueMaterial(t: TissueKind, opts: { vertexColors?: boolean; hover?: boolean } = {}): MeshPhysicalMaterial {
  const hex = TISSUE[t];
  const mat = new MeshPhysicalMaterial({
    color: new Color(opts.vertexColors ? "#ffffff" : hex),
    vertexColors: !!opts.vertexColors,
    roughness: t === "bone" ? 0.62 : t === "nerve" ? 0.42 : t === "vessel" ? 0.35 : t === "skin" ? 0.55 : t === "origin" || t === "insertion" ? 0.55 : 0.34,
    metalness: 0,
    clearcoat: t === "tendon" || t === "ligament" ? 0.45 : t === "nerve" || t === "vessel" || t === "organ" ? 0.3 : t === "bone" ? 0.08 : 0,
    clearcoatRoughness: 0.35,
    sheen: t === "bone" ? 0.25 : t === "tendon" || t === "ligament" ? 0.2 : 0,
    sheenColor: new Color("#fff6e6"),
    envMapIntensity: 0.9,
    side: t === "tendon" || t === "fascia" || t === "bursa" || t === "ligament" ? DoubleSide : FrontSide,
  });
  if (t === "origin" || t === "insertion") {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -2;
  }
  const base = t === "bursa" ? 0.55 : t === "fascia" ? 0.45 : t === "skin" ? 0.35 : 1;
  if (base < 1) {
    mat.transparent = true;
    mat.opacity = base;
    mat.depthWrite = false;
  }
  mat.userData.baseOpacity = base;
  if (opts.hover) mat.emissive = new Color(hex).multiplyScalar(0.22);
  return mat;
}

/** Deterministic small tone variation so neighbouring muscles read as separate tissue. */
export function muscleTone(key: string, base: string = TISSUE.muscle): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const c = new Color(base);
  c.offsetHSL(((h % 7) - 3) * 0.004, (((h >> 3) % 5) - 2) * 0.02, (((h >> 6) % 7) - 3) * 0.01);
  return `#${c.getHexString()}`;
}
