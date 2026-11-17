import type { Metadata } from "next";
import { AppFooter, AppHeader } from "@/components/dashboard/AppHeader";
import { BODYPARTS3D_CREDIT, OPEN_ANATOMY_COMMIT, OPEN_ANATOMY_CREDIT, SOURCES } from "@/lib/attribution";

export const metadata: Metadata = { title: "المصادر والترخيص" };

export default function CreditsPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-10 px-4 py-8 text-sm leading-loose text-muted sm:px-6 sm:py-10">
        <header>
          <h1 className="text-2xl font-bold text-fg">المصادر والترخيص</h1>
          <p className="mt-1">
            العضلات مستخرجة من قاعدة بيانات BodyParts3D، والجسم المرجعي من مشروع Open Anatomy 3D. كلاهما مرخّص بموجب{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="text-accent-2 hover:underline">
              <bdi dir="ltr">Creative Commons Attribution 4.0 International (CC BY 4.0)</bdi>
            </a>
            . يجب ذكر المصدر عند عرض النماذج أو نشر صور مأخوذة منها.
          </p>
        </header>

        <section>
          <h2 className="mb-2 text-base font-semibold text-fg">أسطر النسبة المطلوبة</h2>
          <p className="mb-1">BodyParts3D (بالصيغة التي يحددها المرخِّص):</p>
          <blockquote dir="ltr" className="rounded-xl border border-line bg-panel p-4 text-start font-mono text-xs leading-relaxed text-fg">
            {BODYPARTS3D_CREDIT}
          </blockquote>
          <p className="mb-1 mt-3">Open Anatomy 3D:</p>
          <blockquote dir="ltr" className="rounded-xl border border-line bg-panel p-4 text-start font-mono text-xs leading-relaxed text-fg">
            {OPEN_ANATOMY_CREDIT}
          </blockquote>
          <p className="mt-2">
            يُضاف سطر نسبة مختصر تلقائيًا أسفل كل صورة مُصدَّرة (يمكن إيقافه من نافذة التصدير، وعندها يجب ذكر المصدر في مكان
            النشر).
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-fg">المصادر</h2>
          <ul className="space-y-3">
            {SOURCES.map((s) => (
              <li key={s.name} className="rounded-xl border border-line bg-panel p-4">
                <p dir="ltr" className="text-start font-medium text-fg">
                  {s.name}
                </p>
                <p className="text-xs">
                  <bdi dir="ltr">{s.owner}</bdi> — <bdi>{s.license}</bdi>
                </p>
                <p className="mt-1">{s.usage}</p>
                <a href={s.url} target="_blank" rel="noreferrer" dir="ltr" className="mt-1 block break-all text-start text-xs text-accent-2 hover:underline">
                  {s.url}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-fg">ما الذي تغيّر</h2>
          <ul className="list-disc space-y-1 ps-5">
            <li>
              عضلات BodyParts3D: دُمجت ملفات كل عضلة أو جزء مسمّى في شبكة مستقلة لكل جانب، وحُوّلت الإحداثيات إلى المتر مع محور Y
              للأعلى، وخُفّف عدد المثلثات مع بقاء الشكل ضمن 0.15 مم في المتوسط من السطح الأصلي (التقرير في
              <span dir="ltr" className="font-mono"> build-report.json</span>).
            </li>
            <li>
              النموذج الأنثوي: لُوئمت العضلات المفصولة (والهيكل العظمي) مع نِسَب الهيكل العظمي الأنثوي في Open Anatomy 3D بتحويل
              Thin-Plate Spline منتظم على معالم عظمية متطابقة بين النموذجين. وهو التشريح الذكري بنِسَب هيكل أنثوي، وليس تشريحًا أنثويًا مستقلًا.
            </li>
            <li>
              ملفا Open Anatomy 3D (<span dir="ltr" className="font-mono">anatomy-male.glb</span> و
              <span dir="ltr" className="font-mono">anatomy-female.glb</span>) منسوخان دون تعديل من الإيداع{" "}
              <span dir="ltr" className="font-mono text-xs">{OPEN_ANATOMY_COMMIT.slice(0, 12)}</span>؛ أثناء العرض تُستبدل مجموعاتهما
              العضلية المدموجة بالعضلات المفصولة، وتتغير الألوان وشفافية الجلد.
            </li>
            <li>الأسماء العربية ومعجم المصطلحات من إعداد هذا التطبيق.</li>
            <li>تظليل الجلد الشفاف مقتبس من حزمة open-anatomy-3d-react ‏(© 2026 MervinR07، رخصة MIT).</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-fg">ملاحظة عن الترخيص والاستخدام التجاري</h2>
          <p>
            ينص ملف README الرسمي لقاعدة BodyParts3D (المحدّث في 25 فبراير 2025) على رخصة CC BY 4.0، التي تسمح بإعادة التوزيع
            والأعمال المشتقة والاستخدام التجاري بشرط ذكر المصدر. ما زالت ترويسات ملفات OBJ الصادرة عام 2013 تذكر الرخصة الأقدم
            (CC BY-SA 2.1 Japan)؛ يُعتمد النص الحالي للمرخِّص، ونسخة منه محفوظة في المستودع
            (<span dir="ltr" className="font-mono">data/models/bodyparts3d/README_e.html</span>). للاستخدامات خارج هذه الرخصة يجب
            التواصل مع DBCLS.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-fg">تنبيه</h2>
          <p>
            النماذج مخصّصة للتعليم والتوضيح، وليست صالحة للتشخيص أو لأي قرار طبي. أربع عضلات غير موجودة في المصدر (الظهرية
            العريضة، والمستقيمة البطنية، والمائلة الداخلية، والمستعرضة البطنية) — التفاصيل في مكتبة العضلات.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-fg">برمجيات أخرى</h2>
          <p>
            Three.js و React Three Fiber و drei و three-mesh-bvh (رخصة MIT)، وخط IBM Plex Sans Arabic (رخصة SIL OFL 1.1).
          </p>
        </section>
      </main>
      <AppFooter />
    </>
  );
}
