"use client";

import Link from "next/link";
import { useRef } from "react";
import { REGION_MUSCLE_BY_ID, type RegionMuscle } from "@/data/region/backShoulders";
import { EXERCISE_BY_ID, type Exercise } from "@/data/exercises/exercises";
import { GROUP_BY_ID } from "@/data/exercises/groups";
import { countForUnit, groupIdsOfUnit, spotlightOf, viewOf } from "@/lib/exercises";
import { STRUCTURE_ABOUT, explainMuscle } from "@/lib/exercises/describe";
import { secondaryHighlight } from "@/lib/region/backModel";
import { backStore, useBack, type PanelMode } from "@/stores/backStore";
import { cn } from "@/components/ui/cn";
import { IconBack, IconBody, IconDumbbell, IconFocus, IconInfo, IconIsolate, IconX } from "@/components/ui/icons";
import { ExerciseLibrary } from "@/components/exercise/ExerciseLibrary";
import { regionBridge } from "./BackViewport";
import { REGION_SHORT, useCover, useIsDesktop } from "./studioUi";

const KIND_AR: Record<string, string> = {
  unit: "عضلة",
  bone: "عظم / غضروف",
  tendon: "وتر / سفاق",
  ligament: "رباط / محفظة مفصلية",
  fascia: "لفافة / جراب",
  nerve: "عصب",
  attachment: "موضع ارتكاز",
};
const SIDE_AR = { l: "الأيسر", r: "الأيمن", m: "" } as const;

function Chips({ title, list }: { title: string; list: RegionMuscle["synergists"] }) {
  return (
    <div>
      <dt className="mb-1 text-[11px] font-semibold text-muted">{title}</dt>
      <dd className="flex flex-wrap gap-1">
        {list.map((r) =>
          r.id ? (
            <button key={r.ar} type="button" onClick={() => backStore.getState().selectUnit(r.id!)} className="rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-fg hover:border-[#D2626C] hover:text-[#F0A3AB]">
              {r.ar}
            </button>
          ) : (
            <span key={r.ar} className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] text-muted">
              {r.ar}
            </span>
          ),
        )}
      </dd>
    </div>
  );
}

/** Light an exercise's muscles on the model; opening one also turns the body to the side that shows them. */
function spotlight(e: Exercise | null, opened: boolean): void {
  const st = backStore.getState();
  st.setSpotlight(e ? spotlightOf(e) : null);
  if (e && opened) st.view(viewOf(e));
}

/** Select the muscle of a group on the model (the first unit of the group), keeping the exercises open. */
function pickGroup(groupId: string): void {
  const g = GROUP_BY_ID.get(groupId);
  if (!g) return;
  const st = backStore.getState();
  st.selectUnit(g.units[0], st.selected?.side === "r" ? "r" : "l");
  st.setPanel("exercises");
}

const ghost = "grid size-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-white/8 hover:text-fg";
const soft = "flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/12 px-3 text-[13px] text-fg transition-colors hover:bg-white/8";

/**
 * Panel of the structure picked on the 3D model — kept minimal:
 *  - summary: the muscle's name, its group and what it does in a sentence or two,
 *    with the actions (exercises, isolate, focus);
 *  - explanation, behind the ⓘ button: where the muscle is, what it does and the
 *    movements it works in, in plain Arabic — no source or database data anywhere;
 *  - exercises: the exercise library for this muscle.
 * A floating card at the side on desktop, a bottom sheet on a phone; the 3D view
 * shifts its subject into the part the panel leaves free.
 */
