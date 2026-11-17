import type { AssetAttribution } from "@/types/anatomy";

/**
 * Attribution for the Open Anatomy 3D models and catalog (CC BY 4.0).
 * The credit line is reproduced verbatim from the upstream ATTRIBUTION.md and
 * must stay visible wherever the models or renders of them are shown.
 */
export const OPEN_ANATOMY_CREDIT =
  "Anatomy: BodyParts3D © The Database Center for Life Science (CC BY 4.0); " +
  "female organs: Human Reference Atlas 3D Reference Organs, HuBMAP (CC BY 4.0); " +
  "female body: MakeHuman (CC0). Modified by open-anatomy-3d " +
  "(https://github.com/MervinR07/open-anatomy-3d), CC BY 4.0.";

/** Short credit used on exported images, where space is limited. */
export const OPEN_ANATOMY_SHORT_CREDIT =
  "Anatomy: BodyParts3D © DBCLS · HuBMAP HRA · MakeHuman — via open-anatomy-3d · CC BY 4.0";

export const OPEN_ANATOMY_ATTRIBUTION: AssetAttribution = {
  credit: OPEN_ANATOMY_CREDIT,
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  sourceUrl: "https://github.com/MervinR07/open-anatomy-3d",
};

/** Upstream commit the bundled files were copied from (see data/models/open-anatomy-3d/SOURCE_COMMIT). */
export const OPEN_ANATOMY_COMMIT = "c050aa7b1bc56ceed668199b01ea017341928d7b";

export const SOURCES = [
  {
    name: "BodyParts3D 4.0",
    owner: "© The Database Center for Life Science (DBCLS)",
    license: "CC BY 4.0",
    url: "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/",
    usage: "التشريح في النموذجين: العضلات والعظام والأعضاء والأوعية والأعصاب.",
  },
  {
    name: "Human Reference Atlas — 3D Reference Organ Set (united female v1.10)",
    owner: "HuBMAP / CNS, Indiana University",
    license: "CC BY 4.0",
    url: "https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/",
    usage: "الأعضاء الأنثوية الخاصة في النموذج الأنثوي.",
  },
  {
    name: "MakeHuman (hm08 base mesh)",
    owner: "MakeHuman community",
    license: "CC0 1.0",
    url: "https://github.com/makehumancommunity/makehuman",
    usage: "سطح جسم النموذج الأنثوي.",
  },
  {
    name: "open-anatomy-3d",
    owner: "MervinR07",
    license: "النماذج والفهرس: CC BY 4.0 · الكود: MIT",
    url: "https://github.com/MervinR07/open-anatomy-3d",
    usage: "إعداد النموذجين وفهرس البنى التشريحية. يُستخدم الملفان الأصليان دون تعديل.",
  },
] as const;
