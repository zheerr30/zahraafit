"use client";

import Link from "next/link";
import { DEPTH_NAMES, REGION_MUSCLE_BY_ID, type RegionMuscle } from "@/data/region/backShoulders";
import { EXERCISE_BY_ID, type Exercise } from "@/data/exercises/exercises";
import { GROUP_BY_ID, groupsOfUnit } from "@/data/exercises/groups";
import { countForUnit, functionOfUnit, groupIdsOfUnit, spotlightOf, viewOf } from "@/lib/exercises";
import { COLORS, REGIONS } from "@/lib/region/backModel";
import { backStore, useBack, type PanelMode } from "@/stores/backStore";
import { cn } from "@/components/ui/cn";
import { IconBack, IconBody, IconBook, IconDumbbell, IconFocus, IconX } from "@/components/ui/icons";
import { ExerciseLibrary } from "@/components/exercise/ExerciseLibrary";
import { regionBridge } from "./BackViewport";
import { SourceMeta } from "./SourceMeta";

const KIND_AR: Record<string, string> = {
  unit: "عضلة",
  bone: "عظم / غضروف",
  tendon: "وتر / سفاق",
  ligament: "رباط / محفظة مفصلية",
  fascia: "لفافة / جراب",
  nerve: "عصب",
  attachment: "موضع ارتكاز",
};
const REGION_AR = Object.fromEntries(REGIONS.map((r) => [r.id, r.ar]));
const SIDE_AR = { l: "الأيسر", r: "الأيمن", m: "" } as const;
const SWATCHES = ["#E8602C", "#EEA585", "#173F8A", "#2E9E6A", "#D4A017"];

