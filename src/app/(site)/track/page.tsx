"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MagnifyingGlass, Package } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Reveal } from "@/components/site/site-shell";
import { PageIntro, STATUS_LABEL } from "@/components/site/site-bits";
import { Button, cx, Field, Input } from "@/components/ui";
import { naira, orderLabel } from "@/lib/engine";
import { useDemo } from "@/lib/store";
import type { Order } from "@/lib/types";


const digits = (p: string) => p.replace(/\D/g, "").slice(-10);

export default function TrackPage() {
  const router = useRouter();
  const orders = useDemo((s) => s.orders);
  const customers = useDemo((s) => s.customers);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<Order[] | null>(null);

  const samples = useMemo(() => {
    const pick = (fn: (o: Order) => boolean) => orders.find(fn);
    return [
      pick((o) => o.status === "out-for-delivery"),
      pick((o) => o.status === "baking" || o.status === "decorating"),
      pick((o) => o.status === "delivered" && !o.rating),
    ].filter((o): o is Order => Boolean(o));
  }, [orders]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    setMatches(null);
    const num = term.toUpperCase().match(/^(?:TB-?)?(\d{4,})$/);
    if (num) {
      const o = orders.find((x) => x.number === `TB-${num[1]}`);
      if (o) return router.push(`/track/${o.number}`);
      return setError(`We couldn't find order TB-${num[1]}. Check the number on your WhatsApp receipt.`);
    }
    const d = digits(term);
    if (d.length >= 10) {
      const ids = new Set(customers.filter((c) => digits(c.phone) === d).map((c) => c.id));
      const found = orders.filter((o) => ids.has(o.customerId)).sort((a, b) => (a.dueAt < b.dueAt ? 1 : -1));
      if (found.length) return (setError(""), setMatches(found));
      return setError("No orders on that number yet. Try the number you used on WhatsApp.");
    }
    setError("Enter an order number like TB-1042 or your WhatsApp number.");
  };

  return (
    <>
      <PageIntro eyebrow="Track your order" title={<>Where is <span className="italic text-brand">my cake?</span></>} sub="Use the order number from your WhatsApp receipt, or the phone number you ordered with." />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <form onSubmit={search} className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-start">
          <Field label="Order number or phone" error={error || undefined} className="flex-1">
            {(id) => <Input id={id} value={q} onChange={(e) => (setQ(e.target.value), setError(""))} placeholder="TB-1042 or 0803 123 4567" className="h-12" />}
          </Field>
          <Button type="submit" size="lg" className="sm:mt-[1.6rem]">
            <MagnifyingGlass size={16} aria-hidden /> Find order
          </Button>
        </form>

        {samples.length > 0 && !matches && (
          <div className="mt-6 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
            <span>Demo orders:</span>
            {samples.map((o) => (
              <Link key={o.id} href={`/track/${o.number}`} className="rounded-full border border-line-strong px-3 py-1 font-medium text-ink-2 hover:border-brand hover:text-brand">
                {o.number} · {STATUS_LABEL[o.status].toLowerCase()}
              </Link>
            ))}
          </div>
        )}

        {matches && (
          <ul className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
            {matches.map((o, i) => (
              <Reveal key={o.id} delay={i * 0.04}>
                <Link href={`/track/${o.number}`} className="group flex items-center gap-4 rounded-[1.6rem] border border-line bg-surface p-5 hover:border-line-strong">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                    <Package size={20} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{o.number}</span>
                      <span className={cx("rounded-full px-2 py-0.5 text-[11.5px] font-medium", o.status === "delivered" ? "bg-surface-2 text-ink-2" : o.status === "cancelled" ? "bg-bad-soft text-bad" : "bg-brand-soft text-brand")}>{STATUS_LABEL[o.status]}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-ink-3 first-letter:uppercase">
                      {orderLabel(o)} · {naira(o.totalNGN)} · {new Date(o.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  <ArrowRight size={16} className="text-ink-3 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
