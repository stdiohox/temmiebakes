"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarBlank, ChalkboardTeacher, ChatCircleDots, CheckCircle, MapPin, UsersThree } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { PaystackModal } from "@/components/site/paystack-modal";
import { Eyebrow, MODE_LABEL, nextCohort, openChannel, prettyDay } from "@/components/site/site-bits";
import { Button, cx, Empty, Field, Input, Segmented } from "@/components/ui";
import { enroll, naira, upsertCustomer } from "@/lib/engine";
import { useNow } from "@/lib/hooks";
import { dayKey, depositFor } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";

type Errors = Partial<Record<"name" | "phone" | "email", string>>;

export default function CoursePage() {
  const { slug } = useParams<{ slug: string }>();
  const course = useDemo((s) => s.courses.find((c) => c.slug === slug));
  const cohorts = useDemo((s) => s.cohorts);
  const run = useDemo((s) => s.run);
  const now = useNow(60000);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [plan, setPlan] = useState<"deposit" | "full">("deposit");
  const [errors, setErrors] = useState<Errors>({});
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<{ name: string; amount: number; already: boolean } | null>(null);

  if (!course) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Empty title="That class isn't running" sub="Have a look at the courses open for booking this term." action={<Link href="/classes" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink">All classes</Link>} />
      </div>
    );
  }

  const c = course;
  const cohort = nextCohort(cohorts, c.id, now);
  const left = cohort ? cohort.seats - cohort.studentIds.length : 0;
  const full = !cohort || left <= 0;
  const amount = plan === "deposit" ? depositFor(c.priceNGN, 50) : c.priceNGN;

  const upd = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const book = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Errors = {};
    if (form.name.trim().length < 2) er.name = "Your full name, for the certificate.";
    if (!/^(234\d{10}|0\d{10})$/.test(form.phone.replace(/\D/g, ""))) er.phone = "A Nigerian WhatsApp number, e.g. 0803 123 4567.";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) er.email = "That email doesn't look right.";
    setErrors(er);
    if (Object.keys(er).length) return toast("Check your details", "A few fields need attention.", "warn");
    setPaying(true);
  };

  const confirm = () => {
    if (!cohort) return;
    const res = run((s) => {
      const { customer } = upsertCustomer(s, { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || undefined, source: "class", segment: "student" });
      const ch = s.cohorts.find((x) => x.id === cohort.id);
      const already = Boolean(ch?.studentIds.includes(customer.id));
      if (!already) enroll(s, cohort.id, customer.id, amount);
      return { name: customer.name.split(" ")[0], already };
    });
    setPaying(false);
    setDone({ ...res, amount });
    toast(res.already ? "You're already booked" : "Seat booked", res.already ? `See you on ${prettyDay(dayKey(cohort.startDate), true)}.` : `${naira(amount)} received. Confirmation sent on WhatsApp.`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
      <Link href="/classes" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={14} aria-hidden /> All classes
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0">
          <div className="relative aspect-[16/9] overflow-hidden rounded-[2rem] bg-surface-2">
            <Image src={c.image} alt="" fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
          </div>
          <Eyebrow className="mt-8">{c.level}</Eyebrow>
          <h1 className="mt-3 font-display text-4xl leading-[1.08] text-ink sm:text-5xl">{c.title}</h1>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
            <span className="inline-flex items-center gap-1.5"><ChalkboardTeacher size={16} aria-hidden /> {c.days} {c.mode === "online" ? "days, self-paced" : "days"}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin size={16} aria-hidden /> {MODE_LABEL[c.mode]}</span>
            <span className="inline-flex items-center gap-1.5"><UsersThree size={16} aria-hidden /> Over 200 students trained</span>
          </div>

          <h2 className="mt-10 font-display text-2xl text-ink">What you will learn</h2>
          <ol className="mt-4 divide-y divide-line border-y border-line">
            {c.outline.map((x, i) => (
              <li key={x} className="flex gap-5 py-4">
                <span className="tnum font-display text-xl text-brand">{String(i + 1).padStart(2, "0")}</span>
                <span className="pt-0.5 text-[15px] text-ink">{x}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm leading-relaxed text-ink-2">All ingredients, aprons and equipment are provided. You take home everything you bake, plus a certificate and our costing sheet.</p>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Book a seat">
          <div className="overflow-hidden rounded-[1.6rem] border border-line bg-surface shadow-soft">
            <div className="border-b border-line p-5 sm:p-6">
              <p className="tnum font-display text-3xl text-ink">{naira(c.priceNGN)}</p>
              {cohort ? (
                <div className="mt-3 flex flex-col gap-2 text-sm">
                  <span className="inline-flex items-center gap-2 text-ink-2">
                    <CalendarBlank size={16} aria-hidden /> Next cohort starts {prettyDay(dayKey(cohort.startDate), true)}
                  </span>
                  <div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${cohort.studentIds.length} of ${cohort.seats} seats taken`}>
                      <motion.span className={cx("h-full", full ? "bg-bad" : "bg-brand")} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (cohort.studentIds.length / cohort.seats) * 100)}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                    </div>
                    <p className={cx("mt-1.5 text-[12.5px]", full ? "font-medium text-bad" : left <= 3 ? "font-medium text-warn" : "text-ink-3")}>{full ? "Fully booked" : `${left} of ${cohort.seats} seats left`}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm font-medium text-bad">Fully booked. New dates coming soon.</p>
              )}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 sm:p-6" role="status">
                  <CheckCircle size={40} weight="fill" className="text-ok" aria-hidden />
                  <p className="mt-3 font-display text-2xl text-ink">{done.already ? `${done.name}, you're already in` : `See you in class, ${done.name}`}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">
                    {done.already ? "Your seat was booked earlier, so we didn't charge you again." : `${naira(done.amount)} received. ${done.amount < c.priceNGN ? `Balance of ${naira(c.priceNGN - done.amount)} is due before the first class. ` : ""}Your confirmation and a reminder the day before are on WhatsApp.`}
                  </p>
                </motion.div>
              ) : full ? (
                <motion.div key="full" className="p-5 sm:p-6">
                  <p className="text-sm text-ink-2">This cohort is full. Tia can add you to the waitlist and tell you when the next dates open.</p>
                  <Button size="lg" variant="outline" className="mt-4 w-full" onClick={() => openChannel("web", `Please add me to the waitlist for ${c.title}`)}>
                    <ChatCircleDots size={18} aria-hidden /> Join the waitlist with Tia
                  </Button>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={book} className="flex flex-col gap-4 p-5 sm:p-6" noValidate>
                  <Field label="Full name" error={errors.name}>
                    {(id) => <Input id={id} value={form.name} onChange={(e) => upd("name", e.target.value)} autoComplete="name" placeholder="Chiamaka Eze" />}
                  </Field>
                  <Field label="WhatsApp number" error={errors.phone}>
                    {(id) => <Input id={id} type="tel" value={form.phone} onChange={(e) => upd("phone", e.target.value)} autoComplete="tel" placeholder="0803 123 4567" />}
                  </Field>
                  <Field label="Email (optional)" error={errors.email}>
                    {(id) => <Input id={id} type="email" value={form.email} onChange={(e) => upd("email", e.target.value)} autoComplete="email" placeholder="you@example.com" />}
                  </Field>
                  <div>
                    <p className="mb-1.5 text-[13px] font-medium text-ink-2">Payment</p>
                    <Segmented
                      value={plan}
                      onChange={setPlan}
                      options={[
                        { value: "deposit", label: `50% deposit · ${naira(depositFor(c.priceNGN, 50))}` },
                        { value: "full", label: `Pay in full` },
                      ]}
                    />
                  </div>
                  <Button type="submit" size="lg">
                    Book my seat · {naira(amount)}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>

      <PaystackModal open={paying} onClose={() => setPaying(false)} amountNGN={amount} email={form.email} label={`${c.title}, ${plan === "deposit" ? "50% deposit" : "full fee"}`} onPaid={confirm} />
    </div>
  );
}
