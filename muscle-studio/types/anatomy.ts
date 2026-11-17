/**
 * Core anatomical domain types. These are rendering-agnostic: nothing here
 * imports Three.js so the data layer can be tested and reused independently.
 */

export const REGIONS = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "glutes",
  "legs",
] as const;
export type RegionId = (typeof REGIONS)[number];

export const VIEWS = ["front", "back", "left", "right"] as const;
export type ViewId = (typeof VIEWS)[number];

export type Gender = "male" | "female";

/** Which side of the body a mesh belongs to (from the model's perspective). */
export type BodySide = "left" | "right" | "center";

export type MaterialPreset = "muscle" | "tendon" | "fascia";

export interface LocalizedName {
  en: string;
  ar: string;
}

export interface MuscleDefinition {
  /** Stable, kebab-case identifier. Never change once projects reference it. */
  id: string;
  displayName: LocalizedName;
  region: RegionId;
  /** Canonical mesh names expected in conforming GLB assets (side suffix omitted). */
  meshNames: string[];
  /** Additional names/spellings (English, Latin, Arabic, slang) used for mapping and search. */
  aliases: string[];
  /** Views in which the muscle is meaningfully visible. */
  viewAvailability: ViewId[];
  defaultMaterial: MaterialPreset;
  /** Superficial muscles are visible on the outer layer; deep ones may be occluded. */
  depth: "superficial" | "deep";
}

export interface RegionDefinition {
  id: RegionId;
  displayName: LocalizedName;
}

export type AssetLayer = "superficial" | "deep" | "diagnostic";

export interface AnatomyAssetDefinition {
  id: string;
  label: string;
  gender: Gender | "neutral";
  layer: AssetLayer;
  /** Public URL of the GLB/GLTF file (served from /public/models). */
  url: string;
  /** Views this asset can be used for. Front/back-only assets are supported. */
  views: ViewId[];
  /** Lower number wins when several assets cover the same gender + view. */
  priority: number;
  /** Euler rotation (radians) applied to orient the model upright facing +Z. */
  rotation?: [number, number, number];
  /** Model-specific mesh name → muscle id overrides (exact mesh names). */
  meshMap?: Record<string, string>;
  /** Mesh names (normalized) that should be treated as non-muscle structures. */
  ignoreMeshes?: string[];
  /** Diagnostic assets are explicitly NOT anatomical and must be labeled as such. */
  diagnostic?: boolean;
  license?: string;
  attribution?: string;
}
