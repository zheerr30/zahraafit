"use client";

import { plainArabic } from "@/lib/anatomy/normalize";
import Link from "next/link";
import { structureName, withSide } from "@/data/anatomy/lexicon";
import { getMuscle } from "@/data/muscles/muscles";
import { useLocalModelFile } from "@/hooks/useLocalModelFile";
import { highlightColor } from "@/lib/three/anatomyModel";
import { useAssetStore } from "@/stores/assetStore";
import { useEditor } from "@/stores/editorStore";
import { Button } from "@/components/ui/Button";
import { IconWarning } from "@/components/ui/icons";

export function LoadingOverlay() {
  const status = useAssetStore((s) => s.loadStatus);
  const progress = useAssetStore((s) => s.progress);
  if (status !== "loading") return null;
  const pct = Math.round(progress * 100);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" role="status">
      <div className="w-64 rounded-xl border border-line bg-panel/95 p-4 text-center shadow-xl">
        <p className="text-sm text-fg">جار تحميل النموذج التشريحي…</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel-3" dir="ltr">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct > 0 ? pct : 12}%` }} />
        </div>
        <p className="mt-2 font-mono text-xs text-muted">{pct > 0 ? `${pct}%` : "جار الاتصال"}</p>
      </div>
    </div>
  );
}

/**
 * Shown when the model cannot be loaded. There is deliberately no fallback
 * geometry: the viewport stays empty and explains what went wrong.
 */
export function LoadErrorOverlay() {
  const status = useAssetStore((s) => s.loadStatus);
  const error = useAssetStore((s) => s.error);
  const reload = useAssetStore((s) => s.reload);
  const localFile = useEditor((s) => s.localFile);
  const { clear } = useLocalModelFile();
  if (status !== "error") return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-6" role="alert">
      <div className="max-w-md rounded-2xl border border-danger/40 bg-panel p-6 text-center">
        <IconWarning className="mx-auto mb-3 text-danger" size={28} />
        <h2 className="text-base font-semibold">تعذر تحميل النموذج التشريحي</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          لم يعرض أي مجسم بديل. يرجى التحقق من الاتصال ومن وجود ملف النموذج ثم إعادة المحاولة.
        </p>
        <p dir="auto" className="mt-3 break-words rounded-lg bg-panel-2 p-2 text-start text-xs text-muted">
          {error}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="primary" onClick={reload}>
            إعادة المحاولة
          </Button>
          {localFile && <Button onClick={clear}>العودة إلى النموذج المدمج</Button>}
        </div>
      </div>
    </div>
  );
}

export function AssetWarnings() {
  const summary = useAssetStore((s) => s.summary);
  if (!summary?.unsuitableReason) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
      <div role="alert" className="pointer-events-auto max-w-lg rounded-xl border border-warn/40 bg-bg/90 px-4 py-2 text-xs text-warn backdrop-blur">
        <strong className="font-semibold">هذا النموذج لا يصلح لتلوين العضلات منفردة.</strong>{" "}
        {summary.unsuitableReason}
      </div>
    </div>
  );
}

/** Persistent licence credit for CC BY assets (links to the full attribution page). */
export function ModelCredit() {
  const summary = useAssetStore((s) => s.summary);
  if (!summary?.attribution) return null;
  return (
    <Link
      href="/credits"
      className="absolute bottom-3 left-1/2 z-10 max-w-[min(520px,70%)] -translate-x-1/2 truncate rounded-full border border-line/70 bg-bg/70 px-3 py-1 text-[10px] text-muted backdrop-blur hover:text-fg"
      title={summary.attribution.credit}
    >
      النموذج: Z-Anatomy (على أساس BodyParts3D © DBCLS) · رخصة CC BY-SA 4.0 — المصادر
    </Link>
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
    <div className="pointer-events-none absolute bottom-3 start-3 z-10 max-h-[45%] max-w-[min(320px,60%)] overflow-hidden rounded-xl border border-line bg-bg/75 p-3 backdrop-blur">
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
              {language !== "en" && <span className="truncate text-fg">{m.displayName.ar}</span>}
              {language !== "ar" && (
                <span dir="ltr" className={language === "both" ? "truncate text-muted" : "truncate text-fg"}>
                  {m.displayName.en}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function zaStructure(key: string) {
  const x = JSON.parse(key.slice(3)) as { ar: string; en: string; side: string };
  return { ar: plainArabic(x.ar), en: x.en, side: (x.side === "l" ? "left" : x.side === "r" ? "right" : "center") as "left" | "right" | "center" };
}

export function HoverReadout() {
  const hovered = useEditor((s) => s.hoveredMuscleId);
  const selected = useEditor((s) => (s.hoveredMuscleId ? Boolean(s.doc.selections[s.hoveredMuscleId]) : false));
  const structureKey = useAssetStore((s) => s.hoveredStructure);
  const m = hovered ? getMuscle(hovered) : null;
  const structure = !m && structureKey ? (structureKey.startsWith("za:") ? zaStructure(structureKey) : structureName(structureKey)) : null;
  return (
    <div className="pointer-events-none absolute bottom-12 end-3 z-10 flex flex-col items-end gap-1 text-end">
      {m && (
        <div className="rounded-lg border border-line bg-bg/85 px-3 py-1.5 backdrop-blur">
          <p className="text-sm font-medium text-fg">{m.displayName.ar}</p>
          <p dir="ltr" className="text-xs text-muted">
            {m.displayName.en}
          </p>
          <p className="text-[10px] text-muted">{selected ? "النقر للتغيير أو الإزالة" : "النقر للتلوين"}</p>
        </div>
      )}
      {structure && (
        <div className="rounded-lg border border-line bg-bg/85 px-3 py-1.5 backdrop-blur">
          <p className="text-sm font-medium text-fg">{withSide(structure.ar, structure.side)}</p>
          <p dir="ltr" className="text-xs text-muted">
            {structure.en}
          </p>
          <p className="text-[10px] text-muted">بنية غير عضلية — للعرض فقط</p>
        </div>
      )}
      <p className="hidden text-[10px] text-muted/80 sm:block">السحب: تدوير · العجلة: تكبير · الزر الأيمن: تحريك</p>
    </div>
  );
}
