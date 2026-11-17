import type { Metadata } from "next";
import { AppFooter, AppHeader } from "@/components/dashboard/AppHeader";
import { OPEN_ANATOMY_COMMIT, OPEN_ANATOMY_CREDIT, SOURCES } from "@/lib/attribution";

export const metadata: Metadata = { title: "المصادر والترخيص" };

export default function CreditsPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-10 px-4 py-8 text-sm leading-loose text-muted sm:px-6 sm:py-10">
        <header>
          <h1 className="text-2xl font-bold text-fg">المصادر والترخيص</h1>
          <p className="mt-1">
            النموذجان التشريحيان وفهرس البنى مأخوذة من مشروع Open Anatomy 3D، وهي مرخّصة بموجب{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="text-accent-2 hover:underline">
              <bdi dir="ltr">Creative Commons Attribution 4.0 International (CC BY 4.0)</bdi>
            </a>
            . يجب ذكر المصدر عند عرض النماذج أو نشر صور مأخوذة منها.
          </p>
        </header>

        <section>
          <h2 className="mb-2 text-base font-semibold text-fg">سطر النسبة المطلوب</h2>
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
              ملفا <span dir="ltr" className="font-mono">anatomy-male.glb</span> و
              <span dir="ltr" className="font-mono">anatomy-female.glb</span> منسوخان دون أي تعديل من المستودع الأصلي (الإيداع{" "}
              <span dir="ltr" className="font-mono text-xs">{OPEN_ANATOMY_COMMIT.slice(0, 12)}</span>).
            </li>
            <li>
              أثناء العرض فقط: يغيّر التطبيق ألوان الخامات وشفافية الجلد، ويُظهر الأجهزة أو يخفيها، ويوحّد ارتفاع النموذج.
            </li>
            <li>الأسماء العربية والتجميع حسب المناطق ومعجم المصطلحات من إعداد هذا التطبيق.</li>
            <li>
              تظليل الجلد الشفاف مقتبس من حزمة open-anatomy-3d-react ‏(© 2026 MervinR07، رخصة MIT).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-fg">تنبيه</h2>
          <p>
            النماذج مخصّصة للتعليم والتوضيح، وليست صالحة للتشخيص أو لأي قرار طبي. كثير من العضلات مدموجة في مجموعات
            (مثل عضلات العضد)، والعضلة الظهرية العريضة غير موجودة في النموذج — التفاصيل في مكتبة العضلات.
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
