import type { BodySide } from "@/types/anatomy";

const LEFT_TOKENS = new Set(["l", "left", "lt", "sinister", "sin"]);
const RIGHT_TOKENS = new Set(["r", "right", "rt", "dexter", "dex"]);
/** Filler words that do not change identity ("Biceps_Brachii_Muscle" == "Biceps Brachii"). */
const NOISE_TOKENS = new Set(["muscle", "muscles", "mesh", "geo", "geometry", "m", "mus"]);

export interface NormalizedMeshName {
  /** Canonical comparison key: lowercase words separated by single spaces. */
  key: string;
  side: BodySide;
}

/**
 * Normalize an arbitrary mesh name into a comparison key + body side.
 *
 * Handles: snake_case, kebab-case, dotted Blender suffixes (".L", ".001"),
 * camelCase/PascalCase, "Left"/"Right" prefixes or suffixes, and filler words.
 *
 *   "Pectoralis_Major_L"      → { key: "pectoralis major", side: "left" }
 *   "pectoralis-major.R.001"  → { key: "pectoralis major", side: "right" }
 *   "LatissimusDorsi_Left"    → { key: "latissimus dorsi", side: "left" }
 *   "Right Biceps Brachii"    → { key: "biceps brachii",   side: "right" }
 */
export function normalizeMeshName(raw: string): NormalizedMeshName {
  const spaced = raw
    // GLTF exporters often replace spaces with underscores and append ".001"-style suffixes.
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim();

  const tokens = spaced
    .split(" ")
    .filter(Boolean)
    // Sanitized Blender suffixes fuse side and index: "l001" → "l", "001".
    .flatMap((t) => (/^[lr]\d+$/.test(t) ? [t[0], t.slice(1)] : [t]));
  let side: BodySide = "center";

  // Strip trailing numeric suffixes like "001".
  while (tokens.length > 1 && /^\d+$/.test(tokens[tokens.length - 1])) tokens.pop();

  // Side tokens may appear at either end.
  const takeSide = (token: string | undefined): boolean => {
    if (token === undefined) return false;
    if (LEFT_TOKENS.has(token)) side = "left";
    else if (RIGHT_TOKENS.has(token)) side = "right";
    else return false;
    return true;
  };
  if (tokens.length > 1 && takeSide(tokens[tokens.length - 1])) tokens.pop();
  while (tokens.length > 1 && /^\d+$/.test(tokens[tokens.length - 1])) tokens.pop();
  if (tokens.length > 1 && takeSide(tokens[0])) tokens.shift();

  const key = tokens.filter((t) => !NOISE_TOKENS.has(t)).join(" ");
  return { key: key || tokens.join(" "), side };
}

/** Normalize a free-text name (alias, display name, id) to the same key space. */
export function normalizeKey(raw: string): string {
  return normalizeMeshName(raw).key;
}

const ARABIC_DIACRITICS = /[ً-ٰٟـ]/g;

/** Arabic short-vowel marks and shadda (tashkeel). The interface shows Arabic without them. */
const TASHKEEL = /[\u064B-\u0652\u0670]/g;

/** Arabic text as the interface shows it: without diacritics (names read from the model files carry some). */
export function plainArabic(text: string): string {
  return text.replace(TASHKEEL, "");
}

/**
 * Normalize text for bilingual search: case-folds Latin, removes Arabic
 * diacritics/tatweel and unifies common Arabic letter variants.
 */
export function normalizeSearchText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
