"use client";

import { Star } from "@phosphor-icons/react";
import type { AutomationId, Customer, CustomerOccasion, Occasion, Order, Segment } from "@/lib/types";
import { cx, type Tone } from "../ui";

// Shared helpers for the customer and growth pages (customers, campaigns, reviews, content).

export const DAY = 86400000;

export const firstName = (name: string) => name.split(" ")[0];

/** Replace {{key}} placeholders in a template. Unknown keys are left as they are. */
export function fillTemplate(t: string, vars: Record<string, string>) {
  return t.replace(/\{\{(\w+)\}\}/g, (m, k: string) => vars[k] ?? m);
}

export const SEGMENT: Record<Segment, { label: string; tone: Tone }> = {
  individual: { label: "Individual", tone: "neutral" },
  corporate: { label: "Corporate", tone: "info" },
  student: { label: "Student", tone: "accent" },
  reseller: { label: "Reseller", tone: "brand" },
};

export const TAG_TONE: Record<string, Tone> = { vip: "accent", repeat: "brand", "first-order": "info", lead: "neutral", "big-spender": "ok" };
export const TAG_LABEL: Record<string, string> = { vip: "VIP", repeat: "Repeat", "first-order": "First order", lead: "Lead", "big-spender": "Big spender", "custom-cakes": "Custom cakes", cupcakes: "Cupcakes", corporate: "Corporate", student: "Student", reseller: "Reseller" };

export const OCCASION_LABEL: Record<Occasion, string> = {
  birthday: "Birthday",
  wedding: "Wedding",
  anniversary: "Anniversary",
  "baby-shower": "Baby shower",
  graduation: "Graduation",
  corporate: "Corporate",
  "just-because": "Just because",
  valentine: "Valentine's",
};

/** The next time an MM-DD date comes round (09:00 UTC, matching the engine), and how many days away it is. */
export function nextOccurrence(mmdd: string, now: number) {
  const year = new Date(now).getUTCFullYear();
  let at = new Date(`${year}-${mmdd}T09:00:00Z`).getTime();
  if (at < now - 12 * 3600000) at = new Date(`${year + 1}-${mmdd}T09:00:00Z`).getTime();
  return { at, days: Math.max(0, Math.round((at - now) / DAY)) };
}

export type UpcomingOccasion = CustomerOccasion & { at: number; days: number; customer: Customer };

export function nextOccasion(c: Customer, now: number): UpcomingOccasion | undefined {
  let best: UpcomingOccasion | undefined;
  for (const oc of c.occasions) {
    const n = nextOccurrence(oc.date, now);
    if (!best || n.at < best.at) best = { ...oc, ...n, customer: c };
  }
  return best;
}

export function upcomingOccasions(customers: Customer[], now: number, withinDays = 30) {
  const out: UpcomingOccasion[] = [];
  for (const c of customers) for (const oc of c.occasions) {
    const n = nextOccurrence(oc.date, now);
    if (n.days <= withinDays) out.push({ ...oc, ...n, customer: c });
  }
  return out.sort((a, b) => a.at - b.at);
}

export interface CustomerStats {
  count: number;
  spend: number;
  last?: string;
}

/** Orders count, lifetime spend and last order date per customer (cancelled orders excluded). */
export function statsByCustomer(orders: Order[]) {
  const m = new Map<string, CustomerStats>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const s = m.get(o.customerId) ?? { count: 0, spend: 0 };
    s.count += 1;
    s.spend += o.totalNGN;
    if (!s.last || o.createdAt > s.last) s.last = o.createdAt;
    m.set(o.customerId, s);
  }
  return m;
}

export const dayMonth = (t: number | string) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
export const inDays = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`);

/** Automations that message customers directly; these are managed on the campaigns page. */
export const CUSTOMER_AUTOMATIONS: AutomationId[] = ["quote-follow-up", "payment-reminders", "order-updates", "occasion-reminders", "review-request", "reorder-nudge"];

export function Stars({ rating, size = 14, className }: { rating: number; size?: number; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} weight={i <= rating ? "fill" : "regular"} className={i <= rating ? "text-accent" : "text-ink-3"} />
      ))}
    </span>
  );
}

/** Small WhatsApp-style message bubble used for previews. */
export function Bubble({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("max-w-[34ch] whitespace-pre-wrap rounded-2xl rounded-tl-md bg-ok-soft px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink", className)}>{children}</div>;
}
