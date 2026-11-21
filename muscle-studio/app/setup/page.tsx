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
              النموذج التشريحي للتطبيق كله هو Z-Anatomy، مصدرا من ملف Blender الأصلي دون تعديل الهندسة. إذا تعذر تحميل أي ملف
              تظهر رسالة خطأ واضحة، ولا يستبدل أبدا بمجسم هندسي أو بديل.
            </p>
          </header>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">الملفات</h2>
            <ul className="space-y-1">
              <li>
                <Code>public/models/zanatomy/male/core.glb</Code> و<Code>female/core.glb</Code> — العضلات والأوتار والأربطة
                واللفافات والعظام
              </li>
              <li>
                <Code>attachments.glb</Code>، <Code>nerves.glb</Code>، <Code>organs.glb</Code>، <Code>vessels.glb</Code>،{" "}
                <Code>skin.glb</Code> — تحمل عند تشغيل طبقتها
              </li>
              <li>
                تقرير البناء: <Code>public/models/zanatomy/build-report.json</Code>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">ما يحتويه النموذج</h2>
            <ul className="list-disc space-y-1 ps-5">
              <li>233 عضلة مستقلة لكل جانب في المناطق العشر، كلها قابلة للتحديد في <Link href="/atlas" className="text-accent-2 hover:underline">الأطلس التشريحي</Link>.</li>
              <li>المحرر يربط منها 54 وحدة قابلة للتلوين (منها الظهرية العريضة والمستقيمة البطنية والمائلة الداخلية).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-fg">إعادة البناء</h2>
            <p>
              <Code>blender -b Startup.blend --python pipeline/blender/export_body.py -- TA2.csv &lt;out&gt;</Code> ثم{" "}
              <Code>node pipeline/blender/postprocess-body.mjs &lt;out&gt; public/models/zanatomy</Code> — التفاصيل في
              <Code>pipeline/zanatomy/README.md</Code>.
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
