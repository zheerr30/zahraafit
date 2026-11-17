"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  downloadCanvas,
  MAX_EXPORT_SIDE,
  renderIllustration,
  type ExportOptions,
  type ExportView,
} from "@/lib/three/capture";
import { OPEN_ANATOMY_SHORT_CREDIT } from "@/lib/attribution";
import { useAssetStore } from "@/stores/assetStore";
import { editorStore, useEditor } from "@/stores/editorStore";
import { toast } from "@/stores/toastStore";
import { Button } from "@/components/ui/Button";
import { Segmented, Switch } from "@/components/ui/Controls";
import { Dialog } from "@/components/ui/Dialog";
import { IconDownload } from "@/components/ui/icons";

type Composition = "current" | "front" | "back" | "left" | "right" | "front-back" | "selection";

const COMPOSITIONS: { value: Composition; label: string; views: ExportView[]; hint: string }[] = [
  { value: "current", label: "المنظر الحالي", views: ["current"], hint: "ما تراه الكاميرا الآن تمامًا" },
  { value: "front", label: "أمامي", views: ["front"], hint: "منظر أمامي للجسم كاملًا" },
  { value: "back", label: "خلفي", views: ["back"], hint: "منظر خلفي للجسم كاملًا" },
  { value: "left", label: "الجانب الأيسر", views: ["left"], hint: "منظر جانبي أيسر" },
  { value: "right", label: "الجانب الأيمن", views: ["right"], hint: "منظر جانبي أيمن" },
  { value: "front-back", label: "أمامي + خلفي", views: ["front", "back"], hint: "لوحتان متجاورتان" },
  { value: "selection", label: "العضلات المحددة", views: ["selection"], hint: "الكاميرا مؤطّرة على العضلات الملوّنة" },
];

type SizePreset = "viewport" | "square" | "portrait" | "poster" | "hd" | "4k" | "custom";
const SIZES: { value: SizePreset; label: string; w: number; h: number }[] = [
  { value: "portrait", label: "عمودي 4:5 · 2400×3000", w: 2400, h: 3000 },
  { value: "poster", label: "ملصق 3:4 · 3000×4000", w: 3000, h: 4000 },
  { value: "square", label: "مربع · 2048×2048", w: 2048, h: 2048 },
  { value: "hd", label: "أفقي HD · 1920×1080", w: 1920, h: 1080 },
  { value: "4k", label: "أفقي 4K · 3840×2160", w: 3840, h: 2160 },
  { value: "viewport", label: "حجم العارض ×2", w: 0, h: 0 },
  { value: "custom", label: "مقاس مخصص…", w: 0, h: 0 },
];

/**
 * ASCII-only file name: browsers fall back to a generic "download" name for
 * non-ASCII names on blob downloads, so Arabic project names are replaced by a
 * timestamped default.
 */
