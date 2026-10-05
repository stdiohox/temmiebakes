"use client";

import Link from "next/link";
import { ArrowsClockwise, Cake, Megaphone, PaperPlaneTilt } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { PageHead } from "@/components/app/app-shell";
import { AUTOMATION_LABEL, CustomerChip, OUT_CHANNEL, OUT_STATUS } from "@/components/app/bits";
import { Bubble, CUSTOMER_AUTOMATIONS, dayMonth, fillTemplate, firstName, inDays, upcomingOccasions, type UpcomingOccasion } from "@/components/app/growth";
import { Badge, Button, Card, CardHead, Empty, Field, Select, Textarea, Toggle, cx } from "@/components/ui";
import { logEvent, orderLabel, runOccasionReminders, runReorderNudges, send } from "@/lib/engine";
import { ago, pct } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Automation, AutomationId, Customer, Order, Outbound } from "@/lib/types";

const DAY = 86400000;

export default function CampaignsPage() {
  const run = useDemo((s) => s.run);

  const runBirthdays = () => {
    const n = run((s) => runOccasionReminders(s));
    toast(n ? `${n} occasion reminder${n === 1 ? "" : "s"} sent` : "No reminders due", n ? "Personal offers with free delivery, sent on WhatsApp." : "Everyone with an occasion in the next 14 days has already been reminded.", n ? "ok" : "info");
  };
  const runNudges = () => {
    const n = run((s) => runReorderNudges(s));
    toast(n ? `${n} re-order nudge${n === 1 ? "" : "s"} sent` : "No nudges due", n ? "Customers quiet for 45 to 120 days." : "Nobody in the 45 to 120 day window needs a nudge right now.", n ? "ok" : "info");
  };

  return (
    <div>
      <PageHead
        title="Reminders & campaigns"
        sub="The messages that bring customers back: quote follow-ups, balance reminders, birthday offers, review requests and broadcasts."
        actions={
          <>
            <Button variant="secondary" onClick={runNudges}><ArrowsClockwise size={16} /> Send re-order nudges</Button>
            <Button onClick={runBirthdays}><Cake size={16} /> Run birthday reminders now</Button>
          </>
        }
      />
      <AutomationCards />
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <UpcomingOccasions />
        <Broadcast />
      </div>
      <SendLog />
    </div>
  );
}

// ------------------------------------------------------------ automation cards

function AutomationCards() {
  const automations = useDemo((s) => s.automations);
  const outbound = useDemo((s) => s.outbound);
  const stats = useMemo(() => {
    const m = new Map<AutomationId, { sent: number; read: number; scheduled: number }>();
    for (const o of outbound) {
      if (!o.automationId) continue;
      const s = m.get(o.automationId) ?? { sent: 0, read: 0, scheduled: 0 };
      if (o.status === "scheduled") s.scheduled++;
      else if (o.status !== "failed") s.sent++;
      if (o.status === "read" || o.status === "replied") s.read++;
      m.set(o.automationId, s);
    }
    return m;
  }, [outbound]);
  const list = CUSTOMER_AUTOMATIONS.map((id) => automations.find((a) => a.id === id)).filter((a): a is Automation => Boolean(a));

  return (
    <section aria-label="Customer automations" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {list.map((a) => (
        <AutomationCard key={a.id} a={a} stats={stats.get(a.id) ?? { sent: 0, read: 0, scheduled: 0 }} />
      ))}
    </section>
  );
}

