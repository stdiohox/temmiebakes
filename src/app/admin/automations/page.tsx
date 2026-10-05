"use client";

import Link from "next/link";
import { ArrowRight, Bell, ChatCircleDots, FileCode, Lightning, Play, Robot, Warning } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { PageHead } from "@/components/app/app-shell";
import { Kpi } from "@/components/app/bits";
import { LineChart } from "@/components/app/charts";
import { Badge, Button, Card, CardHead, Select, Toggle, cx } from "@/components/ui";
import { logEvent, naira, orderLabel, runOccasionReminders, runReorderNudges, send } from "@/lib/engine";
import { ago, money } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { kpis } from "@/lib/kpi";
import { dayKey, pointsBooked } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { AutoEvent, AutomationId, DemoData } from "@/lib/types";

type S = DemoData;
const DAY = 86400000;
const first = (s: S, id: string) => (s.customers.find((c) => c.id === id)?.name ?? "there").split(" ")[0];

// What "Run now" does for each workflow. Anything without a runner links to where it happens live.
const RUNNERS: Partial<Record<AutomationId, { label: string; fn: (s: S) => string }>> = {
  "occasion-reminders": { label: "Send due reminders", fn: (s) => `${runOccasionReminders(s)} birthday and anniversary reminders sent` },
  "reorder-nudge": { label: "Nudge quiet customers", fn: (s) => `${runReorderNudges(s)} re-order nudges sent` },
  "quote-follow-up": {
    label: "Chase unpaid quotes",
    fn: (s) => {
      const now = Date.now();
      const due = s.orders.filter((o) => o.status === "quoted" && now - new Date(o.createdAt).getTime() > 6 * 3600000 && new Date(o.dueAt).getTime() > now && !s.outbound.some((m) => m.orderId === o.id && m.automationId === "quote-follow-up" && now - new Date(m.scheduledFor).getTime() < DAY));
      due.forEach((o) => {
        const m = send(s, o.customerId, "whatsapp", `Hi ${first(s, o.customerId)}, just checking you saw your quote for the ${orderLabel(o)} (${naira(o.totalNGN)}). Your slot is held until tonight. Pay the deposit here: pay.temmiebakes.ng/${o.number}`, "quote-follow-up");
        if (m) m.orderId = o.id;
      });
      logEvent(s, { automation: "quote-follow-up", kind: "action", title: `${due.length} quote follow-ups sent`, detail: due.length ? `${naira(due.reduce((a, o) => a + o.totalNGN, 0))} in open quotes` : "No quotes waiting", minutesSaved: due.length * 4 });
      return `${due.length} unpaid quotes followed up`;
    },
  },
  "payment-reminders": {
    label: "Send balance reminders",
    fn: (s) => {
      const now = Date.now();
      const due = s.orders.filter((o) => o.paymentStatus === "deposit" && new Date(o.dueAt).getTime() > now && new Date(o.dueAt).getTime() - now < 2 * DAY && !s.outbound.some((m) => m.orderId === o.id && m.automationId === "payment-reminders"));
      due.forEach((o) => {
        const m = send(s, o.customerId, "whatsapp", `Hi ${first(s, o.customerId)}, your ${orderLabel(o)} is scheduled soon. The balance of ${naira(o.totalNGN - o.paidNGN)} is due before dispatch: pay.temmiebakes.ng/${o.number}`, "payment-reminders");
        if (m) m.orderId = o.id;
      });
      logEvent(s, { automation: "payment-reminders", kind: "action", title: `${due.length} balance reminders sent`, detail: due.length ? `${naira(due.reduce((a, o) => a + o.totalNGN - o.paidNGN, 0))} to collect` : undefined, minutesSaved: due.length * 3 });
      return `${due.length} balance reminders sent`;
    },
  },
  "capacity-guard": {
    label: "Check the next 7 days",
    fn: (s) => {
      const days = Array.from({ length: 7 }, (_, i) => dayKey(Date.now() + i * DAY));
      const full = days.filter((k) => pointsBooked(s.orders, k) >= s.dailyCapacity * 0.9);
      logEvent(s, { automation: "capacity-guard", kind: full.length ? "alert" : "action", title: full.length ? `${full.length} day${full.length > 1 ? "s" : ""} nearly full` : "Kitchen has room all week", detail: full.length ? `Tia will offer the next free date for ${full.join(", ")}` : undefined, minutesSaved: 5 });
      return full.length ? `${full.length} busy days flagged, Tia will steer new orders` : "Kitchen has room all week";
    },
  },
  "daily-report": {
    label: "Send today's brief",
    fn: (s) => {
      const today = dayKey(Date.now());
      const todays = s.orders.filter((o) => dayKey(o.dueAt) === today && !["cancelled", "enquiry", "quoted"].includes(o.status));
      const value = todays.reduce((a, o) => a + o.totalNGN, 0);
      logEvent(s, { automation: "daily-report", kind: "action", title: "Morning brief sent to Temmie on WhatsApp", detail: `${todays.length} orders today worth ${naira(value)} · ${s.conversations.filter((c) => c.status === "handoff").length} chats need you`, minutesSaved: 20 });
      return "Morning brief sent to Temmie";
    },
  },
};

