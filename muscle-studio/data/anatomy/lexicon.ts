import catalog from "@/data/models/open-anatomy-3d/catalog.json";
import { MUSCLES } from "@/data/muscles/muscles";
import type { BodySide, LocalizedName, SystemId } from "@/types/anatomy";

/**
 * Arabic medical lexicon for every mesh structure shown in the studio, keyed
 * by mesh name without its side suffix (`lung_l` → `lung`): the separated
 * BodyParts3D muscles (via the muscle database), the non-separated muscle
 * groups, and the Open Anatomy 3D bones, organs, vessels and nerves.
 * Arabic terms follow standard Arabic anatomical usage (المعجم الطبي الموحد).
 * English names come from the upstream catalog (CC BY 4.0).
 */

export const SYSTEM_NAMES: Record<SystemId, LocalizedName> = {
  muscles: { ar: "العضلات المفصولة", en: "Separated muscles" },
  muscles_context: { ar: "عضلات أخرى غير مفصولة", en: "Other muscles (not separated)" },
  skeleton: { ar: "الهيكل العظمي", en: "Skeleton" },
  fasciae: { ar: "اللفافات والجرابات", en: "Fasciae & bursae" },
  skin: { ar: "الجلد", en: "Skin" },
  organs: { ar: "الأعضاء الداخلية", en: "Organs" },
  vessels: { ar: "الأوعية الدموية", en: "Vessels" },
  nerves: { ar: "الجهاز العصبي", en: "Nerves" },
};

export const SIDE_NAMES: Record<Exclude<BodySide, "center">, LocalizedName> = {
  left: { ar: "الجانب الأيسر", en: "left" },
  right: { ar: "الجانب الأيمن", en: "right" },
};

/** Non-separated BodyParts3D muscle groups (legacy BodyParts3D build, kept for old saved projects). */
const CONTEXT_AR: Record<string, { ar: string; en: string }> = {
  ctx_neck_other: { ar: "عضلات العنق الأخرى (الأخمعية واللامية والجلدية العنقية…)", en: "Other neck muscles" },
  ctx_shoulder_other: { ar: "العضلة تحت الكتف والمنشاريتان الخلفيتان وتحت الترقوة", en: "Subscapularis, serratus posterior, subclavius" },
  ctx_back_deep_other: { ar: "عضلات الظهر العميقة (نصف الشوكية والمدوِّرات…)", en: "Deep back muscles" },
  ctx_intercostals: { ar: "العضلات الوربية", en: "Intercostal muscles" },
  ctx_arm_other: { ar: "العضلة المرفقية", en: "Anconeus" },
  ctx_forearm_deep: { ar: "عضلات الساعد العميقة", en: "Deep forearm muscles" },
  ctx_hand: { ar: "عضلات اليد", en: "Hand muscles" },
  ctx_hip_deep: { ar: "العضلات الدوّارة العميقة للورك والسبيل الحرقفي الظنبوبي", en: "Deep hip rotators & iliotibial tract" },
  ctx_adductor_minimus: { ar: "العضلة المقرِّبة الصغرى", en: "Adductor minimus" },
  ctx_leg_deep: { ar: "عضلات الساق الخلفية العميقة والوتر العقبي", en: "Deep posterior leg muscles & calcaneal tendon" },
  ctx_leg_anterior_other: { ar: "الباسطة الطويلة لإبهام القدم والشظوية الثالثة", en: "Extensor hallucis longus & fibularis tertius" },
  ctx_foot: { ar: "عضلات القدم", en: "Foot muscles" },
  ctx_linea_alba: { ar: "الخط الأبيض", en: "Linea alba" },
  ctx_diaphragm: { ar: "الحجاب الحاجز", en: "Diaphragm" },
  ctx_pelvic_floor: { ar: "عضلات قاع الحوض", en: "Pelvic floor" },
};

