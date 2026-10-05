"use client";

import { create } from "zustand";

export interface Toast {
  id: number;
  title: string;
  detail?: string;
  tone?: "ok" | "info" | "warn";
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let n = 0;
export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++n;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, ...t }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4800);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = (title: string, detail?: string, tone: Toast["tone"] = "ok") => useToasts.getState().push({ title, detail, tone });
