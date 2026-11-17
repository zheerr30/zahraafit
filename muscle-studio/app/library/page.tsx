import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { MuscleCatalog } from "@/components/library/MuscleCatalog";

export const metadata: Metadata = { title: "Anatomy library" };

export default function LibraryPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Anatomy library</h1>
        <p className="mb-6 mt-1 max-w-2xl text-sm text-muted">
          Every muscle the studio can highlight, with English and Arabic names, the mesh names a model must
          use, and search aliases. مكتبة العضلات بالعربية والإنجليزية.
        </p>
        <Suspense fallback={<p className="text-sm text-muted">Loading library…</p>}>
          <MuscleCatalog />
        </Suspense>
      </main>
    </>
  );
}
