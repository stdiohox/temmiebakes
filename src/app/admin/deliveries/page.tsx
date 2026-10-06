"use client";

import Link from "next/link";
import { useState } from "react";
import { MapPin, Moped, Package, Storefront, Truck } from "@phosphor-icons/react";
import { PageHead } from "@/components/app/app-shell";
import { Kpi, Money, PaymentBadge, StatusBadge } from "@/components/app/bits";
import { advance, assignRider, DAY, keyPlus, lagosTime } from "@/components/app/order-ops";
import { Avatar, Badge, Button, Card, CardHead, Empty, Segmented } from "@/components/ui";
import { naira, orderLabel } from "@/lib/engine";
import { money } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { dayKey } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import type { Order, Staff } from "@/lib/types";

const DISPATCHABLE = new Set(["confirmed", "baking", "decorating", "ready", "out-for-delivery", "delivered"]);

export default function DeliveriesPage() {
  const orders = useDemo((s) => s.orders);
  const staff = useDemo((s) => s.staff);
  const zones = useDemo((s) => s.zones);
  const customers = useDemo((s) => s.customers);
  const now = useNow();
  const today = dayKey(now);
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [groupBy, setGroupBy] = useState<"rider" | "zone">("rider");
  const key = day === "today" ? today : keyPlus(now, 1);

  const riders = staff.filter((s) => s.kind === "rider");
  const zoneOf = (o: Order) => zones.find((z) => z.id === o.zoneId);
  const forDay = orders.filter((o) => DISPATCHABLE.has(o.status) && dayKey(o.dueAt) === key).sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1));
  const deliveries = forDay.filter((o) => o.fulfilment === "delivery");
  const pickups = forDay.filter((o) => o.fulfilment === "pickup");

  // KPIs
  const month = today.slice(0, 7);
  const last30 = orders.filter((o) => o.fulfilment === "delivery" && o.status !== "cancelled" && new Date(o.dueAt).getTime() > now - 30 * DAY && new Date(o.dueAt).getTime() <= now);
  const delivered30 = last30.filter((o) => o.status === "delivered");
  const onTime = delivered30.filter((o) => (o.lateMins ?? 0) === 0).length;
  const deliveriesToday = orders.filter((o) => o.fulfilment === "delivery" && DISPATCHABLE.has(o.status) && dayKey(o.dueAt) === today).length;
  const avgFee = last30.length ? last30.reduce((t, o) => t + o.deliveryFeeNGN, 0) / last30.length : 0;
  const monthRevenue = orders.filter((o) => o.fulfilment === "delivery" && o.status !== "cancelled" && dayKey(o.dueAt).slice(0, 7) === month && new Date(o.dueAt).getTime() <= now + DAY).reduce((t, o) => t + o.deliveryFeeNGN, 0);

  const groups: { id: string; title: React.ReactNode; list: Order[] }[] =
    groupBy === "rider"
      ? [
          ...riders.map((r) => ({ id: r.id, title: <RiderTitle r={r} />, list: deliveries.filter((o) => o.riderId === r.id) })),
          { id: "none", title: <span className="text-ink-2">Unassigned</span>, list: deliveries.filter((o) => !o.riderId || !riders.some((r) => r.id === o.riderId)) },
        ]
      : zones
          .map((z) => ({ id: z.id, title: <span className="inline-flex items-center gap-1.5"><MapPin size={15} className="text-brand" /> {z.name} <span className="text-xs font-normal text-ink-3">· {naira(z.feeNGN)} · about {z.etaMins} min</span></span>, list: deliveries.filter((o) => o.zoneId === z.id) }))
          .filter((g) => g.list.length);

  return (
    <div>
      <PageHead
        title="Deliveries"
        icon={<Truck size={26} className="text-brand" />}
        sub="Dispatch board for Musa and Emeka. Dispatching sends the customer the rider's name and ETA on WhatsApp automatically."
        actions={<Segmented value={day} onChange={setDay} options={[{ value: "today", label: "Today" }, { value: "tomorrow", label: "Tomorrow" }]} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Deliveries today" value={deliveriesToday} sub={`${orders.filter((o) => o.fulfilment === "delivery" && o.status === "delivered" && dayKey(o.dueAt) === today).length} already delivered`} />
        <Kpi label="On-time rate, 30 days" value={delivered30.length ? `${Math.round((onTime / delivered30.length) * 100)}%` : "No data"} sub={`${onTime} of ${delivered30.length} delivered on time`} target={delivered30.length ? { text: "95%", met: onTime / delivered30.length >= 0.95 } : undefined} />
        <Kpi label="Average delivery fee" value={money(avgFee)} sub="Last 30 days" />
        <Kpi label="Delivery revenue this month" value={money(monthRevenue)} sub="Fees charged to customers" />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{deliveries.length} deliveries {day}</h2>
        <Segmented size="sm" value={groupBy} onChange={setGroupBy} options={[{ value: "rider", label: "By rider" }, { value: "zone", label: "By zone" }]} />
      </div>

      {deliveries.length === 0 ? (
        <Card className="mb-6"><Empty icon={<Moped size={28} />} title={`No deliveries ${day}`} sub="Delivery orders for this day will appear here." /></Card>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.id} className="min-w-0">
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                <h3 className="min-w-0 text-[14px] font-semibold text-ink">{g.title}</h3>
                <Badge>{g.list.length}</Badge>
              </div>
              {g.list.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-ink-3">No drops assigned</p>
              ) : (
                <ul className="divide-y divide-line">
                  {g.list.map((o) => {
                    const z = zoneOf(o);
                    const c = customers.find((x) => x.id === o.customerId);
                    const others = riders.filter((r) => r.id !== o.riderId);
                    return (
                      <li key={o.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link href={`/admin/orders/${o.id}`} className="text-[13px] font-semibold text-ink hover:underline">{o.number}</Link>
                            <span className="text-[13px] text-ink-2"> · {c?.name}</span>
                            <p className="truncate text-xs text-ink-3">{orderLabel(o)}</p>
                          </div>
                          <StatusBadge status={o.status} />
                        </div>
                        <p className="mt-1.5 text-xs text-ink-2">
                          Due {lagosTime(o.dueAt)} · {z?.name ?? "Zone not set"} · fee {naira(o.deliveryFeeNGN)} · ETA {z?.etaMins ?? 45} min
                        </p>
                        {o.address && <p className="truncate text-xs text-ink-3">{o.address}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <PaymentBadge status={o.paymentStatus} />
                          {o.totalNGN > o.paidNGN && <span className="text-[11.5px] text-warn">Collect {naira(o.totalNGN - o.paidNGN)}</span>}
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {o.status !== "delivered" &&
                            others.map((r) => (
                              <Button key={r.id} size="sm" variant="ghost" onClick={() => assignRider(o.id, r.id)}>
                                Assign to {r.name.split(" ")[0]}
                              </Button>
                            ))}
                          {o.status === "ready" && <Button size="sm" onClick={() => advance(o.id, "out-for-delivery", "Dispatch")}><Moped size={14} /> Dispatch</Button>}
                          {o.status === "out-for-delivery" && <Button size="sm" onClick={() => advance(o.id, "delivered", "Dispatch")}><Package size={14} /> Mark delivered</Button>}
                          {!["ready", "out-for-delivery", "delivered"].includes(o.status) && <span className="self-center text-xs text-ink-3">Still in the kitchen</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHead title={<span className="inline-flex items-center gap-2"><Storefront size={17} className="text-brand" /> Pickups {day}</span>} sub="Collected from the Ikeja studio, 10am to 6pm" />
          {pickups.length === 0 ? (
            <Empty title={`No pickups ${day}`} />
          ) : (
            <ul className="divide-y divide-line px-5 pb-2 pt-2">
              {pickups.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px]"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-ink hover:underline">{o.number}</Link> <span className="text-ink-2">· {customers.find((c) => c.id === o.customerId)?.name}</span></p>
                    <p className="text-xs text-ink-3">{lagosTime(o.dueAt)} · {orderLabel(o)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={o.status} />
                    {o.status === "ready" && <Button size="sm" variant="secondary" onClick={() => advance(o.id, "delivered", "Front desk")}>Mark collected</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0">
          <CardHead title="Delivery zones" sub="Fees and travel time from Ikeja, with orders in the last 30 days" />
          <div className="relative scrollbar-thin overflow-x-auto px-5 pb-4 pt-2">
            <table className="w-full min-w-[360px] text-[13px]">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="py-1.5 font-medium">Zone</th>
                  <th className="py-1.5 text-right font-medium">Fee</th>
                  <th className="py-1.5 text-right font-medium">ETA</th>
                  <th className="py-1.5 text-right font-medium">Orders, 30 days</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id} className="border-t border-line">
                    <td className="py-1.5 text-ink">{z.name}</td>
                    <td className="py-1.5 text-right"><Money ngn={z.feeNGN} className="text-ink" /></td>
                    <td className="tnum py-1.5 text-right text-ink-2">{z.etaMins} min</td>
                    <td className="tnum py-1.5 text-right font-semibold text-ink">{last30.filter((o) => o.zoneId === z.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function RiderTitle({ r }: { r: Staff }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Avatar agent={r} size={26} /> {r.name.split(" ")[0]}
      <span className="text-xs font-normal text-ink-3">{r.role}</span>
    </span>
  );
}
