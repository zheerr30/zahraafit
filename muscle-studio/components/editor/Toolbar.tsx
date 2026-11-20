"use client";

import { useEditor } from "@/stores/editorStore";
import { Brand } from "@/components/ui/Brand";
import { Button, IconButton } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";
import { cn } from "@/components/ui/cn";
import {
  IconDownload,
  IconFocus,
  IconKeyboard,
  IconLayers,
  IconRedo,
  IconReset,
  IconSave,
  IconSliders,
  IconUndo,
} from "@/components/ui/icons";

export function Toolbar({
  onSave,
  onExport,
  onHelp,
  saving,
  onToggleLeft,
  onToggleRight,
  leftOpen,
  rightOpen,
}: {
  onSave: () => void;
  onExport: () => void;
  onHelp: () => void;
  saving: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  leftOpen: boolean;
  rightOpen: boolean;
}) {
  const gender = useEditor((s) => s.doc.gender);
  const setGender = useEditor((s) => s.setGender);
  const view = useEditor((s) => s.currentView);
  const requestView = useEditor((s) => s.requestView);
  const requestReset = useEditor((s) => s.requestReset);
  const requestFrame = useEditor((s) => s.requestFrameSelection);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const paintTone = useEditor((s) => s.paintTone);
  const setPaintTone = useEditor((s) => s.setPaintTone);
  const palette = useEditor((s) => s.doc.palette);
  const projectName = useEditor((s) => s.projectName);
  const setProjectName = useEditor((s) => s.setProjectName);
  const dirty = useEditor((s) => s.dirty);
  const hasSelection = useEditor((s) => Object.keys(s.doc.selections).length > 0);

  return (
    <header className="z-20 border-b border-line bg-panel">
      <div className="flex h-14 items-center gap-2 px-3">
        <Brand compact />
        <IconButton label="مكتبة العضلات" onClick={onToggleLeft} active={leftOpen} className="lg:hidden">
          <IconLayers />
        </IconButton>
        <div className="flex min-w-0 items-center gap-1.5">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            aria-label="اسم المشروع"
            maxLength={120}
            className="h-8 w-[clamp(120px,22vw,260px)] min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 text-sm font-medium text-fg hover:border-line focus:border-accent/60 focus:bg-panel-2 focus:outline-none"
          />
          <span
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dirty ? "bg-warn" : "bg-ok")}
            title={dirty ? "تغييرات غير محفوظة" : "كل التغييرات محفوظة"}
            aria-label={dirty ? "تغييرات غير محفوظة" : "محفوظ"}
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <IconButton label="اختصارات لوحة المفاتيح (?)" onClick={onHelp} className="hidden sm:inline-flex">
            <IconKeyboard />
          </IconButton>
          <Button onClick={onSave} disabled={saving} size="md" aria-label="حفظ المشروع (Ctrl+S)" title="حفظ المشروع (Ctrl+S)">
            <IconSave size={16} />
            <span className="hidden sm:inline">{saving ? "جار الحفظ…" : "حفظ"}</span>
          </Button>
          <Button variant="primary" onClick={onExport} aria-label="تصدير صورة (Ctrl+E)" title="تصدير صورة (Ctrl+E)">
            <IconDownload size={16} />
            <span className="hidden sm:inline">تصدير</span>
          </Button>
          <IconButton label="إعدادات العرض" onClick={onToggleRight} active={rightOpen} className="xl:hidden">
            <IconSliders />
          </IconButton>
        </div>
      </div>

      <div className="scroll-thin flex h-12 items-center gap-2 overflow-x-auto border-t border-line px-3">
        <Segmented
          label="النموذج"
          value={gender}
          onChange={setGender}
          size="sm"
          options={[
            { value: "male", label: "ذكر" },
            { value: "female", label: "أنثى" },
          ]}
        />
        <span className="mx-1 h-5 w-px shrink-0 bg-line" />
        <Segmented
          label="زاوية الكاميرا"
          value={view}
          onChange={(v) => requestView(v)}
          size="sm"
          options={[
            { value: "front", label: "أمامي", title: "منظر أمامي (1)" },
            { value: "back", label: "خلفي", title: "منظر خلفي (2)" },
            { value: "left", label: "يسار", title: "الجانب الأيسر (3)" },
            { value: "right", label: "يمين", title: "الجانب الأيمن (4)" },
          ]}
        />
        <IconButton label="إعادة ضبط الكاميرا (R)" onClick={requestReset} size="sm">
          <IconReset size={16} />
        </IconButton>
        <IconButton label="تأطير العضلات المحددة (F)" onClick={requestFrame} size="sm" disabled={!hasSelection}>
          <IconFocus size={16} />
        </IconButton>
        <span className="mx-1 h-5 w-px shrink-0 bg-line" />
        <Segmented
          label="نوع التلوين عند النقر"
          value={paintTone}
          onChange={setPaintTone}
          size="sm"
          options={[
            {
              value: "primary",
              title: "النقر يلون العضلة كعضلة مستهدفة (X للتبديل)",
              label: (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: palette.primary }} />
                  مستهدفة
                </span>
              ),
            },
            {
              value: "secondary",
              title: "النقر يلون العضلة كعضلة ثانوية (X للتبديل)",
              label: (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: palette.secondary }} />
                  ثانوية
                </span>
              ),
            },
          ]}
        />
        <span className="mx-1 h-5 w-px shrink-0 bg-line" />
        <IconButton label="تراجع (Ctrl+Z)" onClick={undo} disabled={!canUndo} size="sm">
          <IconUndo size={16} className="rtl:-scale-x-100" />
        </IconButton>
        <IconButton label="إعادة (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} size="sm">
          <IconRedo size={16} className="rtl:-scale-x-100" />
        </IconButton>
      </div>
    </header>
  );
}
