"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  downloadCanvas,
  MAX_EXPORT_SIDE,
  renderIllustration,
  type ExportOptions,
  type ExportView,
} from "@/lib/three/capture";
import { useAssetStore } from "@/stores/assetStore";
import { editorStore, useEditor } from "@/stores/editorStore";
import { toast } from "@/stores/toastStore";
import { Button } from "@/components/ui/Button";
import { Segmented, Switch } from "@/components/ui/Controls";
import { Dialog } from "@/components/ui/Dialog";
import { IconDownload } from "@/components/ui/icons";

type Composition = "current" | "front" | "back" | "left" | "right" | "front-back" | "selection";

const COMPOSITIONS: { value: Composition; label: string; views: ExportView[]; hint: string }[] = [
  { value: "current", label: "Current view", views: ["current"], hint: "Exactly what the camera sees now" },
  { value: "front", label: "Front", views: ["front"], hint: "Anterior view, full body" },
  { value: "back", label: "Back", views: ["back"], hint: "Posterior view, full body" },
  { value: "left", label: "Left", views: ["left"], hint: "Left lateral view" },
  { value: "right", label: "Right", views: ["right"], hint: "Right lateral view" },
  { value: "front-back", label: "Front + Back", views: ["front", "back"], hint: "Two panels side by side" },
  { value: "selection", label: "Selected muscles", views: ["selection"], hint: "Camera framed on the highlighted muscles" },
];

type SizePreset = "viewport" | "square" | "portrait" | "poster" | "hd" | "4k" | "custom";
const SIZES: { value: SizePreset; label: string; w: number; h: number }[] = [
  { value: "portrait", label: "Portrait 4:5 · 2400×3000", w: 2400, h: 3000 },
  { value: "poster", label: "Poster 3:4 · 3000×4000", w: 3000, h: 4000 },
  { value: "square", label: "Square · 2048×2048", w: 2048, h: 2048 },
  { value: "hd", label: "Landscape HD · 1920×1080", w: 1920, h: 1080 },
  { value: "4k", label: "Landscape 4K · 3840×2160", w: 3840, h: 2160 },
  { value: "viewport", label: "Viewport ×2", w: 0, h: 0 },
  { value: "custom", label: "Custom…", w: 0, h: 0 },
];

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9؀-ۿ]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "illustration"
  );
}

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Mounting fresh on every open re-reads defaults from the current document.
  return open ? <ExportDialogContent onClose={onClose} /> : null;
}

