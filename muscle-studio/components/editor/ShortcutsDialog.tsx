"use client";

import { SHORTCUTS } from "@/hooks/useKeyboardShortcuts";
import { Dialog } from "@/components/ui/Dialog";

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts">
      <table className="w-full text-sm">
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.keys} className="border-b border-line/60 last:border-0">
              <td className="py-2 pr-4 font-mono text-xs text-fg">{s.keys}</td>
              <td className="py-2 text-muted">{s.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-muted">
        In the viewport: drag to orbit, scroll or pinch to zoom, right-drag or two-finger drag to pan. Click a
        muscle to highlight it with the active paint tone; click again to remove it.
      </p>
    </Dialog>
  );
}
