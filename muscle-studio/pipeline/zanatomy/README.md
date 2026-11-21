<div dir="rtl">

# Z-Anatomy للجسم كاملًا

يصدِّر هذا الخط ملف Blender الأصلي لمشروع Z-Anatomy (`Startup.blend`) **دون تعديل الهندسة** إلى
`public/models/zanatomy/{male,female}/*.glb`، المستخدمة في الأطلس (`/atlas`, `/back`) والمحرّر (`/editor`).

- `../blender/export_body.py` (Blender): يصدّر كل بنية كشبكة مستقلة مع نوعها، اسمها، جانبها، معرّف TA2، الاسم اللاتيني، التسلسل
  التشريحي، خانات المواد (Tendon/Cartilage) والتعريف. يستبعد النماذج غير التجارية (الأذن الداخلية، الكلية).
- `../blender/postprocess-body.mjs` (Node): المنطقة وطبقة العمق، ربط بصمات المنشأ/المرتكز بعضلاتها، بيانات المظهر (إظلال، أوتار
  المؤلف، اتجاه الألياف)، النموذج الأنثوي (ICP + Thin-Plate Spline على الهيكل الأنثوي من `pipeline/data/open-anatomy-3d`)، الضغط،
  و`build-report.json`.
- `lexicon-ar.mjs`: الاسم العربي لكل بنية. `editor-units.mjs`: وحدات المحرّر الـ54 وشبكاتها. `back-config.mjs`: البطاقات المفصّلة.
- `../bodyparts3d/bake.mjs`, `tps.mjs`, `lib.mjs`: أدوات مشتركة (حساب الألياف والإظلال، TPS).

## الترخيص

Z-Anatomy مرخّص **CC BY-SA 4.0** (مبني على BodyParts3D، CC BY 4.0). الاستخدام التجاري مسموح مع ذكر المصدر، وشرط المشاركة بالمثل
يسري على الملفات المشتقة. التعريفات من Wikipedia ‏(CC BY-SA 3.0).

## التشغيل

</div>

```bash
# 1) Blender 4.x (+ python3-numpy لمصدِّر glTF) والملف الأصلي
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/Z-Anatomy/Models-of-human-anatomy za
unzip za/Z-Anatomy.zip -d za-extract            # → za-extract/Z-Anatomy/Startup.blend
# 2) التصدير (~1 دقيقة)
blender -b za-extract/Z-Anatomy/Startup.blend --python pipeline/blender/export_body.py -- za/TA2.csv body-export
# 3) التحضير للويب (~20 دقيقة، ذاكرة كبيرة)
node --max-old-space-size=14000 pipeline/blender/postprocess-body.mjs body-export public/models/zanatomy
```

<div dir="rtl">

## ملاحظات على المصدر

- Z-Anatomy يسمّي جزأي شبه المنحرفة العلوي والسفلي بالعكس؛ يُربطان بالموضع ويتحقق البناء من الترتيب.
- بعض بصمات المنشأ/المرتكز غير موجودة في المصدر أو لا تُنسب لعضلة (`unownedPatches` في التقرير). لا تُولَّد.
- اتجاه الألياف من أوتار المؤلف أولًا، ثم من بصمات الارتكاز، ثم من محور العضلة (`fibreSource` في التقرير).

</div>
