"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EQUIPMENT_AR, LEVEL_AR, TYPE_AR, type Equipment, type Exercise, type ExerciseType, type Level } from "@/data/exercises/exercises";
import { GROUP_AREAS, GROUP_BY_ID } from "@/data/exercises/groups";
import { filterExercises } from "@/lib/exercises";
import { exerciseStore, useExercises } from "@/stores/exerciseStore";
import { cn } from "@/components/ui/cn";
import { IconBookmark, IconSearch, IconX } from "@/components/ui/icons";
import { ExerciseCard } from "./ExerciseCard";
import { TONES, type Tone } from "./tone";

export interface ExerciseLibraryProps {
  tone: Tone;
  /**
   * Muscle groups the library is opened for (the selected muscle of the 3D model).
   * `null`: the whole library, with a muscle filter of its own.
   */
  scope?: readonly string[] | null;
  showEnglish?: boolean;
  /** The exercise being looked at changed (hovered, or opened): light its muscles on the model. */
  onSpotlight?: (e: Exercise | null, opened: boolean) => void;
  /** A target muscle of an exercise was tapped. Without it, the tap filters the library. */
  onPickGroup?: (groupId: string) => void;
  cardFooter?: (e: Exercise) => ReactNode;
  initial?: { type?: ExerciseType; group?: string | null; query?: string; open?: string | null };
  className?: string;
}

const EQUIPMENT = Object.keys(EQUIPMENT_AR) as Equipment[];
const LEVELS: Level[] = [1, 2, 3];

