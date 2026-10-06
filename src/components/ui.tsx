"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { X } from "@phosphor-icons/react";
import { forwardRef, useEffect, useId, useRef } from "react";
import type { Staff } from "@/lib/types";

// Shape rule: buttons and chips are pills, inputs are 10px, cards and panels are 16px.

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "secondary" | "ghost" | "accent" | "danger" | "outline";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-2",
  secondary: "bg-surface-2 text-ink hover:bg-surface-3",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  accent: "bg-accent-bright text-[#1b1407] hover:brightness-105",
  danger: "bg-bad-soft text-bad hover:brightness-95",
  outline: "border border-line-strong text-ink hover:bg-surface-2",
};

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg" }>(
  function Button({ variant = "primary", size = "md", className, ...p }, ref) {
    return (
      <button
        ref={ref}
        {...p}
        className={cx(
          "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[transform,background-color,filter] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
          size === "sm" ? "h-8 px-3 text-[13px]" : size === "lg" ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-sm",
          BTN[variant],
          className,
        )}
      />
    );
  },
);

export type Tone = "neutral" | "ok" | "warn" | "bad" | "info" | "accent" | "brand";
const TONE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent",
  brand: "bg-brand-soft text-brand",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium", TONE[tone], className)}>{children}</span>;
}

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...p} className={cx("min-w-0 rounded-2xl border border-line bg-surface", className)}>
      {children}
    </div>
  );
}

export function CardHead({ title, sub, action, className }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-start justify-between gap-3 px-5 pt-4", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Avatar({ agent, name, hue, size = 32 }: { agent?: Staff; name?: string; hue?: number; size?: number }) {
  const label = agent?.initials ?? (name ?? "?").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  const h = agent?.hue ?? hue ?? hashHue(name ?? "x");
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${h} 32% 86%)`, color: `hsl(${h} 45% 24%)` }}
    >
      {label}
    </span>
  );
}

export function hashHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: (id: string) => React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-xs text-ink-3">{hint}</p>}
      {error && <p role="alert" className="text-xs text-bad">{error}</p>}
    </div>
  );
}

const inputCls = "h-10 w-full rounded-[10px] border border-control bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={cx(inputCls, className)} />;
});

export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={cx(className?.includes("w-auto") ? inputCls.replace("w-full ", "") : inputCls, "appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pe-8 rtl:bg-[left_12px_center]", className)} style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' fill='none' stroke='%235f6f66' stroke-width='1.5'/></svg>\")" }}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(inputCls, "h-auto min-h-24 py-2.5 leading-relaxed", className)} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors", checked ? "bg-brand" : "bg-ink-3")}
    >
      <span className={cx("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5 rtl:-translate-x-0.5")} />
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string; size?: "sm" | "md" }) {
  return (
    <div role="group" className={cx("inline-flex gap-0.5 rounded-full bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-full font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-[13px]",
            o.value === value ? "bg-surface text-ink shadow-soft" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Focus management for dialogs: focus in, trap Tab, Escape closes, restore focus on close. */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    const t = setTimeout(() => (focusables().find((el) => el.dataset.autofocus !== undefined) ?? focusables()[1] ?? focusables()[0])?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) ((e.preventDefault()), last.focus());
      else if (!e.shiftKey && document.activeElement === last) ((e.preventDefault()), first.focus());
    };
    const el = ref.current;
    el?.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      el?.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);
  return ref;
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  const ref = useDialog(open, onClose);
  const titleId = useId();
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#06100b]/50 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: 24, opacity: 0, scale: 0.99 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            className={cx("relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-lift sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
          >
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
              <h2 id={titleId} className="text-base font-semibold text-ink">{title}</h2>
              <button onClick={onClose} className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="scrollbar-thin overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Sheet({ open, onClose, title, children, width = 520 }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; width?: number }) {
  const ref = useDialog(open, onClose);
  const titleId = useId();
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#06100b]/40" onClick={onClose} />
          <motion.aside
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            style={{ maxWidth: width }}
            className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-surface shadow-lift"
          >
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
              <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-ink">{title}</h2>
              <button onClick={onClose} className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Empty({ icon, title, sub, action }: { icon?: React.ReactNode; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 text-ink-3">{icon}</div>}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {sub && <p className="max-w-sm text-[13px] text-ink-3">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Logo({ size = 32, withWord = false, light = false }: { size?: number; withWord?: boolean; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <rect width="40" height="40" rx="12" fill="var(--brand)" />
        <text x="20" y="27" textAnchor="middle" fontFamily="var(--font-display-face), Georgia, serif" fontStyle="italic" fontWeight="700" fontSize="20" fill="var(--brand-ink)">kb</text>
        <circle cx="30.5" cy="10" r="3" fill="var(--accent-bright)" />
      </svg>
      {withWord && (
        <span className={cx("font-display text-[19px] font-semibold leading-none", light ? "text-white" : "text-ink")}>
          koret<span className={cx("italic", light ? "text-accent-bright" : "text-brand")}>bakes</span>
        </span>
      )}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-surface-2", className)} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">{children}</kbd>;
}

/** Small optimised image (next/image) for thumbnails in lists and tables. */
export function Thumb({ src, className, sizes = "96px" }: { src: string; className?: string; sizes?: string }) {
  return (
    <span className={cx("relative block shrink-0 overflow-hidden", className)}>
      <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
    </span>
  );
}