function fileStem(projectName: string): string {
  const latin = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return latin.length >= 3 ? latin : `muscle-studio-${stamp}`;
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
  // CC BY 4.0 requires credit wherever renders of the models are shared.
  const [credit, setCredit] = useState(true);
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
    watermark: credit && summary?.attribution ? OPEN_ANATOMY_SHORT_CREDIT : undefined,
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
  }, [open, ready, sizeValid, size.w, size.h, composition, background, labels, legend, language, title, credit]);

  const doExport = async () => {
    if (!ready || !sizeValid) return;
    setBusy(true);
    editorStore.getState().setExporting(true);
    try {
      const canvas = await renderIllustration(buildOptions(size.w, size.h));
      const filename = `${fileStem(projectName)}-${composition}-${size.w}x${size.h}${background === "transparent" ? "-transparent" : ""}.png`;
      await downloadCanvas(canvas, filename);
      toast.success(`صُدّرت الصورة ${filename}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? `فشل التصدير: ${e.message}` : "فشل التصدير.");
    } finally {
      editorStore.getState().setExporting(false);
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="تصدير رسم توضيحي"
      description="يُرسم المجسّم وحده بدقة كاملة — وليس لقطة شاشة للواجهة."
      className="w-[min(860px,calc(100vw-24px))]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="primary" onClick={doExport} disabled={!ready || !sizeValid || busy}>
            <IconDownload size={16} />
            {busy ? "جارٍ الرسم…" : `تصدير PNG · ${size.w}×${size.h}`}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-muted">التكوين</legend>
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
                    title={disabled ? "يلزم تحديد عضلة واحدة على الأقل" : c.hint}
                    className={
                      "rounded-lg border px-2.5 py-2 text-start text-xs transition-colors disabled:opacity-40 " +
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
            <legend className="mb-2 text-xs font-semibold text-muted">الدقة</legend>
            <select
              value={sizePreset}
              onChange={(e) => setSizePreset(e.target.value as SizePreset)}
              aria-label="مقاس الصورة"
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
                  aria-label="العرض بالبكسل"
                  className="h-9 w-28 rounded-lg border border-line bg-panel-2 px-2 text-sm"
                />
                <span className="text-muted">×</span>
                <input
                  type="number"
                  min={64}
                  max={MAX_EXPORT_SIDE}
                  value={custom.h}
                  onChange={(e) => setCustom((c) => ({ ...c, h: Math.round(Number(e.target.value)) }))}
                  aria-label="الارتفاع بالبكسل"
                  className="h-9 w-28 rounded-lg border border-line bg-panel-2 px-2 text-sm"
                />
                <span className="text-xs text-muted">بكسل (64–{MAX_EXPORT_SIDE})</span>
              </div>
            )}
            {!sizeValid && (
              <p className="mt-1 text-xs text-danger">يجب أن يكون كل بُعد بين 64 و{MAX_EXPORT_SIDE} بكسل.</p>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-muted">الخلفية</legend>
            <Segmented
              label="خلفية الصورة"
              value={background}
              onChange={setBackground}
              options={[
                { value: "black", label: "سوداء" },
                { value: "white", label: "بيضاء" },
                { value: "transparent", label: "PNG شفافة" },
              ]}
              className="flex w-full"
            />
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs font-semibold text-muted">التسميات</legend>
            <Switch label="أسماء العضلات بخطوط إشارة" checked={labels} onChange={setLabels} />
            <Switch label="مفتاح العضلات المحددة" checked={legend} onChange={setLegend} />
            <div className="pt-1">
              <Segmented
                label="لغة التسميات"
                value={language}
                onChange={setLanguage}
                options={[
                  { value: "ar", label: "العربية" },
                  { value: "en", label: "English" },
                  { value: "both", label: "كلتاهما" },
                ]}
                size="sm"
                className="flex w-full"
              />
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان اختياري (مثل: الدفع بالورك بالبار)"
              aria-label="عنوان الرسم"
              maxLength={80}
              className="mt-2 h-9 w-full rounded-lg border border-line bg-panel-2 px-3 text-sm placeholder:text-muted/70"
            />
          </fieldset>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted">معاينة</p>
          <div className="checkerboard flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-line">
            {!ready ? (
              <p className="p-4 text-center text-xs text-muted">يلزم تحميل النموذج قبل التصدير.</p>
            ) : preview && sizeValid ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="معاينة التصدير" className="max-h-full max-w-full object-contain" />
            ) : (
              <p className="text-xs text-muted">جارٍ رسم المعاينة…</p>
            )}
          </div>
          {summary?.attribution && (
            <div className="mt-3 space-y-1">
              <Switch label="ذكر مصدر النموذج على الصورة" checked={credit} onChange={setCredit} />
              <p className="text-xs leading-relaxed text-muted">
                {credit
                  ? "يُكتب سطر النسبة (CC BY 4.0) أسفل الصورة."
                  : "رخصة CC BY 4.0 تشترط ذكر المصدر عند نشر الصورة؛ يجب إضافته في مكان النشر."}
              </p>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