export function ExerciseLibrary({ tone, scope = null, showEnglish, onSpotlight, onPickGroup, cardFooter, initial, className }: ExerciseLibraryProps) {
  const T = TONES[tone];
  const [type, setType] = useState<ExerciseType>(initial?.type ?? "strength");
  const [query, setQuery] = useState(initial?.query ?? "");
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [saved, setSaved] = useState(false);
  const [video, setVideo] = useState(false);
  const [group, setGroup] = useState<string | null>(initial?.group ?? null);
  const [openId, setOpenId] = useState<string | null>(initial?.open ?? null);
  const bookmarks = useExercises((s) => s.bookmarks);
  useEffect(() => exerciseStore.getState().load(), []);

  // the muscle filter as one stable value (the scope array is rebuilt on every render of the parent)
  const groupKey = (scope ?? (group ? [group] : [])).join(" ");
  const { counts, list } = useMemo(() => {
    const base = { query, equipment, level, video, groups: groupKey ? groupKey.split(" ") : null, bookmarks: saved ? bookmarks : null };
    return {
      counts: { strength: filterExercises({ ...base, type: "strength" }).length, stretch: filterExercises({ ...base, type: "stretch" }).length },
      list: filterExercises({ ...base, type }),
    };
  }, [type, query, equipment, level, video, saved, bookmarks, groupKey]);
  // an opened exercise that the filters removed is no longer "being looked at"
  const openVisible = openId && list.some((e) => e.id === openId) ? openId : null;
  useEffect(() => {
    if (!openVisible) onSpotlight?.(null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openVisible]);

  const toggle = (e: Exercise) => {
    const next = openVisible === e.id ? null : e.id;
    setOpenId(next);
    onSpotlight?.(next ? e : null, !!next);
  };
  const hover = (e: Exercise, inside: boolean) => {
    if (inside) onSpotlight?.(e, false);
    else onSpotlight?.(list.find((x) => x.id === openVisible) ?? null, false);
  };
  const activeFilters = (equipment ? 1 : 0) + (level ? 1 : 0) + (saved ? 1 : 0) + (video ? 1 : 0) + (query ? 1 : 0) + (!scope && group ? 1 : 0);
  const clear = () => {
    setQuery("");
    setEquipment(null);
    setLevel(null);
    setSaved(false);
    setVideo(false);
    if (!scope) setGroup(null);
  };
  const pill = (on: boolean) => cn("whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] transition-colors", on ? T.pillOn : T.pillOff);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div role="tablist" aria-label="نوع التمرين" className={cn("grid grid-cols-2 gap-1 rounded-lg p-1", T.tabs)}>
        {(["strength", "stretch"] as ExerciseType[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={type === t} data-tab={t} onClick={() => setType(t)} className={cn("rounded-md py-1.5 text-xs", type === t ? T.tabOn : T.tabOff)}>
            {TYPE_AR[t]} <span className="font-normal opacity-70">({counts[t]})</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">بحث في التمارين</span>
          <IconSearch size={15} className={cn("pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2", T.muted)} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم التمرين أو العضلة…"
            className={cn("w-full rounded-lg border py-1.5 pe-3 ps-8 text-sm outline-none", T.input)}
          />
        </label>
        <button type="button" data-action="saved-filter" aria-pressed={saved} onClick={() => setSaved(!saved)} title="المحفوظات فقط" className={cn("flex shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs", saved ? T.pillOn : T.pillOff)}>
          <IconBookmark size={14} filled={saved} /> المحفوظات{bookmarks.size ? ` (${bookmarks.size})` : ""}
        </button>
      </div>

      {!scope && (
        <div className="space-y-1.5">
          <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="تصفية حسب العضلة">
            <button type="button" aria-pressed={!group} onClick={() => setGroup(null)} className={pill(!group)}>
              كل العضلات
            </button>
            {GROUP_AREAS.map((a) => (
              <span key={a.id} className="flex items-center gap-1.5">
                <span className={cn("ps-1 text-[10px] font-semibold", T.muted)}>{a.ar}</span>
                {a.groups.map((g) => (
                  <button key={g} type="button" aria-pressed={group === g} data-group={g} onClick={() => setGroup(group === g ? null : g)} className={pill(group === g)}>
                    {GROUP_BY_ID.get(g)!.ar}
                  </button>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="scroll-thin flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="تصفية حسب الأدوات والمستوى">
        <button type="button" aria-pressed={video} data-action="video-filter" onClick={() => setVideo(!video)} className={pill(video)}>
          ▶ بفيديو
        </button>
        <span className={cn("mx-0.5 h-4 w-px shrink-0", tone === "light" ? "bg-[#cfd6e4]" : "bg-line-strong")} />
        {EQUIPMENT.map((q) => (
          <button key={q} type="button" aria-pressed={equipment === q} data-equipment={q} onClick={() => setEquipment(equipment === q ? null : q)} className={pill(equipment === q)}>
            {EQUIPMENT_AR[q]}
          </button>
        ))}
        <span className={cn("mx-0.5 h-4 w-px shrink-0", tone === "light" ? "bg-[#cfd6e4]" : "bg-line-strong")} />
        {LEVELS.map((l) => (
          <button key={l} type="button" aria-pressed={level === l} data-level={l} onClick={() => setLevel(level === l ? null : l)} className={pill(level === l)}>
            {LEVEL_AR[l]}
          </button>
        ))}
        {activeFilters > 0 && (
          <button type="button" onClick={clear} className={cn("flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-[11px]", T.ghost)}>
            <IconX size={12} /> مسح التصفية
          </button>
        )}
      </div>

      {list.length ? (
        <ul className={cn("grid gap-2", !scope && "md:grid-cols-2 xl:grid-cols-3")} aria-label={`تمارين ${TYPE_AR[type]}`}>
          {list.map((e) => (
            <ExerciseCard
              key={e.id}
              exercise={e}
              tone={tone}
              open={openVisible === e.id}
              bookmarked={bookmarks.has(e.id)}
              showEnglish={showEnglish}
              scope={scope}
              onToggle={() => toggle(e)}
              onBookmark={() => exerciseStore.getState().toggle(e.id)}
              onHover={onSpotlight ? (inside) => hover(e, inside) : undefined}
              onPickGroup={onPickGroup ?? (scope ? undefined : (g) => setGroup(g))}
              footer={cardFooter?.(e)}
            />
          ))}
        </ul>
      ) : (
        <p role="status" className={cn("rounded-xl border border-dashed px-4 py-6 text-center text-sm", T.border, T.muted)}>
          {saved && !bookmarks.size
            ? "لا توجد تمارين محفوظة بعد. تُحفظ التمارين بالضغط على علامة الحفظ في بطاقة التمرين."
            : activeFilters
              ? "لا توجد تمارين تطابق البحث والتصفية الحالية."
              : scope
                ? `لا توجد تمارين ${TYPE_AR[type]} مخصّصة لهذه العضلة في المكتبة.`
                : "لا توجد تمارين."}
        </p>
      )}
    </div>
  );
}
