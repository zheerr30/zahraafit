/* ============================================================
   ZahraaFit — مولّد الجداول الرياضية
   نسخة أولى كاملة وشغّالة
   ============================================================ */

/* ---------- العضلات الـ14 (مطابقة لملف العميلة) ---------- */
const MUSCLES = {
  chest:      "صدر",
  upperback:  "ظهر علوي",
  midback:    "ظهر اوسط",
  lats:       "ظهر علوي",      // تستخدم نفس صورة الظهر
  frontdelt:  "اكتاف امامية",
  reardelt:   "كتف خلفي",
  sidedelt:   "كتف علوي",
  biceps:     "عضلات البايسبس",
  triceps:    "عضلات التراي سبس",
  absfront:   "بطن",
  absside:    "بطن جانبي",
  quads:      "فخذ داخلي",
  hamstrings: "فخذ خلفي",
  glutes:     "المؤخرة",
  calves:     "السمانة"
};
/* قائمة الصور التي ترفعها العميلة مرة واحدة */
const IMAGE_SLOTS = [
  ["chest","صدر"],["midback","ظهر اوسط"],["upperback","ظهر علوي"],
  ["frontdelt","اكتاف امامية"],["reardelt","كتف خلفي"],["sidedelt","كتف علوي"],
  ["biceps","عضلات البايسبس"],["triceps","عضلات التراي سبس"],
  ["absfront","بطن"],["absside","بطن جانبي"],
  ["quads","فخذ داخلي"],["hamstrings","فخذ خلفي"],
  ["glutes","المؤخرة"],["calves","السمانة"]
];

/* ---------- مجموعات العضلات للعرض في منتقي التمارين ---------- */
const MGROUPS = [
  ["chest","الصدر","🫀"],
  ["back","الظهر","🔙"],
  ["shoulders","الأكتاف","💪"],
  ["biceps","البايسبس","💪"],
  ["triceps","الترايسبس","💪"],
  ["quads","فخذ أمامي","🦵"],
  ["hams","فخذ خلفي","🦵"],
  ["adductors","فخذ داخلي","🦵"],
  ["calves","سمانة","🦵"],
  ["glutes","المؤخرة","🍑"],
  ["abs","البطن","🔥"]
];

/* ============================================================
   قاعدة بيانات التمارين
   env: gym | home | bodyweight
   group: مجموعة العرض | muscle: العضلة المستهدفة (للصورة)
   level: 1 مبتدئ 2 متوسط 3 متقدم (الحد الأدنى)
   risk: مفاصل/مناطق حسّاسة لمراعاة الحالات الصحية
   tip: تنبيه أداء سطر واحد
   ============================================================ */
