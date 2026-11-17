import type { Metadata } from "next";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";

export const metadata: Metadata = { title: "Saved illustrations" };

export default function ProjectsPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Saved illustrations</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Open, rename, duplicate or delete your projects.</p>
        <ProjectGrid showSearch />
      </main>
    </>
  );
}
