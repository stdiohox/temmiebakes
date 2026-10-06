"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle, Lightning, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { PageHead } from "@/components/app/app-shell";
import { CHANNEL, ChannelIcon, Kpi, StatusBadge, useLookup } from "@/components/app/bits";
import { BarList, LineChart, SplitBar } from "@/components/app/charts";
import { Card, CardHead, cx } from "@/components/ui";
import { naira } from "@/lib/engine";
import { ago, duration, money, pct } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { kpis } from "@/lib/kpi";
import { dayKey } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";

const MIX_LABEL: Record<string, string> = { custom: "Custom cakes", "celebration-cakes": "Signature cakes", cupcakes: "Cupcakes", desserts: "Desserts", pastries: "Pastries", cookies: "Cookies & gifts", corporate: "Corporate catering", academy: "Academy" };

export default function Dashboard() {
  const d = useDemo(useShallow((s) => ({ orders: s.orders, customers: s.customers, events: s.events, products: s.products, enrollments: s.enrollments, quotes: s.quotes, goLiveAt: s.goLiveAt, dailyCapacity: s.dailyCapacity, conversations: s.conversations })));
  const now = useNow(60000);
  const k = useMemo(() => kpis(d, now), [d, now]);
  const { customer } = useLookup();
  const goLiveIdx = k.weeks.findIndex((w) => w.afterGoLive);

  const today = dayKey(now);
  const todays = d.orders.filter((o) => dayKey(o.dueAt) === today && o.status !== "cancelled" && o.status !== "enquiry" && o.status !== "quoted").sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1));
  const attention = [
    ...d.orders.filter((o) => o.status === "quoted" && now - new Date(o.createdAt).getTime() > 6 * 3600000 && new Date(o.dueAt).getTime() > now).map((o) => ({ kind: "Quote unpaid", text: `${o.number} · ${customer(o.customerId)?.name}`, href: `/admin/orders/${o.id}`, value: o.totalNGN })),
    ...d.conversations.filter((c) => c.status === "handoff").map((c) => ({ kind: "Needs Koret", text: `${c.name}: ${c.handoffReason}`, href: "/admin/inbox", value: 0 })),
    ...d.orders.filter((o) => o.paymentStatus === "deposit" && new Date(o.dueAt).getTime() - now < 2 * 86400000 && new Date(o.dueAt).getTime() > now).map((o) => ({ kind: "Balance due", text: `${o.number} · due ${ago(o.dueAt, now)}`, href: `/admin/orders/${o.id}`, value: o.totalNGN - o.paidNGN })),
  ].slice(0, 6);

  return (
    <>
      <PageHead
        title="Good day, Koret"
        sub="Everything below is calculated live from orders, chats and the kitchen. Take an action anywhere in the back office and these numbers move."
        actions={<Link href="/admin/automations" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-4 text-sm font-medium text-ink hover:bg-surface-2"><Lightning size={15} weight="fill" className="text-brand" /> What the automations did</Link>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Revenue, last 30 days" value={money(k.revenue30)} sub={`${k.growth >= 0 ? "+" : ""}${pct(k.growth, 0)} on the previous 30 days`} tone={k.growth >= 0 ? "up" : "down"} />
        <Kpi label="Orders, last 30 days" value={String(k.orders30)} sub={`Average order ${naira(k.aov)}`} />
        <Kpi label="First reply to DMs" value={duration(k.responseNow)} sub={`Was ${duration(k.responseBefore)} before Tia`} tone="up" target={{ text: "under 5 min", met: k.responseNow < 5 }} />
        <Kpi label="Enquiries that pay" value={pct(k.conversionNow, 0)} sub={`Was ${pct(k.conversionBefore, 0)} before automation`} tone="up" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Kitchen booked, next 7 days" value={pct(k.utilisation, 0)} sub={`${d.dailyCapacity} oven points a day`} />
        <Kpi label="On-time delivery" value={pct(k.onTimeNow, 0)} sub={`Was ${pct(k.onTimeBefore, 0)} before order updates`} tone="up" />
        <Kpi label="Average rating" value={`${k.rating.toFixed(1)} ★`} sub={`${k.ratedCount} reviews collected automatically`} />
        <Kpi label="Hours saved a week" value={`${k.hoursSavedWeek.toFixed(0)} h`} sub={`${pct(k.aiShare, 0)} of orders handled by Tia`} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHead title="Weekly revenue" sub="Orders by due date, last 16 weeks" />
          <div className="px-3 pb-3 pt-2">
            <LineChart label="Weekly revenue" data={k.weeks.map((w) => ({ label: w.label, value: w.revenue }))} format={(v) => money(v)} marker={goLiveIdx > 0 ? { index: goLiveIdx, label: "Automation live" } : undefined} />
          </div>
        </Card>
        <Card>
          <CardHead title="Needs your attention" sub="Quotes, handoffs and balances" />
          <div className="divide-y divide-line px-5 pb-3 pt-2">
            {attention.length ? attention.map((a, i) => (
              <Link key={i} href={a.href} className="flex items-center gap-3 py-2.5 text-[13.5px] hover:opacity-80">
                <WarningCircle size={18} className={a.kind === "Needs Koret" ? "text-brand" : "text-warn"} weight="fill" />
                <span className="min-w-0 flex-1"><span className="block font-medium text-ink">{a.kind}</span><span className="block truncate text-xs text-ink-3">{a.text}</span></span>
                {a.value > 0 && <span className="tnum text-[13px] font-semibold text-ink">{naira(a.value)}</span>}
              </Link>
            )) : <p className="flex items-center gap-2 py-6 text-sm text-ink-3"><CheckCircle size={18} className="text-ok" /> All clear</p>}
          </div>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHead title="Today in the kitchen" sub={`${todays.length} orders due today`} action={<Link href="/admin/kitchen" className="text-xs font-medium text-brand underline">Calendar</Link>} />
          <div className="divide-y divide-line px-5 pb-3 pt-2">
            {todays.slice(0, 7).map((o) => (
              <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center gap-2 py-2 text-[13px]">
                <span className="tnum w-12 shrink-0 text-ink-3">{new Date(o.dueAt).toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{o.items[0].custom ? "Custom cake" : o.items[0].name}</span>
                <StatusBadge status={o.status} />
              </Link>
            ))}
            {!todays.length && <p className="py-6 text-sm text-ink-3">No orders due today.</p>}
          </div>
        </Card>
        <Card>
          <CardHead title="Where orders come from" sub="Last 30 days" />
          <div className="p-5">
            <BarList label="Revenue by channel" items={k.byChannel.filter((c) => c.count).sort((a, b) => b.value - a.value).map((c) => ({ label: CHANNEL[c.channel].label, value: c.value, sub: `${c.count} orders` }))} format={money} />
          </div>
        </Card>
        <Card>
          <CardHead title="Sales mix" sub="Last 30 days" />
          <div className="p-5">
            <BarList label="Sales by category" items={Object.entries(k.mix).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([key, v]) => ({ label: MIX_LABEL[key] ?? key, value: v }))} format={money} />
            <p className="mt-4 text-xs text-ink-3">Gross margin after ingredients and packaging: <span className="font-semibold text-ink">{pct(k.margin, 0)}</span></p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHead title="What automation is worth" sub="Last 30 days" />
          <div className="grid gap-4 p-5">
            <div>
              <p className="tnum font-display text-3xl font-semibold text-ink">{money(k.influenced)}</p>
              <p className="text-xs text-ink-3">Revenue from orders Tia handled, birthday reminders and re-order nudges</p>
            </div>
            <SplitBar a={k.influenced} b={Math.max(0, k.revenue30 - k.influenced)} labels={["Automation-assisted", "Other"]} format={money} />
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div className="rounded-xl bg-surface-2 p-3"><p className="text-ink-3">Balances still to collect</p><p className="tnum mt-1 font-semibold text-ink">{naira(k.outstanding)}</p></div>
              <div className="rounded-xl bg-surface-2 p-3"><p className="text-ink-3">Corporate quotes out</p><p className="tnum mt-1 font-semibold text-ink">{naira(k.corporatePipeline)}</p></div>
            </div>
          </div>
        </Card>
        <Card>
          <CardHead title="Best sellers" sub="Last 30 days" />
          <div className="p-5">
            <BarList label="Top products" items={k.top.map((p) => ({ label: p.name, value: p.value, sub: `${p.qty} sold` }))} format={money} />
          </div>
          <div className="border-t border-line px-5 py-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3"><Sparkle size={13} className="text-brand" /> Latest from Tia</p>
            {d.conversations.slice(0, 3).map((c) => (
              <Link key={c.id} href="/admin/inbox" className="flex items-center gap-2 py-1.5 text-[13px] hover:underline">
                <ChannelIcon channel={c.channel} size={14} />
                <span className="min-w-0 flex-1 truncate text-ink">{c.name}: <span className="text-ink-3">{c.messages[c.messages.length - 1]?.text}</span></span>
                <span className={cx("shrink-0 text-[11px]", c.status === "handoff" ? "text-brand" : "text-ink-3")}>{c.status === "handoff" ? "Needs you" : ago(c.lastAt, now)}</span>
              </Link>
            ))}
            <Link href="/admin/inbox" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand">Open inbox <ArrowUpRight size={12} /></Link>
          </div>
        </Card>
      </div>
    </>
  );
}
