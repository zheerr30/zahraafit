/**
 * Exercise muscle groups: the functional groups exercises are written for,
 * each mapped to the independent muscle units of the 3D model (Z-Anatomy ids,
 * the same on both sides and in both bodies). A unit may belong to more than
 * one group (e.g. the clavicular head: "chest" and "chest-upper").
 */
export type MuscleView = "front" | "back";

export interface MuscleGroup {
  id: string;
  ar: string;
  en: string;
  /** One-line function, shown in the muscle summary. */
  fn: string;
  /** The side of the body it is best seen from (muscle-map thumbnails, camera). */
  view: MuscleView;
  /** Unit ids of the 3D model. */
  units: string[];
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  { id: "chest", ar: "الصدرية الكبرى", en: "Pectoralis major", view: "front", fn: "تقريب العضد أفقيًا ودفعه للأمام وتدويره إنسيًا.", units: ["clavicular-head-of-pectoralis-major-muscle", "sternocostal-head-of-pectoralis-major-muscle", "abdominal-part-of-pectoralis-major-muscle"] },
  { id: "chest-upper", ar: "أعلى الصدر (الرأس الترقوي)", en: "Upper chest (clavicular head)", view: "front", fn: "ثني العضد ورفعه للأمام والأعلى مع تقريبه.", units: ["clavicular-head-of-pectoralis-major-muscle"] },
  { id: "pec-minor", ar: "الصدرية الصغرى", en: "Pectoralis minor", view: "front", fn: "خفض لوح الكتف وإمالته للأمام وتثبيته على القفص الصدري.", units: ["pectoralis-minor-muscle"] },
  { id: "serratus", ar: "المنشارية الأمامية", en: "Serratus anterior", view: "front", fn: "تبعيد لوح الكتف للأمام وتدويره للأعلى وتثبيته على الأضلاع.", units: ["serratus-anterior-muscle"] },
  { id: "delt-front", ar: "الدالية الأمامية", en: "Anterior deltoid", view: "front", fn: "ثني العضد ورفعه للأمام وتدويره إنسيًا.", units: ["deltoid-anterior"] },
  { id: "delt-side", ar: "الدالية الوسطى", en: "Lateral deltoid", view: "front", fn: "تبعيد العضد ورفعه جانبًا.", units: ["deltoid-lateral"] },
  { id: "delt-rear", ar: "الدالية الخلفية", en: "Posterior deltoid", view: "back", fn: "بسط العضد وسحبه للخلف وتدويره وحشيًا.", units: ["deltoid-posterior"] },
  { id: "rotator-cuff", ar: "الكُفّة المدوِّرة", en: "Rotator cuff", view: "back", fn: "تثبيت رأس العضد في الحُقّ وتدوير الكتف للداخل والخارج.", units: ["supraspinatus", "infraspinatus", "teres-minor", "subscapularis"] },
  { id: "traps-upper", ar: "شبه المنحرفة العلوية", en: "Upper trapezius", view: "back", fn: "رفع لوح الكتف وتدويره للأعلى وبسط العنق.", units: ["trapezius-upper"] },
  { id: "traps-mid", ar: "شبه المنحرفة الوسطى", en: "Middle trapezius", view: "back", fn: "تقريب لوحي الكتف نحو العمود الفقري.", units: ["trapezius-middle"] },
  { id: "traps-lower", ar: "شبه المنحرفة السفلية", en: "Lower trapezius", view: "back", fn: "خفض لوح الكتف وتدويره للأعلى.", units: ["trapezius-lower"] },
  { id: "rhomboids", ar: "المعيَّنيتان", en: "Rhomboids", view: "back", fn: "تقريب لوح الكتف ورفعه وتدويره للأسفل.", units: ["rhomboid-major", "rhomboid-minor"] },
  { id: "levator", ar: "رافعة لوح الكتف", en: "Levator scapulae", view: "back", fn: "رفع لوح الكتف وإمالة العنق للجانب.", units: ["levator-scapulae"] },
  { id: "lats", ar: "الظهرية العريضة والمدوّرة الكبيرة", en: "Latissimus dorsi & teres major", view: "back", fn: "بسط العضد وتقريبه وتدويره إنسيًا (حركة السحب).", units: ["latissimus-dorsi", "teres-major"] },
  { id: "erectors", ar: "ناصبة الفقار والعضلات العميقة للظهر", en: "Erector spinae & deep back", view: "back", fn: "بسط العمود الفقري وحفظ انتصابه وتثبيت فقراته.", units: ["erector-spinae", "multifidus-lumborum-muscle", "multifidus-thoracis-muscle", "semispinalis-thoracis-muscle"] },
  { id: "ql", ar: "المربّعة القَطَنية", en: "Quadratus lumborum", view: "back", fn: "ثني الجذع جانبًا وتثبيت الحوض والضلع الثاني عشر.", units: ["quadratus-lumborum-muscle"] },
  { id: "neck", ar: "عضلات العنق", en: "Neck muscles", view: "front", fn: "ثني العنق وتدويره وإمالته وتثبيت الرأس.", units: ["sternocleidomastoid-muscle", "scalenus-anterior-muscle", "scalenus-medius-muscle", "scalenus-posterior-muscle", "longus-colli-muscle", "longus-capitis-muscle", "splenius-capitis-muscle", "splenius-colli-muscle"] },
  { id: "biceps", ar: "ذات الرأسين العضدية", en: "Biceps brachii", view: "front", fn: "ثني المرفق واستلقاء الساعد (تدويره للخارج).", units: ["long-head-of-biceps-brachii", "short-head-of-biceps-brachii"] },
  { id: "brachialis", ar: "العضدية والعضدية الكعبرية", en: "Brachialis & brachioradialis", view: "front", fn: "ثني المرفق في كل أوضاع الساعد.", units: ["brachialis-muscle", "brachioradialis-muscle"] },
  { id: "triceps", ar: "ثلاثية الرؤوس العضدية", en: "Triceps brachii", view: "back", fn: "بسط المرفق، ورأسها الطويل يبسط العضد.", units: ["long-head-of-triceps-brachii", "lateral-head-of-triceps-brachii", "medial-head-of-triceps-brachii", "anconeus-muscle"] },
  { id: "forearm-flexors", ar: "مثنيات الساعد والرسغ", en: "Forearm flexors", view: "front", fn: "ثني الرسغ والأصابع وقوة القبضة.", units: ["flexor-carpi-radialis", "humeral-head-of-flexor-carpi-ulnaris", "ulnar-head-of-flexor-carpi-ulnaris", "palmaris-longus-muscle", "humero-ulnar-head-of-flexor-digitorum-superficialis", "radial-head-of-flexor-digitorum-superficialis", "flexor-digitorum-profundus", "flexor-pollicis-longus", "superficial-head-of-pronator-teres", "deep-head-of-pronator-teres"] },
  { id: "forearm-extensors", ar: "باسطات الساعد والرسغ", en: "Forearm extensors", view: "back", fn: "بسط الرسغ والأصابع وتثبيت الرسغ عند القبض.", units: ["extensor-carpi-radialis-longus", "extensor-carpi-radialis-brevis", "extensor-digitorum", "humeral-head-of-extensor-carpi-ulnaris", "ulnar-head-of-extensor-carpi-ulnaris", "extensor-digiti-minimi", "supinator"] },
  { id: "hand", ar: "عضلات اليد", en: "Hand muscles", view: "front", fn: "الحركات الدقيقة للأصابع والإبهام.", units: ["abductor-pollicis-brevis", "opponens-pollicis-muscle", "superficial-head-of-flexor-pollicis-brevis", "deep-head-of-flexor-pollicis-brevis", "oblique-head-of-adductor-pollicis", "transverse-head-of-adductor-pollicis", "lumbrical-muscles-of-hand", "dorsal-interossei-muscles-of-hand", "palmar-interossei-muscles", "abductor-digiti-minimi-of-hand", "flexor-digiti-minimi-of-hand", "opponens-digiti-minimi-muscle-of-hand"] },
  { id: "abs", ar: "المستقيمة البطنية", en: "Rectus abdominis", view: "front", fn: "ثني الجذع للأمام وتقريب القفص الصدري من الحوض.", units: ["rectus-abdominis-muscle", "pyramidalis-muscle"] },
  { id: "obliques", ar: "المائلتان البطنيتان", en: "Obliques", view: "front", fn: "تدوير الجذع وثنيه جانبًا وشدّ جدار البطن.", units: ["external-abdominal-oblique-muscle", "internal-abdominal-oblique-muscle"] },
  { id: "tva", ar: "المستعرضة البطنية", en: "Transversus abdominis", view: "front", fn: "شدّ جدار البطن كالحزام وتثبيت العمود القطني.", units: ["transversus-abdominis-muscle"] },
  { id: "breathing", ar: "الحجاب الحاجز وعضلات التنفس", en: "Diaphragm & breathing muscles", view: "front", fn: "الشهيق والزفير وتنظيم الضغط داخل البطن.", units: ["diaphragm", "external-intercostal-muscles", "internal-intercostal-muscles", "innermost-intercostal-muscles"] },
  { id: "pelvic-floor", ar: "عضلات قاع الحوض", en: "Pelvic floor", view: "front", fn: "دعم أعضاء الحوض والتحكّم في المصرّات.", units: ["pubococcygeus-muscle", "iliococcygeus-muscle", "coccygeus-muscle", "pubo-analis-muscle"] },
  { id: "glute-max", ar: "الألوية الكبرى", en: "Gluteus maximus", view: "back", fn: "بسط الورك بقوة وتدويره وحشيًا.", units: ["gluteus-maximus-muscle"] },
  { id: "glute-med", ar: "الألوية الوسطى والصغرى والموتّرة", en: "Gluteus medius, minimus & TFL", view: "back", fn: "تبعيد الورك وتثبيت الحوض عند الوقوف على رجل واحدة.", units: ["gluteus-medius-muscle", "gluteus-minimus-muscle", "tensor-fasciae-latae"] },
  { id: "deep-rotators", ar: "الكمثرية والمدوِّرات العميقة للورك", en: "Piriformis & deep hip rotators", view: "back", fn: "تدوير الورك وحشيًا وتثبيت رأس الفخذ.", units: ["piriformis-muscle", "obturator-internus", "superior-gemellus-muscle", "inferior-gemellus-muscle", "quadratus-femoris-muscle"] },
  { id: "hip-flexors", ar: "مثنيات الورك (الحرقفية القطنية)", en: "Hip flexors (iliopsoas)", view: "front", fn: "ثني الورك ورفع الفخذ نحو الجذع.", units: ["iliacus-muscle", "psoas-major", "sartorius-muscle"] },
  { id: "quads", ar: "رباعية الرؤوس الفخذية", en: "Quadriceps", view: "front", fn: "بسط الركبة، والمستقيمة الفخذية تثني الورك أيضًا.", units: ["rectus-femoris-muscle", "vastus-lateralis-muscle", "vastus-medialis-muscle", "vastus-intermedius-muscle"] },
  { id: "hamstrings", ar: "العضلات المأبضية", en: "Hamstrings", view: "back", fn: "ثني الركبة وبسط الورك.", units: ["long-head-of-biceps-femoris", "short-head-of-biceps-femoris", "semitendinosus-muscle", "semimembranosus-muscle"] },
  { id: "adductors", ar: "المقرِّبات", en: "Adductors", view: "front", fn: "تقريب الفخذ نحو الخط الناصف وتثبيت الحوض.", units: ["adductor-longus", "adductor-brevis", "adductor-magnus", "adductor-minimus", "gracilis-muscle", "pectineus-muscle"] },
  { id: "calves", ar: "عضلات الربلة (الساق الخلفية)", en: "Calves", view: "back", fn: "ثني القدم أخمصيًا (الوقوف على الأمشاط) والدفع عند المشي.", units: ["medial-head-of-gastrocnemius", "lateral-head-of-gastrocnemius", "soleus-muscle", "plantaris-muscle"] },
  { id: "tib-ant", ar: "الظنبوبية الأمامية وباسطات القدم", en: "Tibialis anterior & toe extensors", view: "front", fn: "رفع مقدَّم القدم (العطف الظهري) وبسط الأصابع.", units: ["tibialis-anterior-muscle", "extensor-digitorum-longus", "extensor-hallucis-longus"] },
  { id: "peroneals", ar: "الشظويتان", en: "Fibularis (peroneal) muscles", view: "front", fn: "قلب القدم للخارج وتثبيت الكاحل جانبيًا.", units: ["fibularis-longus-muscle", "fibularis-brevis-muscle"] },
  { id: "foot", ar: "عضلات القدم وقوسها", en: "Foot & arch muscles", view: "back", fn: "دعم قوس القدم وثني الأصابع.", units: ["tibialis-posterior-muscle", "flexor-digitorum-longus", "flexor-hallucis-longus", "flexor-digitorum-brevis", "abductor-hallucis", "quadratus-plantae-muscle", "lumbrical-muscles-of-foot"] },
];

