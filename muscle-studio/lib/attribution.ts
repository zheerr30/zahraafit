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
  "Anatomy: Z-Anatomy (CC BY-SA 4.0) · BodyParts3D © DBCLS · female proportions: open-anatomy-3d";

export const ZANATOMY_ATTRIBUTION: AssetAttribution = {
  credit:
    "Z-Anatomy — The libre 3D atlas of anatomy (Gauthier Kervyn et al.), CC BY-SA 4.0, based on BodyParts3D © DBCLS. " +
    "Female variant: skeletal proportions from open-anatomy-3d (CC BY 4.0).",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  sourceUrl: "https://github.com/Z-Anatomy/Models-of-human-anatomy",
};

export const OPEN_ANATOMY_ATTRIBUTION: AssetAttribution = {
  credit: STUDIO_ANATOMY_CREDIT,
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  sourceUrl: "https://github.com/MervinR07/open-anatomy-3d",
};

/** Upstream commit the bundled files were copied from (see data/models/open-anatomy-3d/SOURCE_COMMIT). */
export const OPEN_ANATOMY_COMMIT = "c050aa7b1bc56ceed668199b01ea017341928d7b";

/** The anatomical model of the whole app: Z-Anatomy, share-alike. */
export const ZANATOMY_CREDIT =
  "Z-Anatomy — The libre 3D atlas of anatomy — CC-BY-SA 4.0 (Gauthier Kervyn, Marcin Zielinski, Lluis Vinent), " +
  "based on BodyParts3D — The Database Center for Life Science. Exported and prepared for the web by MUSCLE STUDIO 3D, CC BY-SA 4.0.";

export const SOURCES = [
  {
    name: "Z-Anatomy",
    owner: "Gauthier Kervyn / Z-Anatomy (Marcin Zielinski, Lluis Vinent) — built on BodyParts3D",
    license: "CC BY-SA 4.0",
    url: "https://github.com/Z-Anatomy/Models-of-human-anatomy",
    usage:
      "النموذج التشريحي للتطبيق كله (الأطلس والمحرّر، ذكر وأنثى): مصدَّر من ملف Blender الأصلي دون تعديل الهندسة — كل عضلة مستقلة بأوتارها المرسومة، والعظام والغضاريف، والأربطة، واللفافات، ومواضع المنشأ والمرتكز، والأعصاب، والأعضاء، والأوعية، والجلد، مع معرّفات TA2 والأسماء اللاتينية والتسلسل التشريحي. ملفات public/models/zanatomy مرخّصة CC BY-SA 4.0 (شرط المشاركة بالمثل). التعريفات الإنجليزية من Wikipedia (CC BY-SA 3.0).",
  },
  {
    name: "BodyParts3D 4.0",
    owner: "© The Database Center for Life Science (DBCLS)",
    license: "CC BY 4.0",
    url: "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/",
    usage: "النموذج الأصلي الذي بُني عليه Z-Anatomy.",
  },
  {
    name: "open-anatomy-3d",
    owner: "MervinR07 (female body from MakeHuman, CC0)",
    license: "CC BY 4.0",
    url: "https://github.com/MervinR07/open-anatomy-3d",
    usage:
      "نِسَب الهيكل العظمي الأنثوي فقط: يُلاءم تشريح Z-Anatomy مع هيكله الأنثوي بتحويل Thin-Plate Spline لإنتاج النموذج الأنثوي (تقريب). ملفاته لا تُعرض في التطبيق.",
  },
] as const;
