import type { RegionLayer } from "@/data/region/backShoulders";

/**
 * The body the atlas shows.
 *  - "ecorche": the Écorché Male & Female model (purchased licence): sculpted muscles
 *    with their own painted textures and normal maps, real male and female shapes.
 *    Only its compressed web build is in this project (pipeline/ecorche/build.mjs);
 *    the original files are never published.
 *  - "zanatomy": the open Z-Anatomy body the atlas used before.
 * `?model=zanatomy` / `?model=ecorche` chooses one for a visit.
 */
export type ModelId = "zanatomy" | "ecorche";

/** The body shown when the address names none. */
export const DEFAULT_MODEL: ModelId = "zanatomy";

export interface ModelProfile {
  id: ModelId;
  /** Folder of the model files under /public. */
  base: string;
  /** The part loaded first, on large screens and on phones. */
  core: { full: string; lite: string };
  /** Further parts of the body itself, loaded right after the core (deep muscles). */
  also: string[];
  /** Base colour of muscles drawn with the atlas's own muscle material (no texture). */
  muscleBase?: string;
  /** Layers kept in files of their own, loaded the first time they are shown. */
  lazy: Partial<Record<RegionLayer, string>>;
  /** Whether the lazy parts have a lighter phone build too (`<part>-lite`). */
  lazyLite: boolean;
  /** Layers of the layer list, in order, with what is shown when the atlas opens. */
  layers: RegionLayer[];
  defaults: Record<RegionLayer, boolean>;
  /** Layer names that differ from the common ones. */
  layerNames: Partial<Record<RegionLayer, string>>;
  /** The body has deep muscle layers to peel (the depth control). */
  depth: boolean;
  /** A selected deep muscle is shown through the muscles over it (they turn into a ghost). */
  ghostOver: boolean;
  /**
   * While a muscle is selected the other muscles keep their own colours (true), or step
   * back into neutral tones so the accent is the only strong colour (false).
   */
  keepColours: boolean;
  /** Colour a selected muscle takes when the visit has chosen none (default: the brand accent). */
  accent?: string;
  /** The body has origin / insertion patches. */
  attachments: boolean;
  /** Textured model: its own materials are used. */
  textured: boolean;
  /** Line under the controls. */
  credit: string;
}

const OFF: Record<RegionLayer, boolean> = { muscles: false, tendons: false, bones: false, fasciae: false, attachments: false, nerves: false, fat: false, vessels: false, skin: false };

export const PROFILES: Record<ModelId, ModelProfile> = {
  zanatomy: {
    id: "zanatomy",
    base: "/models/zanatomy",
    core: { full: "core-smooth", lite: "core-lite" },
    also: [],
    lazy: { attachments: "attachments", nerves: "nerves" },
    lazyLite: false,
    layers: ["muscles", "tendons", "bones", "fasciae", "attachments", "nerves"],
    defaults: { ...OFF, muscles: true, tendons: true, bones: true },
    layerNames: {},
    depth: true,
    ghostOver: false,
    keepColours: false,
    attachments: true,
    textured: false,
    credit: "المجسم: Z-Anatomy · CC BY-SA 4.0",
  },
  ecorche: {
    id: "ecorche",
    base: "/models/ecorche",
    core: { full: "core", lite: "core-lite" },
    // deep muscles: the Écorché model has none; they come from Z-Anatomy, fitted into this
    // body (pipeline/ecorche/deep.mjs), and are drawn in the colour of its muscles
    also: ["deep"],
    muscleBase: "#8E3B2C",
    lazy: { bones: "bones", fat: "fat", vessels: "vessels", skin: "skin" },
    lazyLite: true,
    // muscles (with their tendons, the cartilages and the eyes) are what opens;
    // bones, fat, vessels and skin are layers to switch on
    layers: ["muscles", "tendons", "bones", "fat", "vessels", "skin"],
    defaults: { ...OFF, muscles: true, tendons: true, fasciae: true },
    layerNames: { tendons: "الأوتار والغضاريف", bones: "العظام" },
    depth: true,
    // the superficial muscles of this body are thick solids: a deep muscle is inside them
    ghostOver: true,
    // the body stays as it is; the selected muscle turns deep red
    keepColours: true,
    accent: "#A5111F",
    attachments: false,
    textured: true,
    credit: "المجسم: Écorché Male & Female (نسخة مرخصة) · العضلات العميقة: Z-Anatomy، CC BY-SA 4.0",
  },
};

/** The body asked for in the address, or the default one. */
export function currentModel(): ModelId {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  const q = new URLSearchParams(window.location.search).get("model");
  return q === "ecorche" || q === "zanatomy" ? q : DEFAULT_MODEL;
}
export const currentProfile = (): ModelProfile => PROFILES[currentModel()];
