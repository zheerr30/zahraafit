import type { Metadata } from "next";
import { AppFooter, AppHeader } from "@/components/dashboard/AppHeader";
import { BODYPARTS3D_CREDIT, SOURCES, ZANATOMY_CREDIT } from "@/lib/attribution";

export const metadata: Metadata = { title: "المصادر والترخيص" };

export default function CreditsPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-10 px-4 py-8 text-sm leading-loose text-muted sm:px-6 sm:py-10">
        <header>
          <h1 className="text-2xl font-bold text-fg">المصادر والترخيص</h1>
          <p className="mt-1">
            النموذج التشريحي في التطبيق كله هو Z-Anatomy (مبني على BodyParts3D)، مرخص بموجب{" "}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer" className="text-accent-2 hover:underline">
              <bdi dir="ltr">Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)</bdi>
            </a>
            . يجب ذكر المصدر عند عرض النماذج أو نشر صور منها، وأي ملف نموذج مشتق ينشر بالرخصة نفسها.
          </p>
        </header>

        <section>
          <h2 className="mb-2 text-base font-semibold text-fg">أسطر النسبة المطلوبة</h2>
          <p className="mb-1">Z-Anatomy:</p>
          <blockquote dir="ltr" className="rounded-xl border border-line bg-panel p-4 text-start font-mono text-xs leading-relaxed text-fg">
            {ZANATOMY_CREDIT}
          </blockquote>
          <p className="mb-1 mt-3">BodyParts3D (بالصيغة التي يحددها المرخص):</p>
          <blockquote dir="ltr" className="rounded-xl border border-line bg-panel p-4 text-start font-mono text-xs leading-relaxed text-fg">
            {BODYPARTS3D_CREDIT}
          </blockquote>
          <p className="mt-2">
            يضاف سطر نسبة مختصر تلقائيا أسفل كل صورة مصدرة (يمكن إيقافه من نافذة التصدير، وعندها يجب ذكر المصدر في مكان
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
          <h2 className="mb-2 text-base font-semibold text-fg">ما الذي تغير</h2>
          <ul className="list-disc space-y-1 ps-5">
            <li>
              صدر نموذج Z-Anatomy من ملف Blender الأصلي (<span dir="ltr" className="font-mono">Startup.blend</span>) بخط
              <span dir="ltr" className="font-mono"> pipeline/blender/export_body.py</span>: الهندسة نفسها دون تبسيط أو تقسيم، مع
              تطبيق معدلات المؤلف على بصمات الارتكاز واللفافات وتحويل منحنيات الأعصاب والأوعية إلى شبكات كما تعرض.
            </li>
            <li>
              أضيفت لكل رأس بيانات مظهر (إظلال، أوتار المؤلف، اتجاه الألياف من الأوتار أو من مواضع الارتكاز)، وطبقة عمق محسوبة من
              الهندسة، وأسماء عربية، ثم ضغطت الملفات (تكميم + meshopt).
            </li>
            <li>
              النموذج الأنثوي: التشريح نفسه بعد ملاءمته لنسب الهيكل العظمي الأنثوي في open-anatomy-3d بتحويل Thin-Plate Spline
              منتظم.
            </li>
            <li>الأسماء العربية ومعجم المصطلحات وبطاقات العضلات من إعداد هذا التطبيق.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-fg">ملاحظة عن الترخيص والاستخدام التجاري</h2>
          <p>
            رخصة CC BY-SA 4.0 تسمح بالاستخدام التجاري وإعادة التوزيع والتعديل، بشرطين: ذكر المصدر، ونشر أي نموذج مشتق بالرخصة
            نفسها. الشرط الثاني يسري على ملفات النماذج (<span dir="ltr" className="font-mono">public/models/zanatomy</span>) وما
            يشتق منها، لا على كود التطبيق. الصور المصدرة تحمل سطر النسبة تلقائيا. نماذج الأذن الداخلية والكلية في Z-Anatomy
            مرخصة لغير الأغراض التجارية، ولذلك لا تصدر.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-fg">تنبيه</h2>
          <p>
            النماذج مخصصة للتعليم والتوضيح، وليست صالحة للتشخيص أو لأي قرار طبي. المصدر ذكوري؛ النموذج الأنثوي تقريب.
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
