"use client";

import { useRouter } from "next/navigation";
import { editorStore } from "@/stores/editorStore";
import { Dialog } from "@/components/ui/Dialog";
import type { Gender } from "@/types/anatomy";
import { BodyGlyph } from "./BodyGlyph";

export function startNewIllustration(router: ReturnType<typeof useRouter>, gender: Gender) {
  const st = editorStore.getState();
  if (st.dirty && !window.confirm("You have unsaved changes in the editor. Discard them and start a new illustration?")) {
    return;
  }
  router.push(`/editor?new=1&gender=${gender}`);
}

export function NewIllustrationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  return (
    <Dialog open={open} onClose={onClose} title="New illustration" description="Choose the anatomical model to start from.">
      <div className="grid grid-cols-2 gap-3">
        {(["male", "female"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => {
              onClose();
              startNewIllustration(router, g);
            }}
            className="group flex flex-col items-center gap-3 rounded-xl border border-line bg-panel-2 p-5 transition-colors hover:border-accent/60"
          >
            <BodyGlyph gender={g} className="h-28 text-muscle-shadow transition-colors group-hover:text-muscle" />
            <span className="text-sm font-medium capitalize">{g}</span>
            <span dir="rtl" className="text-xs text-muted">
              {g === "male" ? "نموذج ذكر" : "نموذج أنثى"}
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
