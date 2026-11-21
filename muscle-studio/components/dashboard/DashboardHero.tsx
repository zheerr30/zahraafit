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
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #E8602C 0%, transparent 70%)" }}
      />
      <p className="text-xs font-semibold text-accent">استوديو الرسوم التشريحية</p>
      <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-snug sm:text-4xl">
        تلوين العضلات المستهدفة والثانوية لكل تمرين بدقة.
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-loose text-muted sm:text-base">
        تحديد العضلات على نموذجين تشريحيين ثلاثيي الأبعاد لذكر وأنثى، ثم تصدير رسوم عالية الدقة للبرامج
        التدريبية والمنشورات والدروس.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={() => setOpen(true)}>
          <IconPlus size={18} /> رسم توضيحي جديد
        </Button>
        <Link
          href="/projects"
          className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-sm font-medium text-fg hover:border-line-strong hover:bg-panel-2"
        >
          الرسوم المحفوظة
        </Link>
      </div>
      <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 text-sm">
        <div>
          <dt className="text-muted">وحدات عضلية قابلة للتلوين</dt>
          <dd className="text-xl font-semibold">{muscleCount}</dd>
        </div>
        <div>
          <dt className="text-muted">مناطق تشريحية</dt>
          <dd className="text-xl font-semibold">{regionCount}</dd>
        </div>
        <div>
          <dt className="text-muted">النماذج</dt>
          <dd className="text-xl font-semibold">ذكر · أنثى</dd>
        </div>
      </dl>
      <NewIllustrationDialog open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
