"use client";

import { logEvent, moveOrder } from "@/lib/engine";
import { dayKey } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Order, OrderStatus } from "@/lib/types";
import { cx } from "../ui";
import { ORDER_STATUS } from "./bits";

// Order and production helpers shared by the orders, kitchen and deliveries pages.

export const DAY = 86400000;

/** Statuses that trigger an automatic WhatsApp update to the customer (see engine STATUS_MSG). */
const NOTIFY: OrderStatus[] = ["baking", "ready", "out-for-delivery", "delivered"];

/** The full pipeline for an order, skipping dispatch for pickups. */
export function flowFor(o: Pick<Order, "fulfilment">): OrderStatus[] {
  const all: OrderStatus[] = ["enquiry", "quoted", "confirmed", "baking", "decorating", "ready", "out-for-delivery", "delivered"];
  return o.fulfilment === "pickup" ? all.filter((s) => s !== "out-for-delivery") : all;
}

export function nextStatus(o: Pick<Order, "status" | "fulfilment">): OrderStatus | null {
  if (o.status === "cancelled" || o.status === "delivered") return null;
  const flow = flowFor(o);
  return flow[flow.indexOf(o.status) + 1] ?? null;
}

/** Verb for the "next step" button. */
export function nextLabel(o: Pick<Order, "status" | "fulfilment">) {
  const n = nextStatus(o);
  if (!n) return null;
  if (n === "delivered") return o.fulfilment === "pickup" ? "Mark collected" : "Mark delivered";
  if (n === "out-for-delivery") return "Dispatch";
  if (n === "baking") return "Start baking";
  if (n === "decorating") return "Start decorating";
  if (n === "ready") return "Mark ready";
  if (n === "confirmed") return "Confirm";
  if (n === "quoted") return "Mark quoted";
  return ORDER_STATUS[n].label;
}

/** Move an order through the engine and confirm with a toast. */
export function advance(orderId: string, status: OrderStatus, by = "Kitchen") {
  const st = useDemo.getState();
  const o = st.orders.find((x) => x.id === orderId);
  if (!o || o.status === status) return;
  st.run((s) => moveOrder(s, orderId, status, by));
  const auto = st.automations.find((a) => a.id === "order-updates")?.active;
  const label = status === "delivered" && o.fulfilment === "pickup" ? "Collected" : ORDER_STATUS[status].label;
  toast(
    `${o.number} moved to ${label.toLowerCase()}`,
    auto && NOTIFY.includes(status) ? "Customer updated automatically on WhatsApp." : "Logged on the automation timeline.",
    status === "cancelled" ? "warn" : "ok",
  );
}

export function assignRider(orderId: string, riderId: string) {
  const st = useDemo.getState();
  const o = st.orders.find((x) => x.id === orderId);
  const rider = st.staff.find((x) => x.id === riderId);
  if (!o || !rider) return;
  st.run((s) => {
    const d = s.orders.find((x) => x.id === orderId);
    if (!d) return;
    d.riderId = riderId;
    d.updatedAt = new Date().toISOString();
    logEvent(s, { automation: "order-updates", kind: "action", title: `${d.number} assigned to ${rider.name.split(" ")[0]}`, detail: "Rider gets the address and customer pin on WhatsApp", customerId: d.customerId, orderId, minutesSaved: 2 });
  });
  toast(`${o.number} assigned to ${rider.name.split(" ")[0]}`, "Rider briefed with the address and customer pin.");
}

/** Lagos calendar helpers. Keys are YYYY-MM-DD. */
export const keyPlus = (now: number, days: number) => dayKey(now + days * DAY);
export const isSunday = (key: string) => new Date(key + "T12:00:00Z").getUTCDay() === 0;
export const dayLabel = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(key + "T12:00:00Z").toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
export const lagosTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });
export const lagosDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Capacity bar without a background track; turns warm above 85%. */
export function CapacityBar({ used, cap, className }: { used: number; cap: number; className?: string }) {
  const ratio = cap > 0 ? used / cap : 0;
  return (
    <div className={cx("h-1.5", className)} role="img" aria-label={`${used} of ${cap} oven points booked`}>
      <div
        className={cx("h-1.5 rounded-full transition-[width]", ratio > 1 ? "bg-bad" : ratio > 0.85 ? "bg-warn" : "bg-brand")}
        style={{ width: `${Math.min(100, Math.max(ratio > 0 ? 3 : 0, ratio * 100))}%` }}
      />
    </div>
  );
}
