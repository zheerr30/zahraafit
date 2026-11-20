import type { LocalizedName, MuscleDefinition, RegionDefinition, RegionId, ViewId } from "@/types/anatomy";

/**
 * Selectable muscle units — one mesh per side, extracted from BodyParts3D 4.0
 * by pipeline/bodyparts3d (see units.mjs there for the exact source parts).
 *
 * - `id` is the stable key stored in projects. Never rename an id.
 * - `meshNames[0]` is the node name in public/models/zanatomy/<sex>/core.glb
 *   (`_l` / `_r` suffix per side); pipeline/zanatomy/editor-units.mjs lists
 *   the Z-Anatomy muscle objects of each unit.
 * - Arabic names follow standard Arabic anatomical terminology
 *   (المعجم الطبي الموحد and common Arabic anatomy references).
 *
 * Every other Z-Anatomy muscle (≈ 180 more) is selectable in the atlas (/atlas)
 * and shown here as reference anatomy.
 */

export const REGION_DEFINITIONS: RegionDefinition[] = [
  { id: "neck", displayName: { ar: "العنق", en: "Neck" } },
  { id: "shoulders", displayName: { ar: "الكتف", en: "Shoulder" } },
  { id: "chest", displayName: { ar: "الصدر", en: "Chest" } },
  { id: "back", displayName: { ar: "الظهر", en: "Back" } },
  { id: "arms", displayName: { ar: "العضد والساعد", en: "Arm & forearm" } },
  { id: "core", displayName: { ar: "البطن", en: "Abdomen" } },
  { id: "hips", displayName: { ar: "الورك والأرداف", en: "Hip & gluteal" } },
  { id: "thigh", displayName: { ar: "الفخذ", en: "Thigh" } },
  { id: "leg", displayName: { ar: "الساق", en: "Leg" } },
];

const n = (ar: string, en: string): LocalizedName => ({ ar, en });

const ALL: ViewId[] = ["front", "back", "left", "right"];
const FRONT: ViewId[] = ["front", "left", "right"];
const BACK: ViewId[] = ["back", "left", "right"];

interface UnitInput {
  id: string;
  mesh: string;
  ar: string;
  en: string;
  latin: string;
  region: RegionId;
  granularity?: MuscleDefinition["granularity"];
  includes?: LocalizedName[];
  views?: ViewId[];
  deep?: boolean;
  search?: string[];
  note?: string;
}

function unit(u: UnitInput): MuscleDefinition {
  return {
    id: u.id,
    displayName: { ar: u.ar, en: u.en },
    latin: u.latin,
    region: u.region,
    granularity: u.granularity ?? "single",
    includes: u.includes ?? [{ ar: u.ar, en: u.en }],
    meshNames: [u.mesh],
    aliases: [],
    searchTerms: u.search ?? [],
    viewAvailability: u.views ?? ALL,
    defaultMaterial: "muscle",
    depth: u.deep ? "deep" : "superficial",
    note: u.note,
  };
}

