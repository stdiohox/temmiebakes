"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { CheckCircle, Info, Warning, X } from "@phosphor-icons/react";
import { useEffect } from "react";
import { tick } from "@/lib/engine";
import { bootDemo, useDemo } from "@/lib/store";
import { useToasts } from "@/lib/toast";
import { Logo } from "./ui";

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const ready = useDemo((s) => s.ready);

  useEffect(() => {
    bootDemo();
    try {
      const t = localStorage.getItem("tb-theme");
      if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
    } catch {
      /* storage blocked */
    }
  }, []);

  // The background scheduler: releases due messages and advances delivery status
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => useDemo.getState().run((s) => tick(s)), 20000);
    return () => clearInterval(id);
  }, [ready]);

  return (
    <MotionConfig reducedMotion="user">
      {ready ? children : <BootScreen />}
      <Toaster />
    </MotionConfig>
  );
}

function BootScreen() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <Logo size={44} />
        <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-brand" />
        </div>
        <p className="text-sm text-ink-3">Loading demo data</p>
      </div>
    </div>
  );
}

function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="no-print pointer-events-none fixed bottom-4 left-1/2 z-[80] flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:translate-x-0" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = t.tone === "warn" ? Warning : t.tone === "info" ? Info : CheckCircle;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-lift"
            >
              <Icon size={20} weight="fill" className={t.tone === "warn" ? "text-warn" : t.tone === "info" ? "text-info" : "text-ok"} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.detail && <p className="mt-0.5 text-xs text-ink-2">{t.detail}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-ink-3 hover:text-ink" aria-label="Dismiss">
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
