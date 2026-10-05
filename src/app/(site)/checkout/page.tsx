"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockSimple, MagicWand, ShoppingBag, Storefront, Trash, Truck } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { PaystackModal } from "@/components/site/paystack-modal";
import { dueIsoFor, Eyebrow, prettyDay, Stepper } from "@/components/site/site-bits";
import { Button, cx, Empty, Field, Input, Segmented, Select } from "@/components/ui";
import { createOrder, naira, pay, upsertCustomer } from "@/lib/engine";
import { useNow } from "@/lib/hooks";
import { dayKey, depositFor, earliestSlot, pointsBooked, quoteCake, ZONES } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Occasion, OrderItem, Product } from "@/lib/types";

const DAY = 86400000;
const OCCASIONS: { value: Occasion; label: string }[] = [
  { value: "birthday", label: "Birthday" },
  { value: "wedding", label: "Wedding" },
  { value: "anniversary", label: "Anniversary" },
  { value: "baby-shower", label: "Baby shower" },
  { value: "graduation", label: "Graduation" },
  { value: "valentine", label: "Valentine's" },
  { value: "corporate", label: "Office or corporate" },
  { value: "just-because", label: "Just because" },
];

const noteDate = (items: OrderItem[]) => items.map((i) => i.notes?.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1]).find(Boolean) ?? "";
const noteZone = (items: OrderItem[]) => {
  const n = items.map((i) => i.notes ?? "").join(" ");
  if (/Pickup from/.test(n)) return { fulfilment: "pickup" as const, zoneId: "ikeja" };
  const z = ZONES.find((x) => n.includes(`Delivery to ${x.name}`));
  return { fulfilment: "delivery" as const, zoneId: z?.id ?? "ikeja" };
};

function itemNeeds(i: OrderItem, products: Product[]) {
  if (i.custom) {
    const q = quoteCake(i.custom);
    return { lead: q.leadDays, points: q.ovenPoints * i.qty, image: i.custom.referencePhoto ?? "/img/cake-piping.jpg" };
  }
  const p = products.find((x) => x.id === i.productId);
  return { lead: p?.leadDays ?? 1, points: (p?.ovenPoints ?? 0.5) * i.qty, image: p?.image ?? "/img/shop-display.jpg" };
}