export const MUSCLES: MuscleDefinition[] = [
  // ───────────── العنق ─────────────
  unit({ id: "sternocleidomastoid", mesh: "sternocleidomastoid", ar: "العضلة القصية الترقوية الخشائية", en: "Sternocleidomastoid", latin: "Musculus sternocleidomastoideus", region: "neck", views: FRONT, search: ["رقبة", "الرقبة", "عنق"] }),
  unit({
    id: "splenius", mesh: "splenius", ar: "العضلة الطحالية", en: "Splenius", latin: "Musculi splenii", region: "neck", granularity: "group", views: BACK, deep: true,
    includes: [n("العضلة الطحالية الرأسية", "Splenius capitis"), n("العضلة الطحالية العنقية", "Splenius cervicis")], search: ["خلف الرقبة"],
  }),
  unit({ id: "levator-scapulae", mesh: "levator_scapulae", ar: "العضلة الرافعة للوح الكتف", en: "Levator scapulae", latin: "Musculus levator scapulae", region: "neck", views: BACK, deep: true }),

  // ───────────── الكتف ─────────────
  unit({ id: "deltoid-anterior", mesh: "deltoid_anterior", ar: "الدالية الأمامية (الجزء الترقوي)", en: "Anterior deltoid (clavicular part)", latin: "Pars clavicularis musculi deltoidei", region: "shoulders", granularity: "part", views: FRONT, search: ["كتف أمامي", "الكتف الأمامي", "front delt", "دالية"] }),
  unit({ id: "deltoid-lateral", mesh: "deltoid_lateral", ar: "الدالية الجانبية (الجزء الأخرمي)", en: "Lateral deltoid (acromial part)", latin: "Pars acromialis musculi deltoidei", region: "shoulders", granularity: "part", search: ["كتف جانبي", "الكتف الجانبي", "side delt", "دالية"] }),
  unit({ id: "deltoid-posterior", mesh: "deltoid_posterior", ar: "الدالية الخلفية (الجزء الشوكي)", en: "Posterior deltoid (spinal part)", latin: "Pars spinalis musculi deltoidei", region: "shoulders", granularity: "part", views: BACK, search: ["كتف خلفي", "الكتف الخلفي", "rear delt", "دالية"] }),
  unit({ id: "supraspinatus", mesh: "supraspinatus", ar: "العضلة فوق الشوكة", en: "Supraspinatus", latin: "Musculus supraspinatus", region: "shoulders", views: BACK, deep: true, search: ["الكفة المدورة", "rotator cuff"] }),
  unit({ id: "infraspinatus", mesh: "infraspinatus", ar: "العضلة تحت الشوكة", en: "Infraspinatus", latin: "Musculus infraspinatus", region: "shoulders", views: BACK, search: ["الكفة المدورة", "rotator cuff"] }),
  unit({ id: "teres-minor", mesh: "teres_minor", ar: "العضلة المدورة الصغرى", en: "Teres minor", latin: "Musculus teres minor", region: "shoulders", views: BACK, search: ["الكفة المدورة", "rotator cuff"] }),
  unit({ id: "teres-major", mesh: "teres_major", ar: "العضلة المدورة الكبرى", en: "Teres major", latin: "Musculus teres major", region: "shoulders", views: BACK }),

  // ───────────── الصدر ─────────────
  unit({ id: "pectoralis-major-clavicular", mesh: "pectoralis_major_clavicular", ar: "الصدرية الكبرى — الجزء الترقوي (أعلى الصدر)", en: "Pectoralis major — clavicular part (upper chest)", latin: "Pars clavicularis musculi pectoralis majoris", region: "chest", granularity: "part", views: FRONT, search: ["صدر علوي", "أعلى الصدر", "upper chest", "incline", "صدر"] }),
  unit({ id: "pectoralis-major-sternocostal", mesh: "pectoralis_major_sternocostal", ar: "الصدرية الكبرى — الجزء القصي الضلعي (وسط الصدر)", en: "Pectoralis major — sternocostal part", latin: "Pars sternocostalis musculi pectoralis majoris", region: "chest", granularity: "part", views: FRONT, search: ["وسط الصدر", "صدر", "chest", "pecs"] }),
  unit({ id: "pectoralis-major-abdominal", mesh: "pectoralis_major_abdominal", ar: "الصدرية الكبرى — الجزء البطني (أسفل الصدر)", en: "Pectoralis major — abdominal part (lower chest)", latin: "Pars abdominalis musculi pectoralis majoris", region: "chest", granularity: "part", views: FRONT, search: ["أسفل الصدر", "صدر سفلي", "lower chest", "decline", "صدر"] }),
  unit({ id: "pectoralis-minor", mesh: "pectoralis_minor", ar: "العضلة الصدرية الصغرى", en: "Pectoralis minor", latin: "Musculus pectoralis minor", region: "chest", views: ["front"], deep: true }),
  unit({ id: "serratus-anterior", mesh: "serratus_anterior", ar: "العضلة المنشارية الأمامية", en: "Serratus anterior", latin: "Musculus serratus anterior", region: "chest", views: FRONT, search: ["المنشارية", "سيراتوس"] }),

  // ───────────── الظهر ─────────────
  unit({ id: "trapezius-descending", mesh: "trapezius_descending", ar: "شبه المنحرفة — الجزء النازل (العلوي)", en: "Upper trapezius (descending part)", latin: "Pars descendens musculi trapezii", region: "back", granularity: "part", search: ["ترابيس", "الترابيس", "traps", "upper traps", "شبه المنحرفة"] }),
  unit({
    id: "trapezius-transverse", mesh: "trapezius_transverse", ar: "شبه المنحرفة — الجزء المستعرض (الأوسط)", en: "Middle trapezius (transverse part)", latin: "Pars transversa musculi trapezii", region: "back", granularity: "part", views: BACK, search: ["ترابيس أوسط", "mid traps", "شبه المنحرفة"],
    note: "حدود الأجزاء كما يعرفها BodyParts3D: الجزء المستعرض شريط ضيق (نحو 8 سم) يغطيه الجزء الصاعد جزئيا من الخلف، والجزء الصاعد هو الأكبر.",
  }),
  unit({ id: "trapezius-ascending", mesh: "trapezius_ascending", ar: "شبه المنحرفة — الجزء الصاعد (السفلي)", en: "Lower trapezius (ascending part)", latin: "Pars ascendens musculi trapezii", region: "back", granularity: "part", views: BACK, search: ["ترابيس سفلي", "lower traps", "شبه المنحرفة"] }),
  unit({
    id: "rhomboids", mesh: "rhomboids", ar: "العضلتان المعينيتان", en: "Rhomboids", latin: "Musculi rhomboidei", region: "back", granularity: "group", views: ["back"], deep: true,
    includes: [n("العضلة المعينية الكبرى", "Rhomboid major"), n("العضلة المعينية الصغرى", "Rhomboid minor")], search: ["معينية", "المعينية", "وسط الظهر"],
  }),
  unit({ id: "latissimus-dorsi", mesh: "latissimus_dorsi", ar: "العضلة الظهرية العريضة", en: "Latissimus dorsi", latin: "Musculus latissimus dorsi", region: "back", views: BACK, search: ["لاتس", "lats", "الظهر", "جناح"] }),
  unit({
    id: "erector-spinae", mesh: "erector_spinae", ar: "العضلة الناصبة للفقار", en: "Erector spinae", latin: "Musculus erector spinae", region: "back", granularity: "group", views: ["back"], deep: true,
    includes: [n("العضلة الحرقفية الضلعية (العنقية والصدرية والقطنية)", "Iliocostalis"), n("العضلة الطويلة (الرأسية والعنقية والصدرية)", "Longissimus"), n("العضلة الشوكية", "Spinalis")],
    search: ["أسفل الظهر", "lower back", "الناصبة للفقار"],
    note: "في الواقع تغطي العضلة الظهرية العريضة ولفافتها الجزء السفلي منها، لكن العريضة غير موجودة في BodyParts3D فتظهر الناصبة مكشوفة.",
  }),

  // ───────────── العضد والساعد ─────────────
  unit({
    id: "biceps-brachii", mesh: "biceps_brachii", ar: "العضلة ذات الرأسين العضدية", en: "Biceps brachii", latin: "Musculus biceps brachii", region: "arms", views: FRONT,
    includes: [n("الرأس الطويل", "Long head"), n("الرأس القصير", "Short head")], search: ["بايسبس", "البايسبس", "باي", "biceps"],
  }),
  unit({ id: "brachialis", mesh: "brachialis", ar: "العضلة العضدية", en: "Brachialis", latin: "Musculus brachialis", region: "arms", views: FRONT }),
  unit({ id: "coracobrachialis", mesh: "coracobrachialis", ar: "العضلة الغرابية العضدية", en: "Coracobrachialis", latin: "Musculus coracobrachialis", region: "arms", views: ["front"], deep: true }),
  unit({
    id: "triceps-brachii", mesh: "triceps_brachii", ar: "العضلة ثلاثية الرؤوس العضدية", en: "Triceps brachii", latin: "Musculus triceps brachii", region: "arms", views: BACK,
    includes: [n("الرأس الطويل", "Long head"), n("الرأس الوحشي", "Lateral head"), n("الرأس الإنسي", "Medial head")], search: ["ترايسبس", "الترايسبس", "تراي", "triceps"],
  }),
  unit({ id: "brachioradialis", mesh: "brachioradialis", ar: "العضلة العضدية الكعبرية", en: "Brachioradialis", latin: "Musculus brachioradialis", region: "arms", views: FRONT, search: ["ساعد", "هامر"] }),
  unit({
    id: "forearm-flexors", mesh: "forearm_flexors", ar: "عضلات الساعد القابضة السطحية", en: "Superficial forearm flexors", latin: "Musculi flexores antebrachii superficiales", region: "arms", granularity: "group", views: FRONT,
    includes: [n("العضلة القابضة الكعبرية للرسغ", "Flexor carpi radialis"), n("العضلة الراحية الطويلة", "Palmaris longus"), n("العضلة القابضة الزندية للرسغ", "Flexor carpi ulnaris"), n("العضلة القابضة السطحية للأصابع", "Flexor digitorum superficialis"), n("العضلة الكابة المدورة", "Pronator teres")],
    search: ["ساعد", "قابضات", "forearm"],
  }),
  unit({
    id: "forearm-extensors", mesh: "forearm_extensors", ar: "عضلات الساعد الباسطة", en: "Forearm extensors", latin: "Musculi extensores antebrachii", region: "arms", granularity: "group", views: BACK,
    includes: [n("العضلة الباسطة الكعبرية الطويلة للرسغ", "Extensor carpi radialis longus"), n("العضلة الباسطة الكعبرية القصيرة للرسغ", "Extensor carpi radialis brevis"), n("العضلة الباسطة الزندية للرسغ", "Extensor carpi ulnaris"), n("العضلة الباسطة للأصابع", "Extensor digitorum"), n("العضلة الباسطة للخنصر", "Extensor digiti minimi")],
    search: ["ساعد", "باسطات", "forearm"],
  }),

  // ───────────── البطن ─────────────
  unit({ id: "rectus-abdominis", mesh: "rectus_abdominis", ar: "العضلة المستقيمة البطنية", en: "Rectus abdominis", latin: "Musculus rectus abdominis", region: "core", views: FRONT, search: ["بطن", "سكس باك", "six pack", "abs", "البطن"] }),
  unit({ id: "internal-oblique", mesh: "internal_oblique", ar: "العضلة المائلة الداخلية للبطن", en: "Internal oblique", latin: "Musculus obliquus internus abdominis", region: "core", views: FRONT, deep: true, search: ["خواصر", "obliques", "المائلة"] }),
  unit({ id: "external-oblique", mesh: "external_oblique", ar: "العضلة المائلة الخارجية للبطن", en: "External oblique", latin: "Musculus obliquus externus abdominis", region: "core", views: FRONT, search: ["خواصر", "الخواصر", "obliques", "بطن", "المائلة"] }),

  // ───────────── الورك والأرداف ─────────────
  unit({ id: "gluteus-maximus", mesh: "gluteus_maximus", ar: "العضلة الألوية الكبرى", en: "Gluteus maximus", latin: "Musculus gluteus maximus", region: "hips", views: BACK, search: ["مؤخرة", "أرداف", "الأرداف", "glutes", "جلوت"] }),
  unit({ id: "gluteus-medius", mesh: "gluteus_medius", ar: "العضلة الألوية الوسطى", en: "Gluteus medius", latin: "Musculus gluteus medius", region: "hips", views: BACK, search: ["أرداف", "glute med"] }),
  unit({ id: "gluteus-minimus", mesh: "gluteus_minimus", ar: "العضلة الألوية الصغرى", en: "Gluteus minimus", latin: "Musculus gluteus minimus", region: "hips", views: ["left", "right"], deep: true }),
  unit({ id: "tensor-fasciae-latae", mesh: "tensor_fasciae_latae", ar: "العضلة الموترة للفافة العريضة", en: "Tensor fasciae latae", latin: "Musculus tensor fasciae latae", region: "hips", views: FRONT, search: ["TFL"] }),
  unit({
    id: "iliopsoas", mesh: "iliopsoas", ar: "العضلة الحرقفية القطنية (قابضة الورك)", en: "Iliopsoas (hip flexor)", latin: "Musculus iliopsoas", region: "hips", granularity: "group", views: ["front"], deep: true,
    includes: [n("العضلة القطنية الكبرى", "Psoas major"), n("العضلة الحرقفية", "Iliacus")], search: ["قابضة الورك", "سواس", "hip flexor"],
  }),

  // ───────────── الفخذ ─────────────
  unit({ id: "rectus-femoris", mesh: "rectus_femoris", ar: "العضلة المستقيمة الفخذية", en: "Rectus femoris", latin: "Musculus rectus femoris", region: "thigh", views: FRONT, search: ["كوادز", "quads", "فخذ أمامي", "رباعية الرؤوس"] }),
  unit({ id: "vastus-lateralis", mesh: "vastus_lateralis", ar: "العضلة المتسعة الوحشية", en: "Vastus lateralis", latin: "Musculus vastus lateralis", region: "thigh", views: FRONT, search: ["كوادز", "quads", "رباعية الرؤوس"] }),
  unit({ id: "vastus-medialis", mesh: "vastus_medialis", ar: "العضلة المتسعة الإنسية", en: "Vastus medialis", latin: "Musculus vastus medialis", region: "thigh", views: FRONT, search: ["كوادز", "quads", "VMO", "رباعية الرؤوس"] }),
  unit({ id: "vastus-intermedius", mesh: "vastus_intermedius", ar: "العضلة المتسعة المتوسطة", en: "Vastus intermedius", latin: "Musculus vastus intermedius", region: "thigh", views: ["front"], deep: true, search: ["كوادز", "رباعية الرؤوس"] }),
  unit({ id: "sartorius", mesh: "sartorius", ar: "العضلة الخياطية", en: "Sartorius", latin: "Musculus sartorius", region: "thigh", views: FRONT }),
  unit({ id: "gracilis", mesh: "gracilis", ar: "العضلة الرشيقة", en: "Gracilis", latin: "Musculus gracilis", region: "thigh", views: ["front", "back"], search: ["فخذ داخلي", "adductors"] }),
  unit({ id: "pectineus", mesh: "pectineus", ar: "العضلة العانية", en: "Pectineus", latin: "Musculus pectineus", region: "thigh", views: ["front"], search: ["فخذ داخلي"] }),
  unit({ id: "adductor-longus", mesh: "adductor_longus", ar: "العضلة المقربة الطويلة", en: "Adductor longus", latin: "Musculus adductor longus", region: "thigh", views: ["front"], search: ["فخذ داخلي", "مقربة", "adductors"] }),
  unit({ id: "adductor-brevis", mesh: "adductor_brevis", ar: "العضلة المقربة القصيرة", en: "Adductor brevis", latin: "Musculus adductor brevis", region: "thigh", views: ["front"], deep: true, search: ["فخذ داخلي", "مقربة", "adductors"] }),
  unit({ id: "adductor-magnus", mesh: "adductor_magnus", ar: "العضلة المقربة الكبيرة", en: "Adductor magnus", latin: "Musculus adductor magnus", region: "thigh", views: ["front", "back"], search: ["فخذ داخلي", "مقربة", "adductors"] }),
  unit({
    id: "biceps-femoris", mesh: "biceps_femoris", ar: "العضلة ذات الرأسين الفخذية", en: "Biceps femoris", latin: "Musculus biceps femoris", region: "thigh", views: BACK,
    includes: [n("الرأس الطويل", "Long head"), n("الرأس القصير", "Short head")], search: ["هامسترنج", "فخذ خلفي", "الفخذ الخلفي", "hamstrings"],
  }),
  unit({ id: "semitendinosus", mesh: "semitendinosus", ar: "العضلة نصف الوترية", en: "Semitendinosus", latin: "Musculus semitendinosus", region: "thigh", views: BACK, search: ["هامسترنج", "فخذ خلفي", "hamstrings"] }),
  unit({ id: "semimembranosus", mesh: "semimembranosus", ar: "العضلة نصف الغشائية", en: "Semimembranosus", latin: "Musculus semimembranosus", region: "thigh", views: BACK, search: ["هامسترنج", "فخذ خلفي", "hamstrings"] }),

  // ───────────── الساق ─────────────
  unit({
    id: "gastrocnemius", mesh: "gastrocnemius", ar: "العضلة التوأمية الساقية", en: "Gastrocnemius", latin: "Musculus gastrocnemius", region: "leg", views: BACK,
    includes: [n("الرأس الإنسي", "Medial head"), n("الرأس الوحشي", "Lateral head")], search: ["سمانة", "السمانة", "بطة الساق", "calves", "كافز"],
  }),
  unit({ id: "soleus", mesh: "soleus", ar: "العضلة النعلية", en: "Soleus", latin: "Musculus soleus", region: "leg", views: BACK, search: ["سمانة", "السمانة", "calves"] }),
  unit({ id: "tibialis-anterior", mesh: "tibialis_anterior", ar: "العضلة الظنبوبية الأمامية", en: "Tibialis anterior", latin: "Musculus tibialis anterior", region: "leg", views: FRONT, search: ["قصبة", "مقدمة الساق", "shin"] }),
  unit({
    id: "fibularis", mesh: "fibularis", ar: "العضلتان الشظويتان الطويلة والقصيرة", en: "Fibularis longus & brevis", latin: "Musculi fibulares", region: "leg", granularity: "group", views: ["left", "right"],
    includes: [n("العضلة الشظوية الطويلة", "Fibularis longus"), n("العضلة الشظوية القصيرة", "Fibularis brevis")], search: ["الشظوية", "peroneus"],
  }),
  unit({ id: "extensor-digitorum-longus", mesh: "extensor_digitorum_longus", ar: "العضلة الباسطة الطويلة للأصابع", en: "Extensor digitorum longus", latin: "Musculus extensor digitorum longus", region: "leg", views: FRONT }),
];

