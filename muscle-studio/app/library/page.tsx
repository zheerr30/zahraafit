import type { Metadata } from "next";
import { Suspense } from "react";
import { AppFooter, AppHeader } from "@/components/dashboard/AppHeader";
import { MuscleCatalog } from "@/components/library/MuscleCatalog";

export const metadata: Metadata = { title: "مكتبة العضلات" };

export default function LibraryPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-bold">مكتبة العضلات</h1>
        <p className="mb-6 mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          العضلات المستخرجة من BodyParts3D كشبكات مستقلة لكل جانب، بأسمائها الطبية العربية واللاتينية، ومصدر كل شبكة.
          تتوفر في النموذجين الذكري والأنثوي.
        </p>
        <Suspense fallback={<p className="text-sm text-muted">جار تحميل المكتبة…</p>}>
          <MuscleCatalog />
        </Suspense>
      </main>
      <AppFooter />
    </>
  );
}
