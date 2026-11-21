"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { DEPTH_NAMES, LAYER_NAMES, type RegionLayer } from "@/data/region/backShoulders";
import { EXERCISE_BY_ID } from "@/data/exercises/exercises";
import { spotlightOf, viewOf } from "@/lib/exercises";
import { SELECTION_SWATCHES } from "@/lib/highlight";
import { BRAND_SELECT, currentTheme } from "@/lib/theme";
import { COLORS, REGIONS, type RegionUnit } from "@/lib/region/backModel";
import { normalizeSearchText } from "@/lib/anatomy/normalize";
import { backStore, useBack, type DepthMode, type DockTab, type PanelMode, type RegionView } from "@/stores/backStore";
import { cn } from "@/components/ui/cn";
import { IconBody, IconDumbbell, IconEye, IconEyeOff, IconLayers, IconList, IconMinus, IconPlus, IconReset, IconRotate, IconSearch, IconSettings, IconX } from "@/components/ui/icons";
import { regionBridge, type LoadState } from "./BackViewport";
import { MusclePanel } from "./MusclePanel";
import { RegionTestHooks } from "./RegionTestHooks";
import { REGION_SHORT, isDesktopNow, useCover, useIsDesktop } from "./studioUi";

const BackViewport = dynamic(() => import("./BackViewport").then((m) => m.BackViewport), { ssr: false });

const REGION_AR = Object.fromEntries(REGIONS.map((r) => [r.id, r.ar]));
const SIDE_AR = { l: "الأيسر", r: "الأيمن", m: "" } as const;
/** Floating surface over the 3D view. */
const GLASS = "border border-ink/10 bg-surface/85 shadow-[0_8px_30px_var(--st-shadow)] backdrop-blur-xl";

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-select" : "bg-ink/15")}
    >
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "start-[22px]" : "start-0.5")} />
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange, label, className }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-1 rounded-xl bg-ink/6 p-1", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cn("rounded-lg px-2 py-1.5 text-xs transition-colors", value === v ? "bg-pick font-semibold text-pick-fg" : "text-muted hover:text-fg")}>
          {text}
        </button>
      ))}
    </div>
  );
}

/* ───────────── dock: body regions ───────────── */

function RegionGrid() {
  const region = useBack((s) => s.region);
  const st = backStore.getState();
  const pick = (r: string | null) => {
    st.focusRegion(r);
    if (!isDesktopNow()) st.setDock(null); // the phone sheet gives the view back
  };
  const tile = (on: boolean) =>
    cn("flex h-12 items-center justify-center rounded-xl border px-2 text-center text-[13px] leading-tight transition-colors", on ? "border-select bg-select font-medium text-white" : "border-ink/10 bg-ink/4 text-fg hover:bg-ink/9");
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      <button type="button" aria-pressed={!region} onClick={() => pick(null)} className={cn(tile(!region), "col-span-2 gap-1.5")}>
        <IconBody size={16} /> الجسم كاملا
      </button>
      {REGIONS.map((r) => (
        <button key={r.id} type="button" data-region={r.id} title={r.ar} aria-pressed={region === r.id} onClick={() => pick(r.id)} className={tile(region === r.id)}>
          {REGION_SHORT[r.id] ?? r.ar}
        </button>
      ))}
    </div>
  );
}

/* ───────────── dock: anatomical layers ───────────── */

const LAYER_DOT: Record<RegionLayer, string> = {
  muscles: "#B24E41",
  tendons: "#DDCDA9",
  bones: "#D9C9A0",
  fasciae: "#9FA6AE",
  attachments: COLORS.origin,
  nerves: COLORS.nerve,
};

