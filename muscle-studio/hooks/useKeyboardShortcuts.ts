"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

export interface ShortcutHandlers {
  undo: () => void;
  redo: () => void;
  resetCamera: () => void;
  save: () => void;
  exportImage: () => void;
  view: (v: "front" | "back" | "left" | "right") => void;
  frameSelection: () => void;
  clearHover: () => void;
  togglePaintTone: () => void;
  focusSearch: () => void;
  showHelp: () => void;
}

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Ctrl/⌘ + Z", action: "تراجع" },
  { keys: "Ctrl/⌘ + Shift + Z  ·  Ctrl + Y", action: "إعادة" },
  { keys: "Ctrl/⌘ + S", action: "حفظ المشروع" },
  { keys: "Ctrl/⌘ + E", action: "تصدير صورة" },
  { keys: "R  ·  Home", action: "إعادة ضبط الكاميرا" },
  { keys: "1 / 2 / 3 / 4", action: "منظر أمامي / خلفي / أيسر / أيمن" },
  { keys: "F", action: "تأطير العضلات المحددة" },
  { keys: "X", action: "التبديل بين التلوين المستهدف والثانوي" },
  { keys: "/", action: "البحث عن عضلة" },
  { keys: "?", action: "عرض الاختصارات" },
];

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (target.isContentEditable) return true;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    return !["checkbox", "radio", "range", "color", "button"].includes(type);
  }
  return false;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  const ref = useRef(handlers);
  useLayoutEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) h.redo();
        else h.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        h.redo();
        return;
      }
      if (mod && key === "s") {
        e.preventDefault();
        h.save();
        return;
      }
      if (mod && key === "e") {
        e.preventDefault();
        h.exportImage();
        return;
      }
      if (mod || e.altKey || isTyping(e.target)) return;
      if (document.querySelector("dialog[open]")) return;

      switch (key) {
        case "r":
        case "home":
          h.resetCamera();
          break;
        case "1":
          h.view("front");
          break;
        case "2":
          h.view("back");
          break;
        case "3":
          h.view("left");
          break;
        case "4":
          h.view("right");
          break;
        case "f":
          h.frameSelection();
          break;
        case "x":
          h.togglePaintTone();
          break;
        case "escape":
          h.clearHover();
          break;
        case "/":
          e.preventDefault();
          h.focusSearch();
          break;
        case "?":
          h.showHelp();
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
