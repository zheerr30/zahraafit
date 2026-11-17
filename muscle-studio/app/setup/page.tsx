import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter, AppHeader } from "@/components/dashboard/AppHeader";
import { AssetStatusList } from "@/components/dashboard/ModelShortcuts";
import { StoragePanel } from "@/components/setup/StoragePanel";

export const metadata: Metadata = { title: "الإعدادات" };

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code dir="ltr" className="break-all rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs text-fg">
      {children}
    </code>
  );
}

export default function SetupPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <article className="space-y-8 text-sm leading-loose text-muted">
          <header>
            <h1 className="text-2xl font-bold text-fg">الإعدادات والنماذج</h1>
            <p className="mt-1">
              العضلات مستخرجة من BodyParts3D كشبكات مستقلة بشكلها التشريحي الأصلي، والجسم المرجعي (العظام والجلد والأعضاء) من
              Open Anatomy 3D. إذا تعذّر تحميل أي ملف تظهر رسالة خطأ واضحة، ولا يُستبدل أبدًا بمجسّم هندسي أو بديل.
            </p>
          </header>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">الملفات</h2>
            <ul className="space-y-1">
              <li>
                <Code>public/models/bodyparts3d/muscles-male.glb</Code> و<Code>muscles-female.glb</Code> — العضلات المفصولة
              </li>
              <li>
                <Code>public/models/open-anatomy-3d/anatomy-male.glb</Code> و<Code>anatomy-female.glb</Code> — الجسم المرجعي
              </li>
              <li>
                تقرير البناء: <Code>public/models/bodyparts3d/build-report.json</Code>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">ما يحتويه النموذج</h2>
            <ul className="list-disc space-y-1 ps-5">
              <li>
                51 عضلة أو جزءًا مسمّى، شبكة مستقلة لكل جانب (102 شبكة)، منها أجزاء الدالية الثلاثة وأجزاء شبه المنحرفة الثلاثة
                وأجزاء الصدرية الكبرى الثلاثة.
              </li>
              <li>بقية عضلات BodyParts3D (378 ملفًا مستخدمًا إجمالًا) تظهر للعرض فقط في طبقة «عضلات أخرى غير مفصولة».</li>
              <li>
                غير موجودة في BodyParts3D 4.0 أصلًا: العضلة الظهرية العريضة، والمستقيمة البطنية، والمائلة الداخلية، والمستعرضة
                البطنية.{" "}
                <Link href="/library" className="text-accent-2 hover:underline">
                  جدول التغطية الكامل
                </Link>
                .
              </li>
              <li>
                BodyParts3D جسم ذكر واحد. النموذج الأنثوي هو العضلات نفسها بعد نقل تشوّه الجسم الأنثوي من Open Anatomy 3D إليها،
                وليس تشريحًا أنثويًا مستقلًا.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">إعادة البناء</h2>
            <p>
              <Code>node pipeline/bodyparts3d/build.mjs --bp3d &lt;مجلد BodyParts3D&gt;</Code> — التفاصيل في
              <Code>pipeline/bodyparts3d/README.md</Code>.
            </p>
          </section>
        </article>

        <aside className="space-y-6">
          <div>
            <h2 className="mb-3 text-base font-semibold">ملفات النماذج</h2>
            <AssetStatusList />
          </div>
          <div>
            <h2 className="mb-3 text-base font-semibold">حفظ المشاريع</h2>
            <StoragePanel />
          </div>
        </aside>
      </main>
      <AppFooter />
    </>
  );
}
