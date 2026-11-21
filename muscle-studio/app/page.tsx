import Link from "next/link";
import { AppFooter, AppHeader } from "@/components/dashboard/AppHeader";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { AssetStatusList, ModelShortcuts } from "@/components/dashboard/ModelShortcuts";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { MUSCLES, REGION_DEFINITIONS } from "@/data/muscles/muscles";

export default function DashboardPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6 sm:py-10">
        <DashboardHero muscleCount={MUSCLES.length} regionCount={REGION_DEFINITIONS.length} />

        <section aria-labelledby="models-heading">
          <h2 id="models-heading" className="mb-4 text-lg font-semibold">
            البدء من نموذج
          </h2>
          <ModelShortcuts />
        </section>

        <section aria-labelledby="recent-heading">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="recent-heading" className="text-lg font-semibold">
              أحدث الرسوم
            </h2>
            <Link href="/projects" className="text-sm text-muted hover:text-fg">
              عرض الكل ←
            </Link>
          </div>
          <ProjectGrid limit={4} />
        </section>

        <section aria-labelledby="library-heading" className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div className="mb-4 flex items-end justify-between">
              <h2 id="library-heading" className="text-lg font-semibold">
                مكتبة العضلات
              </h2>
              <Link href="/library" className="text-sm text-muted hover:text-fg">
                تصفح المكتبة ←
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {REGION_DEFINITIONS.map((r) => {
                const muscles = MUSCLES.filter((m) => m.region === r.id);
                return (
                  <Link
                    key={r.id}
                    href={`/library?region=${r.id}`}
                    className="group rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-line-strong"
                  >
                    <p className="text-sm font-semibold">{r.displayName.ar}</p>
                    <p dir="ltr" className="text-end text-xs text-muted">
                      {r.displayName.en}
                    </p>
                    <p className="mt-3 text-xs text-muted">{muscles.length} وحدة عضلية</p>
                  </Link>
                );
              })}
            </div>
          </div>
          <div>
            <h2 className="mb-4 text-lg font-semibold">حالة النماذج</h2>
            <AssetStatusList />
          </div>
        </section>
      </main>
      <AppFooter />
    </>
  );
}