const STRUCTURES_AR: Record<string, string> = {
  // الجلد
  skin: "الجلد",
  // الهيكل العظمي
  skull: "الجمجمة",
  mandible: "الفك السفلي",
  teeth: "الأسنان واللثة",
  spine_cervical: "الفقرات العنقية",
  spine_thoracic: "الفقرات الصدرية",
  spine_lumbar: "الفقرات القطنية",
  sternum: "عظم القص",
  ribs: "الأضلاع",
  clavicle: "الترقوة",
  scapula: "لوح الكتف",
  humerus: "عظم العضد",
  forearm: "عظما الساعد (الكعبرة والزند)",
  hand: "عظام اليد",
  pelvis: "الحوض والعجز",
  femur: "عظم الفخذ",
  patella: "الرضفة (صابونة الركبة)",
  lower_leg: "عظما الساق (الظنبوب والشظية)",
  foot: "عظام القدم",
  // الأعضاء
  brain: "الدماغ",
  brainstem: "جذع الدماغ",
  cerebellum: "المخيخ",
  pituitary: "الغدة النخامية",
  eye: "العين",
  tongue: "اللسان",
  salivary_glands: "الغدد اللعابية",
  pharynx: "البلعوم",
  larynx: "الحنجرة",
  trachea: "الرُّغامى (القصبة الهوائية)",
  bronchi: "القصبات الهوائية",
  lung: "الرئة",
  thymus: "الغدة الزعترية",
  heart: "القلب",
  breast: "الثدي",
  esophagus: "المريء",
  stomach: "المعدة",
  liver: "الكبد",
  gallbladder: "المرارة والقنوات الصفراوية",
  pancreas: "البنكرياس (المعثكلة)",
  spleen: "الطحال",
  small_intestine: "الأمعاء الدقيقة",
  colon: "الأمعاء الغليظة (القولون)",
  appendix: "الزائدة الدودية",
  adrenal: "الغدة الكظرية",
  kidney: "الكلية",
  ureter: "الحالب",
  bladder: "المثانة البولية",
  prostate: "غدة البروستاتا",
  reproductive: "الأعضاء التناسلية الذكرية",
  uterus: "الرحم",
  ovary: "المبيض",
  fallopian_tubes: "قناتا فالوب",
  vagina: "المهبل",
  // الأوعية
  aorta: "الشريان الأبهر",
  coronary_arteries: "الشرايين التاجية",
  carotid: "الشريان السباتي",
  pulmonary_vessels: "الأوعية الرئوية",
  vena_cava_superior: "الوريد الأجوف العلوي",
  vena_cava_inferior: "الوريد الأجوف السفلي",
  arteries_head: "شرايين الرأس والعنق",
  arteries_thorax: "شرايين الصدر",
  arteries_abdomen: "شرايين البطن",
  arteries_pelvis: "شرايين الحوض",
  arteries_arm: "شرايين الطرف العلوي",
  arteries_leg: "شرايين الطرف السفلي",
  veins_thorax: "أوردة الصدر",
  veins_abdomen: "أوردة البطن",
  veins_pelvis: "أوردة الحوض",
  veins_arm: "أوردة الطرف العلوي",
  veins_leg: "أوردة الطرف السفلي",
  // الأعصاب
  spinal_cord: "الحبل الشوكي",
  cranial_nerves: "الأعصاب القحفية والبصرية",
};

interface CatalogEntry {
  key: string;
  label: string;
  system: string;
}

const CATALOG = catalog as CatalogEntry[];
const CATALOG_BY_KEY = new Map(CATALOG.map((c) => [c.key, c]));

/** Muscle mesh base key (e.g. "chest_muscles") → muscle id. */
const MUSCLE_BY_MESH_BASE = new Map<string, string>();
for (const m of MUSCLES) for (const base of m.meshNames) MUSCLE_BY_MESH_BASE.set(base, m.id);

export function splitSide(key: string): { base: string; side: BodySide } {
  const m = /^(.*)_(l|r)$/.exec(key);
  if (!m) return { base: key, side: "center" };
  return { base: m[1], side: m[2] === "l" ? "left" : "right" };
}

export interface StructureName {
  ar: string;
  en: string;
  side: BodySide;
  system: SystemId | null;
  muscleId: string | null;
}

/**
 * Bilingual display name for a mesh/catalog key such as `femur_l`.
 * Returns null for keys unknown to both the lexicon and the muscle database.
 */
export function structureName(key: string): StructureName | null {
  const { base, side } = splitSide(key);
  const ctx = CONTEXT_AR[base];
  if (ctx) return { ar: ctx.ar, en: ctx.en, side, system: "muscles_context", muscleId: null };
  const entry = CATALOG_BY_KEY.get(key);
  const muscleId = MUSCLE_BY_MESH_BASE.get(base) ?? null;
  const muscle = muscleId ? MUSCLES.find((m) => m.id === muscleId) : undefined;
  const ar = muscle?.displayName.ar ?? STRUCTURES_AR[base];
  if (!ar) return null;
  const en = muscle?.displayName.en ?? entry?.label.replace(/\s*\((L|R)\)$/, "") ?? base;
  return {
    ar,
    en,
    side,
    system: (entry?.system as SystemId | undefined) ?? (muscle ? "muscles" : null),
    muscleId,
  };
}

export function withSide(name: string, side: BodySide): string {
  return side === "center" ? name : `${name} — ${SIDE_NAMES[side].ar}`;
}

/** Catalog keys of mesh structures (joints are hotspots, not meshes). */
export const MESH_STRUCTURE_KEYS: string[] = CATALOG.filter((c) => c.system !== "joints").map((c) => c.key);
