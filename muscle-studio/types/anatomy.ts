/**
 * Core anatomical domain types. These are rendering-agnostic: nothing here
 * imports Three.js so the data layer can be tested and reused independently.
 */

export const REGIONS = ["neck", "shoulders", "chest", "back", "arms", "core", "hips", "thigh", "leg"] as const;
export type RegionId = (typeof REGIONS)[number];

export const VIEWS = ["front", "back", "left", "right"] as const;
export type ViewId = (typeof VIEWS)[number];

export type Gender = "male" | "female";

/**
 * Body systems = top-level glTF nodes. "muscles" holds the separately
 * selectable BodyParts3D muscles; "muscles_context" the remaining BodyParts3D
 * muscles (not separated); the rest come from the Open Anatomy 3D body.
 */
export const SYSTEMS = ["muscles", "muscles_context", "skeleton", "fasciae", "skin", "organs", "vessels", "nerves"] as const;
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
   * "single": one whole anatomical muscle (its heads merged, if any).
   * "part": a named part of a muscle (e.g. clavicular part of deltoid).
   * "group": several neighbouring muscles merged into one mesh.
   */
  granularity: "single" | "part" | "group";
  /** The BodyParts3D structures merged into this mesh. */
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
  /** Optional GLB holding the separated muscles; it replaces the body's own "muscles" node. */
  musclesUrl?: string;
  /** Optional system files (nerves, organs, vessels, skin), loaded when their layer is shown. */
  layerUrls?: Partial<Record<"nerves" | "organs" | "vessels" | "skin", string>>;
  /** Model-specific mesh name → muscle id overrides (exact mesh names). */
  meshMap?: Record<string, string>;
  /** Mesh names that should be treated as non-muscle structures. */
  ignoreMeshes?: string[];
  /** True when the asset groups meshes by body system (muscles/skeleton/…). */
  hasSystems?: boolean;
  attribution?: AssetAttribution;
}
