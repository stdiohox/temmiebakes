"use client";

import Image from "next/image";
import { ArrowRight, CalendarCheck, Check, CheckCircle, Clock, Receipt, Truck } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Reveal } from "@/components/site/site-shell";
import { Eyebrow, prettyDay } from "@/components/site/site-bits";
import { Button, cx, Field, Input, Select } from "@/components/ui";
import { createQuote, naira, upsertCustomer } from "@/lib/engine";
import { useNow } from "@/lib/hooks";
import { dayKey, PACKAGES, quoteCatering } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { PackageId } from "@/lib/types";

const IDS = Object.keys(PACKAGES) as PackageId[];
const TRUST = [
  { icon: Clock, title: "On time, every time", body: "Breakfast lands before your 9am. Riders leave Ikeja with buffer for Third Mainland traffic." },
  { icon: Receipt, title: "Proper paperwork", body: "Itemised quotes, invoices and receipts your finance team can file without chasing." },
  { icon: Truck, title: "Lagos-wide delivery", body: "Ikeja to Lekki and VI. Set up and branded styling included on dessert tables." },
  { icon: CalendarCheck, title: "Recurring made easy", body: "Monthly staff birthdays or quarterly meetings on a standing order, invoiced together." },
];

type Errors = Partial<Record<"company" | "contact" | "email" | "phone" | "date", string>>;

