import type { Metadata } from "next";
import { AppFooter, AppHeader } from "@/components/dashboard/AppHeader";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";

export const metadata: Metadata = { title: "الرسوم المحفوظة" };

export default function ProjectsPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-bold">الرسوم المحفوظة</h1>
        <p className="mb-6 mt-1 text-sm text-muted">فتح الرسوم أو إعادة تسميتها أو نسخها أو حذفها.</p>
        <ProjectGrid showSearch />
      </main>
      <AppFooter />
    </>
  );
}
