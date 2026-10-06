"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarHeart, ChatsCircle, EnvelopeSimple, InstagramLogo, PaperPlaneTilt, Phone, Plus, WhatsappLogo } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { PageHead } from "@/components/app/app-shell";
import { AUTOMATION_LABEL, CHANNEL, CONV_CHANNEL, Kpi, Money, OUT_CHANNEL, OUT_STATUS, PaymentBadge, StatusBadge } from "@/components/app/bits";
import { dayMonth, fillTemplate, firstName, inDays, nextOccurrence, OCCASION_LABEL, SEGMENT, Stars, TAG_LABEL, TAG_TONE } from "@/components/app/growth";
import { Avatar, Badge, Button, Card, CardHead, Empty, Field, Input, Select, Textarea } from "@/components/ui";
import { logEvent, naira, orderLabel, send, addOccasion } from "@/lib/engine";
import { ago, dateOnly, duration, money } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Customer, CustomerOccasion, Occasion } from "@/lib/types";

const SOURCE_LABEL: Record<Customer["source"], string> = { ...Object.fromEntries(Object.entries(CHANNEL).map(([k, v]) => [k, v.label])), referral: "Referral", class: "Academy class" } as Record<Customer["source"], string>;

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const c = useDemo((s) => s.customers.find((x) => x.id === id));
  if (!c) {
    return (
      <Card>
        <Empty title="Customer not found" sub="They may have been removed when the demo was reset." action={<Link href="/admin/customers" className="text-sm font-medium text-brand underline">Back to customers</Link>} />
      </Card>
    );
  }
  return <Profile key={c.id} c={c} />;
}

