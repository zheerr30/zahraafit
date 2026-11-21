import { create } from "zustand";

export type ToastKind = "info" | "success" | "error" | "warning";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string, ttl?: number) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (kind, message, ttl = kind === "error" ? 7000 : 3500) => {
    const id = ++seq;
    set({ toasts: [...get().toasts.slice(-3), { id, kind, message }] });
    setTimeout(() => get().dismiss(id), ttl);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  info: (m: string) => useToasts.getState().push("info", m),
  success: (m: string) => useToasts.getState().push("success", m),
  warning: (m: string) => useToasts.getState().push("warning", m),
  error: (m: string) => useToasts.getState().push("error", m),
};