export const GROUP_BY_ID = new Map(MUSCLE_GROUPS.map((g) => [g.id, g]));

const BY_UNIT = new Map<string, MuscleGroup[]>();
for (const g of MUSCLE_GROUPS) for (const u of g.units) BY_UNIT.set(u, [...(BY_UNIT.get(u) ?? []), g]);

/** Groups a model unit belongs to (most specific last, e.g. chest, chest-upper). */
export function groupsOfUnit(unitId: string): MuscleGroup[] {
  return BY_UNIT.get(unitId) ?? [];
}

/** Body areas for the group filter of the exercise library. */
export const GROUP_AREAS: { id: string; ar: string; groups: string[] }[] = [
  { id: "chest", ar: "الصدر", groups: ["chest", "chest-upper", "pec-minor", "serratus"] },
  { id: "shoulders", ar: "الكتفان", groups: ["delt-front", "delt-side", "delt-rear", "rotator-cuff"] },
  { id: "back", ar: "الظهر", groups: ["lats", "traps-upper", "traps-mid", "traps-lower", "rhomboids", "levator", "erectors", "ql"] },
  { id: "arms", ar: "الذراعان", groups: ["biceps", "brachialis", "triceps", "forearm-flexors", "forearm-extensors", "hand"] },
  { id: "core", ar: "البطن والجذع", groups: ["abs", "obliques", "tva", "breathing", "pelvic-floor"] },
  { id: "hips", ar: "الورك والألوية", groups: ["glute-max", "glute-med", "deep-rotators", "hip-flexors", "adductors"] },
  { id: "legs", ar: "الفخذ والساق", groups: ["quads", "hamstrings", "calves", "tib-ant", "peroneals", "foot"] },
  { id: "neck", ar: "العنق", groups: ["neck"] },
];
