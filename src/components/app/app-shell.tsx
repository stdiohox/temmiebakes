"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowCounterClockwise, Brain, CalendarDots, ChartLineUp, ChatsCircle, Cookie, FlowArrow, GraduationCap, Handshake, House,
  Kanban, List, Megaphone, Moon, Package, Sparkle, Star, Sun, Truck, UsersThree, X,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import { cx, Logo } from "../ui";

export const ADMIN_NAV: { group: string; items: { href: string; label: string; icon: typeof House; badge?: "inbox" }[] }[] = [
  { group: "Overview", items: [
    { href: "/admin", label: "Dashboard", icon: ChartLineUp },
    { href: "/admin/automations", label: "Automations", icon: FlowArrow },
  ] },
  { group: "Orders", items: [
    { href: "/admin/inbox", label: "DMs & chats", icon: ChatsCircle, badge: "inbox" },
    { href: "/admin/orders", label: "Orders", icon: Kanban },
    { href: "/admin/kitchen", label: "Kitchen calendar", icon: CalendarDots },
    { href: "/admin/deliveries", label: "Deliveries", icon: Truck },
  ] },
  { group: "Customers", items: [
    { href: "/admin/customers", label: "Customers", icon: UsersThree },
    { href: "/admin/campaigns", label: "Reminders & campaigns", icon: Megaphone },
    { href: "/admin/reviews", label: "Reviews", icon: Star },
    { href: "/admin/content", label: "AI content", icon: Sparkle },
  ] },
  { group: "Business", items: [
    { href: "/admin/corporate", label: "Corporate catering", icon: Handshake },
    { href: "/admin/academy", label: "Academy", icon: GraduationCap },
    { href: "/admin/stock", label: "Stock & costing", icon: Package },
    { href: "/admin/menu", label: "Menu & pricing", icon: Cookie },
    { href: "/admin/assistant", label: "Tia settings", icon: Brain },
  ] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) {
    setLastPath(path);
    setOpen(false);
  }
  const role = useDemo((s) => s.role);
  const setPrefs = useDemo((s) => s.setPrefs);
  const reset = useDemo((s) => s.reset);
  const unread = useDemo((s) => s.conversations.filter((c) => c.unread > 0 || c.status === "handoff").length);
  // The back office renders client-side only (after the store boots), so reading the DOM is safe here
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    (document.documentElement.dataset.theme as "light" | "dark") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  const flipTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("tb-theme", next);
    } catch {}
    setTheme(next);
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/admin" className="flex items-center gap-2">
          <Logo size={30} withWord />
        </Link>
        <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-ink-3 lg:hidden" aria-label="Close menu">
          <X size={18} />
        </button>
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2.5 pb-4">
        {ADMIN_NAV.map((g) => (
          <div key={g.group} className="mt-3">
            <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{g.group}</p>
            {g.items.map((it) => {
              const active = it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
              return (
                <Link key={it.href} href={it.href} className={cx("flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] transition-colors", active ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}>
                  <it.icon size={18} weight={active ? "fill" : "regular"} />
                  <span className="flex-1">{it.label}</span>
                  {it.badge === "inbox" && unread > 0 && <span className={cx("rounded-full px-1.5 text-[11px] font-semibold", active ? "bg-white/20" : "bg-accent-bright text-[#1b1407]")}>{unread}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <Link href="/" className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">
          <House size={17} /> View website
        </Link>
        <button onClick={() => { void reset(); toast("Demo reset", "All data restored to the original sample.", "info"); }} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">
          <ArrowCounterClockwise size={17} /> Reset demo
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-bg lg:grid lg:grid-cols-[248px_1fr] print:block">
      <aside className="no-print sticky top-0 hidden h-[100dvh] border-e border-line bg-surface lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-[#12060e]/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-[270px] border-e border-line bg-surface shadow-lift">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-xl sm:px-6">
          <button onClick={() => setOpen(true)} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 lg:hidden" aria-label="Open menu">
            <List size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1 rounded-full bg-surface-2 p-0.5" role="group" aria-label="Viewing as">
            {(["owner", "kitchen"] as const).map((r) => (
              <button key={r} onClick={() => setPrefs({ role: r })} aria-pressed={role === r} className={cx("rounded-full px-3 py-1 text-[12.5px] font-medium", role === r ? "bg-surface text-ink shadow-soft" : "text-ink-3")}>
                {r === "owner" ? "Temmie (owner)" : "Kitchen team"}
              </button>
            ))}
          </div>
          <button onClick={flipTheme} className="grid h-8 w-8 place-items-center rounded-full text-ink-2 hover:bg-surface-2" aria-label="Toggle dark mode">
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </header>
        <main className="px-4 pb-20 pt-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions, icon }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 font-display text-[28px] font-semibold text-ink">
          {icon}
          {title}
        </h1>
        {sub && <p className="mt-1 max-w-[72ch] text-sm text-ink-3">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