function Profile({ c }: { c: Customer }) {
  const run = useDemo((s) => s.run);
  const allOrders = useDemo((s) => s.orders);
  const zones = useDemo((s) => s.zones);
  const products = useDemo((s) => s.products);
  const conversations = useDemo((s) => s.conversations);
  const outbound = useDemo((s) => s.outbound);
  const enrollments = useDemo((s) => s.enrollments);
  const cohorts = useDemo((s) => s.cohorts);
  const courses = useDemo((s) => s.courses);
  const quotes = useDemo((s) => s.quotes);
  const template = useDemo((s) => s.automations.find((a) => a.id === "occasion-reminders")?.template ?? "");
  const now = useNow();

  const orders = useMemo(() => allOrders.filter((o) => o.customerId === c.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [allOrders, c.id]);
  const valid = orders.filter((o) => o.status !== "cancelled");
  const spend = valid.reduce((t, o) => t + o.totalNGN, 0);
  const counts = new Map<string, number>();
  valid.forEach((o) => o.items.forEach((it) => {
    const name = it.custom ? "Custom cake" : products.find((p) => p.id === it.productId)?.name ?? it.name;
    counts.set(name, (counts.get(name) ?? 0) + it.qty);
  }));
  const favourite = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  const convs = conversations.filter((cv) => cv.customerId === c.id);
  const messages = outbound.filter((m) => m.customerId === c.id).sort((a, b) => (a.scheduledFor < b.scheduledFor ? 1 : -1));
  const reviews = orders.filter((o) => o.rating);
  const enrolled = enrollments.filter((e) => e.customerId === c.id);
  const corpQuotes = quotes.filter((q) => q.customerId === c.id);
  const zone = zones.find((z) => z.id === c.zoneId);
  const occasions = c.occasions.map((oc) => ({ ...oc, ...nextOccurrence(oc.date, now) })).sort((a, b) => a.at - b.at);

  const sendReminder = (oc: CustomerOccasion & { at: number }) => {
    if (!c.consentWhatsApp) return toast("No WhatsApp consent", `${c.name} has not opted in to WhatsApp messages.`, "warn");
    const body = fillTemplate(template, { firstName: firstName(c.name), occasion: oc.label, date: new Date(oc.at).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) });
    run((s) => {
      send(s, c.id, "whatsapp", body, "occasion-reminders");
      logEvent(s, { automation: "occasion-reminders", kind: "action", title: `Occasion reminder sent to ${c.name}`, detail: oc.label, customerId: c.id, minutesSaved: 6 });
    });
    toast("Reminder sent on WhatsApp", `${oc.label} · ${c.name}`);
  };

  return (
    <div>
      <Link href="/admin/customers" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft size={14} /> All customers
      </Link>
      <PageHead
        title={c.name}
        icon={<Avatar name={c.name} size={40} />}
        sub={[c.company, SEGMENT[c.segment].label, zone?.name].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href="/admin/inbox" className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm font-medium text-ink hover:bg-surface-3">
              <ChatsCircle size={16} /> Open inbox
            </Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Orders" value={valid.length} sub={orders.length > valid.length ? `${orders.length - valid.length} cancelled` : c.lastOrderAt ? `Last ${ago(c.lastOrderAt, now)}` : "No orders yet"} />
        <Kpi label="Lifetime spend" value={money(spend)} sub={naira(spend)} />
        <Kpi label="Average order" value={money(valid.length ? spend / valid.length : 0)} />
        <Kpi label="Favourite item" value={<span className="block truncate text-[19px]">{favourite?.[0] ?? "None yet"}</span>} sub={favourite ? `${favourite[1]} ordered` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="pb-4">
            <CardHead title="Contact" />
            <dl className="mt-3 grid gap-2.5 px-5 text-[13.5px]">
              <Row label="Phone"><span className="inline-flex items-center gap-1.5"><Phone size={14} className="text-ink-3" />{c.phone || "Not given"}</span></Row>
              {c.email && <Row label="Email"><span className="inline-flex min-w-0 items-center gap-1.5"><EnvelopeSimple size={14} className="shrink-0 text-ink-3" /><span className="truncate">{c.email}</span></span></Row>}
              {c.instagram && <Row label="Instagram"><span className="inline-flex items-center gap-1.5"><InstagramLogo size={14} className="text-ink-3" />{c.instagram}</span></Row>}
              {c.company && <Row label="Company">{c.company}</Row>}
              <Row label="Segment"><Badge tone={SEGMENT[c.segment].tone}>{SEGMENT[c.segment].label}</Badge></Row>
              <Row label="Zone">{zone?.name ?? c.zoneId}</Row>
              <Row label="Source">{SOURCE_LABEL[c.source] ?? c.source}</Row>
              <Row label="Customer since">{dateOnly(c.createdAt)}</Row>
              <Row label="First response">{c.firstResponseMins !== undefined ? duration(c.firstResponseMins) : "Unknown"}</Row>
              <Row label="WhatsApp">{c.consentWhatsApp ? <span className="inline-flex items-center gap-1 text-ok"><WhatsappLogo size={14} weight="fill" /> Opted in</span> : <span className="text-ink-3">No consent</span>}</Row>
              <Row label="Tags">
                <span className="flex flex-wrap justify-end gap-1">
                  {c.tags.length ? c.tags.map((t) => <Badge key={t} tone={TAG_TONE[t] ?? "neutral"}>{TAG_LABEL[t] ?? t}</Badge>) : <span className="text-ink-3">None</span>}
                </span>
              </Row>
            </dl>
          </Card>

          <Card className="pb-4">
            <CardHead title="Saved occasions" sub="Tia reminds them 14 days before, with a free delivery offer." />
            <ul className="mt-3 grid gap-2 px-5">
              {occasions.length === 0 && <li className="text-[13px] text-ink-3">No occasions saved yet.</li>}
              {occasions.map((oc) => (
                <li key={`${oc.type}-${oc.date}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink"><CalendarHeart size={15} className="text-brand" />{oc.label}</span>
                    <span className="block text-xs text-ink-3">{OCCASION_LABEL[oc.type]} · {dayMonth(oc.at)} · {inDays(oc.days)}</span>
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => sendReminder(oc)} disabled={!c.consentWhatsApp} title={c.consentWhatsApp ? undefined : "No WhatsApp consent"}>
                    <PaperPlaneTilt size={14} /> Send reminder now
                  </Button>
                </li>
              ))}
            </ul>
            <AddOccasion customer={c} />
          </Card>

          <Notes customer={c} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHead title="Order history" sub={`${orders.length} order${orders.length === 1 ? "" : "s"}`} />
            {orders.length === 0 ? (
              <Empty title="No orders yet" sub="Orders placed through Tia, the website or the team will appear here." />
            ) : (
              <div className="relative mt-2 overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-[13px]">
                  <thead className="text-xs text-ink-3">
                    <tr className="border-b border-line">
                      <th scope="col" className="px-5 py-2 font-medium">Order</th>
                      <th scope="col" className="px-3 py-2 font-medium">Items</th>
                      <th scope="col" className="px-3 py-2 font-medium">Due</th>
                      <th scope="col" className="px-3 py-2 font-medium">Status</th>
                      <th scope="col" className="px-5 py-2 text-end font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-line last:border-0">
                        <td className="px-5 py-2.5"><Link href={`/admin/orders/${o.id}`} className="font-medium text-brand hover:underline">{o.number}</Link></td>
                        <td className="max-w-[200px] truncate px-3 py-2.5 text-ink-2">{orderLabel(o)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">{dateOnly(o.dueAt)}</td>
                        <td className="px-3 py-2.5"><span className="flex flex-wrap gap-1"><StatusBadge status={o.status} /><PaymentBadge status={o.paymentStatus} /></span></td>
                        <td className="px-5 py-2.5 text-end font-medium text-ink"><Money ngn={o.totalNGN} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="pb-4">
            <CardHead title="Conversations" action={<Link href="/admin/inbox" className="text-[13px] font-medium text-brand hover:underline">Open inbox</Link>} />
            <ul className="mt-3 grid gap-2 px-5">
              {convs.length === 0 && <li className="text-[13px] text-ink-3">No chats on record.</li>}
              {convs.map((cv) => {
                const ch = CONV_CHANNEL[cv.channel];
                const last = cv.messages[cv.messages.length - 1];
                return (
                  <li key={cv.id}>
                    <Link href="/admin/inbox" className="flex items-start gap-3 rounded-xl border border-line p-3 hover:bg-surface-2">
                      <ch.icon size={18} weight="fill" className={ch.color} aria-label={ch.label} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 text-xs text-ink-3">
                          <span>{ch.label} · {cv.status === "ai" ? "Tia handling" : cv.status === "handoff" ? "Needs Koret" : cv.status === "staff" ? "Team replied" : "Closed"}</span>
                          <span>{ago(cv.lastAt, now)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink">{last?.text ?? "No messages"}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="pb-2">
            <CardHead title="Messages sent" sub="Automated and manual messages to this customer" />
            <ul className="mt-2 divide-y divide-line">
              {messages.length === 0 && <li className="px-5 py-3 text-[13px] text-ink-3">Nothing sent yet.</li>}
              {messages.slice(0, 12).map((m) => {
                const ch = OUT_CHANNEL[m.channel];
                return (
                  <li key={m.id} className="flex gap-3 px-5 py-3">
                    <ch.icon size={16} className="mt-0.5 shrink-0 text-ink-3" aria-label={ch.label} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                        <span className="font-medium text-ink-2">{m.automationId ? AUTOMATION_LABEL(m.automationId) : "Broadcast"}</span>
                        <Badge tone={OUT_STATUS[m.status]}>{m.status[0].toUpperCase() + m.status.slice(1)}</Badge>
                        <span>{ago(m.sentAt ?? m.scheduledFor, now)}</span>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[13px] text-ink">{m.body}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="pb-4">
              <CardHead title="Reviews left" />
              <ul className="mt-3 grid gap-2 px-5">
                {reviews.length === 0 && <li className="text-[13px] text-ink-3">No reviews yet.</li>}
                {reviews.map((o) => (
                  <li key={o.id} className="rounded-xl border border-line p-3">
                    <span className="flex items-center justify-between gap-2">
                      <Stars rating={o.rating!} />
                      <Link href={`/admin/orders/${o.id}`} className="text-xs text-brand hover:underline">{o.number}</Link>
                    </span>
                    {o.review && <p className="mt-1.5 text-[13px] text-ink">{o.review}</p>}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="pb-4">
              <CardHead title="Academy" />
              <ul className="mt-3 grid gap-2 px-5">
                {enrolled.length === 0 && <li className="text-[13px] text-ink-3">No classes booked.</li>}
                {enrolled.map((e) => {
                  const ch = cohorts.find((x) => x.id === e.cohortId);
                  const course = courses.find((x) => x.id === ch?.courseId);
                  return (
                    <li key={e.id} className="rounded-xl border border-line p-3 text-[13px]">
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-medium text-ink">{course?.title ?? "Class"}</span>
                        <Badge tone={e.status === "completed" ? "ok" : e.status === "reserved" ? "warn" : "brand"}>{e.status[0].toUpperCase() + e.status.slice(1)}</Badge>
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-3">{ch ? `Starts ${dateOnly(ch.startDate)}` : ""} · paid {naira(e.paidNGN)}{e.certificate ? " · certificate issued" : ""}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          {(corpQuotes.length > 0 || c.segment === "corporate") && (
            <Card className="pb-4">
              <CardHead title="Corporate quotes" action={<Link href="/admin/corporate" className="text-[13px] font-medium text-brand hover:underline">Corporate catering</Link>} />
              <ul className="mt-3 grid gap-2 px-5">
                {corpQuotes.length === 0 && <li className="text-[13px] text-ink-3">No quotes yet.</li>}
                {corpQuotes.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-[13px]">
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{q.number} · {q.event}</span>
                      <span className="block text-xs text-ink-3">{q.guests} guests · {dateOnly(q.date)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Money ngn={q.totalNGN} className="font-medium text-ink" />
                      <Badge tone={q.status === "accepted" ? "ok" : q.status === "declined" ? "bad" : q.status === "sent" ? "info" : "neutral"}>{q.status[0].toUpperCase() + q.status.slice(1)}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className="min-w-0 text-end text-ink">{children}</dd>
    </div>
  );
}

const OCCASION_TYPES: Occasion[] = ["birthday", "anniversary", "wedding", "graduation", "baby-shower", "valentine", "just-because"];

function AddOccasion({ customer }: { customer: Customer }) {
  const run = useDemo((s) => s.run);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<Occasion>("birthday");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return toast("Pick a date", "Choose the day of the occasion.", "warn");
    const text = label.trim() || `${firstName(customer.name)}'s ${OCCASION_LABEL[type].toLowerCase()}`;
    run((s) => {
      addOccasion(s, customer.id, type, text, date);
      logEvent(s, { automation: "occasion-reminders", kind: "action", title: `Occasion saved for ${customer.name}`, detail: `${text} · reminder 14 days before`, customerId: customer.id, minutesSaved: 2 });
    });
    toast("Occasion saved", `${text}. Tia will send a reminder 14 days before.`);
    setLabel("");
    setDate("");
    setOpen(false);
  };

  if (!open) {
    return (
      <div className="mt-3 px-5">
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Plus size={14} /> Add occasion</Button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="mx-5 mt-3 grid gap-3 rounded-xl bg-surface-2 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Type">
          {(fid) => (
            <Select id={fid} value={type} onChange={(e) => setType(e.target.value as Occasion)}>
              {OCCASION_TYPES.map((t) => <option key={t} value={t}>{OCCASION_LABEL[t]}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Date">{(fid) => <Input id={fid} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
      </div>
      <Field label="Label" hint="For example: Daughter Tolu's birthday">{(fid) => <Input id={fid} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`${firstName(customer.name)}'s ${OCCASION_LABEL[type].toLowerCase()}`} />}</Field>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm">Save occasion</Button>
      </div>
    </form>
  );
}

function Notes({ customer }: { customer: Customer }) {
  const run = useDemo((s) => s.run);
  const [text, setText] = useState(customer.notes ?? "");
  const dirty = text !== (customer.notes ?? "");
  const save = () => {
    run((s) => {
      const c = s.customers.find((x) => x.id === customer.id);
      if (c) c.notes = text.trim() || undefined;
    });
    toast("Notes saved", customer.name);
  };
  return (
    <Card className="pb-4">
      <CardHead title="Notes" sub="Allergies, preferences, family names. Tia reads these before replying." />
      <div className="mt-3 grid gap-2 px-5">
        <Field label="Private notes">
          {(fid) => <Textarea id={fid} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Prefers whipped cream, no nuts. Daughter Tolu turns 8 in March." />}
        </Field>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={!dirty}>Save notes</Button>
        </div>
      </div>
    </Card>
  );
}