const EX = [
  /* ---------------- الصدر ---------------- */
  {id:"bench",name:"بنش بريس بالبار",group:"chest",muscle:"chest",env:["gym"],level:1,risk:["shoulder"],tip:"حافظ على لوح كتفك مشدوداً للخلف ولا تباعد مرفقيك كثيراً."},
  {id:"inclinedb",name:"بنش مائل بالدمبل",group:"chest",muscle:"chest",env:["gym","home"],level:1,risk:["shoulder"],tip:"انزل بتحكم حتى تشعر بتمدد بسيط دون ألم في الكتف."},
  {id:"chestpress",name:"جهاز ضغط الصدر",group:"chest",muscle:"chest",env:["gym"],level:1,risk:[],tip:"اضبط ارتفاع المقعد بحيث يكون المقبض بمستوى منتصف صدرك."},
  {id:"pushup",name:"تمرين الضغط (بوش أب)",group:"chest",muscle:"chest",env:["home","bodyweight"],level:1,risk:["wrist"],tip:"حافظ على جسمك بخط مستقيم من الرأس للكعب."},
  {id:"bandfly",name:"تفتيح بالشريط المطاطي",group:"chest",muscle:"chest",env:["home"],level:1,risk:[],tip:"اعصر صدرك في نهاية الحركة ولا تفرد ذراعيك بالكامل."},
  {id:"dips",name:"غطس الصدر (ديبس)",group:"chest",muscle:"chest",env:["gym","bodyweight"],level:2,risk:["shoulder"],tip:"مِل بجذعك للأمام قليلاً لاستهداف الصدر وتجنّب إجهاد الكتف."},
  {id:"cablecross",name:"تقاطع الكيبل للصدر",group:"chest",muscle:"chest",env:["gym"],level:2,risk:[],tip:"اعصري صدرك في منتصف الحركة وتحكّمي في الرجوع ببطء."},
  {id:"declinepush",name:"ضغط مائل لأسفل",group:"chest",muscle:"chest",env:["home","bodyweight"],level:2,risk:["wrist"],tip:"ارفعي قدميك على سطح مرتفع لاستهداف أسفل الصدر."},
  {id:"flatdb",name:"بنش مستوٍ بالدمبل",group:"chest",muscle:"chest",env:["gym","home"],level:1,risk:["shoulder"],tip:"أنزلي الدمبل لمستوى الصدر وادفعي للأعلى بثبات."},

  /* ---------------- الظهر ---------------- */
  {id:"latpull",name:"سحب أمامي (لات بول داون)",group:"back",muscle:"upperback",env:["gym"],level:1,risk:[],tip:"اسحب البار لأعلى صدرك واخفض كتفيك بعيداً عن أذنيك."},
  {id:"seatedrow",name:"تجديف جالس بالكيبل",group:"back",muscle:"midback",env:["gym"],level:1,risk:["lowerback"],tip:"حافظ على ظهرك مستقيماً ولا تتأرجح بجذعك."},
  {id:"bentrow",name:"تجديف بالبار منحنياً",group:"back",muscle:"midback",env:["gym","home"],level:2,risk:["lowerback"],tip:"ثبّت ظهرك مستقيماً والانحناء يكون من الورك لا من الظهر."},
  {id:"dbrow",name:"تجديف بالدمبل",group:"back",muscle:"midback",env:["gym","home"],level:1,risk:["lowerback"],tip:"استند بيدك على مقعد وحافظ على ظهر مستوٍ طوال الحركة."},
  {id:"bandrow",name:"تجديف بالشريط المطاطي",group:"back",muscle:"midback",env:["home"],level:1,risk:[],tip:"اسحب الشريط نحو بطنك واعصر لوحي كتفك معاً."},
  {id:"pullup",name:"العقلة (بول أب)",group:"back",muscle:"upperback",env:["gym","bodyweight"],level:3,risk:["shoulder"],tip:"ابدأ بذراعين ممدودتين واسحب حتى يتجاوز ذقنك البار."},
  {id:"superman",name:"سوبرمان (تقوية أسفل الظهر)",group:"back",muscle:"midback",env:["home","bodyweight"],level:1,risk:[],tip:"ارفعي ذراعيك وساقيك برفق دون فرط تقويس للظهر."},
  {id:"facepull",name:"سحب للوجه بالكيبل",group:"back",muscle:"upperback",env:["gym"],level:1,risk:[],tip:"اسحبي الحبل نحو وجهك مع فتح المرفقين لتنشيط أعلى الظهر."},
  {id:"closegrippull",name:"سحب أمامي قبضة ضيقة",group:"back",muscle:"lats",env:["gym"],level:1,risk:[],tip:"اسحبي لأسفل الصدر واعصري عضلات الظهر في النهاية."},
  {id:"invertedrow",name:"تجديف معكوس (بار منخفض)",group:"back",muscle:"midback",env:["home","bodyweight"],level:2,risk:[],tip:"حافظي على جسمك مستقيماً واسحبي صدرك نحو البار."},
  {id:"bandlatpull",name:"سحب علوي بالشريط",group:"back",muscle:"upperback",env:["home"],level:1,risk:[],tip:"اسحبي الشريط لأسفل خلف رقبتك مع خفض الكتفين."},
  {id:"towelrow",name:"تجديف بالمنشفة/الباب",group:"back",muscle:"midback",env:["bodyweight","home"],level:1,risk:[],tip:"أمسكي منشفة حول عمود ثابت واسحبي جسمك للخلف بظهر مستقيم."},
  {id:"reverssnow",name:"ملاك الثلج المعكوس",group:"back",muscle:"upperback",env:["bodyweight","home"],level:1,risk:[],tip:"استلقي على بطنك وحرّكي ذراعيك كأنك ترسمين قوساً مع عصر الظهر."},
  {id:"birddog",name:"تمرين الكلب-الطائر",group:"back",muscle:"midback",env:["bodyweight","home"],level:1,risk:[],tip:"مدّي ذراعاً وساقاً معاكسة مع شدّ البطن وثبات الظهر."},

  /* ---------------- الأكتاف ---------------- */
  {id:"ohp",name:"ضغط الكتف بالبار",group:"shoulders",muscle:"frontdelt",env:["gym"],level:2,risk:["shoulder","lowerback"],tip:"شدّ بطنك ولا تقوّس أسفل ظهرك أثناء الدفع لأعلى."},
  {id:"dbshoulder",name:"ضغط الكتف بالدمبل",group:"shoulders",muscle:"frontdelt",env:["gym","home"],level:1,risk:["shoulder"],tip:"ادفع لأعلى دون قفل المرفقين بالكامل."},
  {id:"lateral",name:"رفرفة جانبية",group:"shoulders",muscle:"sidedelt",env:["gym","home"],level:1,risk:["shoulder"],tip:"ارفع حتى مستوى الكتف فقط وقُد الحركة بمرفقك."},
  {id:"reardelt",name:"رفرفة خلفية",group:"shoulders",muscle:"reardelt",env:["gym","home"],level:1,risk:[],tip:"انحنِ قليلاً للأمام واعصر مؤخرة كتفك في الأعلى."},
  {id:"bandlateral",name:"رفرفة جانبية بالشريط",group:"shoulders",muscle:"sidedelt",env:["home"],level:1,risk:[],tip:"تحكّم في النزول ولا تدع الشريط يسحب ذراعك بسرعة."},
  {id:"pike",name:"ضغط بايك (للكتف بوزن الجسم)",group:"shoulders",muscle:"frontdelt",env:["bodyweight"],level:2,risk:["shoulder","wrist"],tip:"ارفع وركك عالياً واخفض رأسك برفق نحو الأرض."},
  {id:"wallpush",name:"ضغط الكتف على الحائط",group:"shoulders",muscle:"frontdelt",env:["bodyweight","home"],level:1,risk:["shoulder"],tip:"قف مائلاً نحو الحائط وادفع بثبات دون قفل المرفقين."},
  {id:"armcircle",name:"تدوير الذراعين (تنشيط الكتف)",group:"shoulders",muscle:"sidedelt",env:["bodyweight","home"],level:1,risk:[],tip:"ابدأ بدوائر صغيرة وكبّرها تدريجياً مع تحكم كامل."},

  /* ---------------- البايسبس ---------------- */
  {id:"barbellcurl",name:"مرجحة بايسبس بالبار",group:"biceps",muscle:"biceps",env:["gym","home"],level:1,risk:[],tip:"ثبّت مرفقيك بجانبك ولا تتأرجح بجسمك."},
  {id:"dbcurl",name:"مرجحة بايسبس بالدمبل",group:"biceps",muscle:"biceps",env:["gym","home"],level:1,risk:[],tip:"اعصر العضلة في الأعلى وانزل ببطء."},
  {id:"hammer",name:"مرجحة مطرقية",group:"biceps",muscle:"biceps",env:["gym","home"],level:1,risk:[],tip:"حافظ على راحتي يدك متقابلتين طوال الحركة."},
  {id:"bandcurl",name:"مرجحة بايسبس بالشريط",group:"biceps",muscle:"biceps",env:["home"],level:1,risk:[],tip:"حافظ على شدّ ثابت في الشريط ولا ترخِه فجأة."},
  {id:"chinup",name:"عقلة قبضة عكسية",group:"biceps",muscle:"biceps",env:["bodyweight"],level:3,risk:["shoulder"],tip:"اسحب بقبضة ضيقة مع التركيز على شدّ البايسبس."},
  {id:"bwcurl",name:"مرجحة بايسبس بالمنشفة",group:"biceps",muscle:"biceps",env:["bodyweight","home"],level:1,risk:[],tip:"شدّي المنشفة بمقاومة ذاتية أثناء ثنيها نحو كتفك."},
  {id:"isocurl",name:"انقباض ثابت للبايسبس",group:"biceps",muscle:"biceps",env:["bodyweight","home"],level:1,risk:[],tip:"اضغطي راحتك ضد بعضها وثبّتي الانقباض على شكل زاوية 90°."},

  /* ---------------- الترايسبس ---------------- */
  {id:"pushdown",name:"دفع الترايسبس بالكيبل",group:"triceps",muscle:"triceps",env:["gym"],level:1,risk:[],tip:"ثبّت مرفقيك بجانبك وافرد ذراعيك بالكامل في الأسفل."},
  {id:"skull",name:"تمرين الجمجمة بالدمبل",group:"triceps",muscle:"triceps",env:["gym","home"],level:2,risk:["elbow"],tip:"حرّك من المرفق فقط وثبّت عضدك عمودياً."},
  {id:"overheadtri",name:"تمديد علوي للترايسبس",group:"triceps",muscle:"triceps",env:["gym","home"],level:1,risk:["shoulder"],tip:"أبقِ مرفقيك قريبين من رأسك أثناء التمديد."},
  {id:"bandpush",name:"دفع الترايسبس بالشريط",group:"triceps",muscle:"triceps",env:["home"],level:1,risk:[],tip:"افرد ذراعيك بالكامل واعصر الترايسبس في النهاية."},
  {id:"benchdip",name:"غطس على المقعد",group:"triceps",muscle:"triceps",env:["home","bodyweight"],level:1,risk:["shoulder"],tip:"أبقِ جسمك قريباً من المقعد ولا تنزل لأبعد من زاوية مريحة للكتف."},
  {id:"diamondpush",name:"ضغط ماسي للترايسبس",group:"triceps",muscle:"triceps",env:["bodyweight"],level:2,risk:["wrist"],tip:"ضمّ يديك على شكل ماسة تحت صدرك وحافظ على مرفقيك قريبين."},

  /* ---------------- الأرجل ---------------- */
  {id:"squat",name:"سكوات بالبار",group:"quads",muscle:"quads",env:["gym"],level:2,risk:["knee","lowerback"],tip:"انزل والركبتان باتجاه أصابع القدم وظهرك مستقيم."},
  {id:"legpress",name:"جهاز دفع الأرجل",group:"quads",muscle:"quads",env:["gym"],level:1,risk:["knee"],tip:"لا تقفل ركبتيك في الأعلى وحافظ على ظهرك ملاصقاً للمقعد."},
  {id:"legext",name:"جهاز تمديد الأرجل",group:"quads",muscle:"quads",env:["gym"],level:1,risk:["knee"],tip:"ارفع بتحكم واعصر الفخذ في الأعلى دون اندفاع."},
  {id:"legcurl",name:"جهاز ثني الأرجل (خلفي)",group:"hams",muscle:"hamstrings",env:["gym"],level:1,risk:["knee"],tip:"حرّك ببطء واعصر الفخذ الخلفي في النهاية."},
  {id:"rdl",name:"رفعة رومانية بالدمبل",group:"hams",muscle:"hamstrings",env:["gym","home"],level:2,risk:["lowerback","knee"],tip:"ادفع وركك للخلف وحافظ على ظهرك مستقيماً تماماً."},
  {id:"gobletsquat",name:"سكوات كأسي بالدمبل",group:"quads",muscle:"quads",env:["gym","home"],level:1,risk:["knee"],tip:"أبقِ صدرك مرفوعاً وكعبيك ملاصقين للأرض."},
  {id:"lunge",name:"طعنات (لانجز)",group:"quads",muscle:"quads",env:["home","bodyweight","gym"],level:1,risk:["knee"],tip:"اخطُ خطوة ثابتة ولا تدع ركبتك الأمامية تتجاوز أصابع قدمك كثيراً."},
  {id:"bandsquat",name:"سكوات بالشريط",group:"quads",muscle:"quads",env:["home"],level:1,risk:["knee"],tip:"ادفع ركبتيك للخارج ضد مقاومة الشريط."},
  {id:"wallsit",name:"الجلوس على الحائط",group:"quads",muscle:"quads",env:["bodyweight","home"],level:1,risk:["knee"],tip:"حافظ على زاوية 90° للركبة وظهرك ملاصق للحائط."},
  {id:"calfraise",name:"رفع السمانة",group:"calves",muscle:"calves",env:["gym","home","bodyweight"],level:1,risk:[],tip:"ارفعي على أطراف أصابعك لأقصى مدى واعصري السمانة."},
  {id:"hacksquat",name:"سكوات هاك بالجهاز",group:"quads",muscle:"quads",env:["gym"],level:2,risk:["knee"],tip:"حافظي على ظهرك ملاصقاً للوسادة وانزلي بتحكم."},
  {id:"bulgarian",name:"سكوات بلغاري",group:"quads",muscle:"quads",env:["gym","home"],level:2,risk:["knee"],tip:"ارفعي قدمك الخلفية على مقعد وانزلي بثبات على الأمامية."},
  {id:"stepup",name:"الصعود على المنصة",group:"quads",muscle:"quads",env:["home","bodyweight","gym"],level:1,risk:["knee"],tip:"اصعدي بالكامل على المنصة وادفعي من كعب القدم الأمامية."},
  {id:"seatedcalf",name:"رفع السمانة جالساً",group:"calves",muscle:"calves",env:["gym"],level:1,risk:[],tip:"حرّكي ببطء واعصري السمانة في أعلى الحركة."},
  {id:"sumosquat",name:"سكوات سومو",group:"quads",muscle:"quads",env:["home","bodyweight","gym"],level:1,risk:["knee"],tip:"باعدي قدميك ووجّهي أصابعك للخارج لاستهداف الفخذ الداخلي."},

  /* ---------------- المؤخرة ---------------- */
  {id:"hipthrust",name:"دفع الورك (هيب ثرست)",group:"glutes",muscle:"glutes",env:["gym","home"],level:1,risk:["lowerback"],tip:"اعصر مؤخرتك في الأعلى ولا تفرط في تقويس ظهرك."},
  {id:"glutebridge",name:"جسر المؤخرة",group:"glutes",muscle:"glutes",env:["home","bodyweight"],level:1,risk:[],tip:"ادفع من كعبيك واعصر المؤخرة في الأعلى لثانية."},
  {id:"kickback",name:"رفس خلفي للمؤخرة",group:"glutes",muscle:"glutes",env:["home","bodyweight","gym"],level:1,risk:[],tip:"حرّك من الورك فقط وحافظ على ظهرك ثابتاً."},
  {id:"bandkick",name:"رفس خلفي بالشريط",group:"glutes",muscle:"glutes",env:["home"],level:1,risk:[],tip:"ادفع كعبك للخلف ببطء ضد مقاومة الشريط."},
  {id:"cablekick",name:"رفس خلفي بالكيبل",group:"glutes",muscle:"glutes",env:["gym"],level:1,risk:[],tip:"حرّكي من الورك واعصري المؤخرة في نهاية الحركة."},
  {id:"abduction",name:"جهاز تبعيد الأرجل",group:"glutes",muscle:"glutes",env:["gym"],level:1,risk:[],tip:"افتحي ساقيك ضد المقاومة واعصري الجانب."},
  {id:"frogpump",name:"ضخ الضفدع للمؤخرة",group:"glutes",muscle:"glutes",env:["home","bodyweight"],level:1,risk:[],tip:"ضمّي كعبيك معاً وادفعي وركك لأعلى بعصر قوي."},
  {id:"sidelunge",name:"طعنة جانبية",group:"glutes",muscle:"glutes",env:["home","bodyweight","gym"],level:1,risk:["knee"],tip:"اخطي للجانب وانزلي على ساق واحدة مع إبقاء الأخرى ممدودة."},

  /* ---------------- البطن ---------------- */
  {id:"crunch",name:"كرنش (تقريب علوي)",group:"abs",muscle:"absfront",env:["gym","home","bodyweight"],level:1,risk:["neck","diastasis"],tip:"ارفع كتفيك عن الأرض دون شدّ رقبتك بيديك."},
  {id:"plank",name:"بلانك (الثبات)",group:"abs",muscle:"absfront",env:["gym","home","bodyweight"],level:1,risk:["lowerback"],tip:"حافظ على جسمك بخط مستقيم ولا ترخِ وركك للأسفل."},
  {id:"legraise",name:"رفع الأرجل",group:"abs",muscle:"absfront",env:["gym","home","bodyweight"],level:2,risk:["lowerback","diastasis"],tip:"ألصق أسفل ظهرك بالأرض ولا ترفع رجليك باندفاع."},
  {id:"russian",name:"الالتفاف الروسي",group:"abs",muscle:"absside",env:["home","bodyweight","gym"],level:1,risk:["lowerback","diastasis"],tip:"لُف من خصرك ببطء وحافظ على ظهر مستقيم."},
  {id:"sideplank",name:"بلانك جانبي",group:"abs",muscle:"absside",env:["gym","home","bodyweight"],level:1,risk:["shoulder"],tip:"ارفع وركك واحفظ جسمك بخط مستقيم من الكتف للقدم."},
  {id:"bicycle",name:"كرنش الدراجة",group:"abs",muscle:"absside",env:["home","bodyweight","gym"],level:1,risk:["neck","diastasis"],tip:"لامس مرفقك بالركبة المعاكسة دون شدّ رقبتك."},

  /* ===== مكتبة التمارين الإضافية ===== */
  /* صدر */
  {id:"pecdeck",name:"جهاز التفتيح (بيك ديك)",group:"chest",muscle:"chest",env:["gym"],level:1,risk:["shoulder"],tip:"اجمعي ذراعيك أمامك ببطء واعصري الصدر في المنتصف."},
  {id:"inclinemachine",name:"جهاز ضغط صدر علوي",group:"chest",muscle:"chest",env:["gym"],level:1,risk:["shoulder"],tip:"ادفعي لأعلى لاستهداف الجزء العلوي من الصدر."},
  {id:"svendpress",name:"ضغط سفيند بالدمبل",group:"chest",muscle:"chest",env:["home","gym"],level:2,risk:[],tip:"اضغطي دمبل بين راحتيك وادفعيه للأمام مع عصر الصدر."},
  {id:"widepush",name:"ضغط واسع",group:"chest",muscle:"chest",env:["bodyweight","home"],level:1,risk:["wrist"],tip:"باعدي يديك أوسع من كتفيك لاستهداف الصدر أكثر."},

  /* ظهر */
  {id:"tbar",name:"تجديف تي-بار",group:"back",muscle:"midback",env:["gym"],level:2,risk:["lowerback"],tip:"حافظي على ظهر مستقيم واسحبي البار نحو بطنك."},
  {id:"machinerow",name:"جهاز التجديف",group:"back",muscle:"midback",env:["gym"],level:1,risk:[],tip:"اسحبي المقبض نحو بطنك واعصري لوحي الكتف."},
  {id:"straightpull",name:"سحب بذراع ممدودة",group:"back",muscle:"lats",env:["gym"],level:2,risk:[],tip:"أبقي ذراعيك ممدودتين واسحبي البار لأسفل من فوق."},
  {id:"deadlift",name:"الرفعة الميتة",group:"back",muscle:"midback",env:["gym"],level:3,risk:["lowerback","knee"],tip:"حافظي على ظهر مستقيم تماماً وارفعي بدفع الورك."},

  /* أكتاف */
  {id:"arnold",name:"ضغط أرنولد",group:"shoulders",muscle:"frontdelt",env:["gym","home"],level:2,risk:["shoulder"],tip:"لُفّي راحتيك أثناء الدفع لأعلى لتفعيل الكتف بالكامل."},
  {id:"frontraise",name:"رفعة أمامية",group:"shoulders",muscle:"frontdelt",env:["gym","home"],level:1,risk:["shoulder"],tip:"ارفعي الوزن أمامك لمستوى الكتف بتحكم دون تأرجح."},
  {id:"uprightrow",name:"تجديف عمودي",group:"shoulders",muscle:"sidedelt",env:["gym","home"],level:2,risk:["shoulder"],tip:"اسحبي الوزن لأعلى قرب جسمك حتى مستوى الصدر."},
  {id:"cablelateral",name:"رفرفة جانبية بالكيبل",group:"shoulders",muscle:"sidedelt",env:["gym"],level:2,risk:["shoulder"],tip:"ارفعي ذراعك للجانب بثبات وقاومي النزول ببطء."},

  /* بايسبس */
  {id:"preachercurl",name:"مرجحة بريتشر",group:"biceps",muscle:"biceps",env:["gym"],level:1,risk:[],tip:"ثبّتي عضدك على الوسادة وارفعي بتحكم كامل."},
  {id:"concentration",name:"مرجحة تركيز",group:"biceps",muscle:"biceps",env:["gym","home"],level:1,risk:[],tip:"اسندي مرفقك على فخذك واعصري البايسبس في الأعلى."},
  {id:"cablecurl",name:"مرجحة بايسبس بالكيبل",group:"biceps",muscle:"biceps",env:["gym"],level:1,risk:[],tip:"حافظي على شدّ ثابت طوال الحركة دون تأرجح."},
  {id:"spidercurl",name:"مرجحة العنكبوت",group:"biceps",muscle:"biceps",env:["gym"],level:2,risk:[],tip:"انحني للأمام ودعي ذراعيك تتدليان ثم ارفعي بعزل تام."},

  /* ترايسبس */
  {id:"ropepush",name:"دفع الترايسبس بالحبل",group:"triceps",muscle:"triceps",env:["gym"],level:1,risk:[],tip:"افتحي الحبل في الأسفل واعصري الترايسبس بالكامل."},
  {id:"kickbacktri",name:"ركلة الترايسبس",group:"triceps",muscle:"triceps",env:["gym","home"],level:1,risk:[],tip:"ثبّتي عضدك موازياً للأرض وافردي ساعدك للخلف."},
  {id:"closegrippress",name:"بنش قبضة ضيقة",group:"triceps",muscle:"triceps",env:["gym"],level:2,risk:["shoulder","wrist"],tip:"ضمّي قبضتك على البار وأبقي مرفقيك قريبين من جسمك."},
  {id:"overheadrope",name:"تمديد علوي بالحبل",group:"triceps",muscle:"triceps",env:["gym"],level:2,risk:["shoulder"],tip:"مدّي الحبل لأعلى خلف رأسك واعصري الترايسبس."},

  /* أرجل */
  {id:"frontsquat",name:"سكوات أمامي",group:"quads",muscle:"quads",env:["gym"],level:3,risk:["knee","lowerback"],tip:"أبقي مرفقيك مرفوعين والبار على أعلى صدرك."},
  {id:"goodmorning",name:"تمرين صباح الخير",group:"hams",muscle:"hamstrings",env:["gym","home"],level:2,risk:["lowerback"],tip:"ادفعي الورك للخلف بظهر مستقيم لاستهداف الفخذ الخلفي."},
  {id:"jumpsquat",name:"سكوات بقفز",group:"quads",muscle:"quads",env:["bodyweight","home"],level:2,risk:["knee"],tip:"انزلي للسكوات ثم اقفزي بانفجار وأنزلي برفق."},
  {id:"singleleg",name:"رفعة رومانية بساق واحدة",group:"hams",muscle:"hamstrings",env:["home","bodyweight","gym"],level:2,risk:["lowerback"],tip:"وازني على ساق واحدة ومدّي الأخرى خلفك مع ميل الجذع."},

  /* مؤخرة */
  {id:"curtsy",name:"طعنة كيرتسي",group:"glutes",muscle:"glutes",env:["home","bodyweight","gym"],level:1,risk:["knee"],tip:"اخطي بساقك خلف الأخرى قطرياً لاستهداف المؤخرة الجانبية."},
  {id:"hipabduct",name:"فتح الورك بالشريط",group:"glutes",muscle:"glutes",env:["home"],level:1,risk:[],tip:"ضعي الشريط فوق ركبتيك وافتحيهما ضد المقاومة."},
  {id:"donkeykick",name:"رفسة الحمار",group:"glutes",muscle:"glutes",env:["home","bodyweight"],level:1,risk:[],tip:"ادفعي كعبك للأعلى مع ثني الركبة واعصري المؤخرة."},
  {id:"glutemachine",name:"جهاز المؤخرة",group:"glutes",muscle:"glutes",env:["gym"],level:1,risk:[],tip:"ادفعي المنصة للخلف من كعبك واعصري في النهاية."},

  /* بطن */
  {id:"hangingraise",name:"رفع الأرجل معلقاً",group:"abs",muscle:"absfront",env:["gym"],level:3,risk:["shoulder","diastasis"],tip:"تعلّقي بالبار وارفعي ساقيك دون تأرجح."},
  {id:"mountain",name:"متسلق الجبل",group:"abs",muscle:"absfront",env:["home","bodyweight","gym"],level:1,risk:["wrist","diastasis"],tip:"بدّلي ركبتيك نحو صدرك بسرعة مع ثبات الجذع."},
  {id:"deadbug",name:"تمرين الخنفساء",group:"abs",muscle:"absfront",env:["home","bodyweight"],level:1,risk:[],tip:"مدّي ذراعاً وساقاً معاكسة مع إلصاق أسفل ظهرك بالأرض."},
  {id:"vups",name:"تمرين V-Ups",group:"abs",muscle:"absfront",env:["home","bodyweight"],level:2,risk:["lowerback","diastasis"],tip:"ارفعي جذعك وساقيك معاً لتلامس يداك قدميك."},
  {id:"woodchop",name:"تقطيع الخشب بالكيبل",group:"abs",muscle:"absside",env:["gym"],level:2,risk:["lowerback"],tip:"اسحبي قطرياً من أعلى لأسفل مع لفّ الجذع."},

  /* ===== فخذ داخلي (Adductors) ===== */
  {id:"hipadduction",name:"جهاز ضمّ الأرجل",group:"adductors",muscle:"quads",env:["gym"],level:1,risk:[],tip:"اضغطي ساقيك للداخل ببطء واعصري الفخذ الداخلي."},
  {id:"sumosquat2",name:"سكوات سومو عميق",group:"adductors",muscle:"quads",env:["gym","home","bodyweight"],level:1,risk:["knee"],tip:"باعدي قدميك ووجّهي أصابعك للخارج وانزلي عميقاً."},
  {id:"sidelyingraise",name:"رفع الساق جانبياً (مستلقية)",group:"adductors",muscle:"quads",env:["home","bodyweight"],level:1,risk:[],tip:"استلقي على جنبك وارفعي الساق السفلية للأعلى ببطء."},
  {id:"copenhagen",name:"تمرين كوبنهاجن",group:"adductors",muscle:"quads",env:["bodyweight","home"],level:3,risk:[],tip:"ارفعي جسمك على مقعد بساق واحدة مع شدّ الفخذ الداخلي."},
  {id:"plie",name:"سكوات بليه بالدمبل",group:"adductors",muscle:"quads",env:["gym","home"],level:1,risk:["knee"],tip:"قفي بوضع باليه وانزلي مستقيمة مع عصر الفخذ الداخلي."},
  {id:"cableadduction",name:"ضمّ الورك بالكيبل",group:"adductors",muscle:"quads",env:["gym"],level:2,risk:[],tip:"اسحبي ساقك للداخل عبر جسمك ضد المقاومة."},
  {id:"bandadduction",name:"ضمّ الأرجل بالشريط",group:"adductors",muscle:"quads",env:["home"],level:1,risk:[],tip:"ثبّتي الشريط جانباً واسحبي ساقك للداخل ببطء."},

  /* ===== فخذ خلفي إضافي ===== */
  {id:"gluteham",name:"رفعة الفخذ الخلفي (GHR)",group:"hams",muscle:"hamstrings",env:["gym"],level:3,risk:["knee"],tip:"اخفضي جسمك ببطء مقاومةً بالفخذ الخلفي ثم ارجعي."},
  {id:"nordic",name:"ثني نوردك للفخذ الخلفي",group:"hams",muscle:"hamstrings",env:["bodyweight","home"],level:3,risk:["knee"],tip:"ثبّتي كعبيك وانزلي للأمام ببطء بمقاومة الفخذ الخلفي."},
  {id:"stiffdl",name:"رفعة ساق مستقيمة",group:"hams",muscle:"hamstrings",env:["gym","home"],level:2,risk:["lowerback"],tip:"حافظي على ساقيك شبه مستقيمتين وادفعي وركك للخلف."},
  {id:"bandlegcurl",name:"ثني الفخذ الخلفي بالشريط",group:"hams",muscle:"hamstrings",env:["home"],level:1,risk:[],tip:"اثني ركبتك ضد مقاومة الشريط واعصري في النهاية."},
  {id:"swissball",name:"ثني الفخذ بكرة سويسرية",group:"hams",muscle:"hamstrings",env:["home"],level:2,risk:[],tip:"اسحبي الكرة نحوك بكعبيك مع رفع وركك."},

  /* ===== سمانة إضافي ===== */
  {id:"legpresscalf",name:"سمانة على جهاز الضغط",group:"calves",muscle:"calves",env:["gym"],level:1,risk:[],tip:"ادفعي بأطراف أصابعك على المنصة ومدّي السمانة بالكامل."},
  {id:"donkeycalf",name:"رفع السمانة (دونكي)",group:"calves",muscle:"calves",env:["gym"],level:2,risk:[],tip:"انحني للأمام وارفعي كعبيك بأقصى مدى."},
  {id:"singlecalf",name:"سمانة على ساق واحدة",group:"calves",muscle:"calves",env:["home","bodyweight","gym"],level:1,risk:[],tip:"قفي على ساق واحدة وارفعي كعبك ببطء واعصري."},
  {id:"jumprope",name:"نطّ الحبل (سمانة)",group:"calves",muscle:"calves",env:["home","bodyweight"],level:1,risk:["knee"],tip:"انطّي على أطراف أصابعك بإيقاع ثابت لتنشيط السمانة."}
];

/* ---------- الحالات الصحية ومناطق الخطر المرتبطة ---------- */
const CONDITIONS = [
  {id:"knee",      name:"مشاكل في الركبة",   ico:"🦵", avoid:["knee"]},
  {id:"lowerback", name:"مشاكل في أسفل الظهر",ico:"🔙", avoid:["lowerback"]},
  {id:"shoulder",  name:"مشاكل في الكتف",     ico:"💪", avoid:["shoulder"]},
  {id:"weakcore",  name:"ضعف في الكور",       ico:"🔥", avoid:[]},
  {id:"wrist",     name:"مشاكل في الرسغ",      ico:"✋", avoid:["wrist"]},
  {id:"neck",      name:"مشاكل في الرقبة",     ico:"🧣", avoid:["neck"]},
  {id:"diastasis", name:"انفصال عضلي (بطن)",  ico:"🤰", avoid:["diastasis"]}
];

