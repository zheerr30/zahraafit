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
              يستخدم الاستوديو نموذجي Open Anatomy 3D الأصليين (ذكر وأنثى). إذا تعذّر تحميل نموذج تظهر رسالة خطأ واضحة،
              ولا يُستبدل أبدًا بمجسّم هندسي أو بديل.
            </p>
          </header>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">مكان الملفات</h2>
            <ul className="space-y-1">
              <li>
                <Code>public/models/open-anatomy-3d/anatomy-male.glb</Code>
              </li>
              <li>
                <Code>public/models/open-anatomy-3d/anatomy-female.glb</Code>
              </li>
              <li>
                نص الترخيص والنسبة بجانبهما: <Code>LICENSE-MODELS.md</Code> و<Code>ATTRIBUTION.md</Code>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">ما يحتويه النموذج</h2>
            <ul className="list-disc space-y-1 ps-5">
              <li>ستة أجهزة: العضلات، والهيكل العظمي، والجلد، والأعضاء، والأوعية، والأعصاب. تظهر العضلات وحدها عند البدء.</li>
              <li>
                41 شبكة عضلية تمثل 22 وحدة قابلة للتلوين. ثلاث منها عضلات مفردة (الصدرية الكبرى، وشبه المنحرفة، والدالية
                كاملة) والباقي مجموعات مدموجة.
              </li>
              <li>
                العضلة الظهرية العريضة غير موجودة، ورؤوس الدالية غير منفصلة.{" "}
                <Link href="/library" className="text-accent-2 hover:underline">
                  جدول التغطية الكامل
                </Link>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">نماذج أخرى</h2>
            <p>
              يمكن تجربة ملف GLB آخر من المحرر («تحميل ملف GLB آخر…»). تُربط شبكاته بالعضلات بالأسماء القياسية الواردة في
              المكتبة، ويمكن ربط الباقي يدويًا من «فاحص ربط الشبكات». الملف يبقى على الجهاز ولا يُرفع.
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
