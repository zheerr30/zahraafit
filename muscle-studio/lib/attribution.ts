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

/** Credit line required by BodyParts3D (verbatim from its README, 2025-02-25). */
export const BODYPARTS3D_CREDIT =
  "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International";

/** Full credit for the assets shown in the studio. */
export const STUDIO_ANATOMY_CREDIT =
  `Muscles: ${BODYPARTS3D_CREDIT} — separated, simplified and (female) reshaped by MUSCLE STUDIO 3D. ` +
  `Body systems and female shape: ${"open-anatomy-3d (https://github.com/MervinR07/open-anatomy-3d), CC BY 4.0"}, ` +
  "built from BodyParts3D, Human Reference Atlas 3D Reference Organs (HuBMAP, CC BY 4.0) and MakeHuman (CC0).";

/** Short credit used on exported images, where space is limited. */
export const OPEN_ANATOMY_SHORT_CREDIT =
  "Anatomy: BodyParts3D © DBCLS (CC BY 4.0) · open-anatomy-3d · HuBMAP HRA · MakeHuman";

export const OPEN_ANATOMY_ATTRIBUTION: AssetAttribution = {
  credit: STUDIO_ANATOMY_CREDIT,
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  sourceUrl: "https://github.com/MervinR07/open-anatomy-3d",
};

/** Upstream commit the bundled files were copied from (see data/models/open-anatomy-3d/SOURCE_COMMIT). */
export const OPEN_ANATOMY_COMMIT = "c050aa7b1bc56ceed668199b01ea017341928d7b";

/** Phase 1 region model (back & shoulders): Z-Anatomy, share-alike. */
export const ZANATOMY_CREDIT =
  "Z-Anatomy models (Gauthier Kervyn / Z-Anatomy, CC BY-SA 4.0), based on BodyParts3D © DBCLS. " +
  "Region extract, subdivision and appearance data by MUSCLE STUDIO 3D, CC BY-SA 4.0.";

export const SOURCES = [
  {
    name: "Z-Anatomy",
    owner: "Gauthier Kervyn / Z-Anatomy (تطبيق Lluís Vinent Juanico) — مبني على BodyParts3D",
    license: "CC BY-SA 4.0",
    url: "https://github.com/Z-Anatomy/Models-of-human-anatomy",
    usage:
      "نموذج الظهر والكتفين: مصدَّر من ملف Blender الأصلي دون تعديل الهندسة — العضلات المفصولة وأوتارها المرسومة والعظام ومواضع المنشأ والمرتكز والأربطة والأعصاب، مع معرّفات TA2 والأسماء اللاتينية والتسلسل التشريحي. الملف المشتق back-shoulders-za.glb مرخّص CC BY-SA 4.0 (شرط المشاركة بالمثل). التعريفات الإنجليزية من Wikipedia (CC BY-SA 3.0).",
  },
  {
    name: "BodyParts3D 4.0",
    owner: "© The Database Center for Life Science (DBCLS)",
    license: "CC BY 4.0",
    url: "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/",
    usage:
      "المصدر الأساسي: العضلات المفصولة (51 وحدة لكل جانب) والعضلات الأخرى، استُخرجت مباشرة من ملفات OBJ الأصلية، ومنها أيضًا العظام والأعضاء والأوعية في النموذجين.",
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
    usage:
      "الجسم المرجعي (العظام والجلد والأعضاء والأوعية والأعصاب)، ونِسَب الهيكل العظمي الأنثوي التي لُوئمت معها العضلات المفصولة. يُستخدم ملفاه الأصليان دون تعديل.",
  },
] as const;