/* تمارين دعم وتأهيل لكل حالة صحية — تظهر في صفحة مخصصة بالـ PDF */
const SUPPORT = {
  knee:{
    name:"دعم الركبة", ico:"🦵",
    intro:"تمارين لطيفة لتقوية العضلات الداعمة للركبة (الفخذ الأمامي والخلفي) وتحسين ثباتها. أدّيها بلا ألم، وتوقّفي عند أي وجع حاد.",
    items:[
      ["sup_knee_1","تمديد الفخذ الأمامي جالسة","افردي ركبتك ببطء وأنتِ جالسة على كرسي واثبتي ثانيتين. 3×12."],
      ["sup_knee_2","رفع الساق المستقيمة","استلقي وارفعي الساق ممدودة 30 سم دون ثني الركبة. 3×10 لكل ساق."],
      ["sup_knee_3","جسر المؤخرة","ادفعي وركك لأعلى من وضع الاستلقاء لتقوية الداعمات. 3×12."],
      ["sup_knee_4","انزلاق على الحائط (نصف سكوات)","انزلي للنصف فقط مسندة ظهرك بالحائط دون ألم. 3×10."],
      ["sup_knee_5","تمديد الفخذ الخلفي","استلقي وارفعي ساقك المستقيمة بمساعدة منشفة حول القدم. ثبات 20 ثانية."],
      ["sup_knee_6","تقوية السمانة الخفيفة","ارفعي كعبيك ببطء وأنتِ ممسكة بحائط للتوازن. 3×15."]
    ]
  },
  lowerback:{
    name:"دعم أسفل الظهر", ico:"🔙",
    intro:"تمارين لتثبيت العمود الفقري وتقوية عضلات الجذع الداعمة لأسفل الظهر، مع إطالات لطيفة لتخفيف الشدّ.",
    items:[
      ["sup_lowerback_1","إمالة الحوض","استلقي واضغطي أسفل ظهرك للأرض بشدّ بطنك. 3×12."],
      ["sup_lowerback_2","تمرين القطة-البقرة","قوّسي ظهرك لأعلى وأسفل برفق على وضع الزحف. 10 مرات."],
      ["sup_lowerback_3","الكلب-الطائر","مدّي ذراعاً وساقاً معاكسة مع ثبات الجذع. 3×8 لكل جهة."],
      ["sup_lowerback_4","بلانك معدّل على الركبتين","ثبات بطن خفيف دون ضغط على أسفل الظهر. 3×20 ثانية."],
      ["sup_lowerback_5","ركبة للصدر","اسحبي ركبتك نحو صدرك برفق وأنتِ مستلقية. ثبات 20 ثانية لكل ساق."],
      ["sup_lowerback_6","جسر المؤخرة","لتقوية المؤخرة وتخفيف الحمل عن أسفل الظهر. 3×12."]
    ]
  },
  shoulder:{
    name:"دعم الكتف", ico:"💪",
    intro:"تمارين لتنشيط الكفة المدوّرة وتحسين مدى حركة الكتف وثباته، بأوزان خفيفة جداً أو بدون وزن.",
    items:[
      ["sup_shoulder_1","دوران خارجي بالشريط","ثبّتي مرفقك بجانبك ولفّي ساعدك للخارج ضد شريط خفيف. 3×12."],
      ["sup_shoulder_2","دوران داخلي بالشريط","نفس الوضع لكن لفّ الساعد للداخل. 3×12."],
      ["sup_shoulder_3","رفع الذراع أماماً خفيف","ارفعي ذراعك لمستوى الكتف بوزن خفيف جداً أو بدون. 3×10."],
      ["sup_shoulder_4","انزلاق على الحائط","حرّكي ذراعيك صعوداً ونزولاً ملاصقة للحائط. 3×10."],
      ["sup_shoulder_5","شدّ لوحي الكتف","اسحبي لوحي كتفك للخلف وللأسفل واثبتي. 3×12."],
      ["sup_shoulder_6","إطالة الكتف المتقاطعة","اسحبي ذراعك عبر صدرك برفق. ثبات 20 ثانية لكل جهة."]
    ]
  },
  weakcore:{
    name:"تقوية الكور", ico:"🔥",
    intro:"تمارين تدريجية لبناء قوة الجذع والثبات، أساس لكل التمارين الأخرى وحماية للظهر.",
    items:[
      ["sup_weakcore_1","بلانك متدرّج","ابدئي بـ15 ثانية وزيدي تدريجياً. 3 مجموعات."],
      ["sup_weakcore_2","الخنفساء (Dead Bug)","مدّي ذراعاً وساقاً معاكسة مع إلصاق ظهرك بالأرض. 3×10."],
      ["sup_weakcore_3","إمالة الحوض","تنشيط عضلات البطن العميقة. 3×12."],
      ["sup_weakcore_4","بلانك جانبي على الركبة","ثبات جانبي خفيف لتقوية الخصر. 3×15 ثانية لكل جهة."],
      ["sup_weakcore_5","الكلب-الطائر","ثبات وتوازن للجذع. 3×8 لكل جهة."],
      ["sup_weakcore_6","جسر المؤخرة مع شدّ البطن","يجمع تقوية المؤخرة والكور معاً. 3×12."]
    ]
  },
  wrist:{
    name:"دعم الرسغ", ico:"✋",
    intro:"إطالات وتقوية لطيفة لمفصل الرسغ والساعد، مفيدة قبل التمارين التي تحمّل الرسغ.",
    items:[
      ["sup_wrist_1","إطالة ثني الرسغ","مدّي ذراعك واسحبي أصابعك للأسفل برفق. 20 ثانية لكل يد."],
      ["sup_wrist_2","إطالة بسط الرسغ","اسحبي أصابعك للأعلى برفق. 20 ثانية لكل يد."],
      ["sup_wrist_3","دوران الرسغ","لفّي رسغك بدوائر بطيئة. 10 لكل اتجاه."],
      ["sup_wrist_4","قبض وفرد الأصابع","اقبضي يدك ثم افرديها بالكامل. 3×15."],
      ["sup_wrist_5","تقوية الرسغ بوزن خفيف","ارفعي وزناً خفيفاً جداً بثني الرسغ لأعلى. 3×12."]
    ]
  },
  neck:{
    name:"دعم الرقبة", ico:"🧣",
    intro:"إطالات لطيفة لتخفيف توتر الرقبة وتحسين مرونتها. حرّكي ببطء شديد دون أي اندفاع.",
    items:[
      ["sup_neck_1","إمالة جانبية","ميلي رأسك نحو كتفك برفق. 15 ثانية لكل جهة."],
      ["sup_neck_2","تدوير بطيء","لفّي رأسك ببطء نحو كل كتف. 10 مرات."],
      ["sup_neck_3","شدّ الذقن للداخل","اسحبي ذقنك للخلف لمحاذاة الرقبة. 3×10."],
      ["sup_neck_4","إطالة خلفية","أنزلي ذقنك نحو صدرك برفق. ثبات 15 ثانية."],
      ["sup_neck_5","استرخاء الكتفين","ارفعي كتفيك ثم أنزليهما بزفير. 10 مرات."]
    ]
  },
  diastasis:{
    name:"برنامج الانفصال العضلي", ico:"🤰",
    intro:"الانفصال العضلي يحدث عندما تضعف عضلات البطن الأمامية وتبتعد عن بعضها. هذه التمارين تُقوّي العضلات العميقة للبطن والظهر بأمان، وتتجنّب الحركات التي تزيد الضغط على البطن (كالكرنش والمعدة الكاملة). أدّيها 2–3 مرات أسبوعياً بتحكّم وتنفّس عميق، وتوقّفي عند أي ألم.",
    items:[
      ["sup_diastasis_1","التنفس العميق بالحجاب الحاجز","استلقي وضعي يدك على بطنك. شهيق عميق من الأنف حتى يرتفع بطنك، ثم زفير ببطء مع سحب البطن للداخل. 5 دقائق يومياً."],
      ["sup_diastasis_2","إمالة الحوض","استلقي مع ثني الركبتين. اضغطي أسفل ظهرك للأرض بشدّ البطن وإمالة الحوض لأعلى ببطء. 3×10."],
      ["sup_diastasis_3","جسر المؤخرة","ارفعي الحوض ببطء مع شدّ البطن دون تقويس أسفل الظهر. 3×12."],
      ["sup_diastasis_4","الكلب-الطائر (Bird Dog)","من وضع اليدين والركبتين، مدّي ذراعاً وساقاً معاكسة بشكل مستقيم وثبّتي مع شدّ الجذع. 3×10 لكل جهة."],
      ["sup_diastasis_5","المحارة (Clamshell)","نامي على جنبك بركبتين مثنيتين 45°، وارفعي الركبة العليا دون تحريك الحوض (بشريط مقاومة إن توفّر). 3×12 لكل جهة."],
      ["sup_diastasis_6","شدّ البطن العميق (Vacuum)","اسحبي بطنك للداخل نحو العمود الفقري وأنتِ تتنفّسين بشكل طبيعي، واثبتي 10–15 ثانية. 3 مرات."]
    ]
  }
};


/* ---------- إعدادات المستوى (مجموعات × تكرارات × راحة) ---------- */
const LEVELS = {
  1:{name:"مبتدئ", sets:3, reps:"12–15", rest:"60 ث"},
  2:{name:"متوسط", sets:4, reps:"10–12", rest:"75 ث"},
  3:{name:"متقدم", sets:4, reps:"8–10",  rest:"90 ث"}
};

/* تصنيف مجموعات العرض: كبيرة تحتاج تمارين أكثر، صغيرة أقل (منهجية ZahraaFit) */
const BIG_GROUPS = ["chest","back","quads","hams","glutes"];
const SMALL_GROUPS = ["shoulders","biceps","triceps","abs","adductors","calves"];

/* عدد التمارين المستهدف لكل عضلة في اليوم، حسب الحجم والمستوى */
function exCountFor(group, level){
  const big = BIG_GROUPS.includes(group);
  if(level===1) return big ? 3 : 2;   // مبتدئ
  if(level===2) return big ? 3 : 2;   // متوسط
  return big ? 4 : 2;                  // متقدم
}

const ENVS = {
  gym:       {name:"النادي",      sub:"أجهزة وأوزان كاملة", emoji:"🏋️"},
  home:      {name:"البيت",       sub:"أوزان وأشرطة مطاطية", emoji:"🏠"},
  bodyweight:{name:"وزن الجسم",   sub:"بدون أي معدّات",     emoji:"🤸"}
};

/* أنظمة التقسيمة — تختارها العميلة */
const SPLIT_SYSTEMS = {
  ppl:{
    name:"بوش / بُل / ليق", sub:"دفع · سحب · أرجل", emoji:"🔄",
    days:{
      2:[["chest","shoulders","triceps","abs"],["back","biceps","quads","hams","glutes"]],
      3:[["chest","shoulders","triceps"],["back","biceps","abs"],["quads","hams","glutes","calves"]],
      4:[["chest","shoulders","triceps"],["back","biceps"],["quads","hams","glutes","abs"],["chest","shoulders","triceps"]],
      5:[["chest","shoulders","triceps"],["back","biceps"],["quads","hams","glutes"],["chest","triceps","abs"],["back","biceps","calves"]]
    }
  },
  ul:{
    name:"علوي / سفلي", sub:"الجزء العلوي · السفلي", emoji:"⬆️",
    days:{
      2:[["chest","back","shoulders","biceps","triceps","abs"],["quads","hams","glutes","calves","abs"]],
      3:[["chest","back","shoulders","biceps","triceps"],["quads","hams","glutes","calves","abs"],["chest","back","shoulders","biceps","triceps","abs"]],
      4:[["chest","back","shoulders","biceps","triceps"],["quads","hams","glutes","calves","abs"],["chest","back","shoulders","abs"],["quads","hams","glutes","calves"]],
      5:[["chest","back","shoulders","biceps","triceps"],["quads","hams","glutes","calves"],["chest","back","shoulders","abs"],["quads","hams","glutes","calves","abs"],["chest","back","biceps","triceps"]]
    }
  },
  fullbody:{
    name:"فل بدي", sub:"الجسم كامل كل يوم", emoji:"🔥",
    days:{
      2:[["chest","back","quads","hams","shoulders","abs"],["back","quads","hams","glutes","biceps","triceps"]],
      3:[["chest","back","quads","hams","abs"],["shoulders","quads","hams","biceps","triceps"],["chest","back","glutes","abs"]],
      4:[["chest","back","quads","hams","abs"],["shoulders","quads","hams","biceps","triceps"],["chest","back","glutes","abs"],["quads","hams","shoulders","biceps","calves"]],
      5:[["chest","quads","hams","abs"],["back","shoulders","glutes"],["quads","hams","biceps","triceps"],["chest","back","abs"],["quads","hams","glutes","calves"]]
    }
  }
};
const DAY_NAMES = {
  chest:"صدر",back:"ظهر",shoulders:"أكتاف",biceps:"بايسبس",
  triceps:"ترايسبس",quads:"فخذ أمامي",hams:"فخذ خلفي",adductors:"فخذ داخلي",glutes:"مؤخرة",calves:"سمانة",abs:"بطن"
};

/* ============================================================
   الإحماء — قسم علوي وسفلي ثابت يُرفق في الجدول
   ============================================================ */
const WARMUP = {
  upper:{
    name:"إحماء علوي",
    sub:"قبل تمارين الصدر · الظهر · الأكتاف · الذراعين",
    items:[
      ["wu_shoulders","تدوير الكتفين","10 دورات أمامية و10 خلفية لتنشيط مفصل الكتف."],
      ["wu_arms","تدوير الذراعين","دوائر واسعة بالذراعين، 30 ثانية لكل اتجاه."],
      ["wu_chest","تمديد الصدر على الحائط","ضعي ساعدك على الحائط ولُفّي جسمك برفق، 20 ثانية لكل جهة."],
      ["wu_neck","إطالة الرقبة الجانبية","ميلي رأسك بلطف لكل جهة، 15 ثانية لكل جانب."],
      ["wu_warmset_u","مجموعة تسخين خفيفة","أدّي أول تمرين بوزن خفيف جداً (نحو 50%) لـ15 تكراراً قبل البدء الفعلي."]
    ]
  },
  lower:{
    name:"إحماء سفلي",
    sub:"قبل تمارين الأرجل · المؤخرة · السمانة",
    items:[
      ["wl_walk","مشي في المكان","2–3 دقائق لرفع معدل ضربات القلب وتدفئة الجسم."],
      ["wl_squat","سكوات بوزن الجسم","15 تكراراً ببطء لتنشيط الفخذ والمؤخرة."],
      ["wl_hip","دوران الورك","دوائر واسعة بالورك، 10 لكل اتجاه."],
      ["wl_bridge","جسر المؤخرة","12 تكراراً لتفعيل عضلات المؤخرة قبل التحميل."],
      ["wl_ham","إطالة الفخذ الخلفي","ميلي للأمام برفق للوصول لأصابع القدم، 20 ثانية."],
      ["wl_warmset","مجموعة تسخين خفيفة","أدّي أول تمرين بوزن خفيف (نحو 50%) لـ15 تكراراً قبل البدء الفعلي."]
    ]
  }
};

