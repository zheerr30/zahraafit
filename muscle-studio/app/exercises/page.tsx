import type { Metadata } from "next";
import { Suspense } from "react";
import { AppFooter, AppHeader } from "@/components/dashboard/AppHeader";
import { ExercisePage } from "@/components/exercise/ExercisePage";

export const metadata: Metadata = { title: "مكتبة التمارين" };

export default function ExercisesPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-bold">مكتبة التمارين</h1>
        <p className="mb-6 mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          تمارين تقوية وإطالة مرتبطة بعضلات المجسم ثلاثي الأبعاد: لكل تمرين اسمه وفيديو يشرحه، وخريطة عضلية مأخوذة من المجسم
          نفسه (العضلات الأساسية بلون التمييز والمساعدة بلون أفتح)، ويمكن فتحه على المجسم لرؤية عضلاته وعزلها.
        </p>
        <Suspense fallback={<p className="text-sm text-muted">جار تحميل المكتبة…</p>}>
          <ExercisePage />
        </Suspense>
        <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted">
          محتوى تعليمي عام وليس وصفة تدريب أو علاج. عند وجود ألم أو إصابة أو حالة صحية تستشار جهة مختصة قبل البدء. أسماء
          التمارين وفيديوهاتها من مكتبة برنامج ZahraaFit؛ الفيديوهات تعرض من يوتيوب وهي ملك قنواتها.
        </p>
      </main>
      <AppFooter />
    </>
  );
}
