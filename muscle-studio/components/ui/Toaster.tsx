"use client";

import { useToasts } from "@/stores/toastStore";
import { cn } from "./cn";
import { IconX } from "./icons";

const dot: Record<string, string> = {
  info: "bg-muted",
  success: "bg-ok",
  warning: "bg-warn",
  error: "bg-danger",
};

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[min(420px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-panel/95 px-4 py-3 text-sm shadow-xl backdrop-blur"
        >
          <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot[t.kind])} />
          <p className="flex-1 text-fg">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className="text-muted hover:text-fg"
          >
            <IconX size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
