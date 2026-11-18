import type { LocalizedName } from "@/types/anatomy";

/**
 * How the studio's original 32 target muscles are represented in the
 * BodyParts3D muscles (verified against all 2,234 BodyParts3D 4.0 OBJ headers).
 *
 * - "individual": its own selectable mesh.
 * - "parts": available as separate named parts (e.g. the three trapezius parts).
 * - "in-group": merged with neighbouring muscles in one selectable mesh.
 * - "missing": no BodyParts3D 4.0 file contains this muscle.
 */
export type CoverageStatus = "individual" | "parts" | "in-group" | "missing";

export interface CoverageEntry {
  name: LocalizedName;
  status: CoverageStatus;
  /** Selectable unit(s) that represent it (empty when missing). */
  muscleIds: string[];
}

const c = (ar: string, en: string, status: CoverageStatus, ...muscleIds: string[]): CoverageEntry => ({
  name: { ar, en },
  status,
  muscleIds,
});

export const TARGET_COVERAGE: CoverageEntry[] = [
  c("العضلة الصدرية الكبرى", "Pectoralis Major", "parts", "pectoralis-major-clavicular", "pectoralis-major-sternocostal", "pectoralis-major-abdominal"),
  c("العضلة الصدرية الصغرى", "Pectoralis Minor", "individual", "pectoralis-minor"),
  c("العضلة الظهرية العريضة", "Latissimus Dorsi", "individual", "latissimus-dorsi"),
  c("العضلة شبه المنحرفة", "Trapezius", "parts", "trapezius-descending", "trapezius-transverse", "trapezius-ascending"),
  c("العضلات المعينية", "Rhomboids", "individual", "rhomboids"),
  c("العضلة المدوّرة الكبرى", "Teres Major", "individual", "teres-major"),
  c("العضلة الناصبة للفقار", "Erector Spinae", "individual", "erector-spinae"),
  c("الدالية الأمامية", "Anterior Deltoid", "individual", "deltoid-anterior"),
  c("الدالية الجانبية", "Lateral Deltoid", "individual", "deltoid-lateral"),
  c("الدالية الخلفية", "Posterior Deltoid", "individual", "deltoid-posterior"),
  c("العضلة ذات الرأسين العضدية", "Biceps Brachii", "individual", "biceps-brachii"),
  c("العضلة العضدية", "Brachialis", "individual", "brachialis"),
  c("العضلة ثلاثية الرؤوس العضدية", "Triceps Brachii", "individual", "triceps-brachii"),
  c("عضلات الساعد القابضة", "Forearm Flexors", "individual", "forearm-flexors"),
  c("عضلات الساعد الباسطة", "Forearm Extensors", "individual", "forearm-extensors"),
  c("العضلة المستقيمة البطنية", "Rectus Abdominis", "individual", "rectus-abdominis"),
  c("العضلة المائلة الخارجية", "External Obliques", "individual", "external-oblique"),
  c("العضلة المائلة الداخلية", "Internal Obliques", "individual", "internal-oblique"),
  c("العضلة الألوية الكبرى", "Gluteus Maximus", "individual", "gluteus-maximus"),
  c("العضلة الألوية الوسطى", "Gluteus Medius", "individual", "gluteus-medius"),
  c("العضلة الألوية الصغرى", "Gluteus Minimus", "individual", "gluteus-minimus"),
  c("العضلة المستقيمة الفخذية", "Rectus Femoris", "individual", "rectus-femoris"),
  c("العضلة المتسعة الوحشية", "Vastus Lateralis", "individual", "vastus-lateralis"),
  c("العضلة المتسعة الإنسية", "Vastus Medialis", "individual", "vastus-medialis"),
  c("العضلة المتسعة المتوسطة", "Vastus Intermedius", "individual", "vastus-intermedius"),
  c("العضلة ذات الرأسين الفخذية", "Biceps Femoris", "individual", "biceps-femoris"),
  c("العضلة نصف الوترية", "Semitendinosus", "individual", "semitendinosus"),
  c("العضلة نصف الغشائية", "Semimembranosus", "individual", "semimembranosus"),
  c("العضلات المقرّبة", "Adductors", "parts", "adductor-longus", "adductor-brevis", "adductor-magnus"),
  c("العضلة التوأمية الساقية", "Gastrocnemius", "individual", "gastrocnemius"),
  c("العضلة النعلية", "Soleus", "individual", "soleus"),
  c("العضلة الظنبوبية الأمامية", "Tibialis Anterior", "individual", "tibialis-anterior"),
];

export const COVERAGE_LABELS: Record<CoverageStatus, string> = {
  individual: "شبكة مستقلة",
  parts: "مفصولة إلى أجزائها",
  "in-group": "ضمن مجموعة",
  missing: "غير موجودة في BodyParts3D",
};