const EDU_PAGES = [
  { title:"معلومات هامة قبل البدء",
    intro:"لبداية صحيحة ومفهومة، اطلعي على هذه الأساسيات لتكوني على دراية تامة قبل أن ترفعي أول وزن. فهمك لهذه المبادئ يوفّر عليك أشهراً من المحاولة والخطأ.",
    blocks:[
      {h:"عدد أيام التمارين", p:"اختاري الأيام التي تناسب جدولك فعلياً؛ المهم الاستمرارية لا الحماس المؤقت. الأفضل أن تكون أيام تمرينك من 3 إلى 5 أيام أسبوعياً. يومان بانتظام لشهور أفضل من ستة أيام تتوقفين بعدها بأسبوع."},
      {h:"الاستشفاء سر النتيجة", p:"العضلة تكبر وقت الراحة لا وقت التمرين. أثناء التمرين أنتِ تهدمين الألياف، وأثناء النوم والراحة يبنيها الجسم أقوى. تقسيم الأسبوع لـ6 أو 7 أيام متتالية لا يعطي الجسم فرصة لترميم نفسه، وقد يؤدي لتراجع النتائج بدل تقدّمها."},
      {h:"ممنوع تكرار نفس العضلة يومين متتاليين", p:"كل عضلة تُمرَّن بجهد عالٍ تحتاج 48 ساعة على الأقل لترتاح وتُبنى من جديد. يمكنك تمرين الجزء العلوي اليوم والسفلي غداً، لكن لا تمرّني الصدر مثلاً في يومين متتاليين."},
      {h:"التوقعات الواقعية", p:"النتائج الحقيقية تظهر خلال 8–12 أسبوعاً من الالتزام، لا خلال أيام. الصبر والثبات على الجدول أهم من شدّة الحماس في الأسبوع الأول."}
    ]},
  { title:"كيف تعمل التمارين؟",
    intro:"يُقسم الجسم إلى عضلات كبيرة وصغيرة، ولكل عضلة احتياجها من حجم التمرين الأسبوعي (عدد الجلسات). فهم هذا يساعدك على توزيع جهدك بذكاء.",
    blocks:[
      {h:"العضلات الصغيرة", p:"مثل البايسبس والترايسبس والأكتاف والبطن والسمانة. تحتاج 4 جلسات أسبوعياً كحد أدنى (تمرين واحد بـ4 جلسات). للاستفادة الأكبر: 8–12 جلسة، أي 2–3 تمارين."},
      {h:"العضلات الكبيرة", p:"مثل الصدر والظهر والأرجل والمؤخرة. تحتاج 8 جلسات أسبوعياً كحد أدنى (تمرينان بـ4 جلسات لكلٍ منهما). للاستفادة الأكبر: 12–15 جلسة، أي 3–4 تمارين."},
      {h:"كيف تنمو العضلة؟", p:"النمو يحدث عبر ثلاثة محفّزات: التوتر الميكانيكي (رفع أوزان تتحدّاك)، التلف العضلي (الإجهاد الذي يُصلَح أقوى)، والإجهاد الأيضي (الحرقان من التكرارات العالية). جدولك مصمَّم ليجمعها."},
      {h:"الهدف", p:"يُنصح بأداء 12–15 جلسة للعضلة أسبوعياً للحصول على أفضل نتيجة. المهم أن تفهمي المبدأ لا أن تحفظي الأرقام فقط، لتقدري على تعديل تمرينك بنفسك مع الوقت."}
    ]},
  { title:"كم الوزن الذي نبدأ به؟",
    intro:"اختيار الوزن الصحيح فنّ مهم: ثقيل جداً يكسر التكنيك ويسبّب الإصابة، وخفيف جداً لا يحفّز النمو. الهدف وزن يتحدّاك مع حفاظك على الأداء السليم.",
    blocks:[
      {h:"البداية الآمنة", p:"في البداية لا نرفع أوزاناً ثقيلة. ابدئي بوزن 2–3 كيلو في أغلب التمارين، وبعض التمارين (كالأرجل) تتحملين فيها أكثر. ركّزي أول أسبوعين على إتقان الحركة قبل زيادة الوزن."},
      {h:"نطاق التكرارات", p:"الحد الأدنى 8 تكرارات لكل جولة، والحد الأقصى 12 تكراراً. الوزن المناسب هو الذي يجعل آخر تكرارين صعبين لكن بتكنيك سليم."},
      {h:"متى تزيدين الوزن؟", p:"إذا وصلتِ في كل الجولات للحد الأقصى (12 تكراراً) بسهولة، فالمرة القادمة ارفعي الوزن قليلاً (نصف إلى واحد كيلو). الهدف الاقتراب من الفشل العضلي في آخر مجموعة."},
      {h:"بديل زيادة الوزن", p:"إذا كان الوزن الأعلى ثقيلاً عليك، يمكنك زيادة عدد التكرارات أو إبطاء النزول حتى الوصول للتحدّي المطلوب، ثم تنتقلين للوزن الأعلى لاحقاً."},
      {h:"ما الفشل العضلي؟", p:"هو النقطة التي لا تقدرين فيها على تكرار إضافي بتكنيك سليم. لا يعني الإصابة، بل أنك استنفدتِ العضلة. للمبتدئة يكفي الاقتراب منه دون الوصول التام إليه."}
    ]},
  { title:"التكنيك الصحيح — كيف أعرف أني صح؟",
    intro:"أداء التمرين بشكل صحيح هو أساس النتيجة والسلامة. تمرين واحد بتكنيك سليم أفضل من عشرة بأداء خاطئ، لأن الخطأ يبني عادة سيئة ويعرّضك للإصابة.",
    blocks:[
      {h:"الشعور بالعضلة المستهدفة", p:"عند الأداء الصحيح ستشعرين بتقلّصات في العضلة المستهدفة؛ غياب الإحساس قد يعني خطأً في الأداء أو وزناً ثقيلاً يجبر عضلات أخرى على المساعدة."},
      {h:"الحركة السلسة والمتحكَّمة", p:"يجب أن تكون الحركة سلسة دون اهتزاز أو تأرجح؛ الاهتزاز يعني وزناً ثقيلاً أو استخدام الزخم بدل العضلة. تحكّمي في الوزن صعوداً ونزولاً."},
      {h:"وضعية الجسم الصحيحة", p:"حافظي على استقامة الظهر وشدّ البطن، وتجنّبي تقويس أسفل الظهر، وثبّتي قدميك مع توزيع الوزن بالتساوي. الوضعية الصحيحة تحمي مفاصلك."},
      {h:"المدى الكامل للحركة", p:"أدّي الحركة بمداها الكامل (نزول كامل وانقباض كامل) ما لم يمنعك ألم. المدى الكامل يبني عضلة أقوى وأكثر مرونة من الحركات النصفية."},
      {h:"صوّري نفسك", p:"إن لم تتأكدي من تكنيكك، صوّري نفسك من الجانب وقارني بالفيديو المرجعي. العين الخارجية تكشف أخطاءً لا تشعرين بها أثناء الأداء."}
    ]},
  { title:"التنفس الصحيح أثناء التمارين",
    intro:"التنفس الصحيح من أهم عوامل التمرين الفعّال والآمن، وكثيرات يهملنه فيفقدن قوة وثباتاً دون أن يدرين.",
    blocks:[
      {h:"الفائدة", p:"التنفس العميق يوصل الأكسجين للعضلات، يحسّن التحمّل، يثبّت الجذع، ويقلّل التعب وخطر الإصابات والدوخة."},
      {h:"القاعدة الذهبية", p:"الزفير مع المجهود/الانقباض (مرحلة الرفع)، والشهيق مع النزول/الانبساط. مثلاً في السكوات: شهيق وأنتِ تنزلين، زفير وأنتِ تصعدين."},
      {h:"تجنّبي كتم النفس", p:"كتم النفس أثناء الجهد يرفع ضغط الدم فجأة ويسبّب الدوخة. الاستثناء الوحيد رفعات ثقيلة جداً متقدمة، وهذا خارج نطاق المبتدئة."},
      {h:"الإيقاع", p:"اجعلي تنفسك منتظماً مع إيقاع الحركة، لا متسرّعاً ولا محبوساً. التنفس الهادئ المنتظم علامة على تحكّمك في الوزن."}
    ]},
  { title:"نطاقات التكرارات حسب الهدف",
    intro:"عدد التكرارات ليس عشوائياً؛ كل نطاق يحفّز الجسم بطريقة مختلفة. معرفتك بهذا تتيح لك تفصيل تمرينك حسب هدفك.",
    blocks:[
      {h:"تكرارات منخفضة (1–5)", p:"تركّز على القوة القصوى وتدريب الجهاز العصبي على تجنيد أكبر عدد من الألياف. مناسبة للمتقدمات، وتحتاج أوزاناً ثقيلة وراحة أطول بين الجولات."},
      {h:"تكرارات متوسطة (6–12)", p:"النطاق الذهبي للتضخيم وشدّ العضلات؛ يجمع بين التوتر الميكانيكي والإجهاد الأيضي بتوازن. الأنسب لأغلب أهداف التشكيل والقوام."},
      {h:"تكرارات عالية (15+)", p:"تركّز على التحمّل العضلي وزيادة ضخ الدم وكفاءة الأكسجين. مفيدة للسمانة والبطن وللإحماء وللمبتدئات في إتقان الحركة."},
      {h:"الأهم من النطاق", p:"بغضّ النظر عن النطاق، النمو يتطلب الاقتراب من الفشل العضلي. 15 تكراراً سهلة لا تبني، بينما 8 تكرارات متحدّية تبني. التحدّي هو المفتاح."}
    ]},
  { title:"سرعة الحركة (Tempo)",
    intro:"رتم الحركة يتكوّن من مراحل، والتحكم فيه يضاعف نتيجة نفس التمرين دون زيادة الوزن. سلاح خفيّ تجهله كثيرات.",
    blocks:[
      {h:"مرحلة الانبساط (النزول)", p:"أهم مرحلة للبناء العضلي. اجعليها بطيئة ومتحكّمة (2–3 ثوانٍ) لزيادة وقت التوتر على العضلة. مقاومة النزول أقوى محفّز للنمو يُهمله المبتدئون."},
      {h:"مرحلة الانقباض (الرفع)", p:"يُفضَّل أن تكون مسيطَراً عليها وبقوة، لتفعيل أكبر قدر من الألياف. ليست متسرّعة بالزخم، بل قوية بتحكّم."},
      {h:"لحظة الانقباض (العصر)", p:"اعصري العضلة لحظة في قمة الحركة (مثلاً أعلى تمرين البايسبس). هذه اللحظة تزيد تفعيل العضلة وتحسّن الاتصال الذهني العضلي."},
      {h:"الثبات في الأسفل", p:"الثبات لحظة في أسفل الحركة يقلّل الزخم ويجبر العضلة على حمل الوزن بالكامل دون استعانة بالاندفاع، فتشتغل العضلة لا الحركة."}
    ]},
  { title:"الزيادة التدريجية — مفتاح كل تطور",
    intro:"أن تطلبي من جسمك مجهوداً أكبر تدريجياً مع الوقت. هذا المبدأ هو السبب الأول للنتائج، وغيابه السبب الأول للثبات.",
    blocks:[
      {h:"لماذا ضرورية؟", p:"الجسم يتكيّف مع أي ضغط يتكرّر. لو بقيتِ على نفس الوزن والتكرار شهوراً، يتوقف النمو لأن جسمك اعتاد. الزيادة التدريجية تعطيه تحدّياً جديداً باستمرار."},
      {h:"طرق التطبيق", p:"زيادة الأوزان، أو زيادة التكرارات، أو زيادة عدد الجولات، أو إبطاء التمبو، أو تقليل الراحة بين الجولات، أو تحسين المدى والتكنيك. لا تقتصري على الوزن فقط."},
      {h:"متى تزيدين؟ (اختبار RPE)", p:"إذا أنهيتِ تكراراتك وأحسستِ أنك تقدرين على 3–4 إضافية بسهولة، فالوزن صار خفيفاً وحان وقت الزيادة. اهدفي لإنهاء كل مجموعة وأنتِ تشعرين بتحدٍّ حقيقي."},
      {h:"التدرّج لا القفز", p:"زيدي بخطوات صغيرة (نصف كيلو أو تكرار واحد). القفزات الكبيرة المفاجئة تكسر التكنيك وتسبّب الإصابة وتراجعاً يضيّع تقدّمك."}
    ]},
  { title:"الألم بعد التمرين (DOMS)",
    intro:"الألم بعد التمرين ليس مقياساً لجودة التمرين، وهذه معلومة يخطئ فيها الكثيرون فيطاردون الألم بدل النتيجة.",
    blocks:[
      {h:"ما هو؟", p:"تمزّقات مجهرية بسيطة في الألياف العضلية، تظهر بعد 24–48 ساعة، وتحدث غالباً عند تغيير الجدول أو زيادة الأوزان أو العودة بعد انقطاع."},
      {h:"لماذا ليس مقياساً؟", p:"الجسم يتكيّف مع الوقت؛ غياب الألم قد يعني أن استشفاءك جيد وتغذيتك ونومك ممتازان، لا أن التمرين بلا فائدة. كثير من تمارينك الفعّالة لن تسبّب ألماً."},
      {h:"كيف تخففينه؟", p:"الحركة الخفيفة والمشي، الترطيب الجيد، النوم الكافي، والبروتين تساعد على التعافي. الراحة التامة قد تطيل الألم بدل تقصيره."},
      {h:"متى يكون مقلقاً؟", p:"ألم العضلة الطبيعي يتحسّن خلال أيام. أما الألم الحادّ في المفصل أو الألم المفاجئ أثناء الحركة فإشارة توقّف ومراجعة، وليس DOMS."}
    ]},
  { title:"الإحساس بالعضلة",
    intro:"الإحساس بالعضلة (الاتصال الذهني العضلي) شيء جيد ومفيد لكنه ليس شرطاً وحيداً للنمو، ولا يجب أن يكون هاجسك الوحيد.",
    blocks:[
      {h:"في التمارين المركبة", p:"كالسكوات والرفعة الميتة يصعب الإحساس بعضلة بعينها لأن الجسم يعمل كمنظومة. التركيز المفرط على الإحساس فيها قد يجبرك على أوزان خفيفة تقلّل الفائدة."},
      {h:"في التمارين العازلة", p:"كمرجحة البايسبس وتفتيح الصدر، الإحساس بالعضلة مفيد جداً ويحسّن التفعيل. اعصري وركّزي ذهنك على العضلة العاملة."},
      {h:"المقياس الحقيقي", p:"هل أوزانك تزيد مع الوقت؟ هل تكنيكك تحسّن؟ هل شكلك وقوتك في تطوّر؟ هذا هو الدليل الحقيقي على التقدّم، لا مجرّد الحرقان أو غيابه."}
    ]},
  { title:"النوم والاستشفاء — نصف النتيجة",
    intro:"كثيرات يركّزن على التمرين ويهملن أهم عاملين خارج الصالة: النوم والتعافي. هنا تُبنى العضلة فعلياً.",
    blocks:[
      {h:"دور النوم", p:"أثناء النوم العميق يفرز الجسم هرمونات البناء ويصلح الألياف. النوم أقل من 6 ساعات يقلّل النتائج، يزيد الجوع، ويرفع هرمون التوتر الذي يعيق التقدّم."},
      {h:"كم تحتاجين؟", p:"7–9 ساعات نوم متواصل ليلاً. جودة النوم لا تقل أهمية عن عدد ساعاته؛ غرفة مظلمة وهادئة وبعيدة عن الشاشات قبل النوم تصنع فرقاً."},
      {h:"الراحة بين التمارين", p:"خذي يوم راحة أو يومين أسبوعياً. أيام الراحة ليست كسلاً بل جزء من البرنامج؛ فيها يكتمل البناء وتعودين أقوى."},
      {h:"علامات الإفراط", p:"تعب مستمر، تراجع الأداء، قلة النوم، فقدان الحماس، أو ألم لا يزول — كلها إشارات أنك تحتاجين راحة أكثر، لا تمريناً أكثر."}
    ]},
  { title:"أخطاء شائعة تجنّبيها",
    intro:"تجنّب الأخطاء أحياناً أهم من إضافة تمارين. هذه أكثر الأخطاء التي تعيق نتائج المبتدئات وحتى المتوسطات.",
    blocks:[
      {h:"مطاردة الألم والتعب", p:"الهدف هو التحفيز لا الإنهاك. تمرين ذكي بأوزان متدرّجة أفضل من تمرين يتركك محطّمة يومين. التعب الشديد ليس دليل نجاح."},
      {h:"إهمال التكنيك للوزن", p:"رفع وزن ثقيل بتكنيك سيّئ يبني عادة خاطئة ويعرّضك للإصابة. الوزن المناسب مع أداء سليم دائماً أفضل."},
      {h:"عدم الاستمرارية", p:"التنقّل بين الجداول كل أسبوع أو الانقطاع المتكرّر يمنع الجسم من التكيّف. الثبات على برنامج لأسابيع هو ما يصنع النتيجة."},
      {h:"إهمال الإحماء", p:"البدء بأوزان ثقيلة دون إحماء يزيد خطر الإصابة ويقلّل الأداء. دقائق الإحماء استثمار لا إضاعة وقت."},
      {h:"المقارنة بالآخرين", p:"كل جسم يستجيب بسرعته الخاصة. قارني نفسك بنفسك قبل أسابيع، لا بمن في الصالة أو على الإنترنت."}
    ]},
  { title:"الثبات (Plateau) وكيف تكسرينه",
    intro:"الثبات مرحلة طبيعية يصل لها الجميع: تتمرّنين بانتظام لكن النتائج توقفت. فهم أسبابه يساعدك على تجاوزه.",
    blocks:[
      {h:"ما هو الثبات؟", p:"نقطة يتوقف فيها التقدّم رغم انتظامك. سببها أن جسمك تكيّف مع التحدّي الحالي ولم يعد يجد سبباً للتغيّر."},
      {h:"غيّري المتغيّرات", p:"بدّلي ترتيب التمارين، أو زيدي الأوزان/التكرارات، أو غيّري التمبو، أو قلّلي الراحة. أي تحدٍّ جديد يوقظ التكيّف من جديد."},
      {h:"راجعي الأساسيات", p:"الثبات أحياناً ليس في التمرين، بل في قلة النوم أو التغذية أو التوتر. راجعي حياتك خارج الصالة أولاً."},
      {h:"خذي أسبوع تخفيف", p:"أحياناً جسمك متعب متراكم. أسبوع بأوزان أخف (Deload) يتيح تعافياً كاملاً، وتعودين بعده أقوى وتكسرين الثبات."}
    ]},
  { title:"الكارديو وحرق الدهون",
    intro:"الكارديو مكمّل مفيد للصحة والقلب وحرق السعرات، لكن دوره وحدوده يُفهَمان خطأً كثيراً.",
    blocks:[
      {h:"الكارديو وحده لا ينحت", p:"حرق الدهون يعتمد أساساً على عجز السعرات (تأكلين أقل مما تحرقين). الكارديو يساعد، لكن تمارين المقاومة والتغذية هي الأساس في تشكيل القوام."},
      {h:"التوقيت", p:"يُفضَّل الكارديو بعد تمارين المقاومة أو في يوم منفصل، حتى لا يستهلك طاقتك قبل رفع الأوزان. الأوزان أولاً للحفاظ على العضلة."},
      {h:"النوع والمدة", p:"المشي السريع أو الدراجة 20–40 دقيقة معتدلة خيار ممتاز ولطيف على المفاصل. الأهم الانتظام لا الشدّة المفرطة."},
      {h:"الخطوات اليومية", p:"النشاط اليومي خارج التمرين (الخطوات) يحرق سعرات أكثر مما تتخيّلين. استهدفي 8–10 آلاف خطوة يومياً كقاعدة لحرق مستدام."}
    ]},
  { title:"الماء والترطيب",
    intro:"الماء عنصر يُهمَل رغم أثره المباشر على الأداء والطاقة والتعافي وحتى الشعور بالجوع.",
    blocks:[
      {h:"لماذا يهم؟", p:"العضلات نحو 75% ماء. الجفاف البسيط يقلّل القوة والتركيز، يزيد التعب، ويبطئ التعافي. الترطيب الجيد يحسّن أداءك فوراً."},
      {h:"كم تشربين؟", p:"قاعدة عامة: 30–35 مل لكل كيلو من وزنك يومياً، وأكثر في أيام التمرين والجو الحار. اجعلي الماء في متناولك طوال اليوم."},
      {h:"حول التمرين", p:"اشربي كوباً قبل التمرين بنصف ساعة، ورشفات أثناءه، وكوباً بعده لتعويض ما فقدتِه بالعرق."},
      {h:"الماء والجوع", p:"كثيراً ما يُخلَط بين العطش والجوع. كوب ماء قبل الوجبة قد يقلّل الإفراط في الأكل ويساعد على ضبط السعرات."}
    ]},
  { title:"التحفيز والاستمرارية",
    intro:"الجانب النفسي قد يكون أصعب من التمرين نفسه. النتائج لمن تستمر، لا لمن تبدأ بحماس ثم تتوقف.",
    blocks:[
      {h:"الحماس ينطفئ، العادة تبقى", p:"لا تعتمدي على الحماس فهو متقلّب. اجعلي التمرين عادة ثابتة في وقت محدّد، حتى يصبح جزءاً من يومك لا قراراً تتّخذينه كل مرة."},
      {h:"أهداف صغيرة وواقعية", p:"بدل 'أريد جسماً مثالياً'، اجعلي هدفك 'سأتمرّن 3 أيام هذا الأسبوع'. الأهداف الصغيرة القابلة للتحقيق تبني ثقة وزخماً."},
      {h:"تتبّعي تقدّمك", p:"سجّلي أوزانك وتكراراتك. رؤية تطوّر الأرقام مع الوقت أقوى محفّز، ويذكّرك أنك تتقدّمين حتى لو لم يظهر بالمرآة بعد."},
      {h:"تعثّر يوم لا يعني فشلاً", p:"لو فاتك تمرين أو يوم أكل سيّئ، لا تتركي كل شيء. ارجعي في اليوم التالي. الاستمرار رغم التعثّر هو الفرق بين من تنجح ومن تستسلم."}
    ]}
];

