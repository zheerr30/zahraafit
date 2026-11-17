"use client";

import { forwardRef, useMemo, useState } from "react";
import { MUSCLES, REGION_DEFINITIONS, getMuscle } from "@/data/muscles/muscles";
import { searchMuscles } from "@/lib/anatomy/search";
import type { MuscleSelection } from "@/lib/storage/schema";
import { highlightColor } from "@/lib/three/anatomyModel";
import { useAssetStore } from "@/stores/assetStore";
import { useEditor } from "@/stores/editorStore";
import type { MuscleDefinition, RegionId } from "@/types/anatomy";
import { cn } from "@/components/ui/cn";
import { IconChevron, IconSearch, IconX } from "@/components/ui/icons";

export const MuscleSearchInput = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (v: string) => void; className?: string }
>(function MuscleSearchInput({ value, onChange, className }, ref) {
  return (
    <div className={cn("relative", className)}>
      <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search muscles · ابحث عن عضلة"
        aria-label="Search muscles in English or Arabic"
        className="h-9 w-full rounded-lg border border-line bg-panel-2 pl-9 pr-8 text-sm text-fg placeholder:text-muted/70 focus:border-accent/60 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg"
        >
          <IconX size={14} />
        </button>
      )}
    </div>
  );
});

function MuscleRow({
  muscle,
  selection,
  color,
  missing,
}: {
  muscle: MuscleDefinition;
  selection: MuscleSelection | undefined;
  color: string | null;
  missing: boolean;
}) {
  const toggle = useEditor((s) => s.toggleMuscle);
  const setHovered = useEditor((s) => s.setHovered);
  const hovered = useEditor((s) => s.hoveredMuscleId === muscle.id);
  return (
    <button
      type="button"
      aria-pressed={Boolean(selection)}
      onClick={() => toggle(muscle.id)}
      onMouseEnter={() => setHovered(muscle.id)}
      onMouseLeave={() => setHovered(null)}
      onFocus={() => setHovered(muscle.id)}
      onBlur={() => setHovered(null)}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        selection ? "bg-panel-3" : hovered ? "bg-panel-2" : "hover:bg-panel-2",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-3.5 w-3.5 shrink-0 rounded-full border",
          selection ? "border-transparent" : "border-line-strong",
        )}
        style={selection && color ? { backgroundColor: color } : undefined}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cn("truncate text-sm", selection ? "text-fg" : "text-fg/90")}>
            {muscle.displayName.en}
          </span>
          {muscle.depth === "deep" && (
            <span className="rounded bg-panel-3 px-1 text-[10px] uppercase tracking-wide text-muted">deep</span>
          )}
        </span>
        <span dir="rtl" className="block truncate text-right text-xs text-muted">
          {muscle.displayName.ar}
        </span>
      </span>
      {missing && (
        <span
          className="shrink-0 rounded border border-warn/40 px-1 text-[10px] text-warn"
          title="The loaded model has no mesh mapped to this muscle"
        >
          not in model
        </span>
      )}
      {selection && (
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted">
          {selection.tone === "primary" ? "P" : "S"}
        </span>
      )}
    </button>
  );
}

