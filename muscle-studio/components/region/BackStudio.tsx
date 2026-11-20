"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DEPTH_NAMES, LAYER_NAMES, REGION_MUSCLE_BY_ID, type RegionLayer } from "@/data/region/backShoulders";
import { COLORS, REGIONS, type RegionUnit } from "@/lib/region/backModel";
import { normalizeSearchText } from "@/lib/anatomy/normalize";
import { EXERCISE_BY_ID } from "@/data/exercises/exercises";
import { spotlightOf, viewOf } from "@/lib/exercises";
import { backStore, useBack, type DepthMode, type PanelMode, type RegionView } from "@/stores/backStore";
import { cn } from "@/components/ui/cn";
import { IconBody, IconDumbbell, IconEye, IconEyeOff, IconReset, IconRotate } from "@/components/ui/icons";
import { regionBridge, type LoadState } from "./BackViewport";
import { MusclePanel } from "./MusclePanel";
import { RegionTestHooks } from "./RegionTestHooks";

const BackViewport = dynamic(() => import("./BackViewport").then((m) => m.BackViewport), { ssr: false });

const NAVY = "#0B2E6B";

const SIDE_AR = { l: "الأيسر", r: "الأيمن", m: "" } as const;

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-[#173F8A]" : "bg-[#cfd6e4]")}
    >
      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", checked ? "start-[18px]" : "start-0.5")} />
    </button>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-b border-[#e3e8f2] px-4 py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#0B2E6B]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MuscleRow({ m }: { m: RegionUnit }) {
  const hidden = useBack((s) => !!s.hiddenUnits[m.id]);
  const selected = useBack((s) => s.selected?.kind === "unit" && s.selected.id === m.id);
  const showEnglish = useBack((s) => s.showEnglish);
  const detailed = REGION_MUSCLE_BY_ID.has(m.id);
  return (
    <li className={cn("flex items-center gap-1 rounded-lg", selected && "bg-[#fdeee7]")}>
      <button
        type="button"
        data-unit-id={m.id}
        aria-pressed={selected}
        onClick={() => (selected ? backStore.getState().select(null) : backStore.getState().selectUnit(m.id))}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-[#f2f5fa]"
      >
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: selected ? COLORS.highlight : "#B9545A" }} />
        <span className="min-w-0">
          <span className={cn("block truncate text-sm", hidden ? "text-[#9aa5b8] line-through" : "text-[#13213d]")}>
            {m.ar}
            {detailed && <span className="ms-1 text-[10px] text-[#c44a1c]" title="بطاقة عربية مفصلة">●</span>}
          </span>
          {showEnglish && <span className="block truncate text-[11px] text-[#6b7891]" dir="ltr">{m.en}</span>}
        </span>
        <span className="ms-auto shrink-0 rounded bg-[#eef2f8] px-1.5 py-0.5 text-[10px] text-[#4b5d80]">{DEPTH_NAMES[m.depth]}</span>
      </button>
      <button
        type="button"
        onClick={() => backStore.getState().toggleUnit(m.id)}
        aria-label={hidden ? `إظهار ${m.ar}` : `إخفاء ${m.ar}`}
        title={hidden ? "إظهار" : "إخفاء"}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-[#4b5d80] hover:bg-[#eef2f8]"
      >
        {hidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
      </button>
    </li>
  );
}

function MuscleList() {
  useBack((s) => s.unitsVersion);
  const region = useBack((s) => s.region);
  const [q, setQ] = useState("");
  const units = [...(regionBridge.model?.units.values() ?? [])];
  const nq = normalizeSearchText(q);
  const match = (u: RegionUnit) => !nq || normalizeSearchText(`${u.ar} ${u.en}`).includes(nq);
  const groups = REGIONS.filter((r) => !region || r.id === region).map((r) => ({
    ...r,
    units: units.filter((u) => u.region === r.id && match(u)).sort((a, b) => a.depth - b.depth || a.ar.localeCompare(b.ar, "ar")),
  }));
  const total = units.length;
  return (
    <Section title={`العضلات (${total} عضلة لكل جانب)`}>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ابحث بالعربية أو الإنجليزية…"
        aria-label="بحث في العضلات"
        className="mb-2 w-full rounded-lg border border-[#cfd6e4] px-3 py-1.5 text-sm outline-none focus:border-[#173F8A]"
      />
      {groups.map((g) =>
        g.units.length ? (
          <details key={g.id} open={!!region || !!nq} className="mb-1">
            <summary className="cursor-pointer rounded-md px-2 py-1 text-[12px] font-semibold text-[#0B2E6B] hover:bg-[#f2f5fa]">
              {g.ar} <span className="font-normal text-[#6b7891]">({g.units.length})</span>
            </summary>
            <ul className="space-y-0.5">{g.units.map((u) => <MuscleRow key={u.id} m={u} />)}</ul>
          </details>
        ) : null,
      )}
    </Section>
  );
}

function RegionPicker() {
  const region = useBack((s) => s.region);
  const sex = useBack((s) => s.sex);
  const st = backStore.getState();
  return (
    <Section title="النموذج والمنطقة">
      <div role="radiogroup" aria-label="الجنس" className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-[#eef2f8] p-1">
        {(["male", "female"] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={sex === v} onClick={() => st.setSex(v)} className={cn("rounded-md py-1.5 text-xs", sex === v ? "bg-white font-semibold text-[#0B2E6B] shadow-sm" : "text-[#4b5d80]")}>
            {v === "male" ? "ذكر" : "أنثى"}
          </button>
        ))}
      </div>
      {sex === "female" && (
        <p className="mb-2 rounded-md bg-[#fff6e5] p-2 text-[11px] leading-relaxed text-[#7a5a12]">
          تقريب: تشريح Z-Anatomy (ذكر) بعد ملاءمته لنِسَب هيكل عظمي أنثوي. لا يوجد مصدر مفتوح لعضلات أنثوية.
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        <button type="button" aria-pressed={!region} onClick={() => st.focusRegion(null)} className={cn("rounded-full border px-2.5 py-1 text-[11px]", !region ? "border-[#0B2E6B] bg-[#0B2E6B] text-white" : "border-[#cfd6e4] text-[#0B2E6B]")}>
          الجسم كاملًا
        </button>
        {REGIONS.map((r) => (
          <button key={r.id} type="button" data-region={r.id} aria-pressed={region === r.id} onClick={() => st.focusRegion(r.id)} className={cn("rounded-full border px-2.5 py-1 text-[11px]", region === r.id ? "border-[#0B2E6B] bg-[#0B2E6B] text-white" : "border-[#cfd6e4] text-[#0B2E6B] hover:bg-[#f2f5fa]")}>
            {r.ar}
          </button>
        ))}
      </div>
    </Section>
  );
}

function LayersPanel() {
  const layers = useBack((s) => s.layers);
  const depthMode = useBack((s) => s.depthMode);
  const st = backStore.getState();
  return (
    <aside
      aria-label="الطبقات التشريحية"
      className="scroll-thin flex shrink-0 flex-col overflow-y-auto border-e border-[#e3e8f2] bg-white text-[#13213d] max-lg:max-h-[42dvh] max-lg:border-t lg:w-[340px]"
    >
      <RegionPicker />
      <Section title="الطبقات">
        <ul className="space-y-2">
          {(Object.keys(LAYER_NAMES) as RegionLayer[]).map((l) => (
            <li key={l} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                {l === "attachments" && (
                  <span className="flex gap-0.5">
                    <span className="size-2.5 rounded-full" style={{ background: COLORS.origin }} />
                    <span className="size-2.5 rounded-full" style={{ background: COLORS.insertion }} />
                  </span>
                )}
                {l === "nerves" && <span className="size-2.5 rounded-full" style={{ background: COLORS.nerve }} />}
                {LAYER_NAMES[l]}
              </span>
              <Toggle checked={layers[l]} onChange={(v) => st.setLayer(l, v)} label={LAYER_NAMES[l]} />
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={st.skeletonOnly} className="rounded-lg border border-[#cfd6e4] px-2 py-1.5 text-xs font-medium text-[#0B2E6B] hover:bg-[#f2f5fa]">
            الهيكل العظمي فقط
          </button>
          <button type="button" onClick={st.showNervesAndTendons} className="rounded-lg border border-[#cfd6e4] px-2 py-1.5 text-xs font-medium text-[#0B2E6B] hover:bg-[#f2f5fa]">
            إظهار الأعصاب والأوتار
          </button>
          <button
            type="button"
            onClick={st.resetAll}
            className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#0B2E6B] px-2 py-2 text-xs font-medium text-white hover:bg-[#173F8A]"
          >
            <IconReset size={14} /> إعادة جميع الطبقات إلى وضعها الأصلي
          </button>
        </div>
      </Section>

      <Section title="العمق">
        <div role="radiogroup" aria-label="العمق" className="grid grid-cols-3 gap-1 rounded-lg bg-[#eef2f8] p-1">
          {(
            [
              ["all", "كل العضلات"],
              ["no-superficial", "بدون السطحية"],
              ["deep", "العميقة فقط"],
            ] as [DepthMode, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={depthMode === v}
              onClick={() => st.setDepthMode(v)}
              className={cn("rounded-md px-1 py-1.5 text-xs", depthMode === v ? "bg-white font-semibold text-[#0B2E6B] shadow-sm" : "text-[#4b5d80]")}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#6b7891]">
          الطبقات محسوبة من الهندسة نفسها: «سطحية» ما يُرى من الخارج، و«متوسطة» ما يظهر بعد إزالتها، والباقي «عميقة».
        </p>
      </Section>

      <MuscleList />
      <div className="px-4 py-4 text-[11px] leading-relaxed text-[#6b7891]">
        المجسمات الأصلية: <a className="underline" href="https://github.com/Z-Anatomy/Models-of-human-anatomy" target="_blank" rel="noreferrer">Z-Anatomy</a>{" "}
        (ملف Blender الأصلي، مبني على BodyParts3D)، مصدّرة دون تعديل الهندسة — رخصة{" "}
        <a className="underline" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        . <Link href="/credits" className="underline">المصادر والترخيص</Link>
      </div>
    </aside>
  );
}

function HoverLabel() {
  const hovered = useBack((s) => s.hovered);
  const showEnglish = useBack((s) => s.showEnglish);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  if (!hovered || !pos) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-40 max-w-xs -translate-x-1/2 rounded-lg bg-[#0B2E6B]/95 px-2.5 py-1.5 text-xs text-white shadow-lg"
      style={{ left: pos.x, top: pos.y + 18 }}
    >
      <div className="font-medium">
        {hovered.ar}
        {hovered.kind !== "unit" && hovered.side !== "m" && <span className="text-white/70"> — {SIDE_AR[hovered.side]}</span>}
      </div>
      {showEnglish && <div className="text-[11px] text-white/70" dir="ltr">{hovered.en}</div>}
    </div>
  );
}

function ViewBar() {
  const autoRotate = useBack((s) => s.autoRotate);
  const bg = useBack((s) => s.background);
  const showEnglish = useBack((s) => s.showEnglish);
  const hd = useBack((s) => s.hd);
  const st = backStore.getState();
  const views: [RegionView, string, string][] = [
    ["back", "خلفي", "1"],
    ["left", "جانبي أيسر", "2"],
    ["right", "جانبي أيمن", "3"],
    ["front", "أمامي", "4"],
    ["closeup", "قريب", "5"],
  ];
  const btn = "rounded-lg px-2.5 py-1.5 text-xs transition-colors";
  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center justify-center gap-1.5">
      <div role="group" aria-label="المنظور" className="flex gap-0.5 rounded-xl bg-white/95 p-1 shadow-lg">
        {views.map(([v, label, key]) => (
          <button key={v} type="button" title={`${label} (${key})`} onClick={() => st.view(v)} className={cn(btn, "text-[#0B2E6B] hover:bg-[#eef2f8]")}>
            {label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={autoRotate}
          onClick={() => st.setAutoRotate(!autoRotate)}
          className={cn(btn, "flex items-center gap-1", autoRotate ? "bg-[#0B2E6B] text-white" : "text-[#0B2E6B] hover:bg-[#eef2f8]")}
        >
          <IconRotate size={14} /> 360°
        </button>
      </div>
      <div className="flex gap-0.5 rounded-xl bg-white/95 p-1 shadow-lg">
        <button type="button" aria-pressed={bg === "navy"} onClick={() => st.setBackground(bg === "black" ? "navy" : "black")} className={cn(btn, "text-[#0B2E6B] hover:bg-[#eef2f8]")}>
          خلفية {bg === "black" ? "كحلية" : "سوداء"}
        </button>
        <button type="button" aria-pressed={showEnglish} onClick={() => st.setShowEnglish(!showEnglish)} className={cn(btn, showEnglish ? "bg-[#0B2E6B] text-white" : "text-[#0B2E6B] hover:bg-[#eef2f8]")}>
          English
        </button>
        <button
          type="button"
          aria-pressed={!!hd}
          title="تفاصيل عالية: أسطح منعّمة للظهر والكتفين، ألياف وأنسجة مفصّلة، إظلال محيطي وظلال"
          onClick={() => st.setHd(!hd)}
          className={cn(btn, hd ? "bg-[#0B2E6B] text-white" : "text-[#0B2E6B] hover:bg-[#eef2f8]")}
        >
          تفاصيل عالية HD
        </button>
      </div>
    </div>
  );
}

export function BackStudio({ initialRegion = null, hd = false }: { initialRegion?: string | null; hd?: boolean }) {
  // The viewer waits for this (hd: null) so the model is prepared once, with the right quality.
  // `?hd=0` / `?hd=1` override the page default (before/after comparison).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("hd");
    backStore.setState({ region: initialRegion, hd: q === null ? hd : q === "1" });
    return () => backStore.setState({ hd: null });
  }, [initialRegion, hd]);
  const [load, setLoad] = useState<LoadState>({ status: "loading", progress: 0 });
  // "Try again" after a failed download: the viewer is mounted anew and loads the model again.
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    setLoad({ status: "loading", progress: 0 });
    setAttempt((n) => n + 1);
  };
  const onState = useCallback((s: LoadState) => setLoad(s), []);
  const isolate = useBack((s) => s.isolate);
  const selected = useBack((s) => s.selected);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      const st = backStore.getState();
      const map: Record<string, RegionView> = { "1": "back", "2": "left", "3": "right", "4": "front", "5": "closeup" };
      if (map[e.key]) st.view(map[e.key]);
      else if (e.key === "Escape") st.select(null);
      else if (e.key.toLowerCase() === "i" && st.selected) st.setIsolate(!st.isolate);
      else if (e.key.toLowerCase() === "f" && st.selected?.kind === "unit") st.focus(st.selected.id, st.selected.side);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useBack((s) => s.unitsVersion);
  const unitCount = regionBridge.model?.units.size ?? 0;

  // Deep link: /atlas?muscle=<unit id>&panel=exercises|details&ex=<exercise id> opens the model on
  // that muscle with its panel (links from the exercise library and shared links).
  const ready = load.status === "ready";
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams(window.location.search);
    const muscle = q.get("muscle");
    if (!muscle || !regionBridge.model?.units.has(muscle)) return;
    const st = backStore.getState();
    st.selectUnit(muscle, q.get("side") === "r" ? "r" : "l");
    const panel = q.get("panel");
    if (panel === "exercises" || panel === "details") st.setPanel(panel as PanelMode);
    const ex = EXERCISE_BY_ID.get(q.get("ex") ?? "");
    if (ex && panel === "exercises") {
      // a linked exercise: its muscles lit, the body turned to the side that shows them
      backStore.setState({ linkedExercise: ex.id, spotlight: spotlightOf(ex) });
      st.view(viewOf(ex));
    }
  }, [ready]);
  // …and the address follows the selection, so the current view can be shared or bookmarked.
  useEffect(() => {
    if (!ready) return;
    return backStore.subscribe((st, prev) => {
      if (st.selected === prev.selected && st.panel === prev.panel) return;
      const url = new URL(window.location.href);
      url.searchParams.delete("ex");
      if (st.selected?.kind === "unit") {
        url.searchParams.set("muscle", st.selected.id);
        if (st.panel === "summary") url.searchParams.delete("panel");
        else url.searchParams.set("panel", st.panel);
      } else {
        url.searchParams.delete("muscle");
        url.searchParams.delete("panel");
      }
      window.history.replaceState(window.history.state, "", url);
    });
  }, [ready]);

  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center gap-4 px-4 text-white" style={{ background: NAVY }}>
        <Link href="/" className="text-sm font-bold tracking-wide">
          MUSCLE STUDIO <span className="text-[#E8602C]">3D</span>
        </Link>
        <span className="hidden h-5 w-px bg-white/25 sm:block" />
        <h1 className="truncate text-sm font-medium">الأطلس التشريحي — مجسمات Z-Anatomy الأصلية للجسم كاملًا</h1>
        <span className="ms-auto hidden text-xs text-white/70 md:block">
          {unitCount || "…"} عضلة مستقلة لكل جانب · عظام · أوتار · أربطة · أعصاب
        </span>
        <Link href="/exercises" className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs hover:bg-white/20 max-md:ms-auto">
          <IconDumbbell size={14} /> مكتبة التمارين
        </Link>
      </header>
      <div className="flex min-h-0 flex-1 max-lg:flex-col-reverse">
        <LayersPanel />
        <main className="relative min-h-0 flex-1 bg-black max-lg:min-h-[58dvh]" data-viewport-wrap="">
          <BackViewport key={attempt} onState={onState} />
          {load.status === "loading" && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="w-64 text-center text-sm text-white/80">
                <p className="mb-2">تحميل النموذج التشريحي…</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full bg-[#E8602C] transition-all" style={{ width: `${Math.round(load.progress * 100)}%` }} />
                </div>
              </div>
            </div>
          )}
          {load.status === "error" && (
            <div role="alert" data-load-error="" className="absolute inset-0 grid place-items-center p-6">
              <div className="max-w-md rounded-2xl bg-white p-5 text-center text-sm text-[#13213d]">
                <p className="mb-1 font-semibold text-[#c44a1c]">تعذّر تحميل النموذج التشريحي</p>
                <p dir="auto" className="text-[#4b5d80]">{load.message}</p>
                <button type="button" data-action="retry-load" onClick={retry} className="mt-3 rounded-lg bg-[#0B2E6B] px-4 py-2 text-sm font-medium text-white hover:bg-[#173F8A]">
                  إعادة المحاولة
                </button>
                <p className="mt-2 text-xs text-[#6b7891]">لا يُعرض أي مجسّم بديل.</p>
              </div>
            </div>
          )}
          {load.status === "ready" && (
            <>
              <MusclePanel />
              <ViewBar />
              {isolate && selected && (
                <div className="absolute start-3 top-3 z-10 flex items-center gap-1 rounded-lg bg-[#E8602C] py-1 pe-1 ps-2.5 text-xs font-medium text-white shadow">
                  عرض معزول: {selected.ar}
                  <button type="button" data-action="exit-isolate" onClick={() => backStore.getState().showFullBody()} className="flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 hover:bg-white/30">
                    <IconBody size={13} /> الجسم كاملًا
                  </button>
                </div>
              )}
              {!selected && (
                <p className="pointer-events-none absolute inset-x-0 top-3 z-0 mx-auto w-fit rounded-full bg-black/45 px-3 py-1 text-[11px] text-white/85">
                  اضغط على أي عضلة لعرض معلوماتها وتمارينها
                </p>
              )}
              <p className="pointer-events-none absolute bottom-16 start-3 z-0 hidden text-[11px] text-white/45 md:block">
                السحب: تدوير · العجلة: تكبير نحو المؤشر · الزر الأيمن: تحريك · 1–4: المناظر · I: عزل · F: تركيز
              </p>
            </>
          )}
          <RegionTestHooks />
        </main>
      </div>
      <HoverLabel />
    </div>
  );
}