const S = {
  step:0,
  client:{name:"",age:"",height:"",weight:"",gender:"female"},
  env:"gym",
  level:1,
  days:4,
  split:"ppl",
  dailyCount:6,
  aiRequest:"",
  includeEdu:true,
  conditions:[],
  fav:new Set(),
  no:new Set(),
  images:{},      // muscle -> dataURL
  plan:null
};

/* ---------- أدوات الجنس في الخطاب ---------- */
function g(male, female){ return S.client.gender==="male" ? male : female; }

/* ============================================================
   التوجيه بين الشاشات
   ============================================================ */
const STEP_LABELS = ["البيانات","الإعداد","التمارين","الجدول"];
function go(n){ S.step=n; render(); window.scrollTo({top:0,behavior:"smooth"}); }

/* ============================================================
   العرض الرئيسي
   ============================================================ */
function render(){
  const root=document.getElementById("root");
  root.innerHTML = topbar() + (
    S.step===-1 ? screenHero()    :
    S.step===0  ? screenClient()  :
    S.step===1  ? screenSetup()   :
    S.step===2  ? screenPicker()  :
    S.step===3  ? screenPlan()    :
    S.step===9  ? screenImages()  :
    S.step===10 ? screenVideos()  : ""
  );
  bind();
}

function topbar(){
  return `<div class="topbar"><div class="topbar-in">
    <div class="brand">
      <div class="logo">Z</div>
      <div><b>Zahraa<span>Fit</span></b><small>sport & nutrition</small></div>
    </div>
    <div class="right">
      <button class="ghost-btn" data-act="images">🖼️ مكتبة الصور</button>
      <button class="ghost-btn" data-act="videos">🎬 مكتبة الفيديوهات</button>
      ${S.step>=0&&S.step<=3?`<button class="ghost-btn" data-act="restart">↺ جديد</button>`:""}
    </div>
  </div></div>`;
}

function stepper(){
  return `<div class="steps">`+STEP_LABELS.map((l,i)=>{
    const cls = i===S.step?"active":(i<S.step?"done":"");
    return `<div class="step-pill ${cls}"><span class="n">${i<S.step?"✓":i+1}</span>${l}</div>`;
  }).join("")+`</div>`;
}

/* ---------------- شاشة البداية (Hero) ---------------- */
function screenHero(){
  return `<div class="app"><div class="screen on">
    <div class="hero"><div class="hero-in">
      <span class="eyebrow">الجدول الرياضي</span>
      <h1>درّبي عميلاتك بجداول <span>احترافية</span> تُبنى في دقائق</h1>
      <p>اختاري بيئة التمرين والمستوى، راعي الحالات الصحية، وولّدي جدولاً متكاملاً — كل تمرين مع صورة عضلته وفيديو شرحه.</p>
      <button class="cta" data-act="start">ابدئي الآن ←</button>
      <div class="hero-badges">
        <div><b>٣</b> بيئات تمرين</div>
        <div><b>٣</b> مستويات</div>
        <div><b>٥٠+</b> تمرين</div>
        <div><b>١٤</b> عضلة مصوّرة</div>
      </div>
    </div></div>
  </div></div>`;
}

/* ---------------- شاشة 1: بيانات العميل ---------------- */
function screenClient(){
  const c=S.client;
  return `<div class="app">${stepper()}<div class="screen on">
    <div class="card">
      <div class="sec-head"><div class="ico">👤</div><div>
        <h2>بطاقة المشتركة</h2><p>أدخلي بيانات العميل الأساسية لتخصيص الجدول والخطاب.</p>
      </div></div>
      <div style="height:8px"></div>
      <div class="field" style="margin-bottom:18px">
        <label>الجنس <span class="req">*</span></label>
        <div class="gender-pills">
          <div class="gp ${c.gender==='female'?'sel':''}" data-gender="female">أنثى</div>
          <div class="gp ${c.gender==='male'?'sel':''}" data-gender="male">ذكر</div>
        </div>
        <div class="hint">يُستخدم لتوجيه الخطاب في الجدول (مذكّر / مؤنّث).</div>
      </div>
      <div class="grid two">
        <div class="field"><label>الاسم <span class="req">*</span></label>
          <input id="f-name" value="${c.name}" placeholder="مثال: جواهر"></div>
        <div class="field"><label>العمر</label>
          <input id="f-age" type="number" value="${c.age}" placeholder="٢٥"></div>
        <div class="field"><label>الطول (سم)</label>
          <input id="f-height" type="number" value="${c.height}" placeholder="١٦٥"></div>
        <div class="field"><label>الوزن (كجم)</label>
          <input id="f-weight" type="number" value="${c.weight}" placeholder="٦٠"></div>
      </div>
      <div class="actions">
        <span></span>
        <button class="btn primary" data-act="to1">التالي ←</button>
      </div>
    </div>
  </div></div>`;
}

/* ---------------- شاشة 2: الإعداد ---------------- */
function screenSetup(){
  return `<div class="app">${stepper()}<div class="screen on">
    <div class="card">
      <div class="sec-head"><div class="ico">⚙️</div><div>
        <h2>إعداد الجدول</h2><p>أين ستتمرّن؟ وما المستوى وعدد الأيام؟</p>
      </div></div>
      <span class="eyebrow" style="margin-top:14px">بيئة التمرين</span>
      <div class="choices g3">
        ${Object.entries(ENVS).map(([k,v])=>`
          <div class="choice ${S.env===k?'sel':''}" data-env="${k}">
            <span class="emoji">${v.emoji}</span><b>${v.name}</b><small>${v.sub}</small>
          </div>`).join("")}
      </div>
      <span class="eyebrow" style="display:block;margin-top:24px">المستوى</span>
      <div class="choices g3">
        ${Object.entries(LEVELS).map(([k,v])=>`
          <div class="choice ${S.level==k?'sel':''}" data-level="${k}">
            <b>${v.name}</b><small>${v.sets} مجموعات · ${v.reps} عدّة</small>
          </div>`).join("")}
      </div>
      <span class="eyebrow" style="display:block;margin-top:24px">نظام الجدول</span>
      <div class="choices g3">
        ${Object.entries(SPLIT_SYSTEMS).map(([k,v])=>`
          <div class="choice ${S.split===k?'sel':''}" data-split="${k}">
            <span class="emoji">${v.emoji}</span><b>${v.name}</b><small>${v.sub}</small>
          </div>`).join("")}
      </div>
      <span class="eyebrow" style="display:block;margin-top:24px">عدد أيام التمرين</span>
      <div class="choices g3" style="grid-template-columns:repeat(4,1fr)">
        ${[2,3,4,5].map(d=>`
          <div class="choice ${S.days==d?'sel':''}" data-days="${d}">
            <span class="emoji">${d}</span><b>${d} أيام</b>
          </div>`).join("")}
      </div>
      <span class="eyebrow" style="display:block;margin-top:24px">عدد التمارين في اليوم</span>
      <div class="choices g3" style="grid-template-columns:repeat(5,1fr)">
        ${[4,5,6,7,8].map(n=>`
          <div class="choice ${S.dailyCount==n?'sel':''}" data-daily="${n}">
            <span class="emoji">${n}</span><b>${n} تمارين</b>
          </div>`).join("")}
      </div>
      <div class="hint" style="margin-top:6px">يُوزَّع العدد تلقائياً بين عضلات اليوم (العضلات الكبيرة حصة أكبر). في نظام «علوي/سفلي» قد يزيد العدد قليلاً لضمان تمرين واحد لكل عضلة على الأقل.</div>

      <span class="eyebrow" style="display:block;margin-top:24px">الحالات الصحية <span style="color:var(--muted);font-weight:600">(اختياري)</span></span>
      <div class="cond-grid">
        ${CONDITIONS.map(c=>`
          <div class="cond ${S.conditions.includes(c.id)?'on':''}" data-cond="${c.id}">
            <span class="box">✓</span><span class="ico">${c.ico}</span>${c.name}
          </div>`).join("")}
      </div>
      <div class="disclaimer">
        <span class="ico">⚠️</span>
        <span>مراعاة الحالات الصحية هنا إرشادية لتقليل المخاطر، وليست بديلاً عن استشارة طبيب أو أخصائي علاج طبيعي قبل بدء أي برنامج تدريبي.</span>
      </div>

      <span class="eyebrow" style="display:block;margin-top:24px">🤖 طلب خاص للذكاء الاصطناعي <span style="color:var(--muted);font-weight:600">(اختياري)</span></span>
      <textarea id="ai-request" placeholder="اكتبي أي تخصيص تريدينه، مثال: ركّزي على المؤخرة والأرجل، تجنّبي تمارين القفز، اجعلي اليوم الأخير خفيفاً..."
        style="width:100%;min-height:90px;padding:14px;border:1.5px solid var(--line);border-radius:13px;font-family:'Tajawal';font-size:15px;font-weight:600;background:#fbfbfc;resize:vertical;line-height:1.7">${S.aiRequest||""}</textarea>
      <div class="hint" style="margin-top:6px">يُطبَّق فقط عند الضغط على «توليد بالذكاء الاصطناعي». الذكاء يفهم طلبك وينفّذه في الجدول.</div>

      <div class="actions">
        <button class="btn line" data-act="to0">→ رجوع</button>
        <button class="btn primary" data-act="to2">اختيار التمارين ←</button>
      </div>
    </div>
  </div></div>`;
}

/* ---------------- شاشة 3: منتقي التمارين ---------------- */
let pickerTab="chest";
function availableEx(){
  return EX.filter(e=>e.env.includes(S.env) && e.level<=S.level && !S.no.has(e.id));
}
function screenPicker(){
  const groups=MGROUPS.filter(gp=>EX.some(e=>e.group===gp[0]&&e.env.includes(S.env)));
  if(!groups.some(g=>g[0]===pickerTab)) pickerTab=groups[0][0];
  const list=EX.filter(e=>e.group===pickerTab && e.env.includes(S.env));
  return `<div class="app">${stepper()}<div class="screen on">
    <div class="card">
      <div class="sec-head"><div class="ico">🎯</div><div>
        <h2>تفضيلات التمارين</h2><p>أشّري المفضّل ليُقدَّم في الجدول، واستبعدي ما لا تريدينه. هذه الخطوة اختيارية بالكامل.</p>
      </div></div>
      <div class="muscle-tabs" style="margin-top:16px">
        ${groups.map(gp=>`<button class="mtab ${pickerTab===gp[0]?'on':''}" data-tab="${gp[0]}">${gp[1]}</button>`).join("")}
      </div>
      <div class="ex-grid">
        ${list.map(e=>{
          const locked = e.level>S.level;
          return `<div class="ex">
            <div class="thumb">${imgThumb(e.muscle)}</div>
            <div class="meta"><b>${e.name}</b><small>${LEVELS[e.level].name} · ${MUSCLES[e.muscle]||""}</small></div>
            <div class="picks">
              <button class="pchip fav ${S.fav.has(e.id)?'on':''}" data-fav="${e.id}" title="مفضّل">★</button>
              <button class="pchip no ${S.no.has(e.id)?'on':''}" data-no="${e.id}" title="استبعاد">✕</button>
            </div>
          </div>`;
        }).join("")}
      </div>
      <div class="note">المفضّل: ${S.fav.size} · المستبعد: ${S.no.size} — يمكنك تجاوز هذه الخطوة وتوليد الجدول مباشرة.</div>
      <div class="actions">
        <button class="btn line" data-act="to1">→ رجوع</button>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn dark" data-act="generateAI">🤖 توليد بالذكاء الاصطناعي</button>
          <button class="btn primary" data-act="generate">⚡ توليد سريع</button>
        </div>
      </div>
    </div>
  </div></div>`;
}

/* ---------------- شاشة الجدول ---------------- */
function screenPlan(){
  if(!S.plan) return "";
  const c=S.client, L=LEVELS[S.level];
  const greeting = c.name ? `جدول ${c.name}` : "جدولك الرياضي";
  const today = new Date().toLocaleDateString('ar-SA-u-nu-latn',{year:'numeric',month:'long',day:'numeric'});
  return `<div class="app"><div class="screen on">

    <!-- ===== الغلاف الاحترافي (يظهر في الطباعة وأعلى الجدول) ===== -->
    <div class="cover show">
      <div class="cover-bg"></div>
      <div class="cover-in">
        <div class="cover-brand">
          <div class="logo">Z</div>
          <div><b>Zahraa<span>Fit</span></b><small>sport & nutrition</small></div>
        </div>
        <div class="cover-photo">${S.images.cover?`<img src="${S.images.cover}">`:`<span>🖼️<br><em>صورة الغلاف</em></span>`}</div>
        <span class="cover-eyebrow">برنامج تدريبي مخصّص</span>
        <h1 class="cover-title">${c.name||"المشتركة"}</h1>
        <div class="cover-data">
          ${c.age?`<div><b>${c.age}</b><small>العمر</small></div>`:""}
          ${c.height?`<div><b>${c.height}</b><small>الطول سم</small></div>`:""}
          ${c.weight?`<div><b>${c.weight}</b><small>الوزن كجم</small></div>`:""}
          <div><b>${ENVS[S.env].name}</b><small>البيئة</small></div>
          <div><b>${SPLIT_SYSTEMS[S.split].name}</b><small>النظام</small></div>
          <div><b>${S.days}</b><small>أيام</small></div>
        </div>
        <div class="cover-foot"><span>المدربة زهراء</span><span>${today}</span></div>
      </div>
    </div>

    <div class="plan-head"><div class="in">
      <span class="eyebrow" style="color:var(--orange-2)">ZahraaFit · جدول مخصّص</span>
      <h2>${greeting} <span>· ${ENVS[S.env].name}</span></h2>
      <p style="color:#c4cfe6;font-weight:500">${g("جاهز للانطلاق؟ التزِم بالأداء الصحيح","جاهزة للانطلاق؟ التزمي بالأداء الصحيح")} والراحة بين المجموعات.</p>
      <div class="plan-meta">
        <span>📍 ${ENVS[S.env].name}</span>
        <span>🎚️ ${L.name}</span>
        <span>📅 ${S.days} أيام</span>
        <span>⏱️ راحة ${L.rest}</span>
        ${S.conditions.length?`<span>🩺 ${S.conditions.length} حالة مراعاة</span>`:""}
      </div>
    </div></div>

    ${S.conditions.length?`<div class="disclaimer" style="margin-bottom:20px">
      <span class="ico">⚠️</span>
      <span>تم استبعاد/تعديل بعض التمارين بناءً على الحالات الصحية المُدخلة. هذا إرشادي وليس بديلاً عن رأي مختص. أوقِف${g("","ي")} أي تمرين يسبّب ألماً.</span>
    </div>`:""}

    ${S.plan.map((day,i)=>`
      <div class="day-card">
        <div class="day-top">
          <div class="num">${i+1}</div>
          <div><b>اليوم ${i+1} — ${day.title}</b>
          <small>${day.exercises.length} تمارين · ${L.sets} مجموعات لكل تمرين</small></div>
        </div>
        ${day.exercises.map(e=>`
          <div class="ex-row">
            <div class="pic">${imgPic(e.muscle)}</div>
            <div class="body">
              <b>${e.name}</b>
              <div class="tip"><span class="i">💡</span> ${e.tip}</div>
            </div>
            <div class="sets">
              <div><b>${L.sets}</b><small>مجموعات</small></div>
              <div><b>${L.reps}</b><small>عدّة</small></div>
            </div>
            <div class="vid">${(videoLinks[e.id]||e.video)?`<a href="${videoLinks[e.id]||e.video}" target="_blank" rel="noopener">▶</a>`:`<span class="off" title="أضيفي رابط يوتيوب">▶</span>`}</div>
          </div>`).join("")}
      </div>`).join("")}

    <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:18px">
      <div>
        <b style="font-family:'Cairo';font-size:15px">📚 إرفاق الدليل التثقيفي وصفحة الإحماء</b>
        <div style="color:var(--muted);font-size:13px;font-weight:600;margin-top:2px">صفحة إحماء + ${EDU_PAGES.length} صفحات تثقيفية + صفحة الحقوق والتواصل — تُرفق كلها في الـ PDF.</div>
      </div>
      <div class="cond ${S.includeEdu?'on':''}" data-act="toggleedu" style="cursor:pointer;flex:none">
        <span class="box">✓</span>${S.includeEdu?'مُفعّل':'مُعطّل'}
      </div>
    </div>

    <div class="actions">
      <button class="btn line" data-act="to2">→ تعديل التمارين</button>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn line" data-act="editvideos">🔗 روابط الفيديو</button>
        <button class="btn dark" data-act="generate">↻ إعادة توليد</button>
        <button class="btn primary" data-act="exportprint">⬇️ حفظ كـ PDF</button>
      </div>
    </div>
    <div class="note">كل تمرين مربوط بصورة عضلته تلقائياً · الـ PDF يحتوي غلافاً + الجدول + الإحماء + الدليل التثقيفي.</div>
  </div></div>`;
}

