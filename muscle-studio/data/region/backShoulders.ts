/**
 * Phase 1 — back and shoulders. Muscle units of the Z-Anatomy region model
 * (public/models/zanatomy/{male,female}/core.glb) with Arabic anatomy cards.
 * Content follows standard anatomy references (Gray's Anatomy, Moore's
 * Clinically Oriented Anatomy); spinal segments are the commonly cited ranges.
 */

export type Depth = 1 | 2 | 3;
export const DEPTH_NAMES: Record<Depth, string> = { 1: "سطحية", 2: "متوسطة", 3: "عميقة" };

export interface MuscleRef {
  ar: string;
  /** Unit id when the muscle exists in this region model (clickable). */
  id?: string;
}

export interface RegionMuscle {
  id: string;
  ar: string;
  en: string;
  latin: string;
  group: "back" | "shoulder";
  depth: Depth;
  origin: string;
  insertion: string;
  action: string;
  innervation: string;
  synergists: MuscleRef[];
  antagonists: MuscleRef[];
  note?: string;
}

const R = (ar: string, id?: string): MuscleRef => (id ? { ar, id } : { ar });

export const REGION_MUSCLES: RegionMuscle[] = [
  {
    id: "trapezius-upper",
    ar: "شبه المنحرفة — الجزء العلوي",
    en: "Trapezius — upper (descending) part",
    latin: "Pars descendens musculi trapezii",
    group: "back",
    depth: 1,
    origin: "الخط القفوي العلوي (ثلثه الإنسي) والنتوء القذالي الظاهر، والرباط القفوي الذي يتصل بالنواتئ الشوكية للفقرات العنقية.",
    insertion: "الثلث الوحشي للحافة الخلفية للترقوة.",
    action: "رفع لوح الكتف، والمشاركة في تدويره للأعلى عند رفع الذراع فوق الرأس. عند عمله من جهة واحدة يميل الرأس والعنق للجهة نفسها ويدير الوجه للجهة المقابلة.",
    innervation: "العصب الإضافي (العصب القحفي الحادي عشر) للحركة، وفروع من الأعصاب العنقية C3–C4 للحس العميق.",
    synergists: [R("الرافعة للوح الكتف", "levator-scapulae"), R("المعينية الكبرى", "rhomboid-major"), R("الجزء السفلي من شبه المنحرفة (في التدوير للأعلى)", "trapezius-lower"), R("المسننة الأمامية (في التدوير للأعلى)")],
    antagonists: [R("الجزء السفلي من شبه المنحرفة (في الخفض)", "trapezius-lower"), R("الظهرية العريضة", "latissimus-dorsi"), R("الصدرية الصغرى")],
  },
  {
    id: "trapezius-middle",
    ar: "شبه المنحرفة — الجزء الأوسط",
    en: "Trapezius — middle (transverse) part",
    latin: "Pars transversa musculi trapezii",
    group: "back",
    depth: 1,
    origin: "النواتئ الشوكية للفقرة العنقية السابعة والفقرات الصدرية العلوية (T1–T3 تقريبًا) والأربطة فوق الشوكية.",
    insertion: "الحافة الإنسية للأخرم والشفة العلوية لشوكة لوح الكتف.",
    action: "تقريب لوحي الكتف (سحبهما نحو العمود الفقري) وتثبيتهما أثناء حركات الذراع.",
    innervation: "العصب الإضافي (القحفي الحادي عشر)، وفروع C3–C4 للحس العميق.",
    synergists: [R("المعينية الكبرى", "rhomboid-major"), R("المعينية الصغرى", "rhomboid-minor"), R("الظهرية العريضة (تقريب مساعد)", "latissimus-dorsi")],
    antagonists: [R("المسننة الأمامية"), R("الصدرية الصغرى")],
  },
  {
    id: "trapezius-lower",
    ar: "شبه المنحرفة — الجزء السفلي",
    en: "Trapezius — lower (ascending) part",
    latin: "Pars ascendens musculi trapezii",
    group: "back",
    depth: 1,
    origin: "النواتئ الشوكية للفقرات الصدرية من الرابعة إلى الثانية عشرة (T4–T12) والأربطة فوق الشوكية.",
    insertion: "الحدبة عند الطرف الإنسي لشوكة لوح الكتف.",
    action: "خفض لوح الكتف، وتدويره للأعلى مع الجزء العلوي والمسننة الأمامية، والمساعدة في تقريبه.",
    innervation: "العصب الإضافي (القحفي الحادي عشر)، وفروع C3–C4 للحس العميق.",
    synergists: [R("المسننة الأمامية (التدوير للأعلى)"), R("الجزء العلوي من شبه المنحرفة (التدوير للأعلى)", "trapezius-upper"), R("الصدرية الصغرى (الخفض)")],
    antagonists: [R("الرافعة للوح الكتف", "levator-scapulae"), R("الجزء العلوي من شبه المنحرفة (الرفع)", "trapezius-upper"), R("المعينية الكبرى (التدوير للأسفل)", "rhomboid-major")],
  },
  {
    id: "latissimus-dorsi",
    ar: "الظهرية العريضة",
    en: "Latissimus dorsi",
    latin: "Musculus latissimus dorsi",
    group: "back",
    depth: 1,
    origin: "النواتئ الشوكية للفقرات الصدرية الست السفلى (T7–T12)، واللفافة الصدرية القطنية (ومن خلالها النواتئ الشوكية القطنية والعجزية)، والثلث الخلفي للعرف الحرقفي، والأضلاع الثلاثة أو الأربعة السفلى، وغالبًا الزاوية السفلية للوح الكتف.",
    insertion: "قاع الميزاب بين الحدبتين في عظم العضد.",
    action: "بسط العضد وتقريبه وتدويره للداخل. عندما تكون الذراعان ثابتتين فوق الرأس ترفع الجذع (التسلق والعقلة)، وتساعد في خفض لوح الكتف.",
    innervation: "العصب الصدري الظهري (C6–C8).",
    synergists: [R("المدورة الكبرى", "teres-major"), R("الدالية — الرأس الخلفي (البسط)", "deltoid-posterior"), R("الصدرية الكبرى — الرأس القصي الضلعي"), R("ثلاثية الرؤوس — الرأس الطويل")],
    antagonists: [R("الدالية — الرأس الأمامي (الثني)", "deltoid-anterior"), R("الدالية — الرأس الجانبي (التبعيد)", "deltoid-lateral"), R("فوق الشوكة", "supraspinatus"), R("تحت الشوكة (التدوير للخارج)", "infraspinatus")],
  },
  {
    id: "deltoid-anterior",
    ar: "الدالية — الرأس الأمامي",
    en: "Deltoid — anterior (clavicular) part",
    latin: "Pars clavicularis musculi deltoidei",
    group: "shoulder",
    depth: 1,
    origin: "الثلث الوحشي للحافة الأمامية للترقوة.",
    insertion: "الحدبة الدالية على السطح الوحشي لجسم العضد.",
    action: "ثني العضد (رفعه للأمام) وتدويره للداخل، والتقريب الأفقي.",
    innervation: "العصب الإبطي (C5–C6).",
    synergists: [R("الصدرية الكبرى — الرأس الترقوي"), R("الغرابية العضدية"), R("ذات الرأسين العضدية"), R("تحت الكتف (التدوير للداخل)", "subscapularis")],
    antagonists: [R("الدالية — الرأس الخلفي", "deltoid-posterior"), R("الظهرية العريضة", "latissimus-dorsi"), R("تحت الشوكة", "infraspinatus"), R("المدورة الصغرى", "teres-minor")],
  },
  {
    id: "deltoid-lateral",
    ar: "الدالية — الرأس الجانبي",
    en: "Deltoid — lateral (acromial) part",
    latin: "Pars acromialis musculi deltoidei",
    group: "shoulder",
    depth: 1,
    origin: "الحافة الوحشية والسطح العلوي للأخرم.",
    insertion: "الحدبة الدالية على السطح الوحشي لجسم العضد.",
    action: "تبعيد العضد بعد أن تبدأ العضلة فوق الشوكة أول الحركة (نحو 15°)، حتى مستوى الكتف.",
    innervation: "العصب الإبطي (C5–C6).",
    synergists: [R("فوق الشوكة", "supraspinatus"), R("الدالية — الرأسان الأمامي والخلفي", "deltoid-anterior"), R("شبه المنحرفة والمسننة الأمامية (تدوير لوح الكتف للأعلى)", "trapezius-upper")],
    antagonists: [R("الظهرية العريضة", "latissimus-dorsi"), R("المدورة الكبرى", "teres-major"), R("الصدرية الكبرى")],
  },
  {
    id: "deltoid-posterior",
    ar: "الدالية — الرأس الخلفي",
    en: "Deltoid — posterior (spinal) part",
    latin: "Pars spinalis musculi deltoidei",
    group: "shoulder",
    depth: 1,
    origin: "الشفة السفلية لشوكة لوح الكتف.",
    insertion: "الحدبة الدالية على السطح الوحشي لجسم العضد.",
    action: "بسط العضد وتدويره للخارج، والتبعيد الأفقي (سحب الذراع للخلف في مستوى الكتف).",
    innervation: "العصب الإبطي (C5–C6).",
    synergists: [R("الظهرية العريضة", "latissimus-dorsi"), R("المدورة الكبرى (البسط)", "teres-major"), R("تحت الشوكة", "infraspinatus"), R("المدورة الصغرى", "teres-minor")],
    antagonists: [R("الدالية — الرأس الأمامي", "deltoid-anterior"), R("الصدرية الكبرى"), R("تحت الكتف", "subscapularis")],
  },
  {
    id: "rhomboid-major",
    ar: "المعينية الكبرى",
    en: "Rhomboid major",
    latin: "Musculus rhomboideus major",
    group: "back",
    depth: 2,
    origin: "النواتئ الشوكية للفقرات الصدرية من الثانية إلى الخامسة (T2–T5) والأربطة فوق الشوكية.",
    insertion: "الحافة الإنسية للوح الكتف من مستوى جذر الشوكة حتى الزاوية السفلية.",
    action: "تقريب لوح الكتف ورفعه وتدويره للأسفل، وتثبيته على جدار الصدر.",
    innervation: "العصب الكتفي الظهري (C4–C5).",
    synergists: [R("المعينية الصغرى", "rhomboid-minor"), R("شبه المنحرفة — الجزء الأوسط", "trapezius-middle"), R("الرافعة للوح الكتف", "levator-scapulae")],
    antagonists: [R("المسننة الأمامية"), R("الصدرية الصغرى"), R("شبه المنحرفة — الجزء السفلي (التدوير للأعلى)", "trapezius-lower")],
  },
  {
    id: "rhomboid-minor",
    ar: "المعينية الصغرى",
    en: "Rhomboid minor",
    latin: "Musculus rhomboideus minor",
    group: "back",
    depth: 2,
    origin: "الطرف السفلي للرباط القفوي والنواتئ الشوكية للفقرتين C7 وT1.",
    insertion: "الحافة الإنسية للوح الكتف عند مستوى جذر الشوكة (المنطقة المثلثية الملساء).",
    action: "تقريب لوح الكتف ورفعه وتدويره للأسفل، وتثبيته على جدار الصدر.",
    innervation: "العصب الكتفي الظهري (C4–C5).",
    synergists: [R("المعينية الكبرى", "rhomboid-major"), R("شبه المنحرفة — الجزء الأوسط", "trapezius-middle"), R("الرافعة للوح الكتف", "levator-scapulae")],
    antagonists: [R("المسننة الأمامية"), R("الصدرية الصغرى")],
  },
  {
    id: "levator-scapulae",
    ar: "الرافعة للوح الكتف",
    en: "Levator scapulae",
    latin: "Musculus levator scapulae",
    group: "back",
    depth: 2,
    origin: "الحدبات الخلفية للنواتئ المستعرضة للفقرات العنقية الأربع الأولى (C1–C4).",
    insertion: "الحافة الإنسية للوح الكتف من الزاوية العلوية حتى جذر الشوكة.",
    action: "رفع لوح الكتف وتدويره للأسفل (إمالة التجويف الحقاني للأسفل). من جهة واحدة تميل العنق للجهة نفسها.",
    innervation: "العصب الكتفي الظهري (C5) وفروع مباشرة من الأعصاب العنقية C3–C4.",
    synergists: [R("شبه المنحرفة — الجزء العلوي (الرفع)", "trapezius-upper"), R("المعينية الكبرى", "rhomboid-major"), R("المعينية الصغرى", "rhomboid-minor")],
    antagonists: [R("شبه المنحرفة — الجزء السفلي", "trapezius-lower"), R("المسننة الأمامية")],
  },
  {
    id: "teres-major",
    ar: "المدورة الكبرى",
    en: "Teres major",
    latin: "Musculus teres major",
    group: "back",
    depth: 2,
    origin: "السطح الخلفي للزاوية السفلية للوح الكتف.",
    insertion: "الشفة الإنسية للميزاب بين الحدبتين في عظم العضد.",
    action: "تقريب العضد وتدويره للداخل وبسطه.",
    innervation: "العصب تحت الكتفي السفلي (C5–C6).",
    synergists: [R("الظهرية العريضة", "latissimus-dorsi"), R("تحت الكتف", "subscapularis"), R("الصدرية الكبرى")],
    antagonists: [R("الدالية — الرأس الجانبي", "deltoid-lateral"), R("فوق الشوكة", "supraspinatus"), R("تحت الشوكة", "infraspinatus"), R("المدورة الصغرى", "teres-minor")],
  },
  {
    id: "teres-minor",
    ar: "المدورة الصغرى",
    en: "Teres minor",
    latin: "Musculus teres minor",
    group: "back",
    depth: 2,
    origin: "الثلثان العلويان للحافة الوحشية للوح الكتف (سطحه الخلفي).",
    insertion: "الوجيه السفلي للحدبة الكبرى للعضد.",
    action: "تدوير العضد للخارج، وتثبيت رأس العضد في التجويف الحقاني (إحدى عضلات الكفة المدورة).",
    innervation: "العصب الإبطي (C5–C6).",
    synergists: [R("تحت الشوكة", "infraspinatus"), R("الدالية — الرأس الخلفي", "deltoid-posterior")],
    antagonists: [R("تحت الكتف", "subscapularis"), R("المدورة الكبرى", "teres-major"), R("الظهرية العريضة", "latissimus-dorsi"), R("الصدرية الكبرى")],
    note: "وترها جزء من شبكة العضلة نفسها في المصدر، ويظهر بلون عاجي عند ارتكازها على الحدبة الكبرى.",
  },
  {
    id: "infraspinatus",
    ar: "تحت الشوكة",
    en: "Infraspinatus",
    latin: "Musculus infraspinatus",
    group: "back",
    depth: 2,
    origin: "الحفرة تحت الشوكة في لوح الكتف ولفافتها.",
    insertion: "الوجيه الأوسط للحدبة الكبرى للعضد.",
    action: "تدوير العضد للخارج، وتثبيت رأس العضد في التجويف الحقاني (إحدى عضلات الكفة المدورة).",
    innervation: "العصب فوق الكتفي (C5–C6).",
    synergists: [R("المدورة الصغرى", "teres-minor"), R("الدالية — الرأس الخلفي", "deltoid-posterior")],
    antagonists: [R("تحت الكتف", "subscapularis"), R("المدورة الكبرى", "teres-major"), R("الظهرية العريضة", "latissimus-dorsi"), R("الصدرية الكبرى")],
    note: "وترها جزء من شبكة العضلة نفسها في المصدر، ويظهر بلون عاجي عند ارتكازها على الحدبة الكبرى.",
  },
  {
    id: "supraspinatus",
    ar: "فوق الشوكة",
    en: "Supraspinatus",
    latin: "Musculus supraspinatus",
    group: "shoulder",
    depth: 2,
    origin: "الحفرة فوق الشوكة في لوح الكتف.",
    insertion: "الوجيه العلوي للحدبة الكبرى للعضد.",
    action: "بدء تبعيد العضد (نحو أول 15°) ثم مساعدة الدالية، وتثبيت رأس العضد في التجويف الحقاني (إحدى عضلات الكفة المدورة).",
    innervation: "العصب فوق الكتفي (C5–C6).",
    synergists: [R("الدالية — الرأس الجانبي", "deltoid-lateral")],
    antagonists: [R("الظهرية العريضة", "latissimus-dorsi"), R("المدورة الكبرى", "teres-major"), R("الصدرية الكبرى")],
    note: "يمر وترها تحت الأخرم فوق رأس العضد، ويظهر بلون عاجي حيث يصبح النسيج رقيقًا.",
  },
  {
    id: "erector-spinae",
    ar: "الناصبة للفقار",
    en: "Erector spinae",
    latin: "Musculus erector spinae",
    group: "back",
    depth: 3,
    origin: "وتر عريض مشترك من السطح الخلفي للعجز، والجزء الخلفي من العرف الحرقفي، والنواتئ الشوكية للفقرات القطنية والصدريتين السفليين.",
    insertion: "الحرقفية الضلعية: زوايا الأضلاع والنواتئ المستعرضة للفقرات العنقية السفلى. الطويلة: النواتئ المستعرضة الصدرية والعنقية والناتئ الخشائي. الشوكية: النواتئ الشوكية الصدرية العلوية والعنقية وقاعدة القحف.",
    action: "من الجهتين: بسط العمود الفقري والرأس، والتحكم في الانحناء للأمام. من جهة واحدة: إمالة العمود الفقري للجهة نفسها.",
    innervation: "الفروع الخلفية (الظهرية) للأعصاب الشوكية في المستويات المقابلة.",
    synergists: [R("متعددة الأقسام"), R("شبه الشوكية"), R("المربعة القطنية (الإمالة الجانبية)")],
    antagonists: [R("المستقيمة البطنية"), R("المائلتان الخارجية والداخلية للبطن (الثني)")],
    note: "تتكون في هذا النموذج من تسع شبكات لكل جانب: الحرقفية الضلعية (القطنية والصدرية والعنقية)، والطويلة (الصدرية والعنقية والرأسية)، والشوكية (الصدرية والعنقية والرأسية).",
  },
  {
    id: "subscapularis",
    ar: "تحت الكتف",
    en: "Subscapularis",
    latin: "Musculus subscapularis",
    group: "shoulder",
    depth: 3,
    origin: "الحفرة تحت الكتف (السطح الأمامي للوح الكتف المواجه للأضلاع).",
    insertion: "الحدبة الصغرى للعضد والجزء الأمامي من محفظة المفصل.",
    action: "تدوير العضد للداخل وتقريبه، وتثبيت رأس العضد في التجويف الحقاني (إحدى عضلات الكفة المدورة).",
    innervation: "العصبان تحت الكتفيين العلوي والسفلي (C5–C6).",
    synergists: [R("المدورة الكبرى", "teres-major"), R("الظهرية العريضة", "latissimus-dorsi"), R("الصدرية الكبرى"), R("الدالية — الرأس الأمامي", "deltoid-anterior")],
    antagonists: [R("تحت الشوكة", "infraspinatus"), R("المدورة الصغرى", "teres-minor"), R("الدالية — الرأس الخلفي", "deltoid-posterior")],
    note: "تقع على الوجه الأمامي للوح الكتف بينه وبين القفص الصدري؛ تظهر من الخلف بعد إخفاء الطبقات أو بتدوير النموذج.",
  },
];

export const REGION_MUSCLE_BY_ID = new Map(REGION_MUSCLES.map((m) => [m.id, m]));

export const LAYER_NAMES = {
  muscles: "العضلات",
  tendons: "الأوتار والأربطة",
  bones: "العظام والغضاريف",
  fasciae: "اللفافات والجرابات",
  attachments: "مواضع المنشأ والمرتكز",
  nerves: "الأعصاب الطرفية",
} as const;
export type RegionLayer = keyof typeof LAYER_NAMES;
