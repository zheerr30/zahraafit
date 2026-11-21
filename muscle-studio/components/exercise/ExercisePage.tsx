"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Exercise, ExerciseType } from "@/data/exercises/exercises";
import { EXERCISE_BY_ID } from "@/data/exercises/exercises";
import { GROUP_BY_ID } from "@/data/exercises/groups";
import { groupIdsOfUnit } from "@/lib/exercises";
import { IconCube } from "@/components/ui/icons";
import { ExerciseLibrary } from "./ExerciseLibrary";

/** Link that opens the 3D model on the main muscle of an exercise, with its exercises and this one lit. */
export function atlasHref(e: Exercise): string {
  const unit = GROUP_BY_ID.get(e.primary[0])?.units[0];
  return unit ? `/atlas?muscle=${unit}&panel=exercises&ex=${e.id}` : "/atlas";
}

/**
 * The whole exercise library. `?group=`, `?muscle=` (a model unit id), `?type=`,
 * `?q=` and `?ex=` preset the muscle filter, tab, search text and opened exercise.
 */
export function ExercisePage() {
  const params = useSearchParams();
  const muscle = params.get("muscle");
  const fromMuscle = muscle ? groupIdsOfUnit(muscle) : [];
  const group = params.get("group") ?? fromMuscle[fromMuscle.length - 1] ?? null;
  const ex = EXERCISE_BY_ID.get(params.get("ex") ?? "");
  const type = (params.get("type") === "stretch" ? "stretch" : params.get("type") === "strength" ? "strength" : ex?.type) as ExerciseType | undefined;
  return (
    <ExerciseLibrary
      key={params.toString()}
      tone="dark"
      showEnglish
      initial={{ group: group && GROUP_BY_ID.has(group) ? group : null, query: params.get("q") ?? "", type, open: ex?.id ?? null }}
      cardFooter={(e) => (
        <Link href={atlasHref(e)} data-action="open-in-atlas" className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-[#f06d3a]">
          <IconCube size={14} /> عرض العضلات على المجسم ثلاثي الأبعاد
        </Link>
      )}
    />
  );
}