const LIVE: Partial<Record<AutomationId, string>> = {
  "order-intake": "/admin/orders",
  "ai-assistant": "/admin/inbox",
  "order-updates": "/admin/orders",
  "review-request": "/admin/reviews",
  "stock-reorder": "/admin/stock",
  academy: "/admin/academy",
  corporate: "/admin/corporate",
  content: "/admin/content",
};

const KIND: Record<AutoEvent["kind"], { icon: typeof Bell; cls: string }> = {
  trigger: { icon: Lightning, cls: "bg-accent-soft text-accent" },
  action: { icon: Play, cls: "bg-brand-soft text-brand" },
  ai: { icon: Robot, cls: "bg-info-soft text-info" },
  handoff: { icon: ChatCircleDots, cls: "bg-warn-soft text-warn" },
  alert: { icon: Warning, cls: "bg-bad-soft text-bad" },
};

export default function Automations() {
  const d = useDemo(useShallow((s) => ({ orders: s.orders, customers: s.customers, events: s.events, products: s.products, enrollments: s.enrollments, quotes: s.quotes, goLiveAt: s.goLiveAt, dailyCapacity: s.dailyCapacity, conversations: s.conversations })));
  const automations = useDemo((s) => s.automations);
  const outbound = useDemo((s) => s.outbound);
  const run = useDemo((s) => s.run);
  const now = useNow(30000);
  const k = useMemo(() => kpis(d, now), [d, now]);
  const [filter, setFilter] = useState<AutomationId | "all">("all");

  const week = d.events.filter((e) => now - new Date(e.at).getTime() < 7 * DAY);
  const sent30 = outbound.filter((o) => o.sentAt && now - new Date(o.sentAt).getTime() < 30 * DAY).length;
  const timeline = d.events.filter((e) => filter === "all" || e.automation === filter).slice(0, 80);
  const goLiveIdx = k.weeks.findIndex((w) => w.afterGoLive);

  const stats = (id: AutomationId) => {
    const xs = d.events.filter((e) => e.automation === id && now - new Date(e.at).getTime() < 30 * DAY);
    return { runs: xs.length, last: d.events.find((e) => e.automation === id)?.at };
  };

  const toggle = (id: AutomationId, v: boolean) => {
    run((s) => {
      const a = s.automations.find((x) => x.id === id);
      if (a) a.active = v;
    });
    toast(v ? "Automation switched on" : "Automation paused", automations.find((a) => a.id === id)?.name, v ? "ok" : "info");
  };

  const runNow = (id: AutomationId) => {
    const r = RUNNERS[id];
    if (!r) return;
    let msg = "";
    run((s) => {
      msg = r.fn(s);
    });
    setFilter(id);
    toast("Done", msg, "ok");
  };

  return (
    <>
      <PageHead
        title="Automations"
        sub="Fourteen workflows run the admin of the bakery: replying to DMs, chasing deposits, updating customers, reminding them of birthdays and keeping the kitchen from overbooking. Each one is a real n8n workflow you can import."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Automation runs, last 7 days" value={week.length.toLocaleString("en-GB")} sub="Every step is logged below" />
        <Kpi label="Hours saved a week" value={`${k.hoursSavedWeek.toFixed(0)} h`} sub="Typing, chasing and checking" tone="up" />
        <Kpi label="Revenue influenced, 30 days" value={money(k.influenced)} sub="Tia orders, reminders, nudges" tone="up" />
        <Kpi label="Messages sent, 30 days" value={sent30.toLocaleString("en-GB")} sub="WhatsApp, Instagram, SMS, email" />
      </div>

      <Card className="mb-4">
        <CardHead title="Hours saved per week" sub="Minutes of admin each automation replaced, last 16 weeks" />
        <div className="px-3 pb-3 pt-2">
          <LineChart label="Hours saved per week" data={k.weeks.map((w) => ({ label: w.label, value: Math.round(w.hoursSaved) }))} format={(v) => `${v} h`} marker={goLiveIdx > 0 ? { index: goLiveIdx, label: "Automation live" } : undefined} />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="grid content-start gap-3">
          {automations.map((a, i) => {
            const st = stats(a.id);
            const runner = RUNNERS[a.id];
            const live = LIVE[a.id];
            return (
              <Card key={a.id} className={cx("p-4", !a.active && "opacity-70")}>
                <div className="flex items-start gap-3">
                  <span className="tnum grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[14.5px] font-semibold text-ink">{a.name}</h2>
                      {!a.active && <Badge tone="warn">Paused</Badge>}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
                      <span>{a.trigger}</span>
                      <ArrowRight size={12} className="text-ink-3" aria-hidden />
                      <span>{a.action}</span>
                    </p>
                    {a.template && <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] italic text-ink-2">{a.template}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-3">
                      <span className="tnum">{st.runs} runs in 30 days</span>
                      {st.last && <span>Last: {ago(st.last, now)}</span>}
                      <span className="inline-flex items-center gap-1 font-mono text-[11px]"><FileCode size={13} /> workflows/{a.file}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {runner && <Button size="sm" onClick={() => runNow(a.id)} disabled={!a.active}><Play size={13} weight="fill" /> {runner.label}</Button>}
                      {live && <Link href={live} className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong px-3 text-[12.5px] font-medium text-ink hover:bg-surface-2">See it working <ArrowRight size={12} /></Link>}
                      <Button size="sm" variant="ghost" onClick={() => setFilter(a.id)}>Show activity</Button>
                    </div>
                  </div>
                  <Toggle checked={a.active} onChange={(v) => toggle(a.id, v)} label={`${a.name} ${a.active ? "on" : "off"}`} />
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="flex flex-col overflow-hidden xl:sticky xl:top-20 xl:max-h-[calc(100dvh-100px)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <h2 className="flex-1 text-sm font-semibold text-ink">Live activity</h2>
            <label htmlFor="auto-filter" className="sr-only">Filter by automation</label>
            <Select id="auto-filter" value={filter} onChange={(e) => setFilter(e.target.value as AutomationId | "all")} className="h-9 w-auto max-w-[220px] text-[13px]">
              <option value="all">All automations</option>
              {automations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
          <ol className="scrollbar-thin flex-1 divide-y divide-line overflow-y-auto">
            {timeline.map((e) => {
              const K = KIND[e.kind];
              return (
                <li key={e.id} className="flex gap-3 px-4 py-3">
                  <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full", K.cls)}><K.icon size={14} weight="fill" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{e.title}</p>
                    {e.detail && <p className="mt-0.5 text-xs text-ink-3">{e.detail}</p>}
                    <p className="mt-1 text-[11px] text-ink-3">
                      {ago(e.at, now)}
                      {e.minutesSaved > 0 && ` · saved ${e.minutesSaved} min`}
                      {e.revenueNGN ? ` · ${naira(e.revenueNGN)}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
            {!timeline.length && <li className="p-6 text-sm text-ink-3">No activity for this automation yet. Press its run button.</li>}
          </ol>
        </Card>
      </div>
    </>
  );
}