/* ---------------- مكتبة الصور ---------------- */
function screenImages(){
  return `<div class="app"><div class="screen on">
    <div class="card">
      <div class="sec-head"><div class="ico">🖼️</div><div>
        <h2>مكتبة صور العضلات</h2><p>ارفعي صورك الـ14 مرة واحدة فقط. تُحفظ في متصفحك وتُربط بالتمارين تلقائياً في كل جدول.</p>
      </div></div>
      <div style="height:10px"></div>
      <div style="background:var(--orange-soft);border:1px solid rgba(232,98,44,.25);border-radius:14px;padding:14px;margin-bottom:18px;display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
        <div style="flex:1;min-width:160px;max-width:220px">
          <div class="img-slot ${S.images.logo?'filled':''}" data-slot="logo">
            <div class="ph" style="background:#0f1f3d">${S.images.logo?`<img src="${S.images.logo}">`:"＋"}</div>
            <b>✨ الشعار</b>
            ${S.images.logo?`<button class="pchip no" style="margin-top:6px" data-delimg="logo">حذف</button>`:""}
          </div>
          <p style="text-align:center;font-size:12px;color:var(--muted);font-weight:600;margin-top:8px">ارفعي شعارك بخلفية شفافة (PNG)</p>
        </div>
        <div style="flex:1;min-width:160px;max-width:220px">
          <div class="img-slot ${S.images.cover?'filled':''}" data-slot="cover">
            <div class="ph">${S.images.cover?`<img src="${S.images.cover}">`:"＋"}</div>
            <b>🖼️ صورة الغلاف</b>
            ${S.images.cover?`<button class="pchip no" style="margin-top:6px" data-delimg="cover">حذف</button>`:""}
          </div>
          <p style="text-align:center;font-size:12px;color:var(--muted);font-weight:600;margin-top:8px">تظهر في غلاف الجدول</p>
        </div>
      </div>
      <div class="img-grid">
        ${IMAGE_SLOTS.map(([k,label])=>`
          <div class="img-slot ${S.images[k]?'filled':''}" data-slot="${k}">
            <div class="ph">${S.images[k]?`<img src="${S.images[k]}">`:"＋"}</div>
            <b>${label}</b>
            ${S.images[k]?`<button class="pchip no" style="margin-top:6px" data-delimg="${k}">حذف</button>`:""}
          </div>`).join("")}
      </div>
      <div class="note">صيغ مدعومة: JPG / PNG. الصور لا تُرفع لأي خادم — تبقى على جهازك فقط.</div>
      <div class="actions">
        <span></span>
        <button class="btn primary" data-act="closeimg">تم ←</button>
      </div>
    </div>
  </div></div>`;
}

/* ---------------- مكتبة الفيديوهات المركزية ---------------- */
let videoFilter="";
function screenVideos(){
  const groupNames={
    chest:"الصدر",back:"الظهر",shoulders:"الأكتاف",biceps:"البايسبس",triceps:"الترايسبس",
    quads:"فخذ أمامي",hams:"فخذ خلفي",adductors:"فخذ داخلي",glutes:"المؤخرة",calves:"السمانة",abs:"البطن"
  };
  // عدّ الروابط المحفوظة
  const total=EX.length;
  const filled=EX.filter(e=>videoLinks[e.id]).length;

  // دالة بناء صف رابط موحّدة
  const row=(id,name,sub)=>`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)">
        <span style="flex:none;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;font-size:14px;background:${videoLinks[id]?'#ff0000':'#eef0f4'};color:${videoLinks[id]?'#fff':'#aab3c2'}">▶</span>
        <div style="flex:none;width:130px">
          <div style="font-family:'Cairo';font-weight:700;font-size:13.5px">${name}</div>
          <div style="font-size:11px;color:var(--muted);font-weight:600">${sub||""}</div>
        </div>
        <input data-vidlib="${id}" value="${videoLinks[id]||""}" placeholder="https://youtube.com/..."
          style="flex:1;padding:9px 12px;border:1.5px solid var(--line);border-radius:10px;font-family:'Tajawal';font-size:13px;font-weight:600;background:#fbfbfc">
      </div>`;
  const sectionBox=(title,count,rowsHtml)=>`<div style="margin-bottom:18px">
      <div style="font-family:'Cairo';font-weight:800;font-size:16px;color:var(--orange);margin-bottom:6px">${title} <span style="color:var(--muted);font-size:12px;font-weight:600">(${count})</span></div>
      ${rowsHtml}</div>`;

  let sections="";
  // 1) تمارين العضلات الأساسية
  Object.entries(groupNames).forEach(([g,gname])=>{
    let list=EX.filter(e=>e.group===g);
    if(videoFilter) list=list.filter(e=>e.name.includes(videoFilter));
    if(!list.length) return;
    const rows=list.map(e=>row(e.id,e.name,LEVELS[e.level].name)).join("");
    sections+=sectionBox(gname,list.length,rows);
  });

  // 2) تمارين الإحماء
  let warmRows="", warmCount=0;
  Object.values(WARMUP).forEach(w=>{
    w.items.forEach(it=>{
      if(videoFilter && !it[1].includes(videoFilter)) return;
      warmCount++;
      warmRows+=row(it[0],it[1],w.name);
    });
  });
  if(warmRows) sections+=sectionBox("🔥 تمارين الإحماء",warmCount,warmRows);

  // 3) تمارين الدعم والتأهيل (لكل حالة صحية)
  const condNames={knee:"دعم الركبة",lowerback:"دعم أسفل الظهر",shoulder:"دعم الكتف",weakcore:"تقوية الكور",wrist:"دعم الرسغ",neck:"دعم الرقبة",diastasis:"الانفصال العضلي"};
  let supRows="", supCount=0;
  Object.entries(SUPPORT).forEach(([cid,sup])=>{
    sup.items.forEach((it,i)=>{
      if(videoFilter && !it[1].includes(videoFilter)) return;
      supCount++;
      supRows+=row(`sup_${cid}_${i}`,it[1],condNames[cid]||sup.name);
    });
  });
  if(supRows) sections+=sectionBox("🩹 تمارين الدعم والتأهيل",supCount,supRows);

  return `<div class="app"><div class="screen on">
    <div class="card">
      <div class="sec-head"><div class="ico">🎬</div><div>
        <h2>مكتبة الفيديوهات</h2><p>ألصقي رابط يوتيوب لكل تمرين مرة واحدة فقط. يُحفظ تلقائياً، ويُسحب في أي جدول تولّدينه — لن تُعيدي إدخاله أبداً.</p>
      </div></div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:14px 0 18px">
        <div style="flex:1;min-width:180px">
          <input id="vid-search" value="${videoFilter}" placeholder="🔍 ابحثي عن تمرين..."
            style="width:100%;padding:11px 14px;border:1.5px solid var(--line);border-radius:12px;font-family:'Tajawal';font-weight:600;background:#fbfbfc">
        </div>
        <div style="background:var(--orange-soft);color:var(--orange);font-weight:800;font-family:'Cairo';padding:9px 16px;border-radius:30px;font-size:14px">${filled} / ${total} رابط</div>
      </div>
      <div style="max-height:60vh;overflow-y:auto;padding-left:6px">${sections}</div>
      <div class="note">الروابط تُحفظ تلقائياً فور كتابتها. تُربط بالتمارين في الجدول والإحماء والمكتبة.</div>
      <div class="actions">
        <span></span>
        <button class="btn primary" data-act="closevideos">تم ←</button>
      </div>
    </div>
  </div></div>`;
}

/* ---------- مساعدات الصور ---------- */
function imgThumb(muscle){
  return S.images[muscle] ? `<img src="${S.images[muscle]}">` : "🎯";
}
function imgPic(muscle){
  return S.images[muscle] ? `<img src="${S.images[muscle]}">` : (MUSCLES[muscle]||"عضلة");
}

/* ============================================================
   توليد الجدول
   ============================================================ */
function dangerSet(){
  const d=new Set();
  S.conditions.forEach(cid=>{
    const c=CONDITIONS.find(x=>x.id===cid);
    if(c) c.avoid.forEach(r=>d.add(r));
  });
  return d;
}
function generate(){
  const danger=dangerSet();
  const sys = SPLIT_SYSTEMS[S.split] || SPLIT_SYSTEMS.ppl;
  const split = sys.days[S.days] || sys.days[4] || Object.values(sys.days)[0];
  const L=LEVELS[S.level];
  const used=new Set();

  const plan = split.map(groups=>{
    const dayPicks=[];
    const totalTarget = S.dailyCount; // العدد الإجمالي الذي اختارته المدربة

    // وزّع العدد الإجمالي بين عضلات اليوم: الكبيرة وزنها 2، الصغيرة 1
    const weights = groups.map(g=>BIG_GROUPS.includes(g)?2:1);
    const wSum = weights.reduce((a,b)=>a+b,0);
    // حصة كل عضلة (حد أدنى 1 لكل عضلة موجودة)
    let quotas = groups.map((g,i)=>Math.max(1, Math.round(totalTarget*weights[i]/wSum)));
    // عدّل المجموع ليطابق الهدف تماماً
    let diff = totalTarget - quotas.reduce((a,b)=>a+b,0);
    while(diff!==0){
      // أضف/اطرح من العضلة الأكبر وزناً (أو الأصغر عند الطرح)
      const idx = diff>0
        ? weights.indexOf(Math.max(...weights.map((w,i)=>quotas[i]>0?w:-1)))
        : quotas.indexOf(Math.max(...quotas));
      quotas[idx]+= diff>0?1:-1;
      if(quotas[idx]<1) quotas[idx]=1;
      diff = totalTarget - quotas.reduce((a,b)=>a+b,0);
      if(quotas.every(q=>q<=1) && diff<0) break; // تفادي حلقة لا نهائية
    }

    groups.forEach((group,gi)=>{
      const target = quotas[gi];
      let pool = EX.filter(e=>
        e.group===group &&
        e.env.includes(S.env) &&
        e.level<=S.level &&
        !S.no.has(e.id) &&
        !e.risk.some(r=>danger.has(r))
      );
      pool.sort((a,b)=>{
        const fa=S.fav.has(a.id)?0:1, fb=S.fav.has(b.id)?0:1;
        if(fa!==fb) return fa-fb;
        const ua=used.has(a.id)?1:0, ub=used.has(b.id)?1:0;
        return ua-ub;
      });
      let added=0;
      for(const e of pool){
        if(added>=target) break;
        if(used.has(e.id)) continue;
        dayPicks.push(e); used.add(e.id); added++;
      }
      if(added<target){
        for(const e of pool){
          if(added>=target) break;
          if(dayPicks.includes(e)) continue;
          dayPicks.push(e); added++;
        }
      }
    });

    // حماية أخيرة: لا يوم فارغ
    if(dayPicks.length===0){
      const fb=EX.filter(e=>
        e.env.includes(S.env) && e.level<=S.level &&
        !S.no.has(e.id) && !e.risk.some(r=>danger.has(r))
      ).slice(0,4);
      fb.forEach(e=>{dayPicks.push(e);used.add(e.id);});
    }

    const title = groups.map(gp=>DAY_NAMES[gp]).join(" + ");
    return {title, exercises:dayPicks.map(e=>({...e, video:videoLinks[e.id]||""}))};
  });
  S.plan=plan;
  go(3);
}

/* ---------- التوليد بالذكاء الاصطناعي ---------- */
async function generateAI(){
  // الذكاء الاصطناعي يحتاج خادماً (Vercel)؛ لا يعمل من ملف محلي
  if(location.protocol==="file:"){
    alert("🤖 التوليد بالذكاء الاصطناعي يعمل فقط بعد نشر البرنامج على Vercel (راجعي دليل النشر).\n\nسيتم الآن استخدام التوليد السريع.");
    generate(); return;
  }
  const btn=document.querySelector('[data-act="generateAI"]');
  const orig = btn ? btn.textContent : "";
  if(btn){ btn.textContent="🤖 يفكّر..."; btn.disabled=true; }

  // التمارين المتاحة لبيئة العميل ومستواه (نرسلها للذكاء ليختار منها)
  const danger=dangerSet();
  const available = EX
    .filter(e=> e.env.includes(S.env) && e.level<=S.level && !S.no.has(e.id) && !e.risk.some(r=>danger.has(r)))
    .map(e=>({id:e.id, name:e.name, group:e.group, muscle:e.muscle, level:e.level, fav:S.fav.has(e.id)}));

  try{
    const resp = await fetch("/api/generate", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        client:S.client, env:S.env, level:S.level, days:S.days,
        split:S.split, dailyCount:S.dailyCount, conditions:S.conditions,
        aiRequest:S.aiRequest, available
      })
    });
    if(!resp.ok){
      const err=await resp.json().catch(()=>({}));
      throw new Error(err.error || "تعذّر الاتصال بالذكاء الاصطناعي");
    }
    const data = await resp.json();
    if(!data.plan || !Array.isArray(data.plan)) throw new Error("ناتج غير متوقع من الذكاء");

    // حوّل ناتج الذكاء (ids) إلى جدول كامل
    const exById=Object.fromEntries(EX.map(e=>[e.id,e]));
    S.plan = data.plan.map(day=>({
      title: day.title || "يوم",
      exercises: (day.exerciseIds||[])
        .map(id=>exById[id])
        .filter(Boolean)
        .map(e=>({...e, video:videoLinks[e.id]||""}))
    })).filter(d=>d.exercises.length);

    if(!S.plan.length) throw new Error("لم يُنتج الذكاء جدولاً صالحاً");
    go(3);
  }catch(e){
    alert("تعذّر التوليد بالذكاء الاصطناعي:\n"+e.message+"\n\nسيتم استخدام التوليد السريع بدلاً منه.");
    generate(); // احتياطي: التوليد المنطقي العادي
  }finally{
    if(btn){ btn.textContent=orig; btn.disabled=false; }
  }
}
let videoLinks={};
function loadStored(){
  try{
    const im=localStorage.getItem("zf_images"); if(im) S.images=JSON.parse(im);
    const vl=localStorage.getItem("zf_videos"); if(vl) videoLinks=JSON.parse(vl);
  }catch(e){}
}
function saveImages(){ try{localStorage.setItem("zf_images",JSON.stringify(S.images));}catch(e){} }
function saveVideos(){ try{localStorage.setItem("zf_videos",JSON.stringify(videoLinks));}catch(e){} }

/* ---------- إدارة روابط الفيديو (نافذة بسيطة) ---------- */
function editVideos(){
  const exById=Object.fromEntries(EX.map(e=>[e.id,e]));
  const danger=dangerSet();
  // 1) تمارين الجدول
  const planIds=[...new Set(S.plan.flatMap(d=>d.exercises.map(e=>e.id)))];
  // 2) تمارين الإحماء
  const warmIds=[...WARMUP.upper.items, ...WARMUP.lower.items];
  // 3) تمارين المكتبة (البدائل = خارج الجدول، متاحة للبيئة والمستوى)
  const planSet=new Set(planIds);
  const libIds=EX.filter(e=>
    e.env.includes(S.env) && e.level<=S.level &&
    !e.risk.some(r=>danger.has(r)) && !planSet.has(e.id)
  ).map(e=>e.id);

  const section=(title,sub)=>`<div style="margin-top:22px;margin-bottom:6px">
    <div style="font-family:'Cairo';font-weight:800;font-size:16px;color:var(--navy)">${title}</div>
    <div style="font-size:12.5px;color:var(--muted);font-weight:600">${sub}</div></div>`;
  const fieldFor=(id,name)=>`<div class="field"><label>${name}</label>
      <input data-vid="${id}" value="${videoLinks[id]||""}" placeholder="https://youtube.com/watch?v=..."></div>`;

  let html=`<div class="app"><div class="screen on"><div class="card">
    <div class="sec-head"><div class="ico">🔗</div><div><h2>روابط الفيديو</h2>
    <p>ألصقي رابط يوتيوب لأي تمرين في الجدول أو الإحماء أو المكتبة. يظهر زر التشغيل ▶ في الـ PDF فور الحفظ.</p></div></div>`;

  html+=section("🏋️ تمارين الجدول","التمارين الموجودة في برنامج العميل الحالي");
  html+=`<div style="display:grid;gap:10px">`;
  planIds.forEach(id=>{ const e=exById[id]; if(e) html+=fieldFor(id,e.name); });
  html+=`</div>`;

  html+=section("🔥 تمارين الإحماء","إحماء علوي وسفلي");
  html+=`<div style="display:grid;gap:10px">`;
  warmIds.forEach(it=>{ html+=fieldFor(it[0], it[1]); });
  html+=`</div>`;

  html+=section("📚 تمارين المكتبة (البدائل)","التمارين البديلة خارج الجدول");
  html+=`<div style="display:grid;gap:10px">`;
  libIds.forEach(id=>{ const e=exById[id]; if(e) html+=fieldFor(id,e.name); });
  html+=`</div>`;

  // تمارين الدعم للحالات الصحية المختارة
  if(S.conditions.length){
    S.conditions.forEach(cid=>{
      const sup=SUPPORT[cid];
      if(!sup) return;
      html+=section(`${sup.ico} ${sup.name}`,"تمارين الدعم والتأهيل لهذه الحالة");
      html+=`<div style="display:grid;gap:10px">`;
      sup.items.forEach((it,i)=>{ html+=fieldFor(`sup_${cid}_${i}`, it[0]); });
      html+=`</div>`;
    });
  }

  html+=`<div class="actions" style="margin-top:24px"><button class="btn line" data-act="backplan">→ رجوع للجدول</button>
    <button class="btn primary" data-act="savevideos">💾 حفظ الروابط</button></div></div></div></div>`;
  document.getElementById("root").innerHTML=topbar()+html;
  bind();
}

/* ============================================================
   تصدير PDF احترافي — يبني مستنداً نظيفاً (غلاف + أيام)
   بدون أي عناصر واجهة برمجية، بألوان كاملة، كل يوم صفحة.
   ============================================================ */
