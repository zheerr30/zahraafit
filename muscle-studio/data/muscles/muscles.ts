import type { MuscleDefinition, RegionDefinition } from "@/types/anatomy";

/**
 * Anatomical muscle database.
 *
 * - `id` is the stable key stored in projects. Never rename an id.
 * - `meshNames` are the canonical mesh names a conforming GLB should use
 *   (without side suffix). The mapping layer also strips `_L`, `.R`, `Left`, etc.
 * - `aliases` feed both the mesh-name mapping and the bilingual search.
 */

export const REGION_DEFINITIONS: RegionDefinition[] = [
  { id: "chest", displayName: { en: "Chest", ar: "الصدر" } },
  { id: "back", displayName: { en: "Back", ar: "الظهر" } },
  { id: "shoulders", displayName: { en: "Shoulders", ar: "الأكتاف" } },
  { id: "arms", displayName: { en: "Arms", ar: "الذراعان" } },
  { id: "core", displayName: { en: "Core", ar: "الجذع والبطن" } },
  { id: "glutes", displayName: { en: "Glutes", ar: "الأرداف" } },
  { id: "legs", displayName: { en: "Legs", ar: "الرجلان" } },
];

const ALL_VIEWS: MuscleDefinition["viewAvailability"] = ["front", "back", "left", "right"];
const FRONT_SIDES: MuscleDefinition["viewAvailability"] = ["front", "left", "right"];
const BACK_SIDES: MuscleDefinition["viewAvailability"] = ["back", "left", "right"];