function ExportDialogContent({ onClose }: { onClose: () => void }) {
  const open = true;
  const docBackground = useEditor((s) => s.doc.background);
  const docLanguage = useEditor((s) => s.doc.labelLanguage);
  const showLabels = useEditor((s) => s.doc.showLabels);
  const selectionCount = useEditor((s) => Object.keys(s.doc.selections).length);
  const projectName = useEditor((s) => s.projectName);
  const loadStatus = useAssetStore((s) => s.loadStatus);
  const summary = useAssetStore((s) => s.summary);

  const [composition, setComposition] = useState<Composition>("current");
  const [sizePreset, setSizePreset] = useState<SizePreset>("portrait");
  const [custom, setCustom] = useState({ w: 2400, h: 3000 });
  const [background, setBackground] = useState(docBackground);
  const [labels, setLabels] = useState(showLabels && selectionCount > 0);
  const [legend, setLegend] = useState(selectionCount > 0);
  const [language, setLanguage] = useState(docLanguage);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const previewSeq = useRef(0);

  const size = useMemo(() => {
    const preset = SIZES.find((s) => s.value === sizePreset)!;
    if (sizePreset === "custom") return custom;
    if (sizePreset === "viewport") {
      const canvas = document.querySelector<HTMLCanvasElement>("[data-viewport] canvas");
      const w = canvas ? canvas.clientWidth * 2 : 1920;
      const h = canvas ? canvas.clientHeight * 2 : 1080;
      return { w, h };
    }
    return { w: preset.w, h: preset.h };
  }, [sizePreset, custom]);

  const views = COMPOSITIONS.find((c) => c.value === composition)!.views;
  const ready = loadStatus === "ready" && summary !== null;
  const sizeValid =
    Number.isFinite(size.w) &&
    Number.isFinite(size.h) &&
    size.w >= 64 &&
    size.h >= 64 &&
    size.w <= MAX_EXPORT_SIDE &&
    size.h <= MAX_EXPORT_SIDE;

  const buildOptions = (w: number, h: number): ExportOptions => ({
    width: w,
    height: h,
    background,
    views,
    labels,
    legend,
    language,
    title: title.trim() || undefined,
    doc: editorStore.getState().doc,
    watermark: summary?.diagnostic ? "Pipeline test rig — not an anatomical model" : undefined,
  });

  // Live low-resolution preview.
  useEffect(() => {
    if (!open || !ready || !sizeValid) return;
    const seq = ++previewSeq.current;
    const timer = setTimeout(async () => {
      const scale = Math.min(1, 420 / Math.max(size.w, size.h));
      editorStore.getState().setExporting(true);
      try {
        const canvas = await renderIllustration(buildOptions(Math.round(size.w * scale), Math.round(size.h * scale)));
        if (seq === previewSeq.current) setPreview(canvas.toDataURL("image/png"));
      } catch (e) {
        console.warn("[muscle-studio] preview failed", e);
      } finally {
        editorStore.getState().setExporting(false);
      }
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, sizeValid, size.w, size.h, composition, background, labels, legend, language, title]);

  const doExport = async () => {
    if (!ready || !sizeValid) return;
    setBusy(true);
    editorStore.getState().setExporting(true);
    try {
      const canvas = await renderIllustration(buildOptions(size.w, size.h));
      const filename = `${slugify(projectName)}-${composition}-${size.w}x${size.h}${background === "transparent" ? "-transparent" : ""}.png`;
      await downloadCanvas(canvas, filename);
      toast.success(`Exported ${filename}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? `Export failed: ${e.message}` : "Export failed.");
    } finally {
      editorStore.getState().setExporting(false);
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Export illustration"
      description="Renders only the 3D artwork at full resolution — never a screenshot of the interface."
      className="w-[min(860px,calc(100vw-24px))]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={doExport} disabled={!ready || !sizeValid || busy}>
            <IconDownload size={16} />
            {busy ? "Rendering…" : `Export PNG · ${size.w}×${size.h}`}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Composition</legend>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {COMPOSITIONS.map((c) => {
                const disabled = c.value === "selection" && selectionCount === 0;
                return (
                  <button
                    key={c.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setComposition(c.value)}
                    aria-pressed={composition === c.value}
                    title={disabled ? "Select at least one muscle first" : c.hint}
                    className={
                      "rounded-lg border px-2.5 py-2 text-left text-xs transition-colors disabled:opacity-40 " +
                      (composition === c.value
                        ? "border-accent/70 bg-accent/10 text-fg"
                        : "border-line text-muted hover:border-line-strong hover:text-fg")
                    }
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Resolution</legend>
            <select
              value={sizePreset}
              onChange={(e) => setSizePreset(e.target.value as SizePreset)}
              aria-label="Resolution preset"
              className="h-9 w-full rounded-lg border border-line bg-panel-2 px-2 text-sm"
            >
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {sizePreset === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={64}
                  max={MAX_EXPORT_SIDE}
                  value={custom.w}
                  onChange={(e) => setCustom((c) => ({ ...c, w: Math.round(Number(e.target.value)) }))}
                  aria-label="Width in pixels"
                  className="h-9 w-28 rounded-lg border border-line bg-panel-2 px-2 text-sm"
                />
                <span className="text-muted">×</span>
                <input
                  type="number"
                  min={64}
                  max={MAX_EXPORT_SIDE}
                  value={custom.h}
                  onChange={(e) => setCustom((c) => ({ ...c, h: Math.round(Number(e.target.value)) }))}
                  aria-label="Height in pixels"
                  className="h-9 w-28 rounded-lg border border-line bg-panel-2 px-2 text-sm"
                />
                <span className="text-xs text-muted">px (64–{MAX_EXPORT_SIDE})</span>
              </div>
            )}
            {!sizeValid && (
              <p className="mt-1 text-xs text-danger">Each side must be between 64 and {MAX_EXPORT_SIDE} pixels.</p>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Background</legend>
            <Segmented
              label="Export background"
              value={background}
              onChange={setBackground}
              options={[
                { value: "black", label: "Black" },
                { value: "white", label: "White" },
                { value: "transparent", label: "Transparent PNG" },
              ]}
              className="flex w-full"
            />
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Annotations</legend>
            <Switch label="Callout labels on muscles" checked={labels} onChange={setLabels} />
            <Switch label="Legend of selected muscles" checked={legend} onChange={setLegend} />
            <div className="pt-1">
              <Segmented
                label="Annotation language"
                value={language}
                onChange={setLanguage}
                options={[
                  { value: "en", label: "English" },
                  { value: "ar", label: "العربية" },
                  { value: "both", label: "Both" },
                ]}
                size="sm"
                className="flex w-full"
              />
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title (e.g. Barbell Hip Thrust)"
              aria-label="Illustration title"
              maxLength={80}
              className="mt-2 h-9 w-full rounded-lg border border-line bg-panel-2 px-3 text-sm placeholder:text-muted/70"
            />
          </fieldset>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Preview</p>
          <div className="checkerboard flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-line">
            {!ready ? (
              <p className="p-4 text-center text-xs text-muted">Load a model to export an illustration.</p>
            ) : preview && sizeValid ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Export preview" className="max-h-full max-w-full object-contain" />
            ) : (
              <p className="text-xs text-muted">Rendering preview…</p>
            )}
          </div>
          {summary?.diagnostic && (
            <p className="mt-2 text-xs text-warn">
              The test rig is not anatomical; exports are watermarked accordingly.
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
