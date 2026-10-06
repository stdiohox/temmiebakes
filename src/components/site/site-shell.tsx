"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowCounterClockwise, InstagramLogo, ShoppingBag, SquaresFour, WhatsappLogo } from "@phosphor-icons/react";
import { useState } from "react";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import { cx, Logo } from "../ui";
import dynamic from "next/dynamic";

// The chat widget is closed on load, so it does not need to be in the first bundle
const SiteAssistant = dynamic(() => import("./site-assistant").then((m) => m.SiteAssistant), { ssr: false });

export const NAV = [
  { href: "/menu", label: "Menu" },
  { href: "/cake-builder", label: "Custom cakes" },
  { href: "/corporate", label: "Corporate" },
  { href: "/classes", label: "Classes" },
  { href: "/track", label: "Track order" },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) {
    setLastPath(path);
    setOpen(false);
  }
  const reset = useDemo((s) => s.reset);
  const cartCount = useDemo((s) => s.cart.reduce((n, i) => n + i.qty, 0));

  return (
    <div className="grain relative min-h-[100dvh] bg-bg">
      <div className="on-brand no-print flex h-9 items-center justify-center gap-3 bg-brand px-4 text-[12.5px] text-brand-ink">
        <span className="hidden sm:inline">Interactive demo for Temmiebakes · sample data</span>
        <span className="sm:hidden">Demo · sample data</span>
        <button
          onClick={() => {
            void reset();
            toast("Demo reset", "All data restored to the original sample.", "info");
          }}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-white/10"
        >
          <ArrowCounterClockwise size={13} /> Reset
        </button>
        <Link href="/admin" className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 hover:bg-white/20">
          <SquaresFour size={13} /> Back office
        </Link>
      </div>

      <header className="no-print sticky top-3 z-40 mx-auto mt-3 w-[calc(100%-24px)] max-w-6xl">
        <nav className="flex h-14 items-center justify-between gap-3 rounded-full border border-line bg-surface/85 pe-1.5 ps-3 shadow-soft backdrop-blur-xl sm:pe-2 sm:ps-4">
          <Link href="/" className="shrink-0" aria-label="Temmiebakes home">
            <Logo size={30} withWord />
          </Link>
          <div className="hidden items-center gap-1 lg:flex">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} className={cx("rounded-full px-3.5 py-2 text-sm transition-colors", path.startsWith(l.href) ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink")}>
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Link href="/checkout" className="relative grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-surface-2" aria-label={`Basket, ${cartCount} items`}>
              <ShoppingBag size={20} />
              {cartCount > 0 && <span className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-brand-ink">{cartCount}</span>}
            </Link>
            <Link href="/cake-builder" className="hidden h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold text-brand-ink hover:bg-brand-2 sm:inline-flex">
              Order a cake
            </Link>
            <button onClick={() => setOpen(!open)} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 lg:hidden" aria-label="Menu" aria-expanded={open}>
              <span className={cx("absolute h-[1.5px] w-4 bg-ink transition-transform duration-300 ease-out-expo", open ? "rotate-45" : "-translate-y-1")} />
              <span className={cx("absolute h-[1.5px] w-4 bg-ink transition-transform duration-300 ease-out-expo", open ? "-rotate-45" : "translate-y-1")} />
            </button>
          </div>
        </nav>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="mt-2 rounded-3xl border border-line bg-surface/95 p-3 shadow-lift backdrop-blur-xl lg:hidden">
              {[...NAV, { href: "/admin", label: "Back office" }].map((l, i) => (
                <motion.div key={l.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}>
                  <Link href={l.href} className="block rounded-2xl px-4 py-3 font-display text-lg text-ink hover:bg-surface-2">
                    {l.label}
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>{children}</main>
      <SiteAssistant />

      <footer className="no-print mt-24 border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <Logo size={34} withWord />
            <p className="mt-4 text-sm leading-relaxed text-ink-2">Celebration cakes, decadent desserts, corporate breakfasts and baking classes, made in Ikeja and delivered across Lagos.</p>
            <p className="mt-3 text-xs text-ink-3">Interactive demo built for Temmiebakes. Orders, people and figures are sample data.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} className="text-ink-2 hover:text-ink">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2 text-sm text-ink-2">
            <span>Ikeja, Lagos · Mon to Sat, 9am to 7pm</span>
            <button onClick={() => window.dispatchEvent(new CustomEvent("open-channel", { detail: { channel: "whatsapp" } }))} className="inline-flex items-center gap-1.5 text-start hover:text-ink">
              <WhatsappLogo size={16} /> Order on WhatsApp
            </button>
            <button onClick={() => window.dispatchEvent(new CustomEvent("open-channel", { detail: { channel: "instagram" } }))} className="inline-flex items-center gap-1.5 text-start hover:text-ink">
              <InstagramLogo size={16} /> @temmiebakes
            </button>
            <Link href="/admin" className="mt-2 text-brand hover:underline">Back office</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