export const MUSCLES: MuscleDefinition[] = [
  // ───────────── CHEST ─────────────
  {
    id: "pectoralis-major",
    displayName: { en: "Pectoralis Major", ar: "العضلة الصدرية الكبرى" },
    region: "chest",
    meshNames: ["Pectoralis_Major"],
    aliases: ["pec major", "pecs", "pectoralis major muscle", "chest", "الصدرية الكبرى", "عضلة الصدر"],
    viewAvailability: FRONT_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "pectoralis-minor",
    displayName: { en: "Pectoralis Minor", ar: "العضلة الصدرية الصغرى" },
    region: "chest",
    meshNames: ["Pectoralis_Minor"],
    aliases: ["pec minor", "الصدرية الصغرى"],
    viewAvailability: ["front"],
    defaultMaterial: "muscle",
    depth: "deep",
  },

  // ───────────── BACK ─────────────
  {
    id: "latissimus-dorsi",
    displayName: { en: "Latissimus Dorsi", ar: "العضلة الظهرية العريضة" },
    region: "back",
    meshNames: ["Latissimus_Dorsi"],
    aliases: ["lats", "lat", "lat dorsi", "latissimus", "المجنصة", "الظهرية العريضة", "اللاتس"],
    viewAvailability: ALL_VIEWS,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "trapezius",
    displayName: { en: "Trapezius", ar: "العضلة شبه المنحرفة" },
    region: "back",
    meshNames: ["Trapezius"],
    aliases: ["traps", "trap", "upper trapezius", "شبه المنحرفة", "الترابيس"],
    viewAvailability: ALL_VIEWS,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "rhomboids",
    displayName: { en: "Rhomboids", ar: "العضلات المعينية" },
    region: "back",
    meshNames: ["Rhomboids", "Rhomboid_Major", "Rhomboid_Minor"],
    aliases: ["rhomboid", "rhomboideus", "المعينية", "المعينيه"],
    viewAvailability: ["back"],
    defaultMaterial: "muscle",
    depth: "deep",
  },
  {
    id: "teres-major",
    displayName: { en: "Teres Major", ar: "العضلة المدوّرة الكبرى" },
    region: "back",
    meshNames: ["Teres_Major"],
    aliases: ["teres", "المدورة الكبرى"],
    viewAvailability: BACK_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "erector-spinae",
    displayName: { en: "Erector Spinae", ar: "العضلة الناصبة للفقار" },
    region: "back",
    meshNames: ["Erector_Spinae"],
    aliases: ["spinal erectors", "lower back", "sacrospinalis", "الناصبة للفقار", "أسفل الظهر"],
    viewAvailability: ["back"],
    defaultMaterial: "muscle",
    depth: "deep",
  },

  // ───────────── SHOULDERS ─────────────
  {
    id: "anterior-deltoid",
    displayName: { en: "Anterior Deltoid", ar: "الدالية الأمامية" },
    region: "shoulders",
    meshNames: ["Deltoid_Anterior", "Anterior_Deltoid"],
    aliases: ["front delt", "front deltoid", "anterior delt", "الكتف الأمامي", "الدالية الامامية"],
    viewAvailability: FRONT_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "lateral-deltoid",
    displayName: { en: "Lateral Deltoid", ar: "الدالية الجانبية" },
    region: "shoulders",
    meshNames: ["Deltoid_Lateral", "Lateral_Deltoid", "Deltoid_Middle"],
    aliases: ["side delt", "middle deltoid", "medial deltoid", "lateral delt", "الكتف الجانبي"],
    viewAvailability: ALL_VIEWS,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "posterior-deltoid",
    displayName: { en: "Posterior Deltoid", ar: "الدالية الخلفية" },
    region: "shoulders",
    meshNames: ["Deltoid_Posterior", "Posterior_Deltoid"],
    aliases: ["rear delt", "rear deltoid", "posterior delt", "الكتف الخلفي"],
    viewAvailability: BACK_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },

  // ───────────── ARMS ─────────────
  {
    id: "biceps-brachii",
    displayName: { en: "Biceps Brachii", ar: "العضلة ذات الرأسين العضدية" },
    region: "arms",
    meshNames: ["Biceps_Brachii"],
    aliases: ["biceps", "bicep", "ذات الرأسين العضدية", "البايسبس", "باي"],
    viewAvailability: FRONT_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "brachialis",
    displayName: { en: "Brachialis", ar: "العضلة العضدية" },
    region: "arms",
    meshNames: ["Brachialis"],
    aliases: ["brachialis muscle", "العضدية"],
    viewAvailability: FRONT_SIDES,
    defaultMaterial: "muscle",
    depth: "deep",
  },
  {
    id: "triceps-brachii",
    displayName: { en: "Triceps Brachii", ar: "العضلة ثلاثية الرؤوس العضدية" },
    region: "arms",
    meshNames: ["Triceps_Brachii"],
    aliases: ["triceps", "tricep", "ثلاثية الرؤوس", "الترايسبس", "تراي"],
    viewAvailability: BACK_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "forearm-flexors",
    displayName: { en: "Forearm Flexors", ar: "عضلات الساعد القابضة" },
    region: "arms",
    meshNames: ["Forearm_Flexors"],
    aliases: ["wrist flexors", "flexor group", "القابضة", "قابضات الساعد"],
    viewAvailability: FRONT_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "forearm-extensors",
    displayName: { en: "Forearm Extensors", ar: "عضلات الساعد الباسطة" },
    region: "arms",
    meshNames: ["Forearm_Extensors"],
    aliases: ["wrist extensors", "extensor group", "الباسطة", "باسطات الساعد"],
    viewAvailability: BACK_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },

  // ───────────── CORE ─────────────
  {
    id: "rectus-abdominis",
    displayName: { en: "Rectus Abdominis", ar: "العضلة المستقيمة البطنية" },
    region: "core",
    meshNames: ["Rectus_Abdominis"],
    aliases: ["abs", "six pack", "abdominals", "المستقيمة البطنية", "عضلات البطن", "البطن"],
    viewAvailability: FRONT_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "external-obliques",
    displayName: { en: "External Obliques", ar: "العضلة المائلة الخارجية" },
    region: "core",
    meshNames: ["External_Oblique", "External_Obliques", "Obliquus_Externus_Abdominis"],
    aliases: ["obliques", "external oblique", "المائلة الخارجية", "الخواصر"],
    viewAvailability: ALL_VIEWS,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "internal-obliques",
    displayName: { en: "Internal Obliques", ar: "العضلة المائلة الداخلية" },
    region: "core",
    meshNames: ["Internal_Oblique", "Internal_Obliques", "Obliquus_Internus_Abdominis"],
    aliases: ["internal oblique", "المائلة الداخلية"],
    viewAvailability: FRONT_SIDES,
    defaultMaterial: "muscle",
    depth: "deep",
  },

  // ───────────── GLUTES ─────────────
  {
    id: "gluteus-maximus",
    displayName: { en: "Gluteus Maximus", ar: "العضلة الألوية الكبرى" },
    region: "glutes",
    meshNames: ["Gluteus_Maximus"],
    aliases: ["glute max", "glutes", "الألوية الكبرى", "المؤخرة", "الأرداف"],
    viewAvailability: BACK_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "gluteus-medius",
    displayName: { en: "Gluteus Medius", ar: "العضلة الألوية الوسطى" },
    region: "glutes",
    meshNames: ["Gluteus_Medius"],
    aliases: ["glute med", "الألوية الوسطى"],
    viewAvailability: BACK_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "gluteus-minimus",
    displayName: { en: "Gluteus Minimus", ar: "العضلة الألوية الصغرى" },
    region: "glutes",
    meshNames: ["Gluteus_Minimus"],
    aliases: ["glute min", "الألوية الصغرى"],
    viewAvailability: ["back", "left", "right"],
    defaultMaterial: "muscle",
    depth: "deep",
  },

  // ───────────── LEGS ─────────────
  {
    id: "rectus-femoris",
    displayName: { en: "Rectus Femoris", ar: "العضلة المستقيمة الفخذية" },
    region: "legs",
    meshNames: ["Rectus_Femoris"],
    aliases: ["quads", "quadriceps", "المستقيمة الفخذية", "الفخذ الأمامي"],
    viewAvailability: FRONT_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "vastus-lateralis",
    displayName: { en: "Vastus Lateralis", ar: "العضلة المتسعة الوحشية" },
    region: "legs",
    meshNames: ["Vastus_Lateralis"],
    aliases: ["outer quad", "المتسعة الوحشية", "المتسعة الجانبية"],
    viewAvailability: ALL_VIEWS,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "vastus-medialis",
    displayName: { en: "Vastus Medialis", ar: "العضلة المتسعة الإنسية" },
    region: "legs",
    meshNames: ["Vastus_Medialis"],
    aliases: ["vmo", "teardrop", "inner quad", "المتسعة الإنسية", "المتسعة الأنسية"],
    viewAvailability: FRONT_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "vastus-intermedius",
    displayName: { en: "Vastus Intermedius", ar: "العضلة المتسعة المتوسطة" },
    region: "legs",
    meshNames: ["Vastus_Intermedius"],
    aliases: ["المتسعة المتوسطة", "المتسعة الوسطى"],
    viewAvailability: ["front"],
    defaultMaterial: "muscle",
    depth: "deep",
  },
  {
    id: "biceps-femoris",
    displayName: { en: "Biceps Femoris", ar: "العضلة ذات الرأسين الفخذية" },
    region: "legs",
    meshNames: ["Biceps_Femoris"],
    aliases: ["hamstrings", "outer hamstring", "ذات الرأسين الفخذية", "الفخذ الخلفي"],
    viewAvailability: BACK_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "semitendinosus",
    displayName: { en: "Semitendinosus", ar: "العضلة نصف الوترية" },
    region: "legs",
    meshNames: ["Semitendinosus"],
    aliases: ["inner hamstring", "نصف الوترية"],
    viewAvailability: BACK_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "semimembranosus",
    displayName: { en: "Semimembranosus", ar: "العضلة نصف الغشائية" },
    region: "legs",
    meshNames: ["Semimembranosus"],
    aliases: ["نصف الغشائية"],
    viewAvailability: BACK_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "adductors",
    displayName: { en: "Adductors", ar: "العضلات المقرّبة" },
    region: "legs",
    meshNames: ["Adductors", "Adductor_Group", "Adductor_Magnus", "Adductor_Longus"],
    aliases: ["adductor", "inner thigh", "groin", "المقربة", "الفخذ الداخلي"],
    viewAvailability: ["front", "back"],
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "gastrocnemius",
    displayName: { en: "Gastrocnemius", ar: "العضلة التوأمية الساقية" },
    region: "legs",
    meshNames: ["Gastrocnemius"],
    aliases: ["calves", "calf", "gastroc", "التوأمية", "السمانة", "بطة الساق"],
    viewAvailability: ALL_VIEWS,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "soleus",
    displayName: { en: "Soleus", ar: "العضلة النعلية" },
    region: "legs",
    meshNames: ["Soleus"],
    aliases: ["النعلية"],
    viewAvailability: BACK_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
  {
    id: "tibialis-anterior",
    displayName: { en: "Tibialis Anterior", ar: "العضلة الظنبوبية الأمامية" },
    region: "legs",
    meshNames: ["Tibialis_Anterior"],
    aliases: ["shin", "tibialis", "الظنبوبية الأمامية", "عضلة القصبة"],
    viewAvailability: FRONT_SIDES,
    defaultMaterial: "muscle",
    depth: "superficial",
  },
];

export const MUSCLES_BY_ID: ReadonlyMap<string, MuscleDefinition> = new Map(
  MUSCLES.map((m) => [m.id, m]),
);

export function getMuscle(id: string): MuscleDefinition | undefined {
  return MUSCLES_BY_ID.get(id);
}

export function musclesInRegion(region: string): MuscleDefinition[] {
  return MUSCLES.filter((m) => m.region === region);
}
