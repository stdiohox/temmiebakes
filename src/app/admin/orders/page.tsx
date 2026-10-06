"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Kanban, MagnifyingGlass, Plus, Rows, Sparkle } from "@phosphor-icons/react";
import { ChannelIcon, CHANNEL, Kpi, Money, ORDER_STATUS, PAYMENT, PaymentBadge, StatusBadge, useLookup } from "@/components/app/bits";
import { PageHead } from "@/components/app/app-shell";
import { NewOrderSheet } from "@/components/app/new-order-sheet";
import { advance, DAY, keyPlus, lagosDateTime, nextLabel, nextStatus } from "@/components/app/order-ops";
import { Badge, Button, Card, cx, Empty, Input, Segmented, Select } from "@/components/ui";
import { naira } from "@/lib/engine";
import { money } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { dayKey, pointsBooked } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import type { Channel, Order, OrderStatus, PaymentStatus } from "@/lib/types";

const COLUMNS: OrderStatus[] = ["enquiry", "quoted", "confirmed", "baking", "decorating", "ready", "out-for-delivery", "delivered"];
const COLUMN_CAP = 40;

export default function OrdersPage() {
  const orders = useDemo((s) => s.orders);
  const cap = useDemo((s) => s.dailyCapacity);
  const L = useLookup();
  const now = useNow();
  const today = dayKey(now);

  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [payment, setPayment] = useState<PaymentStatus | "all">("all");
  const [range, setRange] = useState<"today" | "week" | "all">("all");
  const [newOrderDate, setNewOrderDate] = useState<string | null>(null);

  // KPIs
  const live = orders.filter((o) => o.status !== "cancelled");
  const dueToday = live.filter((o) => o.status !== "enquiry" && dayKey(o.dueAt) === today);
  const unpaidQuotes = live.filter((o) => o.status === "quoted" && o.paymentStatus === "unpaid");
  const balances = live.filter((o) => !["enquiry", "quoted"].includes(o.status) && o.totalNGN > o.paidNGN);
  const balanceTotal = balances.reduce((t, o) => t + o.totalNGN - o.paidNGN, 0);
  const booked = pointsBooked(orders, today);

  // Filters
  const q = query.trim().toLowerCase();
  const weekEnd = keyPlus(now, 6);
  const matchesQuery = (o: Order) => !q || o.number.toLowerCase().includes(q) || (L.customer(o.customerId)?.name.toLowerCase().includes(q) ?? false);
  const filtered = orders
    .filter(matchesQuery)
    .filter((o) => channel === "all" || o.channel === channel)
    .filter((o) => payment === "all" || o.paymentStatus === payment);
  const listRows = filtered
    .filter((o) => status === "all" || o.status === status)
    .filter((o) => {
      const k = dayKey(o.dueAt);
      return range === "all" || (range === "today" ? k === today : k >= today && k <= weekEnd);
    })
    .sort((a, b) => (range === "all" ? (a.dueAt < b.dueAt ? 1 : -1) : a.dueAt < b.dueAt ? -1 : 1));

  const threeDaysAgo = dayKey(now - 3 * DAY);
  const columnOrders = (st: OrderStatus) =>
    filtered
      .filter((o) => o.status === st && (st !== "delivered" || dayKey(o.dueAt) >= threeDaysAgo))
      .sort((a, b) => (st === "delivered" ? (a.dueAt < b.dueAt ? 1 : -1) : a.dueAt < b.dueAt ? -1 : 1));

  return (
    <div>
      <PageHead
        title="Orders"
        icon={<Kanban size={26} className="text-brand" />}
        sub="Every order from Instagram, WhatsApp, the website and the counter in one place. Moving a card updates the customer automatically."
        actions={<Button onClick={() => setNewOrderDate(dayKey(Date.now() + DAY))}><Plus size={16} /> New order</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Due today" value={dueToday.length} sub={`${dueToday.filter((o) => o.status === "delivered").length} already delivered or collected`} />
        <Kpi label="Unpaid quotes" value={money(unpaidQuotes.reduce((t, o) => t + o.totalNGN, 0))} sub={`${unpaidQuotes.length} quotes awaiting a deposit`} />
        <Kpi label="Balances outstanding" value={money(balanceTotal)} sub={`${balances.length} confirmed orders not fully paid`} />
        <Kpi label="Today's capacity used" value={`${booked}/${cap}`} sub={`${Math.round((booked / Math.max(1, cap)) * 100)}% of oven points booked`} tone={booked / cap > 0.85 ? "down" : undefined} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "board", label: <span className="inline-flex items-center gap-1.5"><Kanban size={14} /> Board</span> },
            { value: "list", label: <span className="inline-flex items-center gap-1.5"><Rows size={14} /> List</span> },
          ]}
        />
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <MagnifyingGlass size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input aria-label="Search orders by number or customer" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search TB-1042 or customer" className="ps-9" />
        </div>
        <Select aria-label="Filter by channel" value={channel} onChange={(e) => setChannel(e.target.value as Channel | "all")} className="w-auto">
          <option value="all">All channels</option>
          {(Object.keys(CHANNEL) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL[c].label}</option>)}
        </Select>
        <Select aria-label="Filter by payment" value={payment} onChange={(e) => setPayment(e.target.value as PaymentStatus | "all")} className="w-auto">
          <option value="all">Any payment</option>
          {(Object.keys(PAYMENT) as PaymentStatus[]).map((p) => <option key={p} value={p}>{PAYMENT[p].label}</option>)}
        </Select>
        {view === "list" && (
          <>
            <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "all")} className="w-auto">
              <option value="all">All statuses</option>
              {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => <option key={s} value={s}>{ORDER_STATUS[s].label}</option>)}
            </Select>
            <Segmented size="sm" value={range} onChange={setRange} options={[{ value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "all", label: "All" }]} />
          </>
        )}
      </div>

      {view === "board" ? (
        <Board columnOrders={columnOrders} />
      ) : (
        <Card className="overflow-hidden">
          <div className="relative scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="px-4 py-2.5 font-medium">Order</th>
                  <th className="px-3 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium">Items</th>
                  <th className="px-3 py-2.5 font-medium">Due</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Payment</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {listRows.slice(0, 150).map((o) => {
                  const c = L.customer(o.customerId);
                  const nl = nextLabel(o);
                  const ns = nextStatus(o);
                  return (
                    <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface-2/50">
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/orders/${o.id}`} className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline">
                          <ChannelIcon channel={o.channel} size={14} /> {o.number}
                        </Link>
                        {o.assistedByAI && <Sparkle size={12} weight="fill" className="ms-1 inline text-accent" aria-label="Taken by Tia (AI)" />}
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-2.5 text-ink">{c?.name}</td>
                      <td className="max-w-[220px] truncate px-3 py-2.5 text-ink-2">{firstItem(o)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">{lagosDateTime(o.dueAt)}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={o.status} /></td>
                      <td className="px-3 py-2.5"><PaymentBadge status={o.paymentStatus} /></td>
                      <td className="px-3 py-2.5 text-right"><Money ngn={o.totalNGN} className="text-ink" /></td>
                      <td className="px-4 py-2.5 text-right">
                        {nl && ns && <Button size="sm" variant="ghost" onClick={() => advance(o.id, ns)}>{nl}</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {listRows.length === 0 && <Empty title="No orders match" sub="Try a different search, channel or date range." />}
          {listRows.length > 150 && <p className="border-t border-line px-4 py-2.5 text-xs text-ink-3">Showing 150 of {listRows.length}. Narrow the filters to see more.</p>}
        </Card>
      )}

      <NewOrderSheet defaultDate={newOrderDate} onClose={() => setNewOrderDate(null)} />
    </div>
  );
}

function firstItem(o: Order) {
  const it = o.items[0];
  const name = it?.custom ? "Custom cake" : it?.name ?? "Order";
  return o.items.length > 1 ? `${name} + ${o.items.length - 1} more` : name;
}

function Board({ columnOrders }: { columnOrders: (s: OrderStatus) => Order[] }) {
  const [over, setOver] = useState<OrderStatus | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const drop = (e: React.DragEvent, st: OrderStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setOver(null);
    setDragId(null);
    if (id) advance(id, st);
  };

  return (
    <div className="relative scrollbar-thin -mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
      <div className="flex gap-3">
        {COLUMNS.map((st) => {
          const list = columnOrders(st);
          return (
            <section
              key={st}
              aria-label={`${ORDER_STATUS[st].label} column`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== st) setOver(st);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((v) => (v === st ? null : v));
              }}
              onDrop={(e) => drop(e, st)}
              className={cx("flex w-[272px] shrink-0 flex-col rounded-2xl border bg-surface-2/60 transition-colors", over === st ? "border-brand bg-brand-soft/60" : "border-line")}
            >
              <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <StatusBadge status={st} />
                  {st === "delivered" && <span className="text-[11px] font-normal text-ink-3">last 3 days</span>}
                </h2>
                <span className="tnum text-xs text-ink-3">{list.length}</span>
              </header>
              <div className="scrollbar-thin flex max-h-[68dvh] min-h-24 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {list.slice(0, COLUMN_CAP).map((o) => (
                  <OrderCard key={o.id} o={o} dragging={dragId === o.id} onDragStart={() => setDragId(o.id)} onDragEnd={() => ((setDragId(null), setOver(null)))} />
                ))}
                {list.length > COLUMN_CAP && <p className="px-1 py-1 text-xs text-ink-3">+{list.length - COLUMN_CAP} more. Use the list view to see them all.</p>}
                {list.length === 0 && <p className="px-1 py-6 text-center text-xs text-ink-3">Drop an order here</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({ o, dragging, onDragStart, onDragEnd }: { o: Order; dragging: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  const c = useDemo((s) => s.customers.find((x) => x.id === o.customerId));
  const ns = nextStatus(o);
  const nl = nextLabel(o);
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", o.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cx("cursor-grab rounded-xl border border-line bg-surface p-3 shadow-soft active:cursor-grabbing", dragging && "opacity-50")}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/admin/orders/${o.id}`} className="min-w-0 hover:underline">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <ChannelIcon channel={o.channel} size={14} />
            {o.number}
            {o.assistedByAI && <Sparkle size={12} weight="fill" className="text-accent" aria-label="Taken by Tia (AI)" />}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-ink-2">{c?.name ?? "Customer"}</span>
        </Link>
        <Money ngn={o.totalNGN} className="shrink-0 text-xs font-semibold text-ink" />
      </div>
      <p className="mt-1.5 truncate text-[12.5px] text-ink">{firstItem(o)}</p>
      <p className="mt-0.5 text-xs text-ink-3">
        Due {lagosDateTime(o.dueAt)} · {o.fulfilment === "pickup" ? "Pickup" : "Delivery"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PaymentBadge status={o.paymentStatus} />
        <Badge>{o.ovenPoints} pts</Badge>
        {o.totalNGN > o.paidNGN && o.paidNGN > 0 && <span className="tnum text-[11px] text-ink-3">{naira(o.totalNGN - o.paidNGN)} due</span>}
      </div>
      {ns && nl && (
        <Button size="sm" variant="secondary" className="mt-2.5 w-full" onClick={() => advance(o.id, ns)} aria-label={`${nl}: move ${o.number} to ${ORDER_STATUS[ns].label}`}>
          {nl} <ArrowRight size={13} />
        </Button>
      )}
    </article>
  );
}
