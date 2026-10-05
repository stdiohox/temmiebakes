"use client";

import Link from "next/link";
import { ChatCircleDots, Globe, InstagramLogo, Phone, Storefront, Buildings, WhatsappLogo, EnvelopeSimple, ChatTeardropText } from "@phosphor-icons/react";
import { naira } from "@/lib/engine";
import { useDemo } from "@/lib/store";
import type { AutomationId, Channel, ConvChannel, Customer, OrderStatus, OutboundChannel, OutboundStatus, PaymentStatus } from "@/lib/types";
import { Avatar, Badge, cx, type Tone } from "../ui";

// Shared back-office vocabulary: labels, colours and icons used on every admin page.

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  enquiry: { label: "Enquiry", tone: "neutral" },
  quoted: { label: "Quoted", tone: "info" },
  confirmed: { label: "Confirmed", tone: "brand" },
  baking: { label: "Baking", tone: "accent" },
  decorating: { label: "Decorating", tone: "accent" },
  ready: { label: "Ready", tone: "ok" },
  "out-for-delivery": { label: "Out for delivery", tone: "ok" },
  delivered: { label: "Delivered", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "bad" },
};

export const KITCHEN_FLOW: OrderStatus[] = ["confirmed", "baking", "decorating", "ready", "out-for-delivery", "delivered"];

export const PAYMENT: Record<PaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "warn" },
  deposit: { label: "Deposit paid", tone: "info" },
  paid: { label: "Paid in full", tone: "ok" },
  refunded: { label: "Refunded", tone: "bad" },
};

export const CHANNEL: Record<Channel, { label: string; icon: typeof Globe; color: string }> = {
  instagram: { label: "Instagram", icon: InstagramLogo, color: "text-[#c13584] dark:text-[#e36aaa]" },
  whatsapp: { label: "WhatsApp", icon: WhatsappLogo, color: "text-wa" },
  web: { label: "Website", icon: Globe, color: "text-brand" },
  "walk-in": { label: "Walk-in", icon: Storefront, color: "text-ink-2" },
  phone: { label: "Phone", icon: Phone, color: "text-ink-2" },
  corporate: { label: "Corporate", icon: Buildings, color: "text-info" },
};

export const CONV_CHANNEL: Record<ConvChannel, { label: string; icon: typeof Globe; color: string }> = {
  instagram: CHANNEL.instagram,
  whatsapp: CHANNEL.whatsapp,
  web: { label: "Website chat", icon: ChatCircleDots, color: "text-brand" },
};

export const OUT_CHANNEL: Record<OutboundChannel, { label: string; icon: typeof Globe }> = {
  whatsapp: { label: "WhatsApp", icon: WhatsappLogo },
  instagram: { label: "Instagram DM", icon: InstagramLogo },
  sms: { label: "SMS", icon: ChatTeardropText },
  email: { label: "Email", icon: EnvelopeSimple },
};

export const OUT_STATUS: Record<OutboundStatus, Tone> = { scheduled: "info", sent: "neutral", delivered: "brand", read: "ok", replied: "accent", failed: "bad" };

export const AUTOMATION_LABEL = (id?: AutomationId) => useDemo.getState().automations.find((a) => a.id === id)?.name ?? "Manual";

export function ChannelIcon({ channel, size = 16 }: { channel: Channel; size?: number }) {
  const C = CHANNEL[channel];
  return <C.icon size={size} weight="fill" className={C.color} aria-label={C.label} />;
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_STATUS[status].tone}>{ORDER_STATUS[status].label}</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT[status].tone}>{PAYMENT[status].label}</Badge>;
}

export function Money({ ngn, className }: { ngn: number; className?: string }) {
  return <span className={cx("tnum", className)}>{naira(ngn)}</span>;
}

export function CustomerChip({ c, sub }: { c: Customer; sub?: React.ReactNode }) {
  return (
    <Link href={`/admin/customers/${c.id}`} className="group flex min-w-0 items-center gap-2.5">
      <Avatar name={c.name} size={30} />
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-ink group-hover:underline">{c.name}</span>
        <span className="block truncate text-xs text-ink-3">{sub ?? (c.company ?? c.instagram ?? c.phone)}</span>
      </span>
    </Link>
  );
}

/** Lookups by id. Each call subscribes to the relevant slice only. */
export function useLookup() {
  const customers = useDemo((s) => s.customers);
  const products = useDemo((s) => s.products);
  const staff = useDemo((s) => s.staff);
  const zones = useDemo((s) => s.zones);
  const orders = useDemo((s) => s.orders);
  return {
    customer: (id?: string) => customers.find((c) => c.id === id),
    product: (id?: string) => products.find((p) => p.id === id),
    staff: (id?: string) => staff.find((s) => s.id === id),
    zone: (id?: string) => zones.find((z) => z.id === id),
    order: (id?: string) => orders.find((o) => o.id === id),
  };
}

export function Kpi({ label, value, sub, tone, target }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "up" | "down"; target?: { text: string; met: boolean } }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[12.5px] text-ink-3">{label}</p>
      <p className="tnum mt-1 font-display text-[26px] font-semibold leading-tight text-ink">{value}</p>
      {sub && <p className={cx("mt-1 text-xs", tone === "up" ? "text-ok" : tone === "down" ? "text-bad" : "text-ink-3")}>{sub}</p>}
      {target && <p className={cx("mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", target.met ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>{target.met ? "On target" : "Below target"} · {target.text}</p>}
    </div>
  );
}

export function Staffer({ id, size = 22 }: { id?: string; size?: number }) {
  const s = useDemo((st) => st.staff.find((x) => x.id === id));
  if (!s) return <span className="text-xs text-ink-3">Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink">
      <Avatar agent={s} size={size} /> {s.name.split(" ")[0]}
    </span>
  );
}