function LayersPanel() {
  const layers = useBack((s) => s.layers);
  const depthMode = useBack((s) => s.depthMode);
  const st = backStore.getState();
  const quick = "h-10 rounded-xl border border-ink/10 px-2 text-xs text-fg transition-colors hover:bg-ink/8";
  return (
    <div className="space-y-4 p-3">
      <ul className="overflow-hidden rounded-xl border border-ink/10">
        {(Object.keys(LAYER_NAMES) as RegionLayer[]).map((l, i) => (
          <li key={l} className={cn("flex min-h-12 items-center gap-3 px-3", i > 0 && "border-t border-ink/10")}>
            <span className="flex w-5 shrink-0 justify-center gap-0.5">
              <span className="size-2.5 rounded-full" style={{ background: LAYER_DOT[l] }} />
              {l === "attachments" && <span className="size-2.5 rounded-full" style={{ background: COLORS.insertion }} />}
            </span>
            <span className="min-w-0 flex-1 text-sm">{LAYER_NAMES[l]}</span>
            <Switch checked={layers[l]} onChange={(v) => st.setLayer(l, v)} label={LAYER_NAMES[l]} />
          </li>
        ))}
      </ul>
      <div>
        <h3 className="mb-1.5 px-1 text-xs font-medium text-muted">عمق العضلات</h3>
        <Segmented<DepthMode>
          label="العمق"
          value={depthMode}
          onChange={st.setDepthMode}
          options={[
            ["all", "الكل"],
            ["no-superficial", "بدون السطحية"],
            ["deep", "العميقة فقط"],
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-label="الهيكل العظمي فقط" onClick={st.skeletonOnly} className={quick}>
          الهيكل العظمي
        </button>
        <button type="button" aria-label="إظهار الأعصاب والأوتار" onClick={st.showNervesAndTendons} className={quick}>
          الأعصاب والأوتار
        </button>
        <button type="button" aria-label="إعادة جميع الطبقات إلى وضعها الأصلي" onClick={st.resetAll} className={cn(quick, "col-span-2 flex items-center justify-center gap-1.5 bg-ink/6")}>
          <IconReset size={14} /> إعادة الضبط
        </button>
      </div>
    </div>
  );
}

/* ───────────── dock: muscle list ───────────── */

function MuscleRow({ m }: { m: RegionUnit }) {
  const hidden = useBack((s) => !!s.hiddenUnits[m.id]);
  const selected = useBack((s) => s.selected?.kind === "unit" && s.selected.id === m.id);
  const showEnglish = useBack((s) => s.showEnglish);
  const highlight = useBack((s) => s.highlightColor);
  return (
    <li className={cn("flex items-center rounded-xl", selected && "bg-ink/8")}>
      <button
        type="button"
        data-unit-id={m.id}
        aria-pressed={selected}
        onClick={() => (selected ? backStore.getState().select(null) : backStore.getState().selectUnit(m.id))}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-start hover:bg-ink/5"
      >
        <span className="size-2 shrink-0 rounded-full" style={{ background: selected ? highlight : "var(--color-line-strong)" }} />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm", hidden ? "text-muted line-through" : "text-fg")}>{m.ar}</span>
          {showEnglish && (
            <span className="block truncate text-end text-[11px] text-muted" dir="ltr">
              {m.en}
            </span>
          )}
        </span>
        <span className="shrink-0 text-[10px] text-muted">{DEPTH_NAMES[m.depth]}</span>
      </button>
      <button type="button" onClick={() => backStore.getState().toggleUnit(m.id)} aria-label={hidden ? `إظهار ${m.ar}` : `إخفاء ${m.ar}`} title={hidden ? "إظهار" : "إخفاء"} className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-ink/8 hover:text-fg">
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
  const shown = groups.reduce((n, g) => n + g.units.length, 0);
  return (
    <div className="p-3">
      <label className="relative mb-2 block">
        <span className="sr-only">بحث في العضلات</span>
        <IconSearch size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث عن عضلة…"
          aria-label="بحث في العضلات"
          className="h-10 w-full rounded-xl border border-ink/10 bg-ink/5 pe-3 ps-9 text-sm text-fg outline-none placeholder:text-muted focus:border-ink/30"
        />
      </label>
      {groups.map((g) =>
        g.units.length ? (
          <details key={g.id} open={!!region || !!nq} className="group mb-1">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-medium text-fg hover:bg-ink/5">
              <span>
                {REGION_SHORT[g.id] ?? g.ar} <span className="font-normal text-muted">({g.units.length})</span>
              </span>
              <span aria-hidden className="text-muted transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <ul>
              {g.units.map((u) => (
                <MuscleRow key={u.id} m={u} />
              ))}
            </ul>
          </details>
        ) : null,
      )}
      {!shown && <p className="px-2 py-6 text-center text-sm text-muted">{units.length ? "لا توجد عضلة بهذا الاسم." : "…"}</p>}
    </div>
  );
}

/* ───────────── dock ───────────── */

const TABS: { id: DockTab; label: string; icon: ReactNode }[] = [
  { id: "regions", label: "المناطق", icon: <IconBody size={18} /> },
  { id: "layers", label: "الطبقات", icon: <IconLayers size={18} /> },
  { id: "muscles", label: "العضلات", icon: <IconList size={18} /> },
];

/**
 * The control groups — body regions, anatomical layers, muscle list — one at a
 * time. Desktop: a column beside the 3D view. Phone: a bar at the bottom whose
 * buttons open a sheet over the lower part of the view (and close it again).
 */
function Dock() {
  const dock = useBack((s) => s.dock);
  const desktop = useIsDesktop();
  const active: DockTab | null = desktop ? (dock ?? "regions") : dock;
  const sheet = useRef<HTMLDivElement>(null);
  useCover(sheet, "dock", "bottom", !desktop && !!dock, dock ?? "");
  const st = backStore.getState();
  return (
    <aside aria-label="أدوات الأطلس" className="z-20 flex shrink-0 bg-chrome max-lg:border-t max-lg:border-ink/10 max-lg:pb-[env(safe-area-inset-bottom)] lg:w-[320px] lg:flex-col lg:border-e lg:border-ink/10">
      <div role="tablist" aria-label="مجموعات التحكم" className="grid w-full shrink-0 grid-cols-3 gap-1 max-lg:h-14 max-lg:px-2 lg:border-b lg:border-ink/10 lg:p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            data-dock-tab={t.id}
            aria-selected={active === t.id}
            onClick={() => st.setDock(desktop ? t.id : dock === t.id ? null : t.id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl text-xs transition-colors max-lg:flex-col max-lg:gap-0.5 lg:h-10",
              active === t.id ? "bg-ink/10 font-medium text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div
        ref={sheet}
        data-dock-sheet=""
        className={cn(
          "scroll-thin min-h-0 overflow-y-auto overscroll-contain lg:flex-1",
          "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-lg:z-20 max-lg:max-h-[50dvh] max-lg:rounded-t-2xl max-lg:border-t max-lg:border-ink/10 max-lg:bg-surface/95 max-lg:shadow-[0_-12px_40px_var(--st-shadow)] max-lg:backdrop-blur-xl",
          !active && "max-lg:hidden",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-surface/95 px-4 pb-1 pt-3 lg:hidden">
          <h2 className="text-sm font-semibold">{TABS.find((t) => t.id === active)?.label}</h2>
          <button type="button" aria-label="إغلاق" onClick={() => st.setDock(null)} className="grid size-9 place-items-center rounded-xl text-muted hover:bg-ink/8 hover:text-fg">
            <IconX size={17} />
          </button>
        </div>
        {/* all three stay mounted (the muscle list keeps its search and scroll) */}
        <div hidden={active !== "regions"}>
          <RegionGrid />
        </div>
        <div hidden={active !== "layers"}>
          <LayersPanel />
        </div>
        <div hidden={active !== "muscles"}>
          <MuscleList />
        </div>
      </div>
      <p className="hidden shrink-0 border-t border-ink/10 px-4 py-2.5 text-[11px] text-muted lg:block">
        المجسم: Z-Anatomy · CC BY-SA 4.0 ·{" "}
        <Link href="/credits" className="underline hover:text-fg">
          المصادر
        </Link>
      </p>
    </aside>
  );
}

/* ───────────── top bar ───────────── */

function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const showEnglish = useBack((s) => s.showEnglish);
  const hd = useBack((s) => s.hd);
  const bg = useBack((s) => s.background);
  const highlight = useBack((s) => s.highlightColor);
  const st = backStore.getState();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  const row = "flex min-h-11 items-center justify-between gap-3 text-sm";
  return (
    <div ref={box} className="relative">
      <button type="button" aria-label="الإعدادات" aria-expanded={open} title="الإعدادات" onClick={() => setOpen(!open)} className={cn("grid size-9 place-items-center rounded-xl transition-colors", open ? "bg-ink/12 text-fg" : "text-muted hover:bg-ink/8 hover:text-fg")}>
        <IconSettings size={18} />
      </button>
      {open && (
        <div role="dialog" aria-label="الإعدادات" className={cn(GLASS, "absolute end-0 top-11 z-40 w-64 rounded-2xl p-3")}>
          <div className={row}>
            الأسماء بالإنجليزية
            <Switch checked={showEnglish} onChange={st.setShowEnglish} label="الأسماء بالإنجليزية" />
          </div>
          <div className={row}>
            تفاصيل عالية (HD)
            <Switch checked={!!hd} onChange={st.setHd} label="تفاصيل عالية HD" />
          </div>
          <div className={row}>
            خلفية كحلية
            <Switch checked={bg === "navy"} onChange={(v) => st.setBackground(v ? "navy" : currentTheme() === "zahraafit" ? "cream" : "black")} label="خلفية كحلية" />
          </div>
          <div className={cn(row, "border-t border-ink/10")}>
            لون التحديد
            <span className="flex items-center gap-1.5">
              {(currentTheme() === "zahraafit" ? [BRAND_SELECT, ...SELECTION_SWATCHES.slice(0, 4)] : SELECTION_SWATCHES).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`لون ${c}`}
                  aria-pressed={highlight.toLowerCase() === c.toLowerCase()}
                  onClick={() => st.setHighlightColor(c)}
                  className={cn("size-6 rounded-full ring-offset-2 ring-offset-surface", highlight.toLowerCase() === c.toLowerCase() && "ring-2 ring-ink")}
                  style={{ background: c }}
                />
              ))}
            </span>
          </div>
          <Link href="/credits" className="mt-1 block border-t border-ink/10 pt-2.5 text-xs text-muted hover:text-fg">
            المصادر والترخيص
          </Link>
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const sex = useBack((s) => s.sex);
  return (
    <header className="relative z-40 flex h-12 shrink-0 items-center gap-2 border-b border-ink/10 bg-chrome px-3 sm:gap-3 sm:px-4">
      <Link href="/" dir="ltr" className="flex h-9 shrink-0 items-center gap-1 text-[13px] font-bold tracking-wide">
        MUSCLE STUDIO <span className="text-accent">3D</span>
      </Link>
      <h1 className="hidden truncate text-sm text-muted md:block">الأطلس التشريحي</h1>
      <div role="radiogroup" aria-label="الجنس" className="ms-auto grid grid-cols-2 gap-0.5 rounded-xl bg-ink/6 p-0.5">
        {(["male", "female"] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={sex === v} data-sex={v} onClick={() => sex !== v && backStore.getState().setSex(v)} className={cn("h-8 rounded-[10px] px-3.5 text-xs transition-colors", sex === v ? "bg-pick font-semibold text-pick-fg" : "text-muted hover:text-fg")}>
            {v === "male" ? "ذكر" : "أنثى"}
          </button>
        ))}
      </div>
      <Link href="/exercises" aria-label="مكتبة التمارين" title="مكتبة التمارين" className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs text-muted transition-colors hover:bg-ink/8 hover:text-fg">
        <IconDumbbell size={17} /> <span className="hidden sm:inline">التمارين</span>
      </Link>
      <SettingsMenu />
    </header>
  );
}

/* ───────────── view controls ───────────── */

function ViewControls() {
  const autoRotate = useBack((s) => s.autoRotate);
  const st = backStore.getState();
  const views: [RegionView, string, string, boolean][] = [
    ["front", "أمامي", "4", false],
    ["back", "خلفي", "1", false],
    ["right", "أيمن", "3", false],
    ["left", "أيسر", "2", false],
    ["closeup", "قريب", "5", true],
  ];
  const btn = "flex h-9 items-center justify-center rounded-xl px-2.5 text-xs text-fg transition-colors hover:bg-ink/10";
  const sep = <span aria-hidden className="mx-0.5 h-5 w-px bg-ink/12" />;
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-3 z-10 flex justify-center">
      <div className={cn(GLASS, "pointer-events-auto flex items-center gap-0.5 rounded-2xl p-1")}>
        <div role="group" aria-label="المنظور" className="flex gap-0.5">
          {views.map(([v, label, key, wideOnly]) => (
            <button key={v} type="button" data-view={v} title={`${label} (${key})`} onClick={() => st.view(v)} className={cn(btn, wideOnly && "max-sm:hidden")}>
              {label}
            </button>
          ))}
        </div>
        {sep}
        <button type="button" aria-pressed={autoRotate} aria-label="دوران 360°" title="دوران 360°" onClick={() => st.setAutoRotate(!autoRotate)} className={cn(btn, "gap-1", autoRotate && "bg-select hover:bg-select-hover")}>
          <IconRotate size={15} /> <span className="max-sm:hidden">360°</span>
        </button>
        {sep}
        <button type="button" data-action="zoom-out" aria-label="تصغير" title="تصغير" onClick={() => st.zoom(-1)} className={cn(btn, "w-9 px-0")}>
          <IconMinus size={16} />
        </button>
        <button type="button" data-action="zoom-in" aria-label="تكبير" title="تكبير" onClick={() => st.zoom(1)} className={cn(btn, "w-9 px-0")}>
          <IconPlus size={16} />
        </button>
      </div>
    </div>
  );
}

function HoverLabel() {
  const hovered = useBack((s) => s.hovered);
  const showEnglish = useBack((s) => s.showEnglish);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const onMove = (e: PointerEvent) => e.pointerType === "mouse" && setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  if (!hovered || !pos) return null;
  return (
    <div role="tooltip" className={cn(GLASS, "pointer-events-none fixed z-40 max-w-xs -translate-x-1/2 rounded-xl px-2.5 py-1.5 text-xs text-fg")} style={{ left: pos.x, top: pos.y + 18 }}>
      <div className="font-medium">
        {hovered.ar}
        {hovered.kind !== "unit" && hovered.side !== "m" && <span className="text-muted"> — {SIDE_AR[hovered.side]}</span>}
      </div>
      {showEnglish && (
        <div className="text-[11px] text-muted" dir="ltr">
          {hovered.en}
        </div>
      )}
    </div>
  );
}

/* ───────────── page ───────────── */

export function BackStudio({ initialRegion = null, hd = false }: { initialRegion?: string | null; hd?: boolean }) {
  // The viewer waits for this (hd: null) so the model is prepared once, with the right quality.
  // `?hd=0` / `?hd=1` override the page default (before/after comparison).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("hd");
    // ZahraaFit theme (?theme=zahraafit): a cream backdrop behind the model, the brand's selection colour
    const themed = currentTheme() === "zahraafit" ? ({ background: "cream", highlightColor: BRAND_SELECT } as const) : {};
    backStore.setState({ region: initialRegion, hd: q === null ? hd : q === "1", ...themed });
    return () => backStore.setState({ hd: null });
  }, [initialRegion, hd]);
  const [load, setLoad] = useState<LoadState>({ status: "loading", progress: 0 });
  // The first load covers the view; later ones (switching body) keep the model on screen.
  const [shownOnce, setShownOnce] = useState(false);
  const onState = useCallback((s: LoadState) => {
    setLoad(s);
    if (s.status === "ready") setShownOnce(true);
  }, []);
  // "Try again" after a failed download: the viewer is mounted anew and loads the model again.
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    setLoad({ status: "loading", progress: 0 });
    setShownOnce(false);
    setAttempt((n) => n + 1);
  };
  const isolate = useBack((s) => s.isolate);
  const selected = useBack((s) => s.selected);
  const region = useBack((s) => s.region);
  const [picked, setPicked] = useState(false); // the "tap a muscle" hint leaves after the first selection
  useEffect(() => backStore.subscribe((st) => st.selected && setPicked(true)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      const st = backStore.getState();
      const map: Record<string, RegionView> = { "1": "back", "2": "left", "3": "right", "4": "front", "5": "closeup" };
      if (map[e.key]) st.view(map[e.key]);
      else if (e.key === "Escape") st.select(null);
      else if (e.key === "+" || e.key === "=") st.zoom(1);
      else if (e.key === "-") st.zoom(-1);
      else if (e.key.toLowerCase() === "i" && st.selected) st.setIsolate(!st.isolate);
      else if (e.key.toLowerCase() === "f" && st.selected?.kind === "unit") st.focus(st.selected.id, st.selected.side);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // On a phone a newly picked structure takes the place of an open control sheet.
  useEffect(
    () =>
      backStore.subscribe((st, prev) => {
        if (st.selected && st.selected !== prev.selected && st.dock && !isDesktopNow()) st.setDock(null);
      }),
    [],
  );

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
    <div className="flex h-dvh flex-col overflow-hidden bg-stage text-fg">
      <TopBar />
      <div className="flex min-h-0 flex-1 max-lg:flex-col-reverse">
        <Dock />
        <main className="relative min-h-0 flex-1 bg-stage" data-viewport-wrap="">
          <BackViewport key={attempt} onState={onState} />
          {load.status === "loading" && !shownOnce && (
            <div className="absolute inset-0 grid place-items-center bg-stage">
              <div className="w-56 text-center text-sm text-muted">
                <p className="mb-3">تحميل المجسم…</p>
                <div className="h-1 overflow-hidden rounded-full bg-ink/10">
                  <div className="h-full rounded-full bg-select transition-all" style={{ width: `${Math.round(load.progress * 100)}%` }} />
                </div>
              </div>
            </div>
          )}
          {load.status === "loading" && shownOnce && (
            <div role="status" className={cn(GLASS, "absolute inset-x-0 top-3 z-10 mx-auto flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs text-fg")}>
              <span className="size-3 animate-spin rounded-full border-2 border-ink/25 border-t-ink" />
              جار التحميل… {Math.round(load.progress * 100)}%
            </div>
          )}
          {load.status === "error" && (
            <div role="alert" data-load-error="" className="absolute inset-0 z-20 grid place-items-center bg-stage/80 p-6">
              <div className={cn(GLASS, "max-w-sm rounded-2xl p-5 text-center text-sm")}>
                <p className="mb-1 font-semibold">تعذر تحميل النموذج التشريحي</p>
                <p dir="auto" className="text-muted">
                  {load.message}
                </p>
                <button type="button" data-action="retry-load" onClick={retry} className="mt-4 h-10 rounded-xl bg-select px-5 text-sm font-medium text-white hover:bg-select-hover">
                  إعادة المحاولة
                </button>
              </div>
            </div>
          )}
          {shownOnce && load.status !== "error" && (
            <>
              <MusclePanel />
              <ViewControls />
              {isolate && selected && (
                <div className={cn(GLASS, "absolute start-3 top-3 z-10 flex items-center gap-2 rounded-full py-1 pe-1 ps-3 text-xs")}>
                  <span className="size-2 rounded-full bg-select" />
                  معزولة: {selected.ar}
                  <button type="button" data-action="exit-isolate" onClick={() => backStore.getState().showFullBody()} className="flex h-7 items-center gap-1 rounded-full bg-ink/10 px-2.5 hover:bg-ink/18">
                    <IconBody size={13} /> الجسم كاملا
                  </button>
                </div>
              )}
              {!isolate && region && !selected && (
                <div className={cn(GLASS, "absolute start-3 top-3 z-10 flex items-center gap-2 rounded-full py-1 pe-1 ps-3 text-xs")}>
                  {REGION_SHORT[region] ?? REGION_AR[region]}
                  <button type="button" aria-label="عرض الجسم كاملا" onClick={() => backStore.getState().focusRegion(null)} className="grid size-7 place-items-center rounded-full bg-ink/10 hover:bg-ink/18">
                    <IconX size={13} />
                  </button>
                </div>
              )}
              {!picked && !selected && !region && (
                <p className={cn(GLASS, "pointer-events-none absolute inset-x-0 top-3 z-0 mx-auto w-fit rounded-full px-3.5 py-1.5 text-xs text-ink/85")}>اضغط على أي عضلة لعرض معلوماتها وتمارينها</p>
              )}
            </>
          )}
          <RegionTestHooks />
        </main>
      </div>
      <HoverLabel />
    </div>
  );
}
