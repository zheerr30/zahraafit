/**
 * Core anatomical domain types. These are rendering-agnostic: nothing here
 * imports Three.js so the data layer can be tested and reused independently.
 */

export const REGIONS = ["neck", "shoulders", "chest", "back", "arms", "core", "hips", "legs"] as const;
export type RegionId = (typeof REGIONS)[number];

export const VIEWS = ["front", "back", "left", "right"] as const;
export type ViewId = (typeof VIEWS)[number];

export type Gender = "male" | "female";

/** Body systems as grouped in the Open Anatomy 3D models (top-level glTF nodes). */
export const SYSTEMS = ["muscles", "skeleton", "skin", "organs", "vessels", "nerves"] as const;
export type SystemId = (typeof SYSTEMS)[number];

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
  /** Arabic medical name (primary) and English name. */
  displayName: LocalizedName;
  /** Latin (Terminologia Anatomica) name of the structure or group. */
  latin: string;
  region: RegionId;
  /**
   * "single": the mesh is one anatomical muscle.
   * "group": the mesh merges several muscles that cannot be selected separately.
   */
  granularity: "single" | "group";
  /** The individual muscles merged into this mesh, per the model's build rules. */
  includes: LocalizedName[];
  /** Canonical mesh names in the asset (side suffix omitted). Used for mesh mapping. */
  meshNames: string[];
  /** Exact alternative names used for mesh mapping. Must not collide between muscles. */
  aliases: string[];
  /** Informal search words (Arabic gym terms etc.). Search only — never used for mapping. */
  searchTerms: string[];
  /** Views in which the structure is meaningfully visible from outside. */
  viewAvailability: ViewId[];
  defaultMaterial: MaterialPreset;
  /** Superficial structures are visible on the outer layer; deep ones are mostly occluded. */
  depth: "superficial" | "deep";
  /** Optional Arabic note shown in the library (e.g. limitations of the model). */
  note?: string;
}

export interface RegionDefinition {
  id: RegionId;
  displayName: LocalizedName;
}

export type AssetLayer = "full-body" | "superficial" | "deep";

export interface AssetAttribution {
  /** Exact credit line required by the licence. */
  credit: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

export interface AnatomyAssetDefinition {
  id: string;
  label: string;
  gender: Gender | "neutral";
  layer: AssetLayer;
  /** Public URL of the GLB/GLTF file (served from /public/models). */
  url: string;
  /** Views this asset can be used for. */
  views: ViewId[];
  /** Lower number wins when several assets cover the same gender + view. */
  priority: number;
  /** Euler rotation (radians) applied to orient the model upright facing +Z. */
  rotation?: [number, number, number];
  /** Model-specific mesh name → muscle id overrides (exact mesh names). */
  meshMap?: Record<string, string>;
  /** Mesh names that should be treated as non-muscle structures. */
  ignoreMeshes?: string[];
  /** True when the asset groups meshes by body system (muscles/skeleton/…). */
  hasSystems?: boolean;
  attribution?: AssetAttribution;
}
