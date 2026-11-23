import { Color, SRGBColorSpace } from "three";

/**
 * Colours of the muscles on the model.
 *
 * Calm, natural tissue tones instead of one saturated red: each muscle gets its own
 * tone around the base (a few degrees of hue, a little saturation and lightness), so
 * neighbouring muscles read as separate structures; deeper layers are slightly darker
 * and duller, as they are in a dissection. The variation is deterministic — the same
 * muscle has the same tone on every device and in both bodies.
 */

/** Base tone of skeletal muscle: a muted terracotta (not the saturated red of older plates). */
export const MUSCLE_BASE = "#A26259";

/** The face is not the subject of a training atlas: its muscles sit close to this quiet clay tone. */
const FACE_TONE = "#B5A69C";

const NEUTRAL_HUE = 0.07;

function hash(key: string): number {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}
/** -1 … 1 from one byte of the hash. */
const part = (h: number, k: number) => (((h >>> (k * 8)) & 255) / 127.5) - 1;

export interface MuscleTones {
  /** The muscle's own colour. */
  base: string;
  /** The same muscle in a neutral tone: shown while another muscle is selected. */
  neutral: string;
}

export function muscleTones(id: string, opts: { depth?: 1 | 2 | 3; face?: boolean; base?: string } = {}): MuscleTones {
  const h = hash(id);
  const c = new Color(opts.base ?? MUSCLE_BASE);
  const depth = opts.depth ?? 1;
  // hue, saturation and lightness as seen (sRGB), not of the linear working values
  const o = { h: 0, s: 0, l: 0 };
  c.getHSL(o, SRGBColorSpace);
  c.setHSL(
    (o.h + part(h, 0) * 0.012 + 1) % 1,
    Math.min(1, Math.max(0, o.s + part(h, 1) * 0.045 - (depth - 1) * 0.02)),
    Math.min(1, Math.max(0, o.l + part(h, 2) * 0.045 - (depth - 1) * 0.02)),
    SRGBColorSpace,
  );
  if (opts.face) c.lerp(new Color(FACE_TONE), 0.72);
  return { base: `#${c.getHexString()}`, neutral: neutralTone(c) };
}

/**
 * A muscle's neutral tone: most of its colour taken out, a little lighter — a warm
 * grey that still shows the muscle's shape and fibres, against which the selection
 * accent stands out.
 */
export function neutralTone(color: Color | string): string {
  const c = new Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl, SRGBColorSpace);
  // (the little colour that stays is warm — a taupe, not the mauve a greyed red turns into)
  c.setHSL(NEUTRAL_HUE, hsl.s * 0.32, Math.min(0.76, hsl.l * 0.94 + 0.1), SRGBColorSpace);
  return `#${c.getHexString()}`;
}