function buildPdfHTML(){
  const c=S.client, L=LEVELS[S.level];
  const today=new Date().toLocaleDateString('ar-SA-u-nu-latn',{year:'numeric',month:'long',day:'numeric'});
  const navy="#0f1f3d", navy2="#16294b", navy3="#1f3661", orange="#e8622c", orange2="#ff7a3d";

  /* الشعار: يستخدم الصورة المرفوعة إن وُجدت، وإلا نص ZAHRAA FITNESS */
  const logoSVG=(color="#ffffff",size=1)=>{
    if(S.images.logo){
      return `<img src="${S.images.logo}" style="height:${72*size}px;max-width:${260*size}px;object-fit:contain">`;
    }
    return `<div style="display:inline-block;text-align:center;line-height:1.05">
      <div style="font-family:Cairo,Arial,sans-serif;font-weight:900;font-size:${36*size}px;letter-spacing:${3*size}px;color:${color}">ZAHRAA</div>
      <div style="font-family:Cairo,Arial,sans-serif;font-weight:900;font-size:${30*size}px;letter-spacing:${11*size}px;color:${color}">FITNESS</div>
    </div>`;
  };

  const dataCell=(b,s)=> `<td style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:12px 8px;text-align:center">
    <div style="font-family:Cairo;font-weight:900;font-size:17px;color:#fff">${b}</div>
    <div style="color:#aebbd6;font-size:11px;font-weight:600">${s}</div></td>`;

  // ===== الغلاف =====
  let cover=`<div style="position:relative;width:100%;height:297mm;background:linear-gradient(160deg,${navy} 0%,${navy2} 60%,${navy3} 100%);overflow:hidden;page-break-after:always;page-break-inside:avoid">
    <div style="position:absolute;right:-9%;top:-7%;width:42%;padding-bottom:42%;border-radius:50%;background:radial-gradient(circle,rgba(232,98,44,.4),transparent 70%)"></div>
    <div style="position:absolute;left:-8%;bottom:-9%;width:36%;padding-bottom:36%;border-radius:50%;background:radial-gradient(circle,rgba(255,122,61,.22),transparent 70%)"></div>
    <div style="position:relative;z-index:2;padding:14% 9%;color:#fff">
      <div style="margin-bottom:34px">${logoSVG("#ffffff",1.15)}
        <div style="color:#aebbd6;font-size:12px;font-weight:600;margin-top:8px;letter-spacing:3px">SPORT & NUTRITION</div></div>
      <div style="width:100%;height:330px;border-radius:20px;overflow:hidden;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.14);margin-bottom:34px;display:flex;align-items:center;justify-content:center;color:#8294b8;font-size:38px">
        ${S.images.cover?`<img src="${S.images.cover}" style="width:100%;height:330px;object-fit:cover">`:`🖼️`}
      </div>
      <div style="color:${orange2};font-family:Cairo;font-weight:800;font-size:14px;letter-spacing:2px">برنامج تدريبي مخصّص</div>
      <div style="font-family:Cairo;font-weight:900;font-size:46px;margin:8px 0 30px">${c.name||"المشتركة"}</div>
      <table style="width:100%;border-collapse:separate;border-spacing:11px;margin-bottom:10px"><tr>
        ${c.age?dataCell(c.age,"العمر"):""}
        ${c.height?dataCell(c.height,"الطول سم"):""}
        ${c.weight?dataCell(c.weight,"الوزن كجم"):""}
      </tr><tr>
        ${dataCell(ENVS[S.env].name,"البيئة")}
        ${dataCell(SPLIT_SYSTEMS[S.split].name,"النظام")}
        ${dataCell(S.days+" أيام","المدة")}
      </tr></table>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid rgba(255,255,255,.14);margin-top:30px"><tr>
        <td style="padding-top:18px;color:#c4cfe6;font-weight:700;font-size:15px">المدربة زهراء</td>
        <td style="padding-top:18px;text-align:left;color:#c4cfe6;font-weight:700;font-size:15px">${today}</td>
      </tr></table>
    </div>
  </div>`;

  // ===== الأيام =====
  let body="";
  S.plan.forEach((day,i)=>{
    let rows="";
    day.exercises.forEach(e=>{
      const pic = S.images[e.muscle]
        ? `<div style="width:92px;height:92px;border-radius:12px;background:#fff;border:1px solid #e3e7ee;padding:4px;display:flex;align-items:center;justify-content:center"><img src="${S.images[e.muscle]}" style="max-width:100%;max-height:100%;object-fit:contain"></div>`
        : `<div style="width:92px;height:92px;border-radius:12px;background:#f4f6f9;border:1px solid #e3e7ee;color:${navy};font-size:10px;font-weight:700;text-align:center;display:flex;align-items:center;justify-content:center;padding:4px">${MUSCLES[e.muscle]||""}</div>`;
      const vlink = videoLinks[e.id]||e.video;
      const vidBtn = vlink
        ? `<a href="${vlink}" style="text-decoration:none;display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:#ff0000;color:#fff;font-size:15px">▶</a>`
        : `<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:#eef0f4;color:#aab3c2;font-size:13px">▶</span>`;
      rows+=`<tr style="page-break-inside:avoid">
        <td style="width:100px;padding:12px 10px;vertical-align:middle">${pic}</td>
        <td style="padding:12px 6px;vertical-align:middle">
          <div style="font-family:Cairo;font-weight:700;font-size:15px;color:${navy}">${e.name}</div>
          <div style="font-size:12px;color:#6a7488;font-weight:600;margin-top:2px">💡 ${e.tip}</div>
        </td>
        <td style="width:60px;text-align:center;vertical-align:middle">
          <div style="font-family:Cairo;font-weight:900;font-size:18px;color:${navy}">${L.sets}</div>
          <div style="font-size:10px;color:#6a7488;font-weight:700">مجموعات</div></td>
        <td style="width:68px;text-align:center;vertical-align:middle">
          <div style="font-family:Cairo;font-weight:900;font-size:18px;color:${navy}">${L.reps}</div>
          <div style="font-size:10px;color:#6a7488;font-weight:700">عدّة</div></td>
        <td style="width:56px;text-align:center;vertical-align:middle">
          <div style="font-family:Cairo;font-weight:900;font-size:14px;color:${orange}">${L.rest}</div>
          <div style="font-size:10px;color:#6a7488;font-weight:700">راحة</div></td>
        <td style="width:44px;text-align:center;vertical-align:middle">${vidBtn}</td>
      </tr>`;
    });
    body+=`<div style="page-break-inside:avoid;${i>0?'page-break-before:always;':''}margin-bottom:6px">
      <table style="width:100%;border-collapse:collapse;background:linear-gradient(90deg,${navy},${navy2});border-radius:14px 14px 0 0;overflow:hidden">
        <tr><td style="padding:18px 22px">
          <span style="display:inline-grid;place-items:center;width:40px;height:40px;border-radius:11px;background:${orange};font-family:Cairo;font-weight:900;font-size:18px;color:#fff;vertical-align:middle">${i+1}</span>
          <span style="font-family:Cairo;font-weight:900;font-size:18px;color:#fff;margin-right:12px;vertical-align:middle">اليوم ${i+1} — ${day.title}</span>
          <div style="color:#b9c5dd;font-weight:600;font-size:12px;margin-top:4px">${day.exercises.length} تمارين · ${L.sets} مجموعات لكل تمرين</div>
        </td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e3e7ee;border-top:none;border-radius:0 0 14px 14px;overflow:hidden">
        ${rows.replace(/<tr /g,'<tr style="border-bottom:1px solid #eef0f4" ').replace('border-bottom:1px solid #eef0f4" style="page-break-inside:avoid','page-break-inside:avoid')}
      </table>
    </div>`;
  });

  // ===== تنبيه صحي إن وُجد =====
  let disc = S.conditions.length
    ? `<div style="page-break-inside:avoid;background:#fff7ee;border:1px solid rgba(217,138,31,.3);border-radius:12px;padding:14px 16px;font-size:12.5px;color:#8a5a13;font-weight:600;margin-top:14px">
        ⚠️ روعيت الحالات الصحية المُدخلة بتعديل/استبعاد بعض التمارين. هذا إرشادي وليس بديلاً عن رأي مختص؛ يُوقف أي تمرين يسبّب ألماً.</div>` : "";

  // ===== صفحة الإحماء =====
  const warmCol=(w)=>`
    <div style="background:#fff;border:1px solid #e3e7ee;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(90deg,${navy},${navy2});padding:16px 20px">
        <div style="font-family:Cairo;font-weight:900;font-size:18px;color:#fff">${w.name}</div>
        <div style="color:#b9c5dd;font-size:11.5px;font-weight:600;margin-top:2px">${w.sub}</div>
      </div>
      <div style="padding:8px 18px 14px">
        ${w.items.map((it,i)=>{
          const vid = videoLinks[it[0]]
            ? `<a href="${videoLinks[it[0]]}" style="text-decoration:none;flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#ff0000;color:#fff;font-size:12px">▶</a>`
            : `<span style="flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#eef0f4;color:#aab3c2;font-size:11px">▶</span>`;
          return `<div style="display:flex;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid #f0f2f6">
            <div style="flex:none;width:26px;height:26px;border-radius:8px;background:${orange};color:#fff;font-family:Cairo;font-weight:800;font-size:13px;text-align:center;line-height:26px">${i+1}</div>
            <div style="flex:1"><div style="font-family:Cairo;font-weight:700;font-size:14.5px;color:${navy}">${it[1]}</div>
            <div style="font-size:12.5px;color:#6a7488;font-weight:600;line-height:1.7">${it[2]}</div></div>
            ${vid}
          </div>`;
        }).join("")}
      </div>
    </div>`;
  let warmup="";
  if(S.includeEdu){
  warmup=`<div style="page-break-before:always;page-break-inside:avoid;padding:48px 52px;background:linear-gradient(180deg,#fbfbfc,#fff)">
    <div style="text-align:center;margin-bottom:8px">
      <span style="font-family:Cairo;font-weight:900;font-size:13px;color:${orange};letter-spacing:2px">ZAHRAAFIT · قبل التمرين</span>
    </div>
    <h1 style="font-family:Cairo;font-weight:900;font-size:30px;color:${navy};text-align:center;margin-bottom:6px">الإحماء</h1>
    <div style="width:90px;height:4px;background:${orange};border-radius:4px;margin:0 auto 18px"></div>
    <p style="text-align:center;color:#6a7488;font-size:14.5px;font-weight:600;max-width:560px;margin:0 auto 26px;line-height:1.9">الإحماء 5–10 دقائق قبل كل تمرين يقلّل خطر الإصابة ويرفع كفاءة الأداء. اختاري القسم المناسب ليومك.</p>
    <table style="width:100%;border-collapse:separate;border-spacing:12px"><tr>
      <td style="width:50%;vertical-align:top">${warmCol(WARMUP.upper)}</td>
      <td style="width:50%;vertical-align:top">${warmCol(WARMUP.lower)}</td>
    </tr></table>
  </div>`;
  }

  // ===== صفحات دعم الحالات الصحية =====
  let support="";
  if(S.includeEdu && S.conditions.length){
    S.conditions.forEach(cid=>{
      const sup=SUPPORT[cid];
      if(!sup) return;
      const items=sup.items.map((it,i)=>{
        const vl=videoLinks[`sup_${cid}_${i}`];
        const vbtn=vl
          ? `<a href="${vl}" style="flex:none;text-decoration:none;display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:#ff0000;color:#fff;font-size:13px">▶</a>`
          : "";
        return `
        <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f0f2f6;align-items:center">
          <div style="flex:none;width:28px;height:28px;border-radius:8px;background:${orange};color:#fff;font-family:Cairo;font-weight:800;font-size:13px;text-align:center;line-height:28px">${i+1}</div>
          <div style="flex:1"><div style="font-family:Cairo;font-weight:700;font-size:15px;color:${navy};margin-bottom:2px">${it[0]}</div>
          <div style="font-size:13px;color:#56627a;font-weight:600;line-height:1.7">${it[1]}</div></div>
          ${vbtn}
        </div>`;}).join("");
      support+=`<div style="page-break-before:always;page-break-inside:avoid;padding:48px 52px;background:linear-gradient(180deg,#fef6f2,#fff)">
        <div style="text-align:center;margin-bottom:8px">
          <span style="font-family:Cairo;font-weight:900;font-size:13px;color:${orange};letter-spacing:2px">ZAHRAAFIT · دعم وتأهيل</span>
        </div>
        <h1 style="font-family:Cairo;font-weight:900;font-size:29px;color:${navy};text-align:center;margin-bottom:6px">${sup.ico} ${sup.name}</h1>
        <div style="width:90px;height:4px;background:${orange};border-radius:4px;margin:0 auto 16px"></div>
        <p style="text-align:center;color:#6a7488;font-size:14px;font-weight:600;max-width:560px;margin:0 auto 22px;line-height:1.9">${sup.intro}</p>
        <div style="background:#fff;border:1px solid #f0d9cf;border-radius:16px;padding:10px 20px 16px;max-width:600px;margin:0 auto">${items}</div>
        <div style="display:flex;gap:10px;align-items:flex-start;background:#fff7ee;border:1px solid rgba(217,138,31,.3);border-radius:12px;padding:13px 16px;font-size:12.5px;color:#8a5a13;font-weight:600;margin:18px auto 0;max-width:600px">
          <span style="font-size:18px">⚠️</span>
          <span>هذه تمارين دعم عامة وليست علاجاً طبياً. إن استمرّ الألم أو زاد، راجعي طبيباً أو أخصائي علاج طبيعي قبل المتابعة.</span>
        </div>
      </div>`;
    });
  }

  // ===== الصفحات التثقيفية =====
  let edu="";
  if(S.includeEdu){
    EDU_PAGES.forEach((pg,idx)=>{
      let blocks=pg.blocks.map(b=>`
        <div style="background:#fff;border:1px solid #e3e7ee;border-right:4px solid ${orange};border-radius:12px;padding:16px 18px;margin-bottom:13px">
          <div style="font-family:Cairo;font-weight:800;font-size:16px;color:${navy};margin-bottom:5px">${b.h}</div>
          <div style="font-size:14px;line-height:1.85;color:#445">${b.p}</div>
        </div>`).join("");
      edu+=`<div style="page-break-before:always;page-break-inside:avoid;padding:48px 52px;background:linear-gradient(180deg,#fbfbfc,#fff)">
        <div style="text-align:center;margin-bottom:8px">
          <span style="font-family:Cairo;font-weight:900;font-size:13px;color:${orange};letter-spacing:2px">ZAHRAAFIT · دليل تثقيفي</span>
        </div>
        <h1 style="font-family:Cairo;font-weight:900;font-size:30px;color:${navy};text-align:center;margin-bottom:6px">${pg.title}</h1>
        <div style="width:90px;height:4px;background:${orange};border-radius:4px;margin:0 auto 18px"></div>
        <p style="text-align:center;color:#6a7488;font-size:14.5px;font-weight:600;max-width:560px;margin:0 auto 26px;line-height:1.9">${pg.intro}</p>
        ${blocks}
      </div>`;
    });
  }

  // ===== مكتبة التمارين البديلة (فقط ما ليس في الجدول) =====
  let library="";
  if(S.includeEdu){
    const inPlan = new Set(S.plan.flatMap(d=>d.exercises.map(e=>e.id)));
    const danger2 = dangerSet();
    const groupNames={
      chest:"الصدر",back:"الظهر",shoulders:"الأكتاف",biceps:"البايسبس",triceps:"الترايسبس",
      quads:"فخذ أمامي",hams:"فخذ خلفي",adductors:"فخذ داخلي",glutes:"المؤخرة",calves:"السمانة",abs:"البطن"
    };

    let cards="";
    Object.entries(groupNames).forEach(([g,gname])=>{
      // البدائل فقط: متاحة للبيئة والمستوى، غير خطرة، وليست في الجدول
      const list = EX.filter(e=>
        e.group===g &&
        e.env.includes(S.env) &&
        e.level<=S.level &&
        !e.risk.some(r=>danger2.has(r)) &&
        !inPlan.has(e.id)
      );
      if(!list.length) return;
      const rows = list.map(e=>{
        const pic = S.images[e.muscle]
          ? `<div style="width:50px;height:50px;border-radius:9px;background:#fff;border:1px solid #e3e7ee;padding:3px;display:flex;align-items:center;justify-content:center"><img src="${S.images[e.muscle]}" style="max-width:100%;max-height:100%;object-fit:contain"></div>`
          : `<div style="width:50px;height:50px;border-radius:9px;background:#f4f6f9;border:1px solid #e3e7ee"></div>`;
        const vid = videoLinks[e.id]
          ? `<a href="${videoLinks[e.id]}" style="text-decoration:none;display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:#ff0000;color:#fff;font-size:13px">▶</a>`
          : `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:#eef0f4;color:#aab3c2;font-size:12px" title="أضيفي رابط فيديو">▶</span>`;
        return `<div style="display:flex;align-items:center;gap:9px;padding:7px 4px;border-bottom:1px solid #f0f2f6">
          ${pic}
          <div style="flex:1;min-width:0">
            <div style="font-family:Cairo;font-weight:700;font-size:13px;color:${navy};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.name}</div>
            <div style="font-size:10px;color:#94a0b4;font-weight:600">${LEVELS[e.level].name}</div>
          </div>
          ${vid}
        </div>`;
      }).join("");
      cards+=`<div style="break-inside:avoid;background:#fff;border:1px solid #e3e7ee;border-radius:14px;overflow:hidden;margin-bottom:13px">
        <div style="background:linear-gradient(90deg,${navy},${navy2});padding:10px 15px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-family:Cairo;font-weight:800;font-size:14.5px;color:#fff">${gname}</span>
          <span style="font-size:10.5px;color:#b9c5dd;font-weight:600">${list.length} بديل</span>
        </div>
        <div style="padding:5px 13px 9px">${rows}</div>
      </div>`;
    });

    if(cards){
      library=`<div style="page-break-before:always;padding:48px 52px;background:linear-gradient(180deg,#fbfbfc,#fff)">
        <div style="text-align:center;margin-bottom:8px">
          <span style="font-family:Cairo;font-weight:900;font-size:13px;color:${orange};letter-spacing:2px">ZAHRAAFIT · بدائل التمارين</span>
        </div>
        <h1 style="font-family:Cairo;font-weight:900;font-size:30px;color:${navy};text-align:center;margin-bottom:6px">مكتبة التمارين الإضافية</h1>
        <div style="width:90px;height:4px;background:${orange};border-radius:4px;margin:0 auto 18px"></div>
        <p style="text-align:center;color:#6a7488;font-size:14px;font-weight:600;max-width:580px;margin:0 auto 24px;line-height:1.9">
          هذه تمارين بديلة (غير الموجودة في جدولك) مرتّبة حسب العضلة، يمكنك استخدامها لإضافة تنوّع أو استبدال تمرين عند الحاجة — دون تغيير ترتيب جدولك الأساسي. زر ▶ يفتح فيديو الشرح إن تم إضافته.
        </p>
        <div style="column-count:2;column-gap:16px">${cards}</div>
      </div>`;
    }
  }

  // ===== صفحة الحقوق والتواصل =====
  let rights="";
  if(S.includeEdu){
    const social=(label,handle)=>`
      <div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:11px 16px">
        <span style="font-family:Cairo;font-weight:800;font-size:13px;color:${orange2};min-width:70px">${label}</span>
        <span style="font-weight:700;font-size:14px;color:#fff;direction:ltr">${handle}</span>
      </div>`;
    rights=`<div style="page-break-before:always;page-break-inside:avoid;position:relative;width:100%;height:297mm;background:linear-gradient(160deg,${navy} 0%,${navy2} 60%,${navy3} 100%);overflow:hidden">
      <div style="position:absolute;right:-9%;top:-7%;width:42%;padding-bottom:42%;border-radius:50%;background:radial-gradient(circle,rgba(232,98,44,.35),transparent 70%)"></div>
      <div style="position:absolute;left:-8%;bottom:-9%;width:36%;padding-bottom:36%;border-radius:50%;background:radial-gradient(circle,rgba(255,122,61,.2),transparent 70%)"></div>
      <div style="position:relative;z-index:2;padding:8% 7%;color:#fff;text-align:center">
        <div style="display:flex;justify-content:center;margin-bottom:10px">${logoSVG("#ffffff",1)}</div>
        <div style="color:#aebbd6;font-size:13px;font-weight:600;margin-bottom:30px;letter-spacing:3px">SPORT & NUTRITION</div>

        <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:24px;max-width:540px;margin:0 auto 26px;text-align:right">
          <div style="font-family:Cairo;font-weight:800;font-size:17px;color:${orange2};margin-bottom:12px;text-align:center">⚠️ تنبيه حقوق الملكية</div>
          <p style="font-size:14px;line-height:2;color:#dde4f0;font-weight:500;margin:0">
            هذا البرنامج التدريبي مُعدّ خصيصاً للمشتركة، وجميع محتوياته من جداول ومعلومات وتصاميم مملوكة لـ ZahraaFit ومحمية بحقوق الملكية. يُمنع منعاً باتاً إعادة بيعه أو نشره أو توزيعه أو مشاركته مع أي طرف آخر، أو استخدامه لأغراض تجارية. أي مخالفة تُعرّض صاحبها للمساءلة. شكراً لاحترامك الجهد المبذول.
          </p>
        </div>

        <div style="font-family:Cairo;font-weight:800;font-size:15px;color:#fff;margin-bottom:14px">تابعينا وتواصلي معنا</div>
        <div style="display:flex;flex-direction:column;gap:10px;max-width:380px;margin:0 auto 22px">
          ${social("الموقع","zahraafit.com")}
          ${social("إنستقرام","@czahraafit")}
          ${social("تيك توك","@czahraafit")}
          ${social("سناب شات","zal_30")}
          ${social("X (تويتر)","@zahraafit")}
        </div>

        <div style="color:#8294b8;font-size:12.5px;font-weight:600;border-top:1px solid rgba(255,255,255,.12);padding-top:16px;max-width:420px;margin:0 auto">
          نتمنى لك حياة صحية وسعيدة 💪
        </div>
      </div>
    </div>`;
  }

  // ===== صفحة تعليمات وملاحظات (بداية الجدول) =====
  let intro="";
  if(S.includeEdu){
    const L2=LEVELS[S.level];
    const notes=[
      ["📅","الالتزام أهم من الحماس","التزمي بأيامك المختارة (${S.days} أيام) بثبات؛ الاستمرارية هي ما يصنع النتيجة."],
      ["💤","الراحة جزء من البرنامج","لا تمرّني نفس العضلة يومين متتاليين؛ العضلة تنمو وقت الراحة لا وقت التمرين."],
      ["⏱️","الراحة بين المجموعات","التزمي بزمن الراحة (${L2.rest}) بين المجموعات للحفاظ على الأداء."],
      ["🎯","الإحماء أولاً","ابدئي كل حصة بالإحماء المناسب (تجدينه في صفحة الإحماء) لتقليل خطر الإصابة."],
      ["🔁","الزيادة التدريجية","عند إتمام أعلى عدد تكرارات بسهولة، ارفعي الوزن قليلاً في الحصة التالية."],
      ["🚶‍♀️","النشاط اليومي","أضيفي كارديو بعد المقاومة (تفاصيله في صفحة مستقلة)، واستهدفي 8–10 آلاف خطوة يومياً."],
      ["💧","الماء والتغذية","حافظي على شرب الماء وتغذية متوازنة لدعم الاستشفاء والنتائج."],
      ["🛑","أوقفي عند الألم","التعب الطبيعي مقبول، أما الألم الحاد فإشارة للتوقف ومراجعة الأداء."]
    ];
    const cards2=notes.map(n=>`
      <div style="break-inside:avoid;display:flex;gap:12px;background:#fff;border:1px solid #e3e7ee;border-right:4px solid ${orange};border-radius:13px;padding:14px 16px;margin-bottom:11px">
        <span style="font-size:22px;flex:none">${n[0]}</span>
        <div><div style="font-family:Cairo;font-weight:800;font-size:15px;color:${navy};margin-bottom:2px">${n[1]}</div>
        <div style="font-size:13px;color:#56627a;font-weight:600;line-height:1.7">${n[2].replace('${S.days}',S.days).replace('${L2.rest}',L2.rest)}</div></div>
      </div>`).join("");
    intro=`<div style="page-break-before:always;padding:48px 52px;background:linear-gradient(180deg,#fbfbfc,#fff)">
      <div style="text-align:center;margin-bottom:8px">
        <span style="font-family:Cairo;font-weight:900;font-size:13px;color:${orange};letter-spacing:2px">ZAHRAAFIT · قبل أن تبدئي</span>
      </div>
      <h1 style="font-family:Cairo;font-weight:900;font-size:30px;color:${navy};text-align:center;margin-bottom:6px">تعليمات وملاحظات هامة</h1>
      <div style="width:90px;height:4px;background:${orange};border-radius:4px;margin:0 auto 20px"></div>
      <div style="column-count:2;column-gap:16px">${cards2}</div>
    </div>`;
  }

  // ===== صفحة الكارديو (تحت الجدول مباشرة) =====
  let cardio="";
  if(S.includeEdu){
    const cv=(t,d)=>`<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f0f2f6">
      <span style="font-size:20px;flex:none">▸</span>
      <div><div style="font-family:Cairo;font-weight:700;font-size:15px;color:${navy};margin-bottom:2px">${t}</div>
      <div style="font-size:13px;color:#56627a;font-weight:600;line-height:1.7">${d}</div></div></div>`;
    cardio=`<div style="page-break-before:always;page-break-inside:avoid;padding:48px 52px;background:linear-gradient(180deg,#fbfbfc,#fff)">
      <div style="text-align:center;margin-bottom:8px">
        <span style="font-family:Cairo;font-weight:900;font-size:13px;color:${orange};letter-spacing:2px">ZAHRAAFIT · بعد التمرين</span>
      </div>
      <h1 style="font-family:Cairo;font-weight:900;font-size:30px;color:${navy};text-align:center;margin-bottom:6px">الكارديو والخطوات</h1>
      <div style="width:90px;height:4px;background:${orange};border-radius:4px;margin:0 auto 18px"></div>
      <div style="background:#fff;border:1px solid #e3e7ee;border-radius:16px;padding:10px 22px 16px;max-width:600px;margin:0 auto">
        ${cv("التوقيت","يكون في جميع الأيام بعد تمارين المقاومة، ويمكن تجنّبه بعد تمارين الجزء السفلي.")}
        ${cv("الخطوات اليومية","استهدفي 8–10 آلاف خطوة يومياً مع الكارديو مهما كان هدفك.")}
        ${cv("المدة","20–40 دقيقة كارديو معتدل بعد الحصة، حسب لياقتك وهدفك.")}
        ${cv("أيام الراحة","يمكن أخذ أيام الراحة بين أيام التمارين أو نهاية الأسبوع بالشكل الذي يناسبك.")}
      </div>
    </div>`;
  }

  return `<div dir="rtl" style="font-family:Tajawal,sans-serif;width:100%;margin:0 auto;background:#fff">
    ${cover}
    ${intro}
    ${warmup}
    <div style="padding:44px 50px">
      ${body}
      ${disc}
    </div>
    ${cardio}
    ${support}
    ${library}
    ${edu}
    ${rights}
  </div>`;
}