type Errors = Partial<Record<"name" | "phone" | "email" | "address" | "date", string>>;

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useDemo((s) => s.cart);
  const products = useDemo((s) => s.products);
  const orders = useDemo((s) => s.orders);
  const capacity = useDemo((s) => s.dailyCapacity);
  const depositPct = useDemo((s) => s.assistant.depositPct);
  const updateCartQty = useDemo((s) => s.updateCartQty);
  const run = useDemo((s) => s.run);
  const clearCart = useDemo((s) => s.clearCart);
  const now = useNow(60000);

  const [initial] = useState(() => noteZone(cart));
  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">(initial.fulfilment);
  const [zoneId, setZoneId] = useState(initial.zoneId);
  const [date, setDate] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", instagram: "", email: "", address: "", occasion: "birthday" as Occasion, consent: true });
  const [errors, setErrors] = useState<Errors>({});
  const [mode, setMode] = useState<"deposit" | "full">("deposit");
  const [paying, setPaying] = useState(false);
  const [placing, setPlacing] = useState(false);

  const needs = useMemo(() => cart.map((i) => itemNeeds(i, products)), [cart, products]);
  const lead = needs.reduce((m, n) => Math.max(m, n.lead), 1);
  const points = Math.round(needs.reduce((t, n) => t + n.points, 0) * 2) / 2;
  const earliest = useMemo(() => earliestSlot(orders, capacity, lead, points, now), [orders, capacity, lead, points, now]);
  const fromNotes = noteDate(cart);
  const chosen = date || (fromNotes && fromNotes >= earliest ? fromNotes : earliest);
  const leadMin = dayKey(now + lead * DAY);
  const dateProblem =
    chosen < leadMin ? `Your basket needs ${lead} days notice.` : new Date(`${chosen}T12:00:00Z`).getUTCDay() === 0 ? "We don't deliver on Sundays." : pointsBooked(orders, chosen) + points > capacity ? `${prettyDay(chosen)} is fully booked.` : undefined;

  const zone = ZONES.find((z) => z.id === zoneId) ?? ZONES[0];
  const subtotal = cart.reduce((t, i) => t + i.qty * i.unitPriceNGN, 0);
  const fee = fulfilment === "delivery" ? zone.feeNGN : 0;
  const total = subtotal + fee;
  const deposit = depositFor(total, depositPct);
  const due = mode === "deposit" ? deposit : total;

  const upd = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as keyof Errors]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: Errors = {};
    if (form.name.trim().length < 2) e.name = "Please tell us your name.";
    const digits = form.phone.replace(/\D/g, "");
    if (!/^(234\d{10}|0\d{10})$/.test(digits)) e.phone = "Enter a Nigerian WhatsApp number, e.g. 0803 123 4567.";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = "That email doesn't look right.";
    if (fulfilment === "delivery" && form.address.trim().length < 6) e.address = "Add a street address for the rider.";
    if (dateProblem) e.date = dateProblem;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const startPay = (m: "deposit" | "full") => {
    setMode(m);
    if (validate()) setPaying(true);
    else toast("Check your details", "A few fields need attention.", "warn");
  };

  const placeOrder = () => {
    const items: OrderItem[] = JSON.parse(JSON.stringify(cart));
    const number = run((s) => {
      const { customer } = upsertCustomer(s, { name: form.name.trim(), phone: form.phone.trim(), instagram: form.instagram.trim() || undefined, email: form.email.trim() || undefined, zoneId: fulfilment === "delivery" ? zoneId : undefined, source: "web" });
      customer.consentWhatsApp = form.consent;
      const order = createOrder(s, { customerId: customer.id, channel: "web", status: "quoted", items, fulfilment, zoneId: fulfilment === "delivery" ? zoneId : undefined, address: fulfilment === "delivery" ? form.address.trim() : undefined, dueAt: dueIsoFor(chosen), occasion: form.occasion, ovenPoints: points, by: "Website" });
      pay(s, order.id, mode === "deposit" ? "deposit" : "full");
      return order.number;
    });
    setPlacing(true);
    setPaying(false);
    clearCart();
    toast(`Order ${number} confirmed`, mode === "deposit" ? `Deposit of ${naira(deposit)} received. Receipt sent on WhatsApp.` : `Paid in full: ${naira(total)}. Receipt sent on WhatsApp.`);
    router.push(`/track/${number}`);
  };

  if (!cart.length) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        {placing ? (
          <Empty title="Taking you to your order" sub="Payment confirmed." />
        ) : (
          <Empty
            icon={<ShoppingBag size={36} aria-hidden />}
            title="Your basket is empty"
            sub="Pick something from the menu or design a custom cake with a live price."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/menu" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink">Browse the menu</Link>
                <Link href="/cake-builder" className="rounded-full border border-line-strong px-5 py-2.5 text-sm font-medium text-ink">Build a cake</Link>
              </div>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
      <Eyebrow>Checkout</Eyebrow>
      <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">Almost ready for the oven</h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-12">
          <section aria-labelledby="basket-h">
            <h2 id="basket-h" className="font-display text-2xl text-ink">Your basket</h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              <AnimatePresence initial={false}>
                {cart.map((i, idx) => (
                  <motion.li key={`${i.productId ?? "custom"}-${idx}`} layout exit={{ opacity: 0, height: 0 }} className="flex gap-4 py-4">
                    <span className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
                      <Image src={needs[idx]?.image ?? "/img/shop-display.jpg"} alt="" fill sizes="80px" className="object-cover" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-ink">
                          {i.custom && <MagicWand size={14} className="me-1 inline text-brand" aria-label="Custom" />}
                          {i.name}
                        </p>
                        <p className="tnum shrink-0 font-semibold text-ink">{naira(i.qty * i.unitPriceNGN)}</p>
                      </div>
                      {i.notes && <p className="mt-0.5 text-[12.5px] text-ink-3">{i.notes}</p>}
                      <div className="mt-2 flex items-center gap-3">
                        <Stepper size="sm" value={i.qty} onChange={(n) => updateCartQty(idx, n)} label={`Quantity of ${i.name}`} />
                        <span className="tnum text-[12.5px] text-ink-3">{naira(i.unitPriceNGN)} each</span>
                        <button type="button" onClick={() => updateCartQty(idx, 0)} className="ms-auto rounded-full p-2 text-ink-3 hover:bg-surface-2 hover:text-bad" aria-label={`Remove ${i.name}`}>
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>

          <section aria-labelledby="when-h">
            <h2 id="when-h" className="font-display text-2xl text-ink">When and where</h2>
            <div className="mt-4">
              <Segmented
                value={fulfilment}
                onChange={(v) => (setFulfilment(v), setErrors((e) => ({ ...e, address: undefined })))}
                options={[
                  { value: "delivery", label: <span className="inline-flex items-center gap-1.5"><Truck size={15} aria-hidden /> Delivery</span> },
                  { value: "pickup", label: <span className="inline-flex items-center gap-1.5"><Storefront size={15} aria-hidden /> Pickup in Ikeja</span> },
                ]}
              />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Date" error={errors.date ?? dateProblem} hint={`Earliest: ${prettyDay(earliest, true)}`}>
                {(id) => <Input id={id} type="date" min={earliest} value={chosen} onChange={(e) => (setDate(e.target.value), setErrors((x) => ({ ...x, date: undefined })))} />}
              </Field>
              {fulfilment === "delivery" ? (
                <Field label="Delivery area" hint={`${naira(zone.feeNGN)} · about ${zone.etaMins} minutes`}>
                  {(id) => (
                    <Select id={id} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                      {ZONES.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} · {naira(z.feeNGN)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ) : (
                <div className="rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">Collect from our Ikeja studio, 10am to 6pm. Directions come on WhatsApp.</div>
              )}
              {fulfilment === "delivery" && (
                <Field label="Street address" error={errors.address} className="sm:col-span-2">
                  {(id) => <Input id={id} value={form.address} onChange={(e) => upd("address", e.target.value)} placeholder="12 Isaac John Street, GRA" autoComplete="street-address" />}
                </Field>
              )}
            </div>
          </section>

          <section aria-labelledby="you-h">
            <h2 id="you-h" className="font-display text-2xl text-ink">Your details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errors.name}>
                {(id) => <Input id={id} value={form.name} onChange={(e) => upd("name", e.target.value)} autoComplete="name" placeholder="Adaeze Okafor" />}
              </Field>
              <Field label="WhatsApp number" error={errors.phone}>
                {(id) => <Input id={id} type="tel" inputMode="tel" value={form.phone} onChange={(e) => upd("phone", e.target.value)} autoComplete="tel" placeholder="0803 123 4567" />}
              </Field>
              <Field label="Instagram (optional)">
                {(id) => <Input id={id} value={form.instagram} onChange={(e) => upd("instagram", e.target.value)} placeholder="@yourhandle" />}
              </Field>
              <Field label="Email (optional)" error={errors.email}>
                {(id) => <Input id={id} type="email" value={form.email} onChange={(e) => upd("email", e.target.value)} autoComplete="email" placeholder="you@example.com" />}
              </Field>
              <Field label="Occasion" hint="We'll remind you next year, if you'd like">
                {(id) => (
                  <Select id={id} value={form.occasion} onChange={(e) => upd("occasion", e.target.value as Occasion)}>
                    {OCCASIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <label className="flex items-start gap-3 self-end rounded-2xl bg-surface-2 p-4 text-sm text-ink-2 sm:col-span-2">
                <input type="checkbox" checked={form.consent} onChange={(e) => upd("consent", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
                <span>Send me order updates and occasion reminders on WhatsApp. You can stop them any time.</span>
              </label>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Order total">
          <div className="rounded-[1.6rem] border border-line bg-surface p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-xl text-ink">Summary</h2>
            <dl className="mt-4 flex flex-col gap-2 text-sm">
              <Row label={`Items (${cart.reduce((n, i) => n + i.qty, 0)})`} value={naira(subtotal)} />
              <Row label={fulfilment === "delivery" ? `Delivery to ${zone.name}` : "Pickup"} value={fee ? naira(fee) : "Free"} />
              <Row label="Ready on" value={prettyDay(chosen)} />
              <div className="mt-2 flex items-end justify-between border-t border-line-strong pt-3">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="tnum font-display text-3xl text-ink">{naira(total)}</dd>
              </div>
              <div className="flex justify-between rounded-xl bg-brand-soft px-3 py-2 text-brand">
                <dt>{depositPct}% deposit today</dt>
                <dd className="tnum font-semibold">{naira(deposit)}</dd>
              </div>
              <p className="text-[12px] text-ink-3">Balance of {naira(total - deposit)} is due before dispatch.</p>
            </dl>
            <div className="mt-5 flex flex-col gap-2">
              <Button size="lg" onClick={() => startPay("deposit")}>
                <LockSimple size={16} aria-hidden /> Pay deposit with Paystack
              </Button>
              <Button size="lg" variant="outline" onClick={() => startPay("full")}>
                Pay in full · {naira(total)}
              </Button>
            </div>
            <p className={cx("mt-4 text-center text-[12px] text-ink-3")}>Secured by Paystack · demo, no money moves</p>
          </div>
        </aside>
      </div>

      <PaystackModal open={paying} onClose={() => setPaying(false)} amountNGN={due} email={form.email} label={mode === "deposit" ? `Deposit for ${cart.length} item${cart.length > 1 ? "s" : ""}, due ${prettyDay(chosen)}` : `Full payment, due ${prettyDay(chosen)}`} onPaid={placeOrder} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-2">{label}</dt>
      <dd className="tnum text-ink">{value}</dd>
    </div>
  );
}
