"use client";

import type { ReactNode } from "react";
import { EQUIPMENT_AR, LEVEL_AR, TYPE_AR, type Exercise } from "@/data/exercises/exercises";
import { GROUP_BY_ID } from "@/data/exercises/groups";
import { relevance, youtubeId } from "@/lib/exercises";
import { cn } from "@/components/ui/cn";
import { IconBookmark, IconChevron } from "@/components/ui/icons";
import { ExerciseVideo, VideoThumb } from "./ExerciseVideo";
import { MuscleMap } from "./MuscleMap";
import { TONES, type Tone } from "./tone";

export interface ExerciseCardProps {
  exercise: Exercise;
  tone: Tone;
  open: boolean;
  bookmarked: boolean;
  showEnglish?: boolean;
  /** Groups of the muscle the library is opened for: labels the card "main" / "helper". */
  scope?: readonly string[] | null;
  onToggle: () => void;
  onBookmark: () => void;
  onHover?: (inside: boolean) => void;
  /** A target muscle was tapped (select it on the model / filter by it). */
  onPickGroup?: (groupId: string) => void;
  footer?: ReactNode;
}

export function ExerciseCard({ exercise: e, tone, open, bookmarked, showEnglish, scope, onToggle, onBookmark, onHover, onPickGroup, footer }: ExerciseCardProps) {
  const T = TONES[tone];
  const role = scope?.length ? relevance(e, scope) : 0;
  const names = (ids: string[]) => ids.map((g) => GROUP_BY_ID.get(g)?.ar ?? g).join("، ");
  return (
    <li
      data-exercise={e.id}
      onPointerEnter={(ev) => ev.pointerType === "mouse" && onHover?.(true)}
      onPointerLeave={(ev) => ev.pointerType === "mouse" && onHover?.(false)}
      className={cn("rounded-xl border transition-colors", open ? T.cardOpen : T.card)}
    >
      <div className="flex items-stretch gap-3 p-2.5">
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`ex-${e.id}`} className="flex min-w-0 flex-1 items-stretch gap-3 text-start">
          {e.media?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.media.image} alt={e.ar} loading="lazy" className="h-[92px] w-[84px] shrink-0 rounded-lg object-cover" />
          ) : e.media?.video && youtubeId(e.media.video) ? (
            <VideoThumb url={e.media.video} alt={`فيديو ${e.ar}`} className="h-[92px] w-[104px] shrink-0" />
          ) : (
            <MuscleMap primary={e.primary} secondary={e.secondary} label={`العضلات العاملة في ${e.ar}: ${names(e.primary)}`} className="h-[92px] w-[84px] shrink-0" />
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={cn("text-sm font-semibold leading-snug", T.title)}>{e.ar}</span>
            {showEnglish && <span className={cn("truncate text-end text-[11px]", T.muted)} dir="ltr">{e.en}</span>}
            <span className={cn("mt-0.5 line-clamp-1 text-[11px]", T.soft)}>{names(e.primary)}</span>
            <span className="mt-auto flex flex-wrap items-center gap-1 pt-1.5 text-[10.5px]">
              {role > 0 && (
                <span className={cn("rounded-full px-1.5 py-0.5 font-medium", role === 2 ? "bg-select text-white" : "bg-select-chip text-select-chip-fg")}>
                  {role === 2 ? "عضلة أساسية" : "عضلة مساعدة"}
                </span>
              )}
              <span className={cn("rounded-full px-1.5 py-0.5", T.chip)}>{EQUIPMENT_AR[e.equipment]}</span>
              <span className={cn("rounded-full px-1.5 py-0.5", T.chip)}>{LEVEL_AR[e.level]}</span>
              {e.dose && <span className={cn("rounded-full px-1.5 py-0.5", T.chip)} dir="rtl">{e.dose}</span>}
            </span>
          </span>
        </button>
        <span className="flex shrink-0 flex-col items-center justify-between">
          <button
            type="button"
            aria-pressed={bookmarked}
            aria-label={bookmarked ? `إزالة ${e.ar} من المحفوظات` : `حفظ ${e.ar}`}
            title={bookmarked ? "إزالة من المحفوظات" : "حفظ التمرين"}
            onClick={onBookmark}
            className={cn("grid size-8 place-items-center rounded-lg", bookmarked ? "text-[#E8602C]" : T.ghost)}
          >
            <IconBookmark size={17} filled={bookmarked} />
          </button>
          <IconChevron size={15} aria-hidden className={cn("mb-1 transition-transform", T.muted, open ? "-rotate-90" : "rotate-90")} />
        </span>
      </div>
      {open && (
        <div id={`ex-${e.id}`} className={cn("space-y-3 border-t px-3 py-3 text-[13px] leading-relaxed", T.border, T.text)}>
          {e.media?.video && <ExerciseVideo url={e.media.video} title={e.ar} linkClass={T.link} />}
          {e.steps.length > 0 && (
            <ol className="space-y-1.5">
              {e.steps.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold", T.step)}>{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
          <p className={cn("rounded-lg p-2 text-xs", T.note)}>
            <span className="font-semibold">ملاحظة: </span>
            {e.tip}
          </p>
          <div className="flex items-start gap-3">
            {(e.media?.video || e.media?.image) && (
              <MuscleMap primary={e.primary} secondary={e.secondary} label={`العضلات العاملة في ${e.ar}: ${names(e.primary)}`} className="h-[92px] w-[84px] shrink-0" />
            )}
          <dl className="min-w-0 flex-1 space-y-1.5 text-xs">
            {(
              [
                ["العضلات الأساسية", e.primary, "bg-select"],
                ["العضلات المساعدة", e.secondary, "bg-select-soft"],
              ] as [string, string[], string][]
            ).map(([title, ids, dot]) =>
              ids.length ? (
                <div key={title} className="flex flex-wrap items-center gap-1">
                  <dt className={cn("flex items-center gap-1 font-semibold", T.soft)}>
                    <span className={cn("size-2 rounded-full", dot)} /> {title}:
                  </dt>
                  {ids.map((g) => (
                    <dd key={g}>
                      <button type="button" onClick={() => onPickGroup?.(g)} disabled={!onPickGroup} className={cn("rounded-full border px-2 py-0.5", T.pillOff, !onPickGroup && "pointer-events-none")}>
                        {GROUP_BY_ID.get(g)?.ar ?? g}
                      </button>
                    </dd>
                  ))}
                </div>
              ) : null,
            )}
          </dl>
          </div>
          <p className={cn("text-[11px]", T.muted)}>
            {[TYPE_AR[e.type], EQUIPMENT_AR[e.equipment], LEVEL_AR[e.level], e.dose].filter(Boolean).join(" · ")}
          </p>
          {footer}
        </div>
      )}
    </li>
  );
}