/* تصدير عبر نافذة طباعة نظيفة — مضمون بأي متصفح، بدون مكتبات */
function exportViaPrintWindow(){
  const css=`
    @page{ size:A4; margin:0; }
    *{ -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; box-sizing:border-box; margin:0; }
    html,body{ font-family:'Tajawal',sans-serif; background:#fff; width:100%; }
    .pbar{ position:fixed; top:0; left:0; right:0; background:#0f1f3d; color:#fff; padding:14px;
           text-align:center; font-family:'Tajawal'; font-weight:700; z-index:99; box-shadow:0 2px 10px rgba(0,0,0,.2); }
    .pbar button{ background:#e8622c; color:#fff; border:none; padding:10px 26px; border-radius:10px;
                  font-family:'Cairo'; font-weight:800; font-size:15px; cursor:pointer; margin:8px 6px 0; }
    .pbar button.sec{ background:rgba(255,255,255,.16); }
    .pbar small{ display:block; opacity:.8; font-weight:500; font-size:12px; margin-top:4px }
    @media print{ .pbar,.noprint{ display:none!important; } body{ padding:0!important; } }
  `;
  const w=window.open("","_blank","width=900,height=1000");
  if(!w){ alert("المتصفح منع فتح النافذة. اسمحي بالنوافذ المنبثقة (Pop-ups) لهذا الموقع ثم حاولي مجدداً."); return; }
  const html=`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ZahraaFit — ${(S.client.name||"جدول")}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>${css}</style></head><body>
    <div class="pbar noprint">📄 الجدول جاهز
      <small>اضغطي الزر، وفي نافذة الطباعة اختاري «حفظ بصيغة PDF» وفعّلي «الرسوم الخلفية»</small>
      <button onclick="doPrint()">🖨️ حفظ كـ PDF</button>
      <button class="sec" onclick="window.close()">إغلاق</button></div>
    <div style="height:86px" class="noprint"></div>
    ${buildPdfHTML()}
    <script>
      function doPrint(){ window.focus(); window.print(); }
      // انتظر تحميل الخطوط والصور قبل السماح بالطباعة لتفادي الصفحات الفارغة
      if(document.fonts && document.fonts.ready){ document.fonts.ready.then(()=>{}); }
    <\/script>
    </body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function exportPDF(){
  if(typeof window.html2pdf==="undefined"){
    alert("سيتم استخدام طباعة المتصفح. فعّلي خيار «الرسوم الخلفية / Background graphics» لظهور الألوان.");
    window.print(); return;
  }
  const btn=document.querySelector('[data-act="exportpdf"]');
  if(btn){ btn.textContent="⏳ جارٍ التجهيز..."; btn.disabled=true; }

  // طبقة عرض مرئية فعلياً (وراء واجهة معتمة) — تفادياً لمشكلة الصفحات الفارغة
  const overlay=document.createElement("div");
  overlay.style.cssText="position:fixed;inset:0;z-index:9999;background:rgba(15,31,61,.85);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px";
  overlay.innerHTML=`<div style="color:#fff;font-family:Tajawal,sans-serif;font-weight:700;font-size:17px">⏳ جارٍ إنشاء ملف PDF...</div>`;
  const stage=document.createElement("div");
  stage.style.cssText="position:fixed;top:0;left:0;width:794px;background:#fff;z-index:1;opacity:0.01;pointer-events:none";
  stage.innerHTML=buildPdfHTML();
  document.body.appendChild(stage);
  document.body.appendChild(overlay);

  const fname=`ZahraaFit_${(S.client.name||"جدول").replace(/\s+/g,"_")}.pdf`;
  const target=stage.firstElementChild;

  const finish=()=>{
    if(stage.parentNode) document.body.removeChild(stage);
    if(overlay.parentNode) document.body.removeChild(overlay);
    if(btn){ btn.textContent="⬇️ تحميل PDF"; btn.disabled=false; }
  };

  // مهلة بسيطة لضمان تحميل الصور قبل التصوير
  setTimeout(()=>{
    window.html2pdf().set({
      margin:0,
      filename:fname,
      image:{type:"jpeg",quality:0.97},
      html2canvas:{scale:2,useCORS:true,allowTaint:true,backgroundColor:"#ffffff",
                   windowWidth:794, scrollX:0, scrollY:0},
      jsPDF:{unit:"px",format:[794,1123],orientation:"portrait",hotfixes:["px_scaling"]},
      pagebreak:{mode:["css","legacy"]}
    }).from(target).save()
      .then(finish)
      .catch(()=>{ finish(); alert("تعذّر إنشاء الملف. حاولي مرة أخرى أو استخدمي طباعة المتصفح."); });
  }, 350);
}


function bind(){
  const $=s=>document.querySelector(s);
  const $$=s=>document.querySelectorAll(s);

  $$("[data-act]").forEach(b=>b.onclick=()=>{
    const a=b.dataset.act;
    if(a==="start") go(0);
    else if(a==="to0") go(0);
    else if(a==="to1"){ saveClient(); go(1); }
    else if(a==="to2"){ const ai=document.getElementById("ai-request"); if(ai) S.aiRequest=ai.value.trim(); go(2); }
    else if(a==="generate") generate();
    else if(a==="generateAI"){ const ai=document.getElementById("ai-request"); if(ai) S.aiRequest=ai.value.trim(); generateAI(); }
    else if(a==="print") window.print();
    else if(a==="exportprint") exportViaPrintWindow();
    else if(a==="toggleedu"){ S.includeEdu=!S.includeEdu; render(); }
    else if(a==="exportpdf") exportPDF();
    else if(a==="restart"){ if(confirm("بدء جدول جديد؟ ستُحذف اختياراتك الحالية (الصور تبقى محفوظة).")){ resetPlan(); go(-1);} }
    else if(a==="images"){ S._back=S.step; go(9); }
    else if(a==="videos"){ S._back=S.step; videoFilter=""; go(10); }
    else if(a==="closevideos") go(S._back??-1);
    else if(a==="closeimg") go(S._back??-1);
    else if(a==="editvideos") editVideos();
    else if(a==="backplan") go(3);
    else if(a==="savevideos"){ $$("[data-vid]").forEach(i=>{ const v=i.value.trim(); if(v) videoLinks[i.dataset.vid]=v; else delete videoLinks[i.dataset.vid]; }); saveVideos(); generate(); }
  });

  // الجنس
  $$("[data-gender]").forEach(el=>el.onclick=()=>{ S.client.gender=el.dataset.gender; render(); });
  // بيئة / مستوى / أيام
  $$("[data-env]").forEach(el=>el.onclick=()=>{ S.env=el.dataset.env; render(); });
  $$("[data-split]").forEach(el=>el.onclick=()=>{ S.split=el.dataset.split; render(); });
  $$("[data-level]").forEach(el=>el.onclick=()=>{ S.level=+el.dataset.level; render(); });
  $$("[data-days]").forEach(el=>el.onclick=()=>{ S.days=+el.dataset.days; render(); });
  $$("[data-daily]").forEach(el=>el.onclick=()=>{ S.dailyCount=+el.dataset.daily; render(); });
  // الحالات الصحية
  $$("[data-cond]").forEach(el=>el.onclick=()=>{
    const id=el.dataset.cond;
    S.conditions.includes(id) ? S.conditions=S.conditions.filter(x=>x!==id) : S.conditions.push(id);
    render();
  });
  // منتقي التمارين
  $$("[data-tab]").forEach(el=>el.onclick=()=>{ pickerTab=el.dataset.tab; render(); });
  $$("[data-fav]").forEach(el=>el.onclick=()=>{
    const id=el.dataset.fav;
    if(S.fav.has(id)) S.fav.delete(id); else { S.fav.add(id); S.no.delete(id); }
    render();
  });
  $$("[data-no]").forEach(el=>el.onclick=()=>{
    const id=el.dataset.no;
    if(S.no.has(id)) S.no.delete(id); else { S.no.add(id); S.fav.delete(id); }
    render();
  });
  // الصور
  $$("[data-slot]").forEach(el=>el.onclick=(ev)=>{
    if(ev.target.dataset.delimg) return;
    const k=el.dataset.slot;
    const inp=document.createElement("input");
    inp.type="file"; inp.accept="image/*";
    inp.onchange=()=>{ const f=inp.files[0]; if(!f) return;
      const r=new FileReader(); r.onload=()=>{ S.images[k]=r.result; saveImages(); render(); }; r.readAsDataURL(f);
    };
    inp.click();
  });
  $$("[data-delimg]").forEach(el=>el.onclick=(ev)=>{
    ev.stopPropagation(); delete S.images[el.dataset.delimg]; saveImages(); render();
  });

  // مكتبة الفيديوهات: حفظ تلقائي عند الكتابة
  $$("[data-vidlib]").forEach(inp=>{
    inp.oninput=()=>{
      const id=inp.dataset.vidlib, v=inp.value.trim();
      if(v) videoLinks[id]=v; else delete videoLinks[id];
      saveVideos();
    };
  });
  // بحث المكتبة (يحدّث عند الضغط Enter أو فقدان التركيز لتفادي إعادة الرسم أثناء الكتابة)
  const vsearch=document.getElementById("vid-search");
  if(vsearch){
    vsearch.onkeydown=(e)=>{ if(e.key==="Enter"){ videoFilter=vsearch.value.trim(); render(); } };
    vsearch.onblur=()=>{ if(vsearch.value.trim()!==videoFilter){ videoFilter=vsearch.value.trim(); render(); } };
  }
}

function saveClient(){
  const v=id=>{const el=document.getElementById(id);return el?el.value.trim():"";};
  S.client.name=v("f-name"); S.client.age=v("f-age");
  S.client.height=v("f-height"); S.client.weight=v("f-weight");
}
function resetPlan(){
  S.client={name:"",age:"",height:"",weight:"",gender:S.client.gender};
  S.env="gym"; S.level=1; S.days=4; S.dailyCount=6; S.conditions=[];
  S.fav=new Set(); S.no=new Set(); S.plan=null;
}

/* ============================================================
   إقلاع
   ============================================================ */
loadStored();
S.step=-1;
render();