function AutomationCard({ a, stats }: { a: Automation; stats: { sent: number; read: number; scheduled: number } }) {
  const run = useDemo((s) => s.run);
  const [text, setText] = useState(a.template);
  const dirty = text !== a.template;

  const toggle = (v: boolean) => {
    run((s) => {
      const x = s.automations.find((y) => y.id === a.id);
      if (!x) return;
      x.active = v;
      logEvent(s, { automation: a.id, kind: "action", title: `${a.name} ${v ? "switched on" : "paused"}`, detail: "Changed by Temmie", minutesSaved: 0 });
    });
    toast(v ? "Automation on" : "Automation paused", a.name, v ? "ok" : "info");
  };
  const save = () => {
    run((s) => {
      const x = s.automations.find((y) => y.id === a.id);
      if (!x) return;
      x.template = text;
      logEvent(s, { automation: a.id, kind: "action", title: `${a.name}: message template updated`, minutesSaved: 0 });
    });
    toast("Template saved", "New messages will use this wording.");
  };

  return (
    <Card className={cx("flex flex-col p-4", !a.active && "opacity-80")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{a.name}</h3>
          <p className="mt-0.5 text-xs text-ink-3">{a.trigger}</p>
        </div>
        <Toggle checked={a.active} onChange={toggle} label={`${a.name} active`} />
      </div>
      <p className="mt-2 text-[13px] text-ink-2">{a.action}</p>
      <Field label="Message template" hint="Placeholders like {{firstName}} are filled in per customer." className="mt-3">
        {(fid) => <Textarea id={fid} value={text} onChange={(e) => setText(e.target.value)} className="min-h-28 text-[13px]" />}
      </Field>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge tone="neutral">{stats.sent} sent</Badge>
          <Badge tone="ok">{stats.sent ? pct(stats.read / stats.sent, 0) : "0%"} read or replied</Badge>
          {stats.scheduled > 0 && <Badge tone="info">{stats.scheduled} scheduled</Badge>}
        </div>
        {dirty && (
          <span className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setText(a.template)}>Undo</Button>
            <Button size="sm" onClick={save}>Save</Button>
          </span>
        )}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------ upcoming occasions

function UpcomingOccasions() {
  const run = useDemo((s) => s.run);
  const customers = useDemo((s) => s.customers);
  const orders = useDemo((s) => s.orders);
  const outbound = useDemo((s) => s.outbound);
  const template = useDemo((s) => s.automations.find((a) => a.id === "occasion-reminders")?.template ?? "");
  const now = useNow();
  const list = useMemo(() => upcomingOccasions(customers, now, 30), [customers, now]);
  const [limit, setLimit] = useState(12);

  const lastOrder = (c: Customer, at: number): { label: string; o: Order } | undefined => {
    const mine = orders.filter((o) => o.customerId === c.id && o.status !== "cancelled");
    const lastYear = mine.find((o) => Math.abs(new Date(o.dueAt).getTime() - (at - 365 * DAY)) < 21 * DAY);
    if (lastYear) return { label: "Last year", o: lastYear };
    const recent = mine.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    return recent ? { label: "Last order", o: recent } : undefined;
  };
  const reminded = (c: Customer) => outbound.find((o) => o.customerId === c.id && o.automationId === "occasion-reminders" && Math.abs(now - new Date(o.scheduledFor).getTime()) < 20 * DAY);

  const sendOne = (oc: UpcomingOccasion) => {
    const c = oc.customer;
    if (!c.consentWhatsApp) return toast("No WhatsApp consent", `${c.name} has not opted in.`, "warn");
    const body = fillTemplate(template, { firstName: firstName(c.name), occasion: oc.label, date: new Date(oc.at).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) });
    run((s) => {
      send(s, c.id, "whatsapp", body, "occasion-reminders");
      logEvent(s, { automation: "occasion-reminders", kind: "action", title: `Occasion reminder sent to ${c.name}`, detail: oc.label, customerId: c.id, minutesSaved: 6 });
    });
    toast("Reminder sent", `${oc.label} · ${c.name}`);
  };

  return (
    <Card className="pb-2">
      <CardHead title="Upcoming occasions" sub={`${list.length} birthdays and anniversaries in the next 30 days`} />
      {list.length === 0 ? (
        <Empty title="No occasions in the next 30 days" />
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {list.slice(0, limit).map((oc) => {
            const last = lastOrder(oc.customer, oc.at);
            const prev = reminded(oc.customer);
            return (
              <li key={`${oc.customer.id}-${oc.type}-${oc.date}`} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <CustomerChip c={oc.customer} sub={oc.label} />
                  {last && (
                    <p className="mt-1 truncate ps-10 text-xs text-ink-3">
                      {last.label}: <Link href={`/admin/orders/${last.o.id}`} className="hover:underline">{orderLabel(last.o)}</Link>
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 ps-10 sm:ps-0">
                  <span className="text-end text-xs">
                    <span className="block font-medium text-ink">{dayMonth(oc.at)}</span>
                    <span className={cx("block", oc.days <= 14 ? "text-accent" : "text-ink-3")}>{inDays(oc.days)}</span>
                  </span>
                  {prev && <Badge tone={OUT_STATUS[prev.status]}>{prev.status === "scheduled" ? "Reminder scheduled" : "Reminded"}</Badge>}
                  <Button size="sm" variant="secondary" onClick={() => sendOne(oc)} disabled={!oc.customer.consentWhatsApp} aria-label={`Send reminder to ${oc.customer.name}`}>
                    <PaperPlaneTilt size={14} /> Send
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > limit && (
        <div className="px-5 py-2">
          <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + 12)}>Show more ({list.length - limit})</Button>
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------ broadcast composer

type Audience = "all" | "vip" | "zone" | "student" | "corporate";
const AUDIENCE: { value: Audience; label: string }[] = [
  { value: "all", label: "All opted-in customers" },
  { value: "vip", label: "VIPs (4+ orders)" },
  { value: "zone", label: "Customers in a zone" },
  { value: "student", label: "Academy students" },
  { value: "corporate", label: "Corporate clients" },
];

function Broadcast() {
  const run = useDemo((s) => s.run);
  const customers = useDemo((s) => s.customers);
  const zones = useDemo((s) => s.zones);
  const [audience, setAudience] = useState<Audience>("vip");
  const [zone, setZone] = useState("ikeja");
  const [text, setText] = useState("Hi {{firstName}}! Weekend treats are back 🧁 Red velvet cupcakes, Oreo parfait cups and fresh cinnamon rolls. Order by Thursday 6pm for Saturday delivery. Reply MENU for the full list.");

  const recipients = customers.filter((c) => {
    if (!c.consentWhatsApp) return false;
    if (audience === "vip") return c.tags.includes("vip");
    if (audience === "zone") return c.zoneId === zone;
    if (audience === "student") return c.segment === "student";
    if (audience === "corporate") return c.segment === "corporate";
    return true;
  });
  const sample = recipients[0];
  const preview = fillTemplate(text, { firstName: sample ? firstName(sample.name) : "Adaeze" });
  const label = audience === "zone" ? `customers in ${zones.find((z) => z.id === zone)?.name}` : AUDIENCE.find((a) => a.value === audience)!.label.replace(/ \(.*\)/, "");

  const sendAll = () => {
    if (!recipients.length || !text.trim()) return;
    const ids = recipients.map((c) => [c.id, firstName(c.name)] as const);
    run((s) => {
      ids.forEach(([id, name]) => send(s, id, "whatsapp", fillTemplate(text, { firstName: name })));
      logEvent(s, { automation: "content", kind: "action", title: `WhatsApp broadcast sent to ${ids.length} customers`, detail: `${label}: ${text.slice(0, 60)}`, minutesSaved: Math.round(ids.length * 1.5) });
    });
    toast(`Broadcast sent to ${ids.length} customer${ids.length === 1 ? "" : "s"}`, `Personalised for each ${label.toLowerCase()} recipient.`);
  };

  return (
    <Card className="pb-4">
      <CardHead title="WhatsApp broadcast" sub="Only customers who opted in to WhatsApp receive it." action={<Megaphone size={18} className="text-ink-3" />} />
      <div className="mt-3 grid gap-3 px-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Audience">
            {(fid) => (
              <Select id={fid} value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
                {AUDIENCE.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </Select>
            )}
          </Field>
          {audience === "zone" && (
            <Field label="Zone">
              {(fid) => (
                <Select id={fid} value={zone} onChange={(e) => setZone(e.target.value)}>
                  {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </Select>
              )}
            </Field>
          )}
        </div>
        <Field label="Message" hint="Use {{firstName}} to greet each customer by name.">
          {(fid) => <Textarea id={fid} value={text} onChange={(e) => setText(e.target.value)} maxLength={700} />}
        </Field>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="mb-2 text-xs text-ink-3">Preview{sample ? ` for ${sample.name}` : ""}</p>
          <Bubble>{preview || "Your message will appear here."}</Bubble>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] text-ink-2"><span className="tnum font-semibold text-ink">{recipients.length}</span> recipient{recipients.length === 1 ? "" : "s"}</p>
          <Button onClick={sendAll} disabled={!recipients.length || !text.trim()}><PaperPlaneTilt size={16} /> Send broadcast</Button>
        </div>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------ send log

function SendLog() {
  const outbound = useDemo((s) => s.outbound);
  const customers = useDemo((s) => s.customers);
  const automations = useDemo((s) => s.automations);
  const now = useNow();
  const [filter, setFilter] = useState<"" | AutomationId | "broadcast">("");
  const [limit, setLimit] = useState(50);

  const when = (o: Outbound) => o.sentAt ?? o.scheduledFor;
  const rows = useMemo(
    () =>
      outbound
        .filter((o) => (!filter ? true : filter === "broadcast" ? !o.automationId : o.automationId === filter))
        .sort((a, b) => (when(a) < when(b) ? 1 : -1)),
    [outbound, filter],
  );
  const used = useMemo(() => new Set(outbound.map((o) => o.automationId).filter(Boolean)), [outbound]);

  return (
    <Card className="mt-6">
      <CardHead
        title="Send log"
        sub={`${rows.length.toLocaleString()} message${rows.length === 1 ? "" : "s"}, newest first`}
        action={
          <Select value={filter} onChange={(e) => { setFilter(e.target.value as typeof filter); setLimit(50); }} aria-label="Filter by automation" className="w-auto max-w-[200px]">
            <option value="">All automations</option>
            {automations.filter((a) => used.has(a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            <option value="broadcast">Broadcasts</option>
          </Select>
        }
      />
      {rows.length === 0 ? (
        <Empty title="No messages yet" sub="Messages appear here as automations and broadcasts send them." />
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="text-xs text-ink-3">
              <tr className="border-y border-line">
                <th scope="col" className="w-10 px-5 py-2 font-medium"><span className="sr-only">Channel</span></th>
                <th scope="col" className="px-3 py-2 font-medium">Customer</th>
                <th scope="col" className="px-3 py-2 font-medium">Automation</th>
                <th scope="col" className="px-3 py-2 font-medium">Message</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-5 py-2 text-end font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((o) => {
                const ch = OUT_CHANNEL[o.channel];
                const c = customers.find((x) => x.id === o.customerId);
                return (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5"><ch.icon size={16} className="text-ink-2" aria-label={ch.label} /></td>
                    <td className="max-w-[200px] px-3 py-2.5">{c ? <CustomerChip c={c} /> : <span className="text-ink-3">Unknown</span>}</td>
                    <td className="max-w-[180px] truncate px-3 py-2.5 text-ink-2">{o.automationId ? AUTOMATION_LABEL(o.automationId) : "Broadcast"}</td>
                    <td className="max-w-[300px] px-3 py-2.5"><span className="line-clamp-2 text-ink">{o.body}</span></td>
                    <td className="px-3 py-2.5"><Badge tone={OUT_STATUS[o.status]}>{o.status[0].toUpperCase() + o.status.slice(1)}</Badge></td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-end text-ink-3">{ago(when(o), now)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > limit && (
        <div className="border-t border-line px-5 py-3">
          <Button size="sm" variant="secondary" onClick={() => setLimit((l) => l + 50)}>Load 50 more</Button>
        </div>
      )}
    </Card>
  );
}