export function MusclePanel() {
  const selected = useBack((s) => s.selected);
  const isolate = useBack((s) => s.isolate);
  const region = useBack((s) => s.region);
  const showEnglish = useBack((s) => s.showEnglish);
  const highlight = useBack((s) => s.highlightColor);
  const mode = useBack((s) => s.panel);
  const linked = useBack((s) => s.linkedExercise);
  const dock = useBack((s) => s.dock);
  const desktop = useIsDesktop();
  const ref = useRef<HTMLDivElement>(null);
  // on a phone an open control sheet takes the place of this panel
  const shown = !!selected && (desktop || !dock);
  useCover(ref, "panel", desktop ? "left" : "bottom", shown, `${selected?.id}|${mode}`);
  if (!selected) return null;
  const st = backStore.getState();
  const isUnit = selected.kind === "unit";
  const unit: RegionMuscle | undefined = isUnit ? REGION_MUSCLE_BY_ID.get(selected.id) : undefined;
  const modelUnit = isUnit ? regionBridge.model?.units.get(selected.id) : undefined;
  const groups = isUnit ? groupIdsOfUnit(selected.id) : [];
  const counts = isUnit ? countForUnit(selected.id) : { strength: 0, stretch: 0 };
  const total = counts.strength + counts.stretch;
  // Muscles: a plain explanation. Other structures: one sentence on what they are (no details view).
  const explain = isUnit ? explainMuscle(selected.id, modelUnit?.region) : null;
  const about = explain ? explain.about : (STRUCTURE_ABOUT[selected.kind] ?? null);
  const panel: PanelMode = isUnit ? mode : "summary";
  const focus = () => (isUnit ? st.focus(selected.id, selected.side) : backStore.setState({ cameraCommand: { type: "focus-structure", key: selected.id, nonce: Date.now() } }));
  // A tall sheet on a phone leaves a small part of the view: bring the muscle into it.
  const open = (p: PanelMode) => {
    st.setPanel(p);
    if (!desktop) focus();
  };
  const groupLine = isUnit
    ? modelUnit
      ? `المجموعة: ${REGION_SHORT[modelUnit.region] ?? ""}`
      : KIND_AR.unit
    : `${KIND_AR[selected.kind]}${selected.side !== "m" ? ` · الجانب ${SIDE_AR[selected.side]}` : ""}`;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`بطاقة ${selected.ar}`}
      data-panel={panel}
      className={cn(
        "pointer-events-auto z-30 flex flex-col overflow-hidden border-white/10 bg-[#111214]/92 text-fg shadow-[0_12px_40px_rgba(0,0,0,.55)] backdrop-blur-xl",
        "lg:absolute lg:end-3 lg:top-3 lg:max-h-[calc(100%-1.5rem)] lg:rounded-2xl lg:border",
        panel === "exercises" ? "lg:w-[420px]" : "lg:w-[340px]",
        // phone: a sheet resting on the control bar, which stays reachable
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-lg:rounded-t-2xl max-lg:border-t",
        panel === "summary" ? "max-lg:max-h-[42dvh]" : "max-lg:h-[56dvh]",
        !shown && "hidden",
      )}
    >
      <span aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-white/18 lg:hidden" />
      <div className="flex shrink-0 items-start gap-2 px-4 pb-2 pt-3">
        {panel !== "summary" ? (
          <button type="button" aria-label="رجوع إلى ملخص العضلة" title="رجوع" onClick={() => st.setPanel("summary")} className={cn(ghost, "-ms-1.5 -mt-1")}>
            <IconBack size={18} />
          </button>
        ) : (
          <span aria-hidden className="mt-1.5 size-3 shrink-0 rounded-full ring-2 ring-white/15" style={{ background: highlight }} />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold leading-snug">
            {panel === "exercises" && <span className="font-normal text-muted">تمارين </span>}
            {selected.ar}
          </h3>
          {showEnglish && (
            <p className="truncate text-end text-xs text-muted" dir="ltr">
              {selected.en}
            </p>
          )}
          {panel === "summary" && <p className="mt-0.5 text-xs text-muted">{groupLine}</p>}
        </div>
        {panel === "summary" && isUnit && (
          <button type="button" data-action="learn-more" aria-label="شرح العضلة" title="شرح العضلة" onClick={() => open("details")} className={cn(ghost, "-mt-1")}>
            <IconInfo size={19} />
          </button>
        )}
        <button type="button" aria-label="إغلاق البطاقة" title="إغلاق" onClick={() => st.select(null)} className={cn(ghost, "-me-1.5 -mt-1")}>
          <IconX size={18} />
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {panel === "summary" && (
          <div className="space-y-3 px-4 pb-4">
            {about && (
              <p data-muscle-about="" className="text-sm leading-relaxed text-white/85">
                {about}
              </p>
            )}
            <div className="flex gap-2">
              {isUnit && (
                <button type="button" data-action="exercises" onClick={() => open("exercises")} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#A5111F] px-3 text-sm font-medium text-white transition-colors hover:bg-[#BA1626]">
                  <IconDumbbell size={16} /> التمارين{total ? ` (${total})` : ""}
                </button>
              )}
              <button type="button" data-action="isolate" aria-pressed={isolate} onClick={() => st.setIsolate(!isolate)} className={cn(soft, isolate && "border-[#D2626C] bg-[#A5111F]/20 text-[#F4B4BB]", !isUnit && "flex-1")}>
                <IconIsolate size={15} />
                {isolate ? "إلغاء العزل" : "عزل"}
              </button>
              <button type="button" aria-label="تركيز الكاميرا" title="تركيز الكاميرا" onClick={focus} className={cn(soft, "w-10 px-0")}>
                <IconFocus size={16} />
              </button>
            </div>
            {(isolate || region) && (
              <button type="button" data-action="full-body" onClick={st.showFullBody} className={cn(soft, "w-full")}>
                <IconBody size={15} /> عرض الجسم كاملا
              </button>
            )}
          </div>
        )}

        {panel === "details" && explain && (
          <div className="space-y-4 px-4 pb-4 text-sm leading-relaxed">
            {explain.where && (
              <section>
                <h4 className="mb-1 text-xs font-semibold text-muted">أين تقع</h4>
                <p>{explain.where}</p>
              </section>
            )}
            <section>
              <h4 className="mb-1 text-xs font-semibold text-muted">ماذا تفعل</h4>
              {explain.does.length ? (
                <ul className="space-y-1">
                  {explain.does.map((d) => (
                    <li key={d} className="flex gap-2">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[#D2626C]" />
                      {d}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{explain.about}</p>
              )}
            </section>
            {explain.moves.length > 0 && (
              <section>
                <h4 className="mb-1.5 text-xs font-semibold text-muted">تعمل في</h4>
                <ul className="flex flex-wrap gap-1.5">
                  {explain.moves.map((m) => (
                    <li key={m} className="rounded-full bg-white/7 px-2.5 py-1 text-xs text-white/85">
                      {m}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {unit && (
              <dl className="space-y-3">
                <Chips title="عضلات تعمل معها" list={unit.synergists} />
                <Chips title="عضلات تعاكسها" list={unit.antagonists} />
              </dl>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => st.showAttachmentsOf(selected.id)} className={cn(soft, "h-auto min-h-10 py-2 text-xs")}>
                إظهار ارتباطها بالعظم
              </button>
              <button
                type="button"
                onClick={() => {
                  st.toggleUnit(selected.id);
                  st.select(null);
                }}
                className={cn(soft, "h-auto min-h-10 py-2 text-xs")}
              >
                إخفاء العضلة
              </button>
            </div>
            {total > 0 && (
              <button type="button" onClick={() => open("exercises")} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#A5111F] px-3 text-sm font-medium text-white transition-colors hover:bg-[#BA1626]">
                <IconDumbbell size={16} /> تمارين هذه العضلة ({total})
              </button>
            )}
          </div>
        )}

        {panel === "exercises" && (
          <div className="px-3 pb-4">
            {groups.length ? (
              <>
                <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-muted">
                  <span>اختيار تمرين يضيء عضلاته على المجسم:</span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full" style={{ background: highlight }} /> أساسية
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full" style={{ background: secondaryHighlight(highlight) }} /> مساعدة
                  </span>
                </p>
                <ExerciseLibrary
                  key={selected.id}
                  tone="dark"
                  scope={groups}
                  showEnglish={showEnglish}
                  onSpotlight={spotlight}
                  onPickGroup={pickGroup}
                  initial={linked ? { open: linked, type: EXERCISE_BY_ID.get(linked)?.type } : undefined}
                />
                <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
                  محتوى تعليمي عام وليس وصفة تدريب أو علاج.{" "}
                  <Link href={`/exercises?group=${groups[groups.length - 1]}`} className="text-accent-2 underline">
                    فتح مكتبة التمارين كاملة
                  </Link>
                </p>
              </>
            ) : (
              <div className="px-1 py-4 text-sm leading-relaxed text-muted">
                <p>لا توجد في المكتبة تمارين مخصصة لهذه العضلة.</p>
                <Link href="/exercises" className="mt-2 inline-block text-accent-2 underline">
                  تصفح مكتبة التمارين كاملة
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
