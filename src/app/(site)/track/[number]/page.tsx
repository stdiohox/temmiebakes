"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ChatCircleDots, Check, MapPin, Moped, Star, Storefront } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useState } from "react";
import { PaystackModal } from "@/components/site/paystack-modal";
import { Eyebrow, openChannel, Stars, STATUS_LABEL } from "@/components/site/site-bits";
import { Avatar, Button, cx, Empty, Textarea } from "@/components/ui";
import { naira, pay, recordReview } from "@/lib/engine";
import { dateTime } from "@/lib/format";
import { ZONES } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Order, OrderStatus } from "@/lib/types";

const FLOW: OrderStatus[] = ["enquiry", "quoted", "confirmed", "baking", "decorating", "ready", "out-for-delivery", "delivered"];
const EASE = [0.16, 1, 0.3, 1] as const;

export default function OrderTrackPage() {
  const { number } = useParams<{ number: string }>();
  const key = decodeURIComponent(number ?? "").toUpperCase();
  const order = useDemo((s) => s.orders.find((o) => o.number === key));
  const customer = useDemo((s) => (order ? s.customers.find((c) => c.id === order.customerId) : undefined));
  const rider = useDemo((s) => (order?.riderId ? s.staff.find((x) => x.id === order.riderId) : undefined));
  const run = useDemo((s) => s.run);
  const [paying, setPaying] = useState(false);

  if (!order) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Empty title={`We couldn't find ${key || "that order"}`} sub="Check the number on your WhatsApp receipt, or search by phone number." action={<Link href="/track" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink">Search again</Link>} />
      </div>
    );
  }

  const o = order;
  const balance = o.totalNGN - o.paidNGN;
  const zone = ZONES.find((z) => z.id === o.zoneId);
  const firstName = customer?.name.split(" ")[0];

  const payBalance = () => {
    run((s) => pay(s, o.id, "balance"));
    setPaying(false);
    toast("Balance paid", `${naira(balance)} received for ${o.number}. You're fully paid.`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
      <Link href="/track" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={14} aria-hidden /> Track another order
      </Link>

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Order {o.number}</Eyebrow>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl">{headline(o, firstName)}</h1>
          <p className="mt-2 text-[15px] text-ink-2">
            {o.fulfilment === "delivery" ? "Delivery" : "Pickup"} on {dateTime(o.dueAt)}
          </p>
        </div>
        <button type="button" onClick={() => openChannel("whatsapp", `Hi, any update on my order ${o.number}?`)} className="inline-flex h-11 w-fit items-center gap-2 rounded-full border border-line-strong px-5 text-sm font-medium text-ink hover:bg-surface-2">
          <ChatCircleDots size={16} aria-hidden /> Ask about this order
        </button>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-8">
          <Progress order={o} />

          {o.status === "out-for-delivery" && rider && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 rounded-[1.6rem] bg-brand p-5 text-brand-ink">
              <Avatar agent={rider} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-sm opacity-85">Your rider</p>
                <p className="font-display text-xl">{rider.name}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm">
                <Moped size={18} aria-hidden /> About {zone?.etaMins ?? 45} min
              </span>
            </motion.div>
          )}

          {o.status === "delivered" && <ReviewBox order={o} />}

          <section aria-labelledby="items-h" className="rounded-[1.6rem] border border-line bg-surface p-5 sm:p-6">
            <h2 id="items-h" className="font-display text-xl text-ink">Items</h2>
            <ul className="mt-3 divide-y divide-line">
              {o.items.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {i.qty} × {i.name}
                    </p>
                    {i.notes && <p className="mt-0.5 text-[12.5px] text-ink-3">{i.notes}</p>}
                  </div>
                  <p className="tnum shrink-0 text-ink">{naira(i.qty * i.unitPriceNGN)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[1.6rem] border border-line bg-surface p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-xl text-ink">Payment</h2>
            <dl className="mt-4 flex flex-col gap-2 text-sm">
              <Row label="Subtotal" value={naira(o.subtotalNGN)} />
              <Row label="Delivery" value={o.deliveryFeeNGN ? naira(o.deliveryFeeNGN) : "Free"} />
              <div className="flex items-end justify-between border-t border-line-strong pt-3">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="tnum font-display text-2xl text-ink">{naira(o.totalNGN)}</dd>
              </div>
              <Row label="Paid" value={naira(o.paidNGN)} />
              <div className={cx("flex justify-between rounded-xl px-3 py-2", balance > 0 ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok")}>
                <dt>{balance > 0 ? "Balance due" : "Fully paid"}</dt>
                <dd className="tnum font-semibold">{balance > 0 ? naira(balance) : <Check size={16} weight="bold" aria-label="Paid" />}</dd>
              </div>
            </dl>
            {balance > 0 && o.status !== "cancelled" && (
              <Button size="lg" className="mt-4 w-full" onClick={() => setPaying(true)}>
                Pay balance · {naira(balance)}
              </Button>
            )}
          </div>

          <div className="rounded-[1.6rem] border border-line bg-surface p-5 sm:p-6">
            <h2 className="font-display text-xl text-ink">{o.fulfilment === "delivery" ? "Delivery" : "Pickup"}</h2>
            <div className="mt-3 flex gap-3 text-sm text-ink-2">
              {o.fulfilment === "delivery" ? <MapPin size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden /> : <Storefront size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />}
              <div>
                <p className="text-ink">{o.fulfilment === "delivery" ? o.address || zone?.name || "Lagos" : "Koretbakes studio, Ikeja"}</p>
                <p className="mt-0.5">{o.fulfilment === "delivery" ? `${zone?.name ?? "Lagos"} · about ${zone?.etaMins ?? 45} minutes from the kitchen` : "Open 10am to 6pm, Monday to Saturday"}</p>
                <p className="mt-2">{dateTime(o.dueAt)}</p>
                {rider && (o.status === "out-for-delivery" || o.status === "delivered") && <p className="mt-2">Rider: {rider.name}</p>}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <PaystackModal open={paying} onClose={() => setPaying(false)} amountNGN={balance} email={customer?.email} label={`Balance for ${o.number}`} onPaid={payBalance} />
    </div>
  );
}

function headline(o: Order, name?: string) {
  const hi = name ? `${name}, ` : "";
  switch (o.status) {
    case "enquiry":
    case "quoted":
      return `${hi}your quote is waiting`;
    case "confirmed":
      return `${hi}you're booked in`;
    case "baking":
      return "It's in the oven";
    case "decorating":
      return "Getting dressed up";
    case "ready":
      return o.fulfilment === "pickup" ? "Ready for collection" : "Boxed and ready";
    case "out-for-delivery":
      return "On its way to you";
    case "delivered":
      return "Delivered. Enjoy!";
    case "cancelled":
      return "This order was cancelled";
  }
}

function Progress({ order: o }: { order: Order }) {
  const flow = o.fulfilment === "pickup" ? FLOW.filter((s) => s !== "out-for-delivery") : FLOW;
  const at = (s: OrderStatus) => [...o.history].reverse().find((h) => h.status === s);
  const current = flow.indexOf(o.status);
  const reached = (i: number) => (o.status === "cancelled" ? Boolean(at(flow[i])) : i <= current);

  return (
    <section aria-labelledby="progress-h" className="rounded-[1.6rem] border border-line bg-surface p-5 sm:p-6">
      <h2 id="progress-h" className="font-display text-xl text-ink">Progress</h2>
      {o.status === "cancelled" && <p className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">Cancelled. Any payment will be refunded within 3 working days.</p>}
      <ol className="mt-5">
        {flow.map((s, i) => {
          const done = reached(i);
          const now = s === o.status;
          const h = at(s);
          return (
            <li key={s} className="relative flex gap-4 pb-5 last:pb-0">
              {i < flow.length - 1 && (
                <span className="absolute start-[13px] top-7 h-[calc(100%-1.5rem)] w-0.5 overflow-hidden rounded-full bg-line" aria-hidden>
                  <motion.span className="block w-full bg-brand" initial={{ height: 0 }} animate={{ height: reached(i + 1) ? "100%" : 0 }} transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }} />
                </span>
              )}
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.08, duration: 0.4, ease: EASE }}
                className={cx("relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2", done ? "border-brand bg-brand text-brand-ink" : "border-line-strong bg-surface text-ink-3", now && o.status !== "delivered" && "ring-4 ring-brand/20")}
              >
                {done ? <Check size={13} weight="bold" aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </motion.span>
              <div className="min-w-0 pt-0.5">
                <p className={cx("text-sm", done ? "font-semibold text-ink" : "text-ink-3")}>
                  {STATUS_LABEL[s]}
                  {now && o.status !== "delivered" && <span className="ms-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">Now</span>}
                </p>
                {h && <p className="text-[12.5px] text-ink-3">{dateTime(h.at)}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ReviewBox({ order: o }: { order: Order }) {
  const run = useDemo((s) => s.run);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  if (o.rating) {
    return (
      <section className="rounded-[1.6rem] bg-ok-soft p-5 sm:p-6">
        <p className="font-display text-xl text-ink">Thank you for your review</p>
        <Stars value={o.rating} size={16} className="mt-2" />
        {o.review && <p className="mt-2 text-sm text-ink-2">&ldquo;{o.review}&rdquo;</p>}
      </section>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return setErr("Tap a star to rate.");
    run((s) => recordReview(s, o.id, rating, text.trim()));
    toast("Review received", rating >= 4 ? "Thank you! Temmie reads every one." : "Thank you. Temmie will reach out personally.");
  };

  const shown = hover || rating;
  return (
    <form onSubmit={submit} className="rounded-[1.6rem] border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-xl text-ink">How was it?</h2>
      <p className="mt-1 text-sm text-ink-2">Your rating helps other Lagos families choose.</p>
      <div className="mt-4 flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onMouseEnter={() => setHover(n)} onClick={() => (setRating(n), setErr(""))} className="rounded-full p-1 transition-transform hover:scale-110">
            <Star size={30} weight={n <= shown ? "fill" : "regular"} className={n <= shown ? "text-accent-bright" : "text-ink-3"} />
          </button>
        ))}
      </div>
      {err && <p className="mt-1 text-xs text-bad">{err}</p>}
      <label htmlFor="review-text" className="mt-4 block text-[13px] font-medium text-ink-2">
        Tell us more (optional)
      </label>
      <Textarea id="review-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="The red velvet was perfect and everyone asked for the number..." className="mt-1.5" />
      <Button type="submit" className="mt-4">
        Submit review
      </Button>
    </form>
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
