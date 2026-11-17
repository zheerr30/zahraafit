"use client";

import Link from "next/link";
import { getMuscle } from "@/data/muscles/muscles";
import type { ActiveAsset } from "@/hooks/useActiveAsset";
import { useLocalModelFile } from "@/hooks/useLocalModelFile";
import { highlightColor } from "@/lib/three/anatomyModel";
import { useAssetStore } from "@/stores/assetStore";
import { useEditor } from "@/stores/editorStore";
import { Button } from "@/components/ui/Button";
import { IconUpload, IconWarning } from "@/components/ui/icons";

/** Shown instead of a fake model when no anatomical GLB is installed. */
export function AssetSetupState({ active }: { active: Extract<ActiveAsset, { status: "missing" }> }) {
  const setMode = useEditor((s) => s.setAssetMode);
  const testRigAvailable = useAssetStore((s) => s.availability["pipeline-test-rig"]);
  const { open } = useLocalModelFile();
  const genderLabel = active.gender === "male" ? "male" : "female";

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto p-4 sm:p-8">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-panel/95 p-6 shadow-2xl backdrop-blur">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-warn/30 bg-warn/10 text-warn">
            <IconWarning size={20} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-warn">Asset setup required</p>
            <h2 className="text-lg font-semibold">
              {active.testRig ? "Pipeline test rig not found" : `No ${genderLabel} anatomical model installed`}
            </h2>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          MUSCLE STUDIO 3D does not ship an anatomical model and never substitutes a generic mannequin.
          Add a licensed GLB with one separately named mesh per muscle at:
        </p>
        <ul className="mt-3 space-y-1.5">
          {active.expected.map((a) => (
            <li key={a.id} className="rounded-lg border border-line bg-panel-2 px-3 py-2">
              <code className="break-all font-mono text-xs text-fg">public{a.url}</code>
              <span className="mt-0.5 block text-[11px] text-muted">
                {a.label}
                {a.views.length < 4 ? ` · optional, ${a.views.join("/")} view only` : ""}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" onClick={open}>
            <IconUpload size={16} /> Load a GLB from this computer
          </Button>
          {!active.testRig && testRigAvailable && (
            <Button onClick={() => setMode("test-rig")}>Use pipeline test rig</Button>
          )}
          <Link
            href="/setup"
            className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm text-muted hover:bg-panel-2 hover:text-fg"
          >
            Setup guide
          </Link>
        </div>
        {!active.testRig && testRigAvailable && (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            The pipeline test rig is a geometric, non-anatomical stand-in with one mesh per muscle. Use it only
            to try selection, colors and export while you source real assets.
          </p>
        )}
      </div>
    </div>
  );
}

export function LoadingOverlay() {
  const status = useAssetStore((s) => s.loadStatus);
  const progress = useAssetStore((s) => s.progress);
  if (status !== "loading") return null;
  const pct = Math.round(progress * 100);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" role="status">
      <div className="w-64 rounded-xl border border-line bg-panel/95 p-4 text-center shadow-xl">
        <p className="text-sm text-fg">Loading anatomical model…</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel-3">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${pct > 0 ? pct : 12}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-xs text-muted">{pct > 0 ? `${pct}%` : "connecting"}</p>
      </div>
    </div>
  );
}

export function LoadErrorOverlay() {
  const status = useAssetStore((s) => s.loadStatus);
  const error = useAssetStore((s) => s.error);
  const reload = useAssetStore((s) => s.reload);
  const { open } = useLocalModelFile();
  if (status !== "error") return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-6" role="alert">
      <div className="max-w-md rounded-2xl border border-line bg-panel p-6 text-center">
        <IconWarning className="mx-auto mb-3 text-danger" size={26} />
        <h2 className="text-base font-semibold">The model could not be loaded</h2>
        <p className="mt-2 break-words text-sm text-muted">{error}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="primary" onClick={reload}>
            Retry
          </Button>
          <Button onClick={open}>Choose another file</Button>
        </div>
      </div>
    </div>
  );
}

export function AssetWarnings() {
  const summary = useAssetStore((s) => s.summary);
  if (!summary) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-2 px-3">
      {summary.diagnostic && (
        <div className="pointer-events-auto rounded-full border border-warn/40 bg-bg/85 px-3 py-1 text-center text-[11px] font-medium text-warn backdrop-blur">
          PIPELINE TEST RIG — geometric stand-ins, not anatomically accurate
        </div>
      )}
      {summary.unsuitableReason && (
        <div
          role="alert"
          className="pointer-events-auto max-w-lg rounded-xl border border-warn/40 bg-bg/90 px-4 py-2 text-xs text-warn backdrop-blur"
        >
          <strong className="font-semibold">Not suitable for muscle highlighting.</strong> {summary.unsuitableReason}
        </div>
      )}
    </div>
  );
}

export function SelectedNamesLegend() {
  const show = useEditor((s) => s.doc.showSelectedNames);
  const selections = useEditor((s) => s.doc.selections);
  const palette = useEditor((s) => s.doc.palette);
  const language = useEditor((s) => s.doc.labelLanguage);
  const ids = Object.keys(selections);
  if (!show || !ids.length) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-h-[45%] max-w-[min(320px,70%)] overflow-hidden rounded-xl border border-line bg-bg/75 p-3 backdrop-blur">
      <ul className="space-y-1.5">
        {ids.map((id) => {
          const m = getMuscle(id);
          if (!m) return null;
          return (
            <li key={id} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: highlightColor(id, { selections, palette }) ?? palette.primary }}
              />
              {language !== "ar" && <span className="truncate text-fg">{m.displayName.en}</span>}
              {language !== "en" && (
                <span dir="rtl" className={language === "both" ? "truncate text-muted" : "truncate text-fg"}>
                  {m.displayName.ar}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function HoverReadout() {
  const hovered = useEditor((s) => s.hoveredMuscleId);
  const selected = useEditor((s) => (s.hoveredMuscleId ? Boolean(s.doc.selections[s.hoveredMuscleId]) : false));
  const m = hovered ? getMuscle(hovered) : null;
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex flex-col items-end gap-1 text-right">
      {m && (
        <div className="rounded-lg border border-line bg-bg/85 px-3 py-1.5 backdrop-blur">
          <p className="text-sm font-medium text-fg">{m.displayName.en}</p>
          <p dir="rtl" className="text-xs text-muted">
            {m.displayName.ar}
          </p>
          <p className="text-[10px] text-muted">{selected ? "Click to change / remove" : "Click to highlight"}</p>
        </div>
      )}
      <p className="hidden text-[10px] text-muted/80 sm:block">
        Drag: orbit · Scroll: zoom · Right-drag: pan
      </p>
    </div>
  );
}
