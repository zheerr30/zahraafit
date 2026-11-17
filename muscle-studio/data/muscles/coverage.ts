import type { LocalizedName } from "@/types/anatomy";

/**
 * How the studio's original 32 target muscles are represented in the Open
 * Anatomy 3D models, derived from the upstream build rules
 * (pipeline/catalog.mjs) and verified against the actual GLB meshes.
 *
 * - "individual": the muscle is its own selectable mesh.
 * - "whole-muscle": only the whole muscle exists (sub-parts are not separate).
 * - "in-group": merged with other muscles; highlighting colours the whole group.
 * - "missing": no mesh contains this muscle.
 */
export type CoverageStatus = "individual" | "whole-muscle" | "in-group" | "missing";

export interface CoverageEntry {
  name: LocalizedName;
  status: CoverageStatus;
  /** Selectable muscle unit that contains it (null when missing). */
  muscleId: string | null;
}

const c = (ar: string, en: string, status: CoverageStatus, muscleId: string | null): CoverageEntry => ({
  name: { ar, en },
  status,
  muscleId,
});

export const TARGET_COVERAGE: CoverageEntry[] = [
  c("العضلة الصدرية الكبرى", "Pectoralis Major", "individual", "pectoralis-major"),
  c("العضلة الصدرية الصغرى", "Pectoralis Minor", "in-group", "shoulder-girdle"),
  c("العضلة الظهرية العريضة", "Latissimus Dorsi", "missing", null),
  c("العضلة شبه المنحرفة", "Trapezius", "individual", "trapezius"),
  c("العضلات المعينية", "Rhomboids", "in-group", "shoulder-girdle"),
  c("العضلة المدوّرة الكبرى", "Teres Major", "in-group", "shoulder-girdle"),
  c("العضلة الناصبة للفقار", "Erector Spinae", "in-group", "deep-back"),
  c("الدالية الأمامية", "Anterior Deltoid", "whole-muscle", "deltoid"),
  c("الدالية الجانبية", "Lateral Deltoid", "whole-muscle", "deltoid"),
  c("الدالية الخلفية", "Posterior Deltoid", "whole-muscle", "deltoid"),
  c("العضلة ذات الرأسين العضدية", "Biceps Brachii", "in-group", "upper-arm"),
  c("العضلة العضدية", "Brachialis", "in-group", "upper-arm"),
  c("العضلة ثلاثية الرؤوس العضدية", "Triceps Brachii", "in-group", "upper-arm"),
  c("عضلات الساعد القابضة", "Forearm Flexors", "in-group", "forearm"),
  c("عضلات الساعد الباسطة", "Forearm Extensors", "in-group", "forearm"),
  c("العضلة المستقيمة البطنية", "Rectus Abdominis", "in-group", "abdominal-wall"),
  c("العضلة المائلة الخارجية", "External Obliques", "in-group", "abdominal-wall"),
  c("العضلة المائلة الداخلية", "Internal Obliques", "in-group", "abdominal-wall"),
  c("العضلة الألوية الكبرى", "Gluteus Maximus", "in-group", "gluteal"),
  c("العضلة الألوية الوسطى", "Gluteus Medius", "in-group", "gluteal"),
  c("العضلة الألوية الصغرى", "Gluteus Minimus", "in-group", "gluteal"),
  c("العضلة المستقيمة الفخذية", "Rectus Femoris", "in-group", "quadriceps"),
  c("العضلة المتسعة الوحشية", "Vastus Lateralis", "in-group", "quadriceps"),
  c("العضلة المتسعة الإنسية", "Vastus Medialis", "in-group", "quadriceps"),
  c("العضلة المتسعة المتوسطة", "Vastus Intermedius", "in-group", "quadriceps"),
  c("العضلة ذات الرأسين الفخذية", "Biceps Femoris", "in-group", "hamstrings"),
  c("العضلة نصف الوترية", "Semitendinosus", "in-group", "hamstrings"),
  c("العضلة نصف الغشائية", "Semimembranosus", "in-group", "hamstrings"),
  c("العضلات المقرّبة", "Adductors", "in-group", "adductors"),
  c("العضلة التوأمية الساقية", "Gastrocnemius", "in-group", "calf"),
  c("العضلة النعلية", "Soleus", "in-group", "calf"),
  c("العضلة الظنبوبية الأمامية", "Tibialis Anterior", "in-group", "anterior-leg"),
];

export const COVERAGE_LABELS: Record<CoverageStatus, string> = {
  individual: "قابلة للتحديد منفردة",
  "whole-muscle": "العضلة كاملة فقط",
  "in-group": "ضمن مجموعة مدموجة",
  missing: "غير موجودة في النموذج",
};
