"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { MUSCLES, REGION_DEFINITIONS } from "@/data/muscles/muscles";
import { searchMuscles } from "@/lib/anatomy/search";
import { cn } from "@/components/ui/cn";
import type { RegionId } from "@/types/anatomy";
import { MuscleSearchInput } from "./MuscleSelector";

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
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <MuscleSearchInput value={query} onChange={setQuery} className="w-full lg:max-w-sm" />
        <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Filter by region">
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
                {def ? def.displayName.en : "All regions"}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mb-3 text-xs text-muted" aria-live="polite">
        {muscles.length} muscle{muscles.length === 1 ? "" : "s"}
      </p>

      {muscles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">
          No muscle matches your search.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {muscles.map((m) => {
            const r = REGION_DEFINITIONS.find((x) => x.id === m.region)!;
            return (
              <article key={m.id} className="flex flex-col rounded-2xl border border-line bg-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">{m.displayName.en}</h2>
                    <p dir="rtl" className="text-sm text-muted">
                      {m.displayName.ar}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-panel-2 px-2 py-0.5 text-[11px] text-muted">
                    {r.displayName.en}
                  </span>
                </div>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-muted">ID</dt>
                    <dd className="font-mono text-fg">{m.id}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-muted">Mesh names</dt>
                    <dd className="font-mono text-fg">{m.meshNames.map((n) => `${n}_L/_R`).join(", ")}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-muted">Layer</dt>
                    <dd className="text-fg">{m.depth}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-muted">Views</dt>
                    <dd className="text-fg">{m.viewAvailability.join(" · ")}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-muted">Aliases</dt>
                    <dd className="text-muted">{m.aliases.join(" · ")}</dd>
                  </div>
                </dl>
                <Link
                  href={`/editor?select=${m.id}`}
                  className="mt-4 inline-flex h-8 w-fit items-center rounded-lg border border-line px-3 text-xs text-fg hover:border-accent/60"
                >
                  Highlight in studio →
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
