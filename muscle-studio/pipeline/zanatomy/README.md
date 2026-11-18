<div dir="rtl">

# الظهر والكتفان: مجسمات Z-Anatomy الأصلية

الصفحة `/back` تعرض الملف `public/models/back-shoulders/back-shoulders-za.glb`، المصدَّر من ملف Blender الأصلي لمشروع
Z-Anatomy (`Startup.blend`) **دون تعديل الهندسة**. تفاصيل الفحص والتقرير عن الأصول في
[`docs/ASSETS-back-shoulder.md`](../../docs/ASSETS-back-shoulder.md).

- `back-config.mjs`: قائمة البنى (16 عضلة قابلة للتحديد، العضلات المرجعية، العظام، الأوتار والأربطة، الأعصاب) وأسماؤها العربية.
- `../blender/selection.mjs` ← `../blender/export_back.py` (Blender) ← `../blender/postprocess.mjs` (Node).

## الترخيص

Z-Anatomy مرخّص **CC BY-SA 4.0** (ومبني على BodyParts3D). الاستخدام التجاري مسموح مع ذكر المصدر، لكن شرط المشاركة بالمثل يسري
على الملف المشتق وأي تعديل عليه (`public/models/back-shoulders/LICENSE.md`). نصوص التعريف من Wikipedia (CC BY-SA 3.0).

## التشغيل

</div>

```bash
# 1) Blender 4.x (+ numpy لمصدِّر glTF) والملف الأصلي
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/Z-Anatomy/Models-of-human-anatomy za
unzip za/Z-Anatomy.zip -d za-extract            # → za-extract/Z-Anatomy/Startup.blend
# 2) التصدير
node pipeline/blender/selection.mjs selection.json
blender -b za-extract/Z-Anatomy/Startup.blend --python pipeline/blender/export_back.py -- \
  selection.json za/TA2.csv back-raw.glb definitions.json
# 3) التحضير للويب (لا تبسيط ولا تقسيم)
node --max-old-space-size=12000 pipeline/blender/postprocess.mjs back-raw.glb definitions.json public/models/back-shoulders
```

<div dir="rtl">

## ملاحظات على المصدر

- Z-Anatomy يسمّي جزأي شبه المنحرفة العلوي والسفلي بالعكس؛ يُربطان بالموضع ويتحقق البناء من الترتيب.
- بعض بصمات المنشأ/المرتكز غير موجودة في المصدر (مرتكز الظهرية العريضة والمدورة الكبرى على العضد، منشأ المعينيتين). لا تُولَّد.
- الأوتار مرسومة وجهًا بوجه في المصدر للعضلات السطحية؛ للكفة المدورة والناصبة للفقار لا توجد، فتُقدَّر من سماكة النسيج.

</div>
