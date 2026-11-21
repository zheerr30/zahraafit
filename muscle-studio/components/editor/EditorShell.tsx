"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useActiveAsset } from "@/hooks/useActiveAsset";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSaveProject } from "@/hooks/useSaveProject";
import { getProjectRepository } from "@/lib/storage";
import { editorStore, useEditor } from "@/stores/editorStore";
import { toast } from "@/stores/toastStore";
import { ExportDialog } from "@/components/export/ExportDialog";
import { MuscleSelector } from "@/components/library/MuscleSelector";
import { cn } from "@/components/ui/cn";
import { SettingsPanel } from "./SettingsPanel";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { Toolbar } from "./Toolbar";
import {
  AssetWarnings,
  HoverReadout,
  LoadErrorOverlay,
  LoadingOverlay,
  ModelCredit,
  SelectedNamesLegend,
} from "./ViewportOverlays";

// WebGL must never render on the server.
const AnatomyViewport = dynamic(() => import("@/components/anatomy/AnatomyViewport"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-muted" role="status">
      جار تشغيل المحرك ثلاثي الأبعاد…
    </div>
  ),
});

function useEditorInitialization() {
  const params = useSearchParams();
  const key = params.toString();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const st = editorStore.getState();
      const projectId = params.get("project");
      const gender = params.get("gender");
      const select = params.get("select");

      if (projectId) {
        if (st.projectId !== projectId) {
          try {
            const repo = await getProjectRepository();
            const project = await repo.get(projectId);
            if (cancelled) return;
            if (project) {
              const dropped = st.loadProject(project);
              if (dropped > 0) {
                toast.warning(
                  `أزيلت ${dropped} من العضلات المحفوظة لأنها غير موجودة في BodyParts3D.`,
                );
              }
            } else {
              toast.error("هذا المشروع لم يعد موجودا. بدأ رسم جديد.");
              st.newDocument();
            }
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "تعذر فتح المشروع.");
          }
        }
      } else if (params.has("new") || gender) {
        st.newDocument(gender === "female" ? "female" : "male");
      }
      if (select) st.selectMuscles(select.split(",").map((s) => s.trim()));
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // Re-run only when the query string changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return ready;
}

export function EditorShell() {
  const ready = useEditorInitialization();
  const active = useActiveAsset();
  const { save, saving } = useSaveProject();
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const background = useEditor((s) => s.doc.background);
  const dirty = useEditor((s) => s.dirty);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useKeyboardShortcuts({
    undo: () => editorStore.getState().undo(),
    redo: () => editorStore.getState().redo(),
    resetCamera: () => editorStore.getState().requestReset(),
    save: () => void save(),
    exportImage: () => setExportOpen(true),
    view: (v) => editorStore.getState().requestView(v),
    frameSelection: () => editorStore.getState().requestFrameSelection(),
    clearHover: () => editorStore.getState().setHovered(null),
    togglePaintTone: () => {
      const st = editorStore.getState();
      st.setPaintTone(st.paintTone === "primary" ? "secondary" : "primary");
    },
    focusSearch: () => {
      setLeftOpen(true);
      requestAnimationFrame(() => searchRef.current?.focus());
    },
    showHelp: () => setHelpOpen(true),
  });

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      <Toolbar
        onSave={() => void save()}
        onExport={() => setExportOpen(true)}
        onHelp={() => setHelpOpen(true)}
        saving={saving}
        onToggleLeft={() => setLeftOpen((o) => !o)}
        onToggleRight={() => setRightOpen((o) => !o)}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
      />

      <div className="relative flex min-h-0 flex-1">
        {(leftOpen || rightOpen) && (
          <button
            type="button"
            aria-label="إغلاق اللوحة"
            onClick={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
            className={cn(
              "absolute inset-0 z-20 bg-black/55",
              leftOpen && !rightOpen && "lg:hidden",
              rightOpen && !leftOpen && "xl:hidden",
            )}
          />
        )}

        <aside
          aria-label="مكتبة العضلات"
          className={cn(
            "absolute inset-y-0 start-0 z-30 w-[min(340px,88vw)] border-e border-line bg-panel transition-transform duration-200 lg:static lg:z-auto lg:w-[310px]",
            // Off-canvas only below lg; in RTL the start edge is on the right.
            !leftOpen && "max-lg:translate-x-full max-lg:ltr:-translate-x-full",
          )}
        >
          <MuscleSelector ref={searchRef} />
        </aside>

        <main
          data-viewport
          aria-label="العارض ثلاثي الأبعاد"
          className={cn(
            "relative min-w-0 flex-1 overflow-hidden",
            background === "white" ? "bg-white" : background === "transparent" ? "checkerboard" : "bg-[#050505]",
          )}
        >
          {ready && (
            <AnatomyViewport asset={active.status === "ok" ? active.asset : null} />
          )}
          {active.status === "ok" && (
            <>
              <LoadingOverlay />
              <LoadErrorOverlay />
              <AssetWarnings />
              <SelectedNamesLegend />
              <HoverReadout />
              <ModelCredit />
            </>
          )}
        </main>

        <aside
          aria-label="إعدادات العرض"
          className={cn(
            "absolute inset-y-0 end-0 z-30 w-[min(340px,88vw)] border-s border-line bg-panel transition-transform duration-200 xl:static xl:z-auto xl:w-[310px]",
            !rightOpen && "max-xl:-translate-x-full max-xl:ltr:translate-x-full",
          )}
        >
          <SettingsPanel active={active} />
        </aside>
      </div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
