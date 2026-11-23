import { groupsOfUnit } from "@/data/exercises/groups";

/**
 * What a person sees about a muscle: where it is, what it does and which
 * movements use it — in plain Arabic for people who train, without anatomical
 * jargon, codes or source data. Muscles of the exercise groups take the group's
 * text; the small muscles outside them are described by family here.
 */
export interface MuscleExplanation {
  /** One or two short sentences: the summary under the muscle's name. */
  about: string;
  /** Where the muscle is. */
  where: string | null;
  /** What it does, as short points. */
  does: string[];
  /** Movements and exercises it works in. */
  moves: string[];
}

/** [ids, what it does, where it is] */
const FAMILIES: [RegExp, string, string][] = [
  [/^(inferior|superior|lateral|medial)-rectus-muscle$|^(inferior|superior)-oblique-muscle$/, "من عضلات العين: تحرك العين في اتجاهات النظر المختلفة.", "حول مقلة العين داخل محجرها."],
  [/levator-palpebrae/, "ترفع الجفن العلوي لفتح العين.", "في الجفن العلوي."],
  [/tarsus$/, "صفيحة ليفية تعطي الجفن شكله وتدعمه.", "داخل الجفن."],
  [/orbicularis-oculi/, "تغلق الجفون، كما في الرمش وإغماض العين.", "حول العين."],
  [/orbicularis-oris/, "تضم الشفتين وتغلق الفم.", "حول الفم."],
  [/masseter|temporalis|pterygoid/, "من عضلات المضغ: تحرك الفك السفلي لإغلاق الفم وطحن الطعام.", "على جانبي الفك والصدغ."],
  [/genioglossus|hyoglossus/, "من عضلات اللسان: تحركه أثناء الكلام والبلع.", "داخل اللسان وتحته."],
  [/frontalis|occipitalis|temporoparietalis/, "ترفع الحاجبين وتحرك فروة الرأس.", "على الجبهة ومؤخرة الرأس."],
  [/bucinator|corrugator|depressor|levator-(anguli|labii|nasolabialis)|mentalis|nasalis|procerus|risorius|zygomaticus/, "من عضلات تعابير الوجه: تحرك الشفتين والخدين والحاجبين.", "في الوجه تحت الجلد."],
  [/platysma/, "عضلة رقيقة تشد جلد العنق وتنزل زاوية الفم.", "تحت جلد مقدمة العنق."],
  [/arytenoid|cricothyroid/, "من عضلات الحنجرة: تتحكم في الأحبال الصوتية عند الكلام والتنفس.", "داخل الحنجرة."],
  [/pharyngeal|pharyngeus/, "من عضلات البلعوم: تدفع الطعام نحو المريء عند البلع.", "في جدار البلعوم خلف الفم."],
  [/hyoid|digastric|sternothyroid/, "تحرك الحنجرة وأسفل الفك عند البلع والكلام.", "في مقدمة العنق."],
  [/rectus-(anterior|lateralis|posterior)|obliquus-(inferior|superior)-capitis/, "عضلات صغيرة تضبط حركات الرأس الدقيقة.", "في أعلى الرقبة تحت الجمجمة."],
  [/interspinales|rotatores|intertransversarii|semispinalis-colli|multifidus-colli/, "عضلات صغيرة عميقة تثبت العمود الفقري وتساعد على استقامة الظهر.", "بين فقرات العمود الفقري."],
  [/serratus-posterior|levatores-.*costarum|transversus-thoracis/, "تساعد على حركة الأضلاع أثناء التنفس.", "على القفص الصدري بين الأضلاع والفقرات."],
  [/subclavius/, "عضلة صغيرة تثبت عظم الترقوة في مكانه.", "تحت عظم الترقوة."],
  [/coracobrachialis/, "تساعد على رفع الذراع للأمام وضمها نحو الجسم.", "في أعلى الذراع من الداخل."],
  [/pronator-quadratus/, "تدير الساعد لتصير راحة اليد للأسفل.", "في أسفل الساعد قرب الرسغ."],
  [/abductor-pollicis-longus|extensor-(indicis|pollicis)/, "تفرد الإبهام والسبابة وتبعدهما عن باقي الأصابع.", "في خلف الساعد."],
  [/popliteus/, "عضلة صغيرة تساعد على بدء ثني الركبة وتثبيتها.", "خلف الركبة."],
  [/fibularis-tertius/, "تساعد على رفع مقدمة القدم وإمالتها للخارج.", "في أسفل مقدمة الساق."],
  [/obturator-externus/, "تدير الفخذ للخارج وتثبت مفصل الورك.", "عميقة في أعلى الفخذ من الداخل."],
  [/anal-sphincter/, "عضلة حلقية تتحكم في إغلاق فتحة الشرج.", "حول فتحة الشرج."],
  [/of-foot|hallucis|plantar-interossei|digitorum-brevis|quadratus-plantae/, "من عضلات القدم الصغيرة: تحرك الأصابع وتسند قوس القدم.", "داخل القدم."],
];

const BY_REGION: Record<string, string> = {
  "head-neck": "عضلة صغيرة من عضلات الرأس والعنق.",
  chest: "عضلة من عضلات الصدر والقفص الصدري.",
  back: "عضلة من عضلات الظهر.",
  shoulders: "عضلة من عضلات الكتف.",
  arms: "عضلة من عضلات الذراع والساعد.",
  abdomen: "عضلة من عضلات البطن والجذع.",
  pelvis: "عضلة من عضلات الحوض.",
  thigh: "عضلة من عضلات الفخذ.",
  adductors: "عضلة من عضلات باطن الفخذ.",
  legs: "عضلة من عضلات الساق والقدم.",
};

/** The explanation of a muscle of the model (always has an `about` sentence). */
export function explainMuscle(unitId: string, region?: string): MuscleExplanation {
  const groups = groupsOfUnit(unitId);
  if (groups.length) {
    const g = groups[groups.length - 1];
    return { about: g.fn, where: g.where, does: g.does, moves: g.moves };
  }
  for (const [re, about, where] of FAMILIES) if (re.test(unitId)) return { about, where, does: [], moves: [] };
  return { about: BY_REGION[region ?? ""] ?? "عضلة مستقلة في المجسم.", where: null, does: [], moves: [] };
}

/** The short description of a muscle (the summary line). */
export function describeMuscle(unitId: string, region?: string): string {
  return explainMuscle(unitId, region).about;
}

/** What the other kinds of structure are, in a sentence (bones, tendons, ligaments, …). */
export const STRUCTURE_ABOUT: Record<string, string> = {
  bone: "عظم من الهيكل العظمي: يدعم الجسم وترتبط به العضلات.",
  tendon: "وتر يربط العضلة بالعظم وينقل قوتها إليه.",
  ligament: "رباط يربط العظام ببعضها ويثبت المفصل.",
  fascia: "غشاء ليفي يغلف العضلات ويفصل بينها.",
  nerve: "عصب ينقل الإشارات بين الدماغ والعضلات والجلد.",
  attachment: "موضع ارتباط العضلة بالعظم.",
  fat: "وسادة دهنية تحت الجلد: تخزن الطاقة وتحمي ما تحتها وتعطي الجسم شكله.",
  vessel: "أوردة سطحية تعيد الدم إلى القلب، وتظهر تحت الجلد خاصة مع التمرين.",
  skin: "الجلد: الغطاء الخارجي للجسم.",
};