export const MUSCLES_BY_ID: ReadonlyMap<string, MuscleDefinition> = new Map(MUSCLES.map((m) => [m.id, m]));

export function getMuscle(id: string): MuscleDefinition | undefined {
  return MUSCLES_BY_ID.get(id);
}

export function musclesInRegion(region: string): MuscleDefinition[] {
  return MUSCLES.filter((m) => m.region === region);
}

/**
 * Open Anatomy 3D muscle-group ids used by projects saved before the
 * BodyParts3D muscles, mapped to the separated units they contained.
 * Groups with no separated counterpart (hand, foot, diaphragm, pelvic floor,
 * intercostals) are dropped on load.
 */
export const LEGACY_GROUP_IDS: Record<string, string[]> = {
  "neck-muscles": ["sternocleidomastoid"],
  deltoid: ["deltoid-anterior", "deltoid-lateral", "deltoid-posterior"],
  "rotator-cuff": ["supraspinatus", "infraspinatus", "teres-minor"],
  "shoulder-girdle": ["teres-major", "rhomboids", "levator-scapulae", "serratus-anterior", "pectoralis-minor"],
  "pectoralis-major": ["pectoralis-major-clavicular", "pectoralis-major-sternocostal", "pectoralis-major-abdominal"],
  trapezius: ["trapezius-descending", "trapezius-transverse", "trapezius-ascending"],
  "deep-back": ["erector-spinae", "splenius"],
  "upper-arm": ["biceps-brachii", "brachialis", "coracobrachialis", "triceps-brachii"],
  forearm: ["brachioradialis", "forearm-flexors", "forearm-extensors"],
  "abdominal-wall": ["rectus-abdominis", "external-oblique", "internal-oblique"],
  gluteal: ["gluteus-maximus", "gluteus-medius", "gluteus-minimus", "tensor-fasciae-latae"],
  quadriceps: ["rectus-femoris", "vastus-lateralis", "vastus-medialis", "vastus-intermedius", "sartorius"],
  hamstrings: ["biceps-femoris", "semitendinosus", "semimembranosus"],
  adductors: ["adductor-longus", "adductor-brevis", "adductor-magnus", "gracilis", "pectineus"],
  calf: ["gastrocnemius", "soleus"],
  "anterior-leg": ["tibialis-anterior", "fibularis", "extensor-digitorum-longus"],
};
