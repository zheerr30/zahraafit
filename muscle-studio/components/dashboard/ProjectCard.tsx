"use client";

import Link from "next/link";
import { useState } from "react";
import { getMuscle } from "@/data/muscles/muscles";
import type { Project } from "@/lib/storage/schema";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { IconCopy, IconEdit, IconTrash } from "@/components/ui/icons";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "الآن";
  if (min < 60) return `قبل ${min} دقيقة`;
  const h = Math.round(min / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.round(h / 24);
  if (d < 30) return `قبل ${d} يوم`;
  return new Date(iso).toLocaleDateString("ar");
}

export function ProjectCard({
  project,
  onRename,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(project.name);
  const ids = Object.keys(project.doc.selections);
  const href = `/editor?project=${encodeURIComponent(project.id)}`;

  return (
    <article className="group overflow-hidden rounded-2xl border border-line bg-panel transition-colors hover:border-line-strong">
      <Link href={href} className="block" aria-label={`فتح ${project.name}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-[#0b0c0d]">
          {project.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.thumbnail} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">لا توجد معاينة</div>
          )}
          <span className="absolute start-2 top-2 rounded-md bg-bg/80 px-2 py-0.5 text-[10px] font-medium text-muted backdrop-blur">
            {project.doc.gender === "male" ? "ذكر" : "أنثى"}
          </span>
        </div>
      </Link>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={href} className="block truncate text-sm font-medium text-fg hover:underline">
              {project.name}
            </Link>
            <p className="mt-0.5 text-xs text-muted">
              {ids.length} عضلة · {relativeTime(project.updatedAt)}
            </p>
          </div>
          <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <button type="button" onClick={() => setRenaming(true)} aria-label={`إعادة تسمية ${project.name}`} title="إعادة التسمية" className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-fg">
              <IconEdit size={15} />
            </button>
            <button type="button" onClick={onDuplicate} aria-label={`نسخ ${project.name}`} title="إنشاء نسخة" className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-fg">
              <IconCopy size={15} />
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)} aria-label={`حذف ${project.name}`} title="حذف" className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
              <IconTrash size={15} />
            </button>
          </div>
        </div>
        {ids.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {ids.slice(0, 3).map((id) => (
              <span key={id} className="flex items-center gap-1 rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] text-muted">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      project.doc.selections[id].color ?? project.doc.palette[project.doc.selections[id].tone],
                  }}
                />
                {getMuscle(id)?.displayName.ar ?? "عضلة غير موجودة"}
              </span>
            ))}
            {ids.length > 3 && <span className="px-1 text-[10px] text-muted">+{ids.length - 3}</span>}
          </div>
        )}
      </div>

      <Dialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title="إعادة تسمية الرسم"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(false)}>إلغاء</Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() => {
                onRename(name);
                setRenaming(false);
              }}
            >
              حفظ الاسم
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onRename(name);
            setRenaming(false);
          }}
        >
          <label htmlFor={`rename-${project.id}`} className="mb-1 block text-sm text-muted">الاسم</label>
          <input
            id={`rename-${project.id}`}
            autoFocus
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-lg border border-line bg-panel-2 px-3 text-sm focus:border-accent/60 focus:outline-none"
          />
        </form>
      </Dialog>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="حذف الرسم؟"
        description={`سيُحذف «${project.name}» نهائيًا ولا يمكن التراجع.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>إلغاء</Button>
            <Button
              variant="danger"
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
            >
              حذف
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">لا يتأثر أي ملف PNG صُدّر مسبقًا إلى جهازك.</p>
      </Dialog>
    </article>
  );
}
