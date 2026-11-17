"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";
import { NewIllustrationDialog } from "./NewIllustrationDialog";

export function DashboardHero({ muscleCount, regionCount }: { muscleCount: number; regionCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-panel px-6 py-10 sm:px-10 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #E8602C 0%, transparent 70%)" }}
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Anatomy illustration studio</p>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        Highlight the exact muscles every exercise works.
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
        Select muscles on male and female 3D anatomy, color primary and secondary movers, and export
        high-resolution illustrations for programs, posts and lessons.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={() => setOpen(true)}>
          <IconPlus size={18} /> New illustration
        </Button>
        <Link
          href="/projects"
          className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-sm font-medium text-fg hover:border-line-strong hover:bg-panel-2"
        >
          Saved illustrations
        </Link>
      </div>
      <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 text-sm">
        <div>
          <dt className="text-muted">Muscles in library</dt>
          <dd className="text-xl font-semibold">{muscleCount}</dd>
        </div>
        <div>
          <dt className="text-muted">Anatomical regions</dt>
          <dd className="text-xl font-semibold">{regionCount}</dd>
        </div>
        <div>
          <dt className="text-muted">Languages</dt>
          <dd className="text-xl font-semibold">EN · ع</dd>
        </div>
      </dl>
      <NewIllustrationDialog open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
