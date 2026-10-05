"use client";

import { Star } from "@phosphor-icons/react";
import type { Category, Cohort, ConvChannel, OrderStatus } from "@/lib/types";
import { cx } from "../ui";

// Small shared pieces for the public storefront pages.

export function openChannel(channel: ConvChannel, prefill?: string) {
  window.dispatchEvent(new CustomEvent("open-channel", { detail: { channel, prefill } }));
}

export const CATEGORIES: { id: Exclude<Category, "corporate">; label: string; blurb: string; image: string }[] = [
  { id: "celebration-cakes", label: "Celebration cakes", blurb: "Birthdays, weddings and every milestone", image: "/img/cake-drip-pink.jpg" },
  { id: "cupcakes", label: "Cupcakes", blurb: "Boxes of 6 and 12", image: "/img/cupcake-pink.jpg" },
  { id: "desserts", label: "Desserts", blurb: "Parfaits, cheesecakes, tarts", image: "/img/dessert-tiramisu.jpg" },
  { id: "pastries", label: "Pastries", blurb: "Baked fresh each morning", image: "/img/pastry-cinnamon-rolls.jpg" },
  { id: "cookies", label: "Cookies & gifts", blurb: "Boxes and baskets to send", image: "/img/cookie-basket.jpg" },
];

export const CATEGORY_LABEL: Record<Category, string> = {
  "celebration-cakes": "Celebration cakes",
  cupcakes: "Cupcakes",
  desserts: "Desserts",
  pastries: "Pastries",
  cookies: "Cookies & gifts",
  corporate: "Corporate",
};

export const CAKE_PHOTOS = [
  "/img/cake-drip-pink.jpg",
  "/img/cake-gold-drip.jpg",
  "/img/cake-floral.jpg",
  "/img/cake-sprinkle.jpg",
  "/img/cake-chocolate-drip.jpg",
  "/img/cake-strawberry.jpg",
  "/img/cake-icecream-drip.jpg",
  "/img/cake-kids-emoji.jpg",
  "/img/cake-piping.jpg",
  "/img/cake-wedding-berry.jpg",
  "/img/cake-black-forest.jpg",
  "/img/cake-mirror-orange.jpg",
];

export const leadLabel = (days: number) => (days <= 1 ? "Order 1 day ahead" : `Order ${days} days ahead`);

/** Lagos date key (YYYY-MM-DD) to an ISO instant at 3pm Lagos time. */
export const dueIsoFor = (key: string) => `${key}T15:00:00+01:00`;

export const prettyDay = (key: string, long = false) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: long ? "long" : "short", day: "numeric", month: long ? "long" : "short", timeZone: "UTC" });

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-0.5 text-accent-bright", className)} aria-label={`${value} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} weight={i <= Math.round(value) ? "fill" : "regular"} aria-hidden />
      ))}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cx("text-[12px] font-semibold uppercase tracking-[0.18em] text-brand", className)}>{children}</p>;
}

export function PageIntro({ eyebrow, title, sub, className }: { eyebrow: string; title: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <header className={cx("mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6 sm:pt-16", className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-3 max-w-3xl font-display text-[2.4rem] leading-[1.05] text-ink sm:text-6xl">{title}</h1>
      {sub && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2 sm:text-base">{sub}</p>}
    </header>
  );
}

/** Quantity stepper with accessible buttons. */
export function Stepper({ value, onChange, min = 1, label = "Quantity", size = "md" }: { value: number; onChange: (n: number) => void; min?: number; label?: string; size?: "sm" | "md" }) {
  const btn = cx("grid place-items-center rounded-full text-ink hover:bg-surface-3 disabled:opacity-40", size === "sm" ? "h-7 w-7" : "h-9 w-9");
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Decrease ${label.toLowerCase()}`}>
        <span aria-hidden className="text-lg leading-none">−</span>
      </button>
      <span className={cx("tnum min-w-7 text-center font-semibold text-ink", size === "sm" ? "text-[13px]" : "text-sm")} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} aria-label={`Increase ${label.toLowerCase()}`}>
        <span aria-hidden className="text-lg leading-none">+</span>
      </button>
    </div>
  );
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  enquiry: "Enquiry",
  quoted: "Quoted",
  confirmed: "Confirmed",
  baking: "Baking",
  decorating: "Decorating",
  ready: "Ready",
  "out-for-delivery": "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** The next cohort of a course that has not started yet. */
export function nextCohort(cohorts: Cohort[], courseId: string, now: number) {
  return cohorts.filter((c) => c.courseId === courseId && new Date(c.startDate).getTime() > now).sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];
}

export const MODE_LABEL = { "in-person": "In person, Ikeja", online: "Online", hybrid: "Hybrid" } as const;
