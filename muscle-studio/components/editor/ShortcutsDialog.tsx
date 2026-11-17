"use client";

import { SHORTCUTS } from "@/hooks/useKeyboardShortcuts";
import { Dialog } from "@/components/ui/Dialog";

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="اختصارات لوحة المفاتيح">
      <table className="w-full text-sm">
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.keys} className="border-b border-line/60 last:border-0">
              <td dir="ltr" className="py-2 pe-4 text-start font-mono text-xs text-fg">{s.keys}</td>
              <td className="py-2 text-muted">{s.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-muted">
        في العارض: السحب للتدوير، والعجلة أو القرص بإصبعين للتكبير، والسحب بالزر الأيمن أو بإصبعين للتحريك.
        النقر على عضلة يلوّنها بالنوع النشط (مستهدفة أو ثانوية)، والنقر مرة أخرى يزيل اللون.
      </p>
    </Dialog>
  );
}