export default function CorporatePage() {
  const run = useDemo((s) => s.run);
  const now = useNow(60000);
  const minDate = dayKey(now + 3 * 86400000);
  const [pkg, setPkg] = useState<PackageId>("breakfast-box");
  const [guests, setGuests] = useState(50);
  const [form, setForm] = useState({ date: "", event: "", company: "", contact: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState<{ number: string; total: number } | null>(null);

  const p = PACKAGES[pkg];
  const q = quoteCatering(pkg, guests || 0);
  const full = p.perGuestNGN * q.guests;
  const upd = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Errors = {};
    if (form.company.trim().length < 2) er.company = "Company name, please.";
    if (form.contact.trim().length < 2) er.contact = "Who should we speak to?";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) er.email = "A work email for the quote PDF.";
    if (!/^(234\d{10}|0\d{10})$/.test(form.phone.replace(/\D/g, ""))) er.phone = "A Nigerian number, e.g. 0803 123 4567.";
    if (!form.date) er.date = "Pick your event date.";
    else if (form.date < minDate) er.date = `We need 3 days notice. Earliest is ${prettyDay(minDate)}.`;
    setErrors(er);
    if (Object.keys(er).length) return;
    const result = run((s) => {
      const { customer } = upsertCustomer(s, { name: form.contact.trim(), phone: form.phone.trim(), email: form.email.trim(), company: form.company.trim(), segment: "corporate", source: "corporate" });
      if (customer.segment === "individual") customer.segment = "corporate";
      if (!customer.company) customer.company = form.company.trim();
      const id = createQuote(s, { customerId: customer.id, company: form.company.trim(), event: form.event.trim() || p.name, guests: q.guests, dateISO: `${form.date}T09:00:00+01:00`, packageId: pkg });
      const quote = s.quotes.find((x) => x.id === id)!;
      return { number: quote.number, total: quote.totalNGN };
    });
    setSent(result);
    toast(`Quote ${result.number} prepared`, `${naira(result.total)} for ${q.guests} guests. Ifeoma will email the PDF shortly.`);
  };

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-end gap-8 px-4 pb-10 pt-12 sm:px-6 sm:pt-16 md:grid-cols-[1.2fr_1fr]">
        <div>
          <Eyebrow>Corporate catering</Eyebrow>
          <h1 className="mt-3 font-display text-[2.4rem] leading-[1.05] text-ink sm:text-6xl">
            Office treats that <span className="italic text-brand">arrive before the meeting</span>
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-2 sm:text-base">Breakfast boxes, canapé receptions and dessert tables for Lagos teams. Price it yourself below and get a formal quote in minutes.</p>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-surface-2">
          <Image src="/img/catering-breakfast-toast.jpg" alt="Corporate breakfast spread" fill priority sizes="(min-width: 768px) 45vw, 100vw" className="object-cover" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-labelledby="pk-h">
        <h2 id="pk-h" className="sr-only">Packages</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {IDS.map((id, i) => {
            const pk = PACKAGES[id];
            const on = id === pkg;
            return (
              <Reveal key={id} delay={i * 0.05}>
                <button type="button" aria-pressed={on} onClick={() => (setPkg(id), setGuests((g) => Math.max(g, pk.minGuests)), setSent(null))} className={cx("group flex h-full w-full flex-col overflow-hidden rounded-[1.6rem] border text-start transition-colors sm:flex-row", on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-line-strong")}>
                  <span className="relative block aspect-[16/9] shrink-0 sm:aspect-auto sm:w-40">
                    <Image src={pk.image} alt="" fill sizes="(min-width: 640px) 160px, 100vw" className="object-cover" />
                  </span>
                  <span className="flex flex-1 flex-col p-5">
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-display text-xl leading-snug text-ink">{pk.name}</span>
                      <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full border", on ? "border-brand bg-brand text-brand-ink" : "border-line-strong")} aria-hidden>
                        {on && <Check size={11} weight="bold" />}
                      </span>
                    </span>
                    <span className="tnum mt-1 text-sm text-ink-2">
                      <span className="font-semibold text-ink">{naira(pk.perGuestNGN)}</span> per guest · min {pk.minGuests}
                    </span>
                    <ul className="mt-3 flex flex-col gap-1 text-[13px] text-ink-2">
                      {pk.includes.map((x) => (
                        <li key={x} className="flex gap-2">
                          <Check size={13} className="mt-0.5 shrink-0 text-brand" aria-hidden /> {x}
                        </li>
                      ))}
                    </ul>
                  </span>
                </button>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6" aria-labelledby="calc-h">
        <div className="grid overflow-hidden rounded-[2rem] border border-line bg-surface lg:grid-cols-[1.3fr_1fr]">
          <form onSubmit={submit} className="p-5 sm:p-8" noValidate>
            <h2 id="calc-h" className="font-display text-3xl text-ink">Quote calculator</h2>
            <p className="mt-1 text-sm text-ink-2">Volume pricing applies automatically from 100 guests.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Package">
                {(id) => (
                  <Select id={id} value={pkg} onChange={(e) => (setPkg(e.target.value as PackageId), setSent(null))}>
                    {IDS.map((x) => (
                      <option key={x} value={x}>
                        {PACKAGES[x].name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Guests" hint={q.belowMinimum ? `Priced at the ${p.minGuests}-guest minimum` : undefined}>
                {(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={2000} value={guests || ""} onChange={(e) => (setGuests(Math.max(0, Math.min(2000, Number(e.target.value)))), setSent(null))} />}
              </Field>
              <Field label="Event date" error={errors.date}>
                {(id) => <Input id={id} type="date" min={minDate} value={form.date} onChange={(e) => upd("date", e.target.value)} />}
              </Field>
              <Field label="Event (optional)">
                {(id) => <Input id={id} value={form.event} onChange={(e) => upd("event", e.target.value)} placeholder="Quarterly town hall" />}
              </Field>
              <Field label="Company" error={errors.company}>
                {(id) => <Input id={id} value={form.company} onChange={(e) => upd("company", e.target.value)} autoComplete="organization" placeholder="Ikeja Fintech Ltd" />}
              </Field>
              <Field label="Contact name" error={errors.contact}>
                {(id) => <Input id={id} value={form.contact} onChange={(e) => upd("contact", e.target.value)} autoComplete="name" placeholder="Funmilayo Adeyemi" />}
              </Field>
              <Field label="Work email" error={errors.email}>
                {(id) => <Input id={id} type="email" value={form.email} onChange={(e) => upd("email", e.target.value)} autoComplete="email" placeholder="you@company.ng" />}
              </Field>
              <Field label="Phone" error={errors.phone}>
                {(id) => <Input id={id} type="tel" value={form.phone} onChange={(e) => upd("phone", e.target.value)} autoComplete="tel" placeholder="0803 123 4567" />}
              </Field>
            </div>
            <Button type="submit" size="lg" className="mt-6 w-full sm:w-auto">
              Request formal quote <ArrowRight size={16} aria-hidden />
            </Button>
          </form>

          <div className="flex flex-col justify-between gap-6 bg-brand p-6 text-brand-ink sm:p-8">
            <AnimatePresence mode="wait" initial={false}>
              {sent ? (
                <motion.div key="sent" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status">
                  <CheckCircle size={40} weight="fill" aria-hidden />
                  <p className="mt-4 text-sm opacity-85">Quote reference</p>
                  <p className="font-display text-5xl">{sent.number}</p>
                  <p className="mt-4 text-[15px] leading-relaxed opacity-90">Thank you. Your quote of {naira(sent.total)} is prepared and Ifeoma will email the PDF within the hour, then follow up on WhatsApp.</p>
                </motion.div>
              ) : (
                <motion.div key="calc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-sm opacity-85">{p.name}</p>
                  <motion.p key={q.totalNGN} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="tnum mt-2 font-display text-5xl leading-none">
                    {naira(q.totalNGN)}
                  </motion.p>
                  <dl className="mt-6 flex flex-col gap-2 text-sm">
                    <div className="flex justify-between gap-3 border-b border-white/20 pb-2">
                      <dt className="opacity-85">Guests</dt>
                      <dd className="tnum font-semibold">{q.guests}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-white/20 pb-2">
                      <dt className="opacity-85">Per guest</dt>
                      <dd className="tnum font-semibold">{naira(q.perGuestNGN)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="opacity-85">Volume discount</dt>
                      <dd className="tnum font-semibold">{q.discountPct ? `${q.discountPct}% · you save ${naira(full - q.totalNGN)}` : "From 100 guests"}</dd>
                    </div>
                  </dl>
                </motion.div>
              )}
            </AnimatePresence>
            <p className="text-[12.5px] opacity-80">Prices include packaging and Lagos delivery. 50% deposit confirms the booking.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6" aria-labelledby="trust-h">
        <Reveal>
          <Eyebrow>Why teams reorder</Eyebrow>
          <h2 id="trust-h" className="mt-2 max-w-xl font-display text-3xl text-ink sm:text-4xl">Built for office managers with a lot on</h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 border-t border-line pt-8 sm:grid-cols-2">
          {TRUST.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.05} className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <t.icon size={20} aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold text-ink">{t.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{t.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
