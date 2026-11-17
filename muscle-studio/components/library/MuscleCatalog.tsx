"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { COVERAGE_LABELS, TARGET_COVERAGE, type CoverageStatus } from "@/data/muscles/coverage";
import { MUSCLES, REGION_DEFINITIONS, getMuscle } from "@/data/muscles/muscles";
import { searchMuscles } from "@/lib/anatomy/search";
import { cn } from "@/components/ui/cn";
import type { RegionId } from "@/types/anatomy";
import { GranularityBadge, MuscleSearchInput } from "./MuscleSelector";

const STATUS_STYLE: Record<CoverageStatus, string> = {
  individual: "border-ok/40 text-ok",
  "whole-muscle": "border-accent-2/50 text-accent-2",
  "in-group": "border-line-strong text-muted",
  missing: "border-danger/40 text-danger",
};

export function MuscleCatalog() {
  const params = useSearchParams();
  const router = useRouter();
  const regionParam = params.get("region") as RegionId | null;
  const region = REGION_DEFINITIONS.some((r) => r.id === regionParam) ? regionParam : null;
  const [query, setQuery] = useState("");

  const muscles = useMemo(() => {
    const base = searchMuscles(MUSCLES, query);
    return region ? base.filter((m) => m.region === region) : base;
  }, [query, region]);

  const setRegion = (r: RegionId | null) => router.replace(r ? `/library?region=${r}` : "/library", { scroll: false });

  return (
    <div className="space-y-12">
      <div>
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <MuscleSearchInput value={query} onChange={setQuery} className="w-full lg:max-w-sm" />
          <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="تصفية حسب المنطقة">
            {[null, ...REGION_DEFINITIONS.map((r) => r.id)].map((id) => {
              const def = REGION_DEFINITIONS.find((r) => r.id === id);
              const active = region === id;
              return (
                <button
                  key={id ?? "all"}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRegion(id)}
                  className={cn(
                    "whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
                    active ? "border-accent/60 bg-accent/10 text-fg" : "border-line text-muted hover:text-fg",
                  )}
                >
                  {def ? def.displayName.ar : "كل المناطق"}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mb-3 text-xs text-muted" aria-live="polite">
          {muscles.length} وحدة عضلية
        </p>

        {muscles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">لا توجد نتائج.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {muscles.map((m) => {
              const r = REGION_DEFINITIONS.find((x) => x.id === m.region)!;
              return (
                <article key={m.id} className="flex flex-col rounded-2xl border border-line bg-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold">{m.displayName.ar}</h2>
                      <p dir="ltr" className="text-end text-sm text-muted">
                        {m.displayName.en} · <i>{m.latin}</i>
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-panel-2 px-2 py-0.5 text-[11px] text-muted">{r.displayName.ar}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <GranularityBadge muscle={m} />
                    <span className="rounded border border-line px-1 text-[10px] text-muted">
                      {m.depth === "deep" ? "عميقة" : "سطحية"}
                    </span>
                  </div>
                  <div className="mt-3 text-xs">
                    <p className="mb-1 text-muted">{m.granularity === "single" ? "العضلة:" : "تشمل الشبكة:"}</p>
                    <ul className="space-y-0.5">
                      {m.includes.map((i) => (
                        <li key={i.en} className="flex flex-wrap gap-x-2">
                          <span className="text-fg">{i.ar}</span>
                          <span dir="ltr" className="text-muted">
                            {i.en}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {m.note && <p className="mt-3 rounded-lg bg-warn/10 p-2 text-xs leading-relaxed text-warn">{m.note}</p>}
                  <p className="mt-3 text-[11px] text-muted">
                    الشبكة في النموذج:{" "}
                    <span dir="ltr" className="font-mono text-fg">
                      {m.meshNames.map((n) => (["abdominal_muscles", "diaphragm", "pelvic_floor"].includes(n) ? n : `${n}_l / _r`)).join(", ")}
                    </span>
                  </p>
                  <Link
                    href={`/editor?select=${m.id}`}
                    className="mt-4 inline-flex h-8 w-fit items-center rounded-lg border border-line px-3 text-xs text-fg hover:border-accent/60"
                  >
                    تلوينها في الاستوديو ←
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <section aria-labelledby="coverage-heading">
        <h2 id="coverage-heading" className="text-lg font-semibold">
          تغطية النموذج للعضلات المستهدفة الـ32
        </h2>
        <p className="mb-4 mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          نماذج Open Anatomy 3D تدمج كثيرًا من العضلات في مجموعات. يبيّن الجدول ما يمكن تلوينه فعلًا لكل عضلة من القائمة
          المرجعية؛ عند اختيار عضلة «ضمن مجموعة» تتلوّن المجموعة كاملة.
        </p>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {(Object.keys(COVERAGE_LABELS) as CoverageStatus[]).map((s) => (
            <span key={s} className={cn("rounded border px-2 py-0.5", STATUS_STYLE[s])}>
              {COVERAGE_LABELS[s]} · {TARGET_COVERAGE.filter((c) => c.status === s).length}
            </span>
          ))}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-panel-2 text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-start font-medium">العضلة</th>
                <th className="px-3 py-2 text-start font-medium">الحالة في النموذج</th>
                <th className="px-3 py-2 text-start font-medium">الوحدة القابلة للتلوين</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {TARGET_COVERAGE.map((c) => (
                <tr key={c.name.en}>
                  <td className="px-3 py-2">
                    <span className="text-fg">{c.name.ar}</span>{" "}
                    <span dir="ltr" className="text-xs text-muted">
                      {c.name.en}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded border px-1.5 py-0.5 text-[11px]", STATUS_STYLE[c.status])}>
                      {COVERAGE_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">{c.muscleId ? getMuscle(c.muscleId)?.displayName.ar : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
