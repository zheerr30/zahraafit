import { groupsOfUnit } from "@/data/exercises/groups";

/**
 * What a muscle does, in one or two short plain sentences — for the summary a
 * person sees when tapping a muscle. No anatomical jargon (that is under
 * "learn more"). Muscles of the exercise groups take the group's line; the
 * small muscles outside them are described by family here.
 */
const FAMILIES: [RegExp, string][] = [
  [/^(inferior|superior|lateral|medial)-rectus-muscle$|^(inferior|superior)-oblique-muscle$/, "من عضلات العين: تحرّك العين في اتجاهات النظر المختلفة."],
  [/levator-palpebrae/, "ترفع الجفن العلوي لفتح العين."],
  [/tarsus$/, "صفيحة ليفية تعطي الجفن شكله وتدعمه."],
  [/orbicularis-oculi/, "تغلق الجفون، كما في الرمش وإغماض العين."],
  [/orbicularis-oris/, "تضمّ الشفتين وتغلق الفم."],
  [/masseter|temporalis|pterygoid/, "من عضلات المضغ: تحرّك الفك السفلي لإغلاق الفم وطحن الطعام."],
  [/genioglossus|hyoglossus/, "من عضلات اللسان: تحرّكه أثناء الكلام والبلع."],
  [/frontalis|occipitalis|temporoparietalis/, "ترفع الحاجبين وتحرّك فروة الرأس."],
  [/bucinator|corrugator|depressor|levator-(anguli|labii|nasolabialis)|mentalis|nasalis|procerus|risorius|zygomaticus/, "من عضلات تعابير الوجه: تحرّك الشفتين والخدّين والحاجبين."],
  [/platysma/, "عضلة رقيقة تحت جلد العنق، تشدّه وتنزل زاوية الفم."],
  [/arytenoid|cricothyroid/, "من عضلات الحنجرة: تتحكم في الأحبال الصوتية عند الكلام والتنفس."],
  [/pharyngeal|pharyngeus/, "من عضلات البلعوم: تدفع الطعام نحو المريء عند البلع."],
  [/hyoid|digastric|sternothyroid/, "تحرّك الحنجرة وأسفل الفك عند البلع والكلام."],
  [/rectus-(anterior|lateralis|posterior)|obliquus-(inferior|superior)-capitis/, "عضلات صغيرة أسفل الجمجمة تضبط حركات الرأس الدقيقة."],
  [/interspinales|rotatores|intertransversarii|semispinalis-colli|multifidus-colli/, "عضلات صغيرة عميقة بين الفقرات، تثبّت العمود الفقري وتساعد على استقامة الظهر."],
  [/serratus-posterior|levatores-.*costarum|transversus-thoracis/, "تساعد على حركة الأضلاع أثناء التنفس."],
  [/subclavius/, "عضلة صغيرة تحت الترقوة تثبّتها في مكانها."],
  [/coracobrachialis/, "تساعد على رفع الذراع للأمام وضمّها نحو الجسم."],
  [/pronator-quadratus/, "تدير الساعد لتصير راحة اليد للأسفل."],
  [/abductor-pollicis-longus|extensor-(indicis|pollicis)/, "تفرد الإبهام والسبابة وتبعدهما عن باقي الأصابع."],
  [/popliteus/, "عضلة صغيرة خلف الركبة تساعد على بدء ثنيها وتثبيتها."],
  [/fibularis-tertius/, "تساعد على رفع مقدّمة القدم وإمالتها للخارج."],
  [/obturator-externus/, "تدير الفخذ للخارج وتثبّت مفصل الورك."],
  [/anal-sphincter/, "عضلة حلقية تتحكم في إغلاق فتحة الشرج."],
  [/of-foot|hallucis|plantar-interossei|digitorum-brevis|quadratus-plantae/, "من عضلات القدم الصغيرة: تحرّك الأصابع وتسند قوس القدم."],
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

/** The short description of a muscle of the model (always a sentence, never empty). */
export function describeMuscle(unitId: string, region?: string): string {
  const groups = groupsOfUnit(unitId);
  if (groups.length) return groups[groups.length - 1].fn;
  for (const [re, text] of FAMILIES) if (re.test(unitId)) return text;
  return BY_REGION[region ?? ""] ?? "عضلة مستقلة في المجسّم.";
}
