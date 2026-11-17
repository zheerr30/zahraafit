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
        <IconButton label="Muscle library" onClick={onToggleLeft} active={leftOpen} className="lg:hidden">
          <IconLayers />
        </IconButton>
        <div className="flex min-w-0 items-center gap-1.5">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            aria-label="Project name"
            maxLength={120}
            className="h-8 w-[clamp(120px,22vw,260px)] min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 text-sm font-medium text-fg hover:border-line focus:border-accent/60 focus:bg-panel-2 focus:outline-none"
          />
          <span
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dirty ? "bg-warn" : "bg-ok")}
            title={dirty ? "Unsaved changes" : "All changes saved"}
            aria-label={dirty ? "Unsaved changes" : "Saved"}
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <IconButton label="Keyboard shortcuts (?)" onClick={onHelp} className="hidden sm:inline-flex">
            <IconKeyboard />
          </IconButton>
          <Button onClick={onSave} disabled={saving} size="md" aria-label="Save project (Ctrl+S)" title="Save project (Ctrl+S)">
            <IconSave size={16} />
            <span className="hidden sm:inline">{saving ? "Saving…" : "Save"}</span>
          </Button>
          <Button variant="primary" onClick={onExport} aria-label="Export image (Ctrl+E)" title="Export image (Ctrl+E)">
            <IconDownload size={16} />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <IconButton label="Visual settings" onClick={onToggleRight} active={rightOpen} className="xl:hidden">
            <IconSliders />
          </IconButton>
        </div>
      </div>

      <div className="scroll-thin flex h-12 items-center gap-2 overflow-x-auto border-t border-line px-3">
        <Segmented
          label="Model"
          value={gender}
          onChange={setGender}
          size="sm"
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
        <span className="mx-1 h-5 w-px shrink-0 bg-line" />
        <Segmented
          label="Camera view"
          value={view}
          onChange={(v) => requestView(v)}
          size="sm"
          options={[
            { value: "front", label: "Front", title: "Front view (1)" },
            { value: "back", label: "Back", title: "Back view (2)" },
            { value: "left", label: "Left", title: "Left side (3)" },
            { value: "right", label: "Right", title: "Right side (4)" },
          ]}
        />
        <IconButton label="Reset camera (R)" onClick={requestReset} size="sm">
          <IconReset size={16} />
        </IconButton>
        <IconButton label="Frame selected muscles (F)" onClick={requestFrame} size="sm" disabled={!hasSelection}>
          <IconFocus size={16} />
        </IconButton>
        <span className="mx-1 h-5 w-px shrink-0 bg-line" />
        <Segmented
          label="Paint tone for clicks"
          value={paintTone}
          onChange={setPaintTone}
          size="sm"
          options={[
            {
              value: "primary",
              title: "Clicks apply the primary highlight (X to swap)",
              label: (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: palette.primary }} />
                  Primary
                </span>
              ),
            },
            {
              value: "secondary",
              title: "Clicks apply the secondary highlight (X to swap)",
              label: (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: palette.secondary }} />
                  Secondary
                </span>
              ),
            },
          ]}
        />
        <span className="mx-1 h-5 w-px shrink-0 bg-line" />
        <IconButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} size="sm">
          <IconUndo size={16} />
        </IconButton>
        <IconButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} size="sm">
          <IconRedo size={16} />
        </IconButton>
      </div>
    </header>
  );
}
