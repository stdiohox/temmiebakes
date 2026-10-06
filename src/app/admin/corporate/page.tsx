"use client";

import { useState } from "react";
import { CheckCircle, FileText, Handshake, PaperPlaneTilt, Plus, Printer, XCircle } from "@phosphor-icons/react";
import { PageHead } from "@/components/app/app-shell";
import { CustomerChip, Kpi, Money } from "@/components/app/bits";
import { Badge, Button, Card, CardHead, Empty, Field, Input, Logo, Modal, Segmented, Sheet, Thumb, cx, type Tone } from "@/components/ui";
import { createQuote, naira, setQuoteStatus, upsertCustomer } from "@/lib/engine";
import { ago, dateOnly, money } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { PACKAGES, quoteCatering } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { CateringQuote, PackageId } from "@/lib/types";

type QStatus = CateringQuote["status"];
const STATUS: Record<QStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "info" },
  accepted: { label: "Accepted", tone: "ok" },
  declined: { label: "Declined", tone: "bad" },
};
const COLUMNS: QStatus[] = ["draft", "sent", "accepted", "declined"];

export default function CorporatePage() {
  const quotes = useDemo((s) => s.quotes);
  const customers = useDemo((s) => s.customers);
  const orders = useDemo((s) => s.orders);
  const run = useDemo((s) => s.run);
  const now = useNow();
  const [view, setView] = useState<"board" | "table">("board");
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const monthKey = new Date(now).toISOString().slice(0, 7);
  const sent = quotes.filter((q) => q.status === "sent");
  const pipeline = sent.reduce((t, q) => t + q.totalNGN, 0);
  const acceptedMonth = quotes.filter((q) => q.status === "accepted" && (q.sentAt ?? q.createdAt).slice(0, 7) === monthKey);
  const accepted = quotes.filter((q) => q.status === "accepted").length;
  const declined = quotes.filter((q) => q.status === "declined").length;
  const winRate = accepted + declined ? accepted / (accepted + declined) : 0;
  const corporate = customers.filter((c) => c.segment === "corporate");
  const recurringIds = new Set(quotes.filter((q) => q.recurring || quotes.filter((x) => x.customerId === q.customerId && x.status === "accepted").length > 1).map((q) => q.customerId));

  const act = (q: CateringQuote, status: "sent" | "accepted" | "declined") => {
    run((s) => setQuoteStatus(s, q.id, status));
    if (status === "sent") toast(`${q.number} sent`, `Emailed to ${q.company} with a follow-up booked for 2 days.`);
    else if (status === "accepted") toast(`${q.number} accepted`, `Order created for ${q.company} and the invoice sent.`);
    else toast(`${q.number} marked declined`, "Logged for the win-rate report.", "info");
  };

  const sorted = [...quotes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div>
      <PageHead
        title="Corporate catering"
        icon={<Handshake size={26} weight="duotone" className="text-brand" />}
        sub="Breakfast boxes, canapé receptions, dessert tables and office celebrations. Quotes go out as a branded PDF in minutes, not days."
        actions={<Button onClick={() => setCreating(true)}><Plus size={16} /> New quote</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pipeline (quotes sent)" value={money(pipeline)} sub={`${sent.length} awaiting a reply`} />
        <Kpi label="Accepted this month" value={acceptedMonth.length} sub={money(acceptedMonth.reduce((t, q) => t + q.totalNGN, 0))} tone="up" />
        <Kpi label="Win rate" value={`${Math.round(winRate * 100)}%`} sub={`${accepted} won, ${declined} lost`} />
        <Kpi label="Recurring clients" value={recurringIds.size} sub={`of ${corporate.length} corporate clients`} />
      </div>

      <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">Quotes</h2>
        <Segmented size="sm" value={view} onChange={setView} options={[{ value: "board", label: "Board" }, { value: "table", label: "Table" }]} />
      </div>

      {view === "board" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const list = sorted.filter((q) => q.status === col);
            return (
              <section key={col} className="rounded-2xl border border-line bg-surface-2/60 p-3" aria-label={`${STATUS[col].label} quotes`}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <Badge tone={STATUS[col].tone}>{STATUS[col].label}</Badge>
                  <span className="tnum text-xs text-ink-3">{list.length} · {money(list.reduce((t, q) => t + q.totalNGN, 0))}</span>
                </div>
                <ul className="grid gap-2">
                  {list.map((q) => (
                    <li key={q.id} className="rounded-xl border border-line bg-surface p-3">
                      <button onClick={() => setPreview(q.id)} className="block w-full text-start">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-ink-3">{q.number}</span>
                          <Money ngn={q.totalNGN} className="text-[13px] font-semibold text-ink" />
                        </div>
                        <p className="mt-1 truncate text-[13.5px] font-medium text-ink hover:underline">{q.company}</p>
                        <p className="truncate text-xs text-ink-3">{q.event}</p>
                        <p className="mt-1 text-xs text-ink-2">{q.guests} guests · {PACKAGES[q.packageId].name} · {dateOnly(q.date)}</p>
                      </button>
                      <QuoteActions q={q} act={act} className="mt-2.5" />
                    </li>
                  ))}
                  {!list.length && <li className="px-1 py-4 text-center text-xs text-ink-3">Nothing here</li>}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[1020px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-xs text-ink-3">
                  <th className="px-5 py-2.5 text-start font-medium">Quote</th>
                  <th className="px-3 py-2.5 text-start font-medium">Company</th>
                  <th className="px-3 py-2.5 text-start font-medium">Event</th>
                  <th className="px-3 py-2.5 text-end font-medium">Guests</th>
                  <th className="px-3 py-2.5 text-start font-medium">Package</th>
                  <th className="px-3 py-2.5 text-end font-medium">Per guest</th>
                  <th className="px-3 py-2.5 text-end font-medium">Total</th>
                  <th className="px-3 py-2.5 text-start font-medium">Event date</th>
                  <th className="px-3 py-2.5 text-start font-medium">Status</th>
                  <th className="px-5 py-2.5 text-end font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((q) => (
                  <tr key={q.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5"><button onClick={() => setPreview(q.id)} className="font-semibold text-brand hover:underline">{q.number}</button></td>
                    <td className="px-3 py-2.5 font-medium text-ink">{q.company}</td>
                    <td className="px-3 py-2.5 text-ink-2">{q.event}</td>
                    <td className="tnum px-3 py-2.5 text-end text-ink-2">{q.guests}</td>
                    <td className="px-3 py-2.5 text-ink-2">{PACKAGES[q.packageId].name}</td>
                    <td className="tnum px-3 py-2.5 text-end text-ink-2">{naira(q.perGuestNGN)}</td>
                    <td className="tnum px-3 py-2.5 text-end font-semibold text-ink">{naira(q.totalNGN)}</td>
                    <td className="px-3 py-2.5 text-ink-2">{dateOnly(q.date)}</td>
                    <td className="px-3 py-2.5"><Badge tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Badge>{q.recurring && <Badge tone="accent" className="ms-1">Monthly</Badge>}</td>
                    <td className="px-5 py-2.5"><QuoteActions q={q} act={act} className="justify-end" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="mt-5">
        <CardHead title="Corporate clients" sub="Companies that order from Temmiebakes" />
        {corporate.length === 0 ? (
          <Empty title="No corporate clients yet" />
        ) : (
          <div className="relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-y border-line text-xs text-ink-3">
                  <th className="px-5 py-2 text-start font-medium">Client</th>
                  <th className="px-3 py-2 text-end font-medium">Orders</th>
                  <th className="px-3 py-2 text-end font-medium">Total spend</th>
                  <th className="px-3 py-2 text-start font-medium">Last order</th>
                  <th className="px-5 py-2 text-start font-medium">Quotes</th>
                </tr>
              </thead>
              <tbody>
                {corporate
                  .map((c) => {
                    const os = orders.filter((o) => o.customerId === c.id && o.status !== "cancelled");
                    return { c, os, spend: os.reduce((t, o) => t + o.totalNGN, 0), qs: quotes.filter((q) => q.customerId === c.id) };
                  })
                  .sort((a, b) => b.spend - a.spend)
                  .map(({ c, os, spend, qs }) => (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-2.5"><CustomerChip c={c} sub={c.company ? `${c.company} · ${c.name}` : undefined} /></td>
                      <td className="tnum px-3 py-2.5 text-end text-ink-2">{os.length}</td>
                      <td className="tnum px-3 py-2.5 text-end font-semibold text-ink">{naira(spend)}</td>
                      <td className="px-3 py-2.5 text-ink-2">{c.lastOrderAt ? ago(c.lastOrderAt, now) : "No orders yet"}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {recurringIds.has(c.id) && <Badge tone="accent">Recurring</Badge>}
                          <span className="text-xs text-ink-3">{qs.length} quote{qs.length === 1 ? "" : "s"} · {qs.filter((q) => q.status === "accepted").length} won</span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewQuoteModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => setPreview(id)} />
      <QuotePreview quoteId={preview} onClose={() => setPreview(null)} act={act} />
    </div>
  );
}

function QuoteActions({ q, act, className }: { q: CateringQuote; act: (q: CateringQuote, s: "sent" | "accepted" | "declined") => void; className?: string }) {
  if (q.status === "accepted" || q.status === "declined") return null;
  return (
    <div className={cx("flex flex-wrap gap-1.5", className)}>
      {q.status === "draft" && <Button size="sm" onClick={() => act(q, "sent")}><PaperPlaneTilt size={14} /> Send</Button>}
      {q.status === "sent" && (
        <>
          <Button size="sm" onClick={() => act(q, "accepted")}><CheckCircle size={14} /> Mark accepted</Button>
          <Button size="sm" variant="ghost" onClick={() => act(q, "declined")}><XCircle size={14} /> Declined</Button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- new quote

function NewQuoteModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="New catering quote" wide>
      {open && <NewQuoteForm onClose={onClose} onCreated={onCreated} />}
    </Modal>
  );
}

function NewQuoteForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const run = useDemo((s) => s.run);
  const [pkg, setPkg] = useState<PackageId>("breakfast-box");
  const [f, setF] = useState(() => ({
    company: "",
    contact: "",
    phone: "",
    email: "",
    event: "",
    guests: "50",
    date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  }));
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const q = quoteCatering(pkg, Number(f.guests) || 0);
  const valid = f.company.trim().length > 1 && f.contact.trim().length > 1 && f.phone.replace(/\D/g, "").length >= 10 && f.event.trim().length > 2 && Number(f.guests) > 0 && f.date;

  const save = () => {
    if (!valid) return;
    const id = run((s) => {
      const { customer } = upsertCustomer(s, { name: f.contact.trim(), phone: f.phone.trim(), email: f.email.trim() || undefined, company: f.company.trim(), segment: "corporate", source: "corporate" });
      return createQuote(s, { customerId: customer.id, company: f.company.trim(), event: f.event.trim(), guests: Number(f.guests), dateISO: new Date(`${f.date}T09:00:00+01:00`).toISOString(), packageId: pkg });
    });
    toast("Quote drafted", `${f.company.trim()}: ${naira(q.totalNGN)} for ${q.guests} guests. Review the proposal, then send.`);
    onClose();
    onCreated(id);
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Package</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(PACKAGES) as PackageId[]).map((id) => {
            const p = PACKAGES[id];
            return (
              <button
                key={id}
                type="button"
                aria-pressed={pkg === id}
                onClick={() => setPkg(id)}
                className={cx("flex items-center gap-3 rounded-2xl border p-2.5 text-start transition-colors", pkg === id ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2")}
              >
                <Thumb src={p.image} className="h-12 w-12 rounded-xl" sizes="48px" />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{p.name}</span>
                  <span className="block text-xs text-ink-3">{naira(p.perGuestNGN)} per guest · min {p.minGuests}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Company">{(id) => <Input id={id} value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Access Bank, Ikeja branch" />}</Field>
        <Field label="Event">{(id) => <Input id={id} value={f.event} onChange={(e) => set("event", e.target.value)} placeholder="Quarterly town hall breakfast" />}</Field>
        <Field label="Contact name">{(id) => <Input id={id} value={f.contact} onChange={(e) => set("contact", e.target.value)} placeholder="Funmilayo Bakare" />}</Field>
        <Field label="Contact phone">{(id) => <Input id={id} type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+234 802 000 0000" />}</Field>
        <Field label="Contact email (optional)">{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="admin@company.ng" />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Guests">{(id) => <Input id={id} type="number" min={1} value={f.guests} onChange={(e) => set("guests", e.target.value)} />}</Field>
          <Field label="Event date">{(id) => <Input id={id} type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />}</Field>
        </div>
      </div>
      <div className="rounded-2xl bg-surface-2 px-4 py-3 text-[13px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-ink-2">{q.guests} guests × {naira(q.perGuestNGN)}{q.discountPct ? ` (${q.discountPct}% volume discount)` : ""}</span>
          <span className="tnum font-display text-xl font-semibold text-ink">{naira(q.totalNGN)}</span>
        </div>
        {q.belowMinimum && <p className="mt-1 text-xs text-warn">This package has a minimum of {PACKAGES[pkg].minGuests} guests, so the quote is priced at the minimum.</p>}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={!valid}><FileText size={15} /> Draft quote</Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- proposal preview

const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  .tb-proposal, .tb-proposal * { visibility: visible !important; }
  .tb-proposal { position: absolute; inset: 0 auto auto 0; width: 100%; background: #fff; color: #111; }
}`;

function QuotePreview({ quoteId, onClose, act }: { quoteId: string | null; onClose: () => void; act: (q: CateringQuote, s: "sent" | "accepted" | "declined") => void }) {
  const q = useDemo((s) => s.quotes.find((x) => x.id === quoteId));
  const c = useDemo((s) => s.customers.find((x) => x.id === q?.customerId));
  const pkg = q ? PACKAGES[q.packageId] : undefined;
  return (
    <Sheet open={!!q} onClose={onClose} title={q ? `Proposal ${q.number}` : "Proposal"} width={640}>
      {q && pkg && (
        <div className="p-4 sm:p-6">
          <style>{PRINT_CSS}</style>
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
            <Badge tone={STATUS[q.status].tone}>{STATUS[q.status].label}{q.sentAt ? ` · sent ${dateOnly(q.sentAt)}` : ""}</Badge>
            <div className="flex flex-wrap gap-2">
              <QuoteActions q={q} act={act} />
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer size={14} /> Print or save PDF</Button>
            </div>
          </div>

          <article className="tb-proposal print-page rounded-2xl border border-line bg-surface p-6 shadow-soft sm:p-8">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
              <div>
                <Logo size={36} withWord />
                <p className="mt-2 text-xs text-ink-3">Ikeja, Lagos · hello@temmiebakes.ng · @temmiebakes</p>
              </div>
              <div className="text-end text-[13px]">
                <p className="font-display text-lg font-semibold text-ink">Catering proposal</p>
                <p className="text-ink-3">{q.number} · {dateOnly(q.createdAt)}</p>
              </div>
            </header>

            <section className="grid grid-cols-1 gap-4 py-5 text-[13px] sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-3">Prepared for</p>
                <p className="mt-1 font-semibold text-ink">{q.company}</p>
                {c && <p className="text-ink-2">{c.name}{c.phone ? ` · ${c.phone}` : ""}</p>}
                {c?.email && <p className="text-ink-2">{c.email}</p>}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-3">Event</p>
                <p className="mt-1 font-semibold text-ink">{q.event}</p>
                <p className="text-ink-2">{new Date(q.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                <p className="text-ink-2">{q.guests} guests</p>
              </div>
            </section>

            <section className="rounded-xl bg-surface-2 p-4">
              <p className="font-display text-[17px] font-semibold text-ink">{pkg.name}</p>
              <ul className="mt-2 grid gap-1 text-[13px] text-ink-2">
                {pkg.includes.map((i) => (
                  <li key={i} className="flex gap-2"><CheckCircle size={15} weight="fill" className="mt-0.5 shrink-0 text-brand" /> {i}</li>
                ))}
              </ul>
            </section>

            <table className="mt-5 w-full text-[13px]">
              <tbody>
                <tr className="border-b border-line">
                  <td className="py-2 text-ink-2">{pkg.name}: {q.guests} guests × {naira(q.perGuestNGN)}</td>
                  <td className="tnum py-2 text-end text-ink">{naira(q.perGuestNGN * q.guests)}</td>
                </tr>
                {q.extras.map((e) => (
                  <tr key={e.name} className="border-b border-line">
                    <td className="py-2 text-ink-2">{e.name}</td>
                    <td className="tnum py-2 text-end text-ink">{naira(e.priceNGN)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-3 font-semibold text-ink">Total</td>
                  <td className="tnum pt-3 text-end font-display text-xl font-semibold text-ink">{naira(q.totalNGN)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-ink-3">Per guest</td>
                  <td className="tnum py-1 text-end text-ink-3">{naira(Math.round(q.totalNGN / Math.max(1, q.guests)))}</td>
                </tr>
              </tbody>
            </table>

            <section className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-2">
              <p className="font-semibold text-ink">Terms</p>
              <p>50% to confirm, balance 48h before event. Deposit: <span className="tnum font-semibold text-ink">{naira(Math.round(q.totalNGN / 2))}</span>.</p>
              <p>Final guest numbers are confirmed 72 hours before the event. This quote is valid for 14 days.</p>
              <p className="mt-3 text-ink-3">Thank you for considering Temmiebakes. We would love to make your event delicious.</p>
            </section>
          </article>
        </div>
      )}
    </Sheet>
  );
}