function SelectedList() {
  const selections = useEditor((s) => s.doc.selections);
  const palette = useEditor((s) => s.doc.palette);
  const setTone = useEditor((s) => s.setMuscleTone);
  const setColor = useEditor((s) => s.setMuscleColor);
  const deselect = useEditor((s) => s.deselectMuscle);
  const clear = useEditor((s) => s.clearSelection);
  const ids = Object.keys(selections);
  if (!ids.length) {
    return (
      <p className="px-4 py-3 text-xs leading-relaxed text-muted">
        Nothing selected. Click a muscle in the 3D view or in the list below. Clicking again removes it.
      </p>
    );
  }
  return (
    <div className="px-2 pb-2">
      <div className="flex items-center justify-between px-2 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          Selected · {ids.length}
        </span>
        <button
          type="button"
          onClick={clear}
          className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-panel-2 hover:text-fg"
          title="Reset all selected muscles to the default material"
        >
          Reset all
        </button>
      </div>
      <ul className="space-y-1">
        {ids.map((id) => {
          const m = getMuscle(id);
          const sel = selections[id];
          if (!m) return null;
          const color = highlightColor(id, { selections, palette }) ?? palette.primary;
          return (
            <li key={id} className="flex items-center gap-2 rounded-lg bg-panel-2 px-2 py-1.5">
              <input
                type="color"
                value={color.toLowerCase()}
                onChange={(e) => setColor(id, e.target.value.toUpperCase())}
                aria-label={`Custom color for ${m.displayName.en}`}
                title="Custom color for this muscle only"
                className="h-6 w-7 shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-xs text-fg">{m.displayName.en}</span>
              {sel.color && (
                <button
                  type="button"
                  onClick={() => setColor(id, null)}
                  className="text-[10px] text-muted hover:text-fg"
                  title="Use the tone color again"
                >
                  auto
                </button>
              )}
              <div role="radiogroup" aria-label={`Tone for ${m.displayName.en}`} className="flex rounded-md border border-line">
                {(["primary", "secondary"] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    role="radio"
                    aria-checked={sel.tone === tone}
                    onClick={() => setTone(id, tone)}
                    title={tone === "primary" ? "Primary highlight" : "Secondary highlight"}
                    className={cn(
                      "h-6 w-6 text-[10px] font-semibold",
                      sel.tone === tone ? "bg-panel-3 text-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    {tone === "primary" ? "P" : "S"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => deselect(id)}
                aria-label={`Deselect ${m.displayName.en}`}
                className="rounded p-1 text-muted hover:text-fg"
              >
                <IconX size={13} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RegionGroup({ region, muscles, missing }: { region: RegionId; muscles: MuscleDefinition[]; missing: Set<string> | null }) {
  const [open, setOpen] = useState(true);
  const def = REGION_DEFINITIONS.find((r) => r.id === region)!;
  const selections = useEditor((s) => s.doc.selections);
  const palette = useEditor((s) => s.doc.palette);
  const paintTone = useEditor((s) => s.paintTone);
  const toggleRegion = useEditor((s) => s.toggleRegion);
  const count = muscles.filter((m) => selections[m.id]).length;
  const allSelected = muscles.every((m) => selections[m.id]?.tone === paintTone);

  return (
    <section className="border-b border-line/70 py-1">
      <div className="flex items-center gap-1 px-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 rounded-md px-1.5 py-2 text-left hover:bg-panel-2"
        >
          <IconChevron size={14} className={cn("text-muted transition-transform", open && "rotate-90")} />
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-fg">{def.displayName.en}</span>
          <span dir="rtl" className="text-xs text-muted">
            {def.displayName.ar}
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted">
            {count}/{muscles.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => toggleRegion(region)}
          className="rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:border-line-strong hover:text-fg"
          title={allSelected ? `Deselect all ${def.displayName.en}` : `Select all ${def.displayName.en} (${paintTone})`}
        >
          {allSelected ? "Clear" : "All"}
        </button>
      </div>
      {open && (
        <div className="space-y-0.5 px-2 pb-2">
          {muscles.map((m) => (
            <MuscleRow
              key={m.id}
              muscle={m}
              selection={selections[m.id]}
              color={highlightColor(m.id, { selections, palette })}
              missing={missing?.has(m.id) ?? false}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export const MuscleSelector = forwardRef<HTMLInputElement>(function MuscleSelector(_props, searchRef) {
  const [query, setQuery] = useState("");
  const selections = useEditor((s) => s.doc.selections);
  const palette = useEditor((s) => s.doc.palette);
  const summary = useAssetStore((s) => s.summary);
  const missing = useMemo(() => (summary ? new Set(summary.missingMuscleIds) : null), [summary]);
  const results = useMemo(() => (query.trim() ? searchMuscles(MUSCLES, query) : null), [query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-3">
        <MuscleSearchInput ref={searchRef} value={query} onChange={setQuery} />
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-line">
          <SelectedList />
        </div>
        {results ? (
          <div className="space-y-0.5 p-2" aria-live="polite">
            <p className="px-2 py-1 text-xs text-muted">
              {results.length} result{results.length === 1 ? "" : "s"}
            </p>
            {results.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted">No muscle matches “{query}”.</p>
            )}
            {results.map((m) => (
              <MuscleRow
                key={m.id}
                muscle={m}
                selection={selections[m.id]}
                color={highlightColor(m.id, { selections, palette })}
                missing={missing?.has(m.id) ?? false}
              />
            ))}
          </div>
        ) : (
          REGION_DEFINITIONS.map((r) => (
            <RegionGroup
              key={r.id}
              region={r.id}
              muscles={MUSCLES.filter((m) => m.region === r.id)}
              missing={missing}
            />
          ))
        )}
      </div>
    </div>
  );
});