function Chips({ title, list }: { title: string; list: RegionMuscle["synergists"] }) {
  return (
    <div>
      <dt className="mb-1 text-[11px] font-semibold text-[#4b5d80]">{title}</dt>
      <dd className="flex flex-wrap gap-1">
        {list.map((r) =>
          r.id ? (
            <button
              key={r.ar}
              type="button"
              onClick={() => backStore.getState().selectUnit(r.id!)}
              className="rounded-full border border-[#cfd6e4] bg-white px-2 py-0.5 text-[11px] text-[#0B2E6B] hover:border-[#E8602C] hover:text-[#c44a1c]"
            >
              {r.ar}
            </button>
          ) : (
            <span key={r.ar} className="rounded-full bg-[#eef2f8] px-2 py-0.5 text-[11px] text-[#4b5d80]">
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

/**
 * Contextual panel of the structure picked on the 3D model.
 *  - summary: name, what the muscle does, and the actions — learn more, exercises, isolate;
 *  - details ("learn more"): origin, insertion, action, innervation, related muscles, source data;
 *  - exercises: the exercise library for this muscle (strengthening / stretching, search,
 *    filters, bookmarks); looking at an exercise lights its muscles on the model.
 * On a phone it is a bottom sheet, so the model stays visible above it.
 */
export function MusclePanel() {
  const selected = useBack((s) => s.selected);
  const isolate = useBack((s) => s.isolate);
  const region = useBack((s) => s.region);
  const showEnglish = useBack((s) => s.showEnglish);
  const highlight = useBack((s) => s.highlightColor);
  const mode = useBack((s) => s.panel);
  const linked = useBack((s) => s.linkedExercise);
  if (!selected) return null;
  const st = backStore.getState();
  const isUnit = selected.kind === "unit";
  const unit: RegionMuscle | undefined = isUnit ? REGION_MUSCLE_BY_ID.get(selected.id) : undefined;
  const modelUnit = isUnit ? regionBridge.model?.units.get(selected.id) : undefined;
  const groups = isUnit ? groupIdsOfUnit(selected.id) : [];
  const counts = isUnit ? countForUnit(selected.id) : { strength: 0, stretch: 0 };
  const total = counts.strength + counts.stretch;
  const fn = unit?.action ?? (isUnit ? functionOfUnit(selected.id) : null);
  const panel: PanelMode = isUnit ? mode : "summary";
  const focus = () => (isUnit ? st.focus(selected.id, selected.side) : backStore.setState({ cameraCommand: { type: "focus-structure", key: selected.id, nonce: Date.now() } }));
  const secondary = "rounded-lg border px-2.5 py-1.5 text-xs border-[#cfd6e4] text-[#0B2E6B] hover:bg-[#f2f5fa]";

  return (
    <div
      role="dialog"
      aria-label={`بطاقة ${selected.ar}`}
      data-panel={panel}
      className={cn(
        "scroll-thin pointer-events-auto z-30 flex flex-col overflow-hidden bg-white text-[#13213d] shadow-2xl ring-1 ring-black/5",
        "lg:absolute lg:end-3 lg:top-3 lg:max-h-[calc(100%-1.5rem)] lg:rounded-2xl",
        panel === "exercises" ? "lg:w-[430px]" : "lg:w-[390px]",
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:rounded-t-2xl",
        panel === "summary" ? "max-lg:max-h-[52dvh]" : "max-lg:h-[64dvh]",
      )}
    >
      <div className="flex shrink-0 items-start gap-2 border-b border-[#eef2f8] px-4 py-3">
        {panel !== "summary" ? (
          <button type="button" aria-label="رجوع إلى ملخّص العضلة" title="رجوع" onClick={() => st.setPanel("summary")} className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-[#0B2E6B] hover:bg-[#f2f5fa]">
            <IconBack size={17} />
          </button>
        ) : (
          <label className="relative mt-1 size-5 shrink-0 cursor-pointer rounded-full ring-2 ring-white" style={{ background: highlight }} title="لون التمييز">
            <input type="color" aria-label="لون تمييز العضلة" value={highlight} onChange={(e) => st.setHighlightColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-[#0B2E6B]">
            {panel === "exercises" && <span className="font-normal text-[#4b5d80]">تمارين </span>}
            {selected.ar}
          </h3>
          {showEnglish && (
            <p className="text-xs text-[#6b7891]" dir="ltr">
              {selected.en}
              {unit && <span className="italic"> · {unit.latin}</span>}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-[#6b7891]">
            {KIND_AR[selected.kind]}
            {isUnit && modelUnit && ` · ${REGION_AR[modelUnit.region] ?? ""} · طبقة ${DEPTH_NAMES[modelUnit.depth]}`}
            {!isUnit && selected.side !== "m" && ` · الجانب ${SIDE_AR[selected.side]}`}
          </p>
        </div>
        <button type="button" aria-label="إغلاق البطاقة" onClick={() => st.select(null)} className="grid size-7 shrink-0 place-items-center rounded-lg text-[#6b7891] hover:bg-[#f2f5fa]">
          <IconX size={16} />
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {panel === "summary" && (
          <div className="space-y-3 px-4 py-3">
            {fn && <p className="text-sm leading-relaxed">{fn}</p>}
            {!fn && isUnit && <p className="text-sm leading-relaxed text-[#4b5d80]">عضلة مستقلة من نموذج Z-Anatomy. التفاصيل التشريحية من المصدر في «اعرف أكثر».</p>}
            {!isUnit && <p className="text-sm leading-relaxed text-[#4b5d80]">بنية تشريحية من نموذج Z-Anatomy.</p>}
            {isUnit && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" data-action="learn-more" onClick={() => st.setPanel("details")} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#0B2E6B] px-3 py-2.5 text-sm font-medium text-white hover:bg-[#173F8A]">
                  <IconBook size={16} /> اعرف أكثر
                </button>
                <button type="button" data-action="exercises" onClick={() => st.setPanel("exercises")} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#E8602C] px-3 py-2.5 text-sm font-medium text-white hover:bg-[#f06d3a]">
                  <IconDumbbell size={16} /> التمارين{total ? ` (${total})` : ""}
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              <button type="button" data-action="isolate" aria-pressed={isolate} onClick={() => st.setIsolate(!isolate)} className={cn("rounded-lg border px-2.5 py-1.5 text-xs", isolate ? "border-[#E8602C] bg-[#fdeee7] text-[#c44a1c]" : "border-[#cfd6e4] text-[#0B2E6B] hover:bg-[#f2f5fa]")}>
                {isolate ? "إلغاء العزل" : "عزل العضلة"}
              </button>
              <button type="button" onClick={focus} className={cn(secondary, "flex items-center gap-1")}>
                <IconFocus size={14} /> تركيز الكاميرا
              </button>
              {(isolate || region) && (
                <button type="button" data-action="full-body" onClick={st.showFullBody} className={cn(secondary, "flex items-center gap-1")}>
                  <IconBody size={14} /> عرض الجسم كاملًا
                </button>
              )}
            </div>
            {!isUnit && <SourceMeta picked={selected} />}
          </div>
        )}

        {panel === "details" && (
          <>
            <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
              <button type="button" aria-pressed={isolate} onClick={() => st.setIsolate(!isolate)} className={cn("rounded-lg border px-2.5 py-1.5 text-xs", isolate ? "border-[#E8602C] bg-[#fdeee7] text-[#c44a1c]" : "border-[#cfd6e4] text-[#0B2E6B] hover:bg-[#f2f5fa]")}>
                {isolate ? "إلغاء العزل" : "عزل العضلة"}
              </button>
              <button type="button" onClick={() => st.showAttachmentsOf(selected.id)} className={secondary}>
                المنشأ والمرتكز على العظم
              </button>
              <button type="button" onClick={() => { st.toggleUnit(selected.id); st.select(null); }} className={secondary}>
                إخفاء العضلة
              </button>
              <button type="button" onClick={() => st.setPanel("exercises")} className={cn(secondary, "flex items-center gap-1 border-[#E8602C]/50 text-[#c44a1c]")}>
                <IconDumbbell size={14} /> التمارين
              </button>
            </div>
            <div className="flex items-center gap-2 px-4 pt-2 text-[11px] text-[#6b7891]">
              لون التمييز:
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`لون ${c}`}
                  aria-pressed={highlight.toLowerCase() === c.toLowerCase()}
                  onClick={() => st.setHighlightColor(c)}
                  className={cn("size-4 rounded-full ring-offset-1", highlight.toLowerCase() === c.toLowerCase() && "ring-2 ring-[#0B2E6B]")}
                  style={{ background: c }}
                />
              ))}
            </div>
            {unit ? (
              <dl className="space-y-3 px-4 py-3 text-sm leading-relaxed">
                <div>
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-[#4b5d80]">
                    <span className="size-2 rounded-full" style={{ background: COLORS.origin }} /> المنشأ
                  </dt>
                  <dd>{unit.origin}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-[#4b5d80]">
                    <span className="size-2 rounded-full" style={{ background: COLORS.insertion }} /> المرتكز
                  </dt>
                  <dd>{unit.insertion}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-[#4b5d80]">الوظيفة</dt>
                  <dd>{unit.action}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-[#4b5d80]">التعصيب</dt>
                  <dd>{unit.innervation}</dd>
                </div>
                <Chips title="العضلات المساعدة" list={unit.synergists} />
                <Chips title="العضلات المضادة" list={unit.antagonists} />
                {unit.note && <p className="rounded-lg bg-[#f5f7fb] p-2 text-xs text-[#4b5d80]">{unit.note}</p>}
              </dl>
            ) : (
              <dl className="space-y-3 px-4 py-3 text-sm leading-relaxed">
                {fn && (
                  <div>
                    <dt className="text-[11px] font-semibold text-[#4b5d80]">الوظيفة</dt>
                    <dd>{fn}</dd>
                  </div>
                )}
                {groups.length > 0 && (
                  <div>
                    <dt className="mb-1 text-[11px] font-semibold text-[#4b5d80]">المجموعة العضلية</dt>
                    <dd className="flex flex-wrap gap-1">
                      {groupsOfUnit(selected.id).map((g) => (
                        <span key={g.id} className="rounded-full bg-[#eef2f8] px-2 py-0.5 text-[11px] text-[#4b5d80]">{g.ar}</span>
                      ))}
                    </dd>
                  </div>
                )}
                <p className="rounded-lg bg-[#f5f7fb] p-2 text-xs text-[#4b5d80]">
                  المنشأ والمرتكز لهذه العضلة يُعرضان على العظم من بصمات المصدر (زر «المنشأ والمرتكز على العظم»)، وبيانات المجسّم الأصلي أدناه. البطاقة العربية المفصّلة (التعصيب والعضلات المساعدة والمضادة) مكتوبة حاليًا لعضلات الظهر والكتف.
                </p>
              </dl>
            )}
            <SourceMeta picked={selected} />
          </>
        )}

        {panel === "exercises" && (
          <div className="px-3 py-3">
            {groups.length ? (
              <>
                <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-[#6b7891]">
                  <span>اختيار تمرين يُضيء عضلاته على المجسّم:</span>
                  <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: highlight }} /> أساسية</span>
                  <span className="flex items-center gap-1"><span className="size-2 rounded-full opacity-50" style={{ background: highlight }} /> مساعدة</span>
                </p>
                <ExerciseLibrary
                  key={selected.id}
                  tone="light"
                  scope={groups}
                  showEnglish={showEnglish}
                  onSpotlight={spotlight}
                  onPickGroup={pickGroup}
                  initial={linked ? { open: linked, type: EXERCISE_BY_ID.get(linked)?.type } : undefined}
                />
                <p className="mt-3 px-1 text-[11px] leading-relaxed text-[#6b7891]">
                  محتوى تعليمي عام وليس وصفة تدريب أو علاج.{" "}
                  <Link href={`/exercises?group=${groups[groups.length - 1]}`} className="text-[#173F8A] underline">
                    فتح مكتبة التمارين كاملة
                  </Link>
                </p>
              </>
            ) : (
              <div className="px-1 py-4 text-sm leading-relaxed text-[#4b5d80]">
                <p>لا توجد في المكتبة تمارين مخصّصة لهذه العضلة (مثل عضلات الوجه والبلع والعين).</p>
                <Link href="/exercises" className="mt-2 inline-block text-[#173F8A] underline">
                  تصفّح مكتبة التمارين كاملة
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
