"use client";

import Link from "next/link";
import { ChatCircleText, Heart, Star, Warning } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { PageHead } from "@/components/app/app-shell";
import { CustomerChip, Kpi } from "@/components/app/bits";
import { Bubble, firstName, Stars } from "@/components/app/growth";
import { Badge, Button, Card, CardHead, Empty, Field, Modal, Segmented, Textarea, cx } from "@/components/ui";
import { logEvent, orderLabel, send } from "@/lib/engine";
import { dateOnly, pct } from "@/lib/format";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Order } from "@/lib/types";

type Filter = "all" | "5" | "4" | "3" | "low";

export default function ReviewsPage() {
  const run = useDemo((s) => s.run);
  const orders = useDemo((s) => s.orders);
  const customers = useDemo((s) => s.customers);
  const [filter, setFilter] = useState<Filter>("all");
  const [replyTo, setReplyTo] = useState<Order | null>(null);
  const [reply, setReply] = useState("");
  const [handled, setHandled] = useState<Record<string, "replied" | "made-right">>({});

  const reviewed = useMemo(() => orders.filter((o) => o.rating).sort((a, b) => (a.dueAt < b.dueAt ? 1 : -1)), [orders]);
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const avg = reviewed.length ? reviewed.reduce((t, o) => t + o.rating!, 0) / reviewed.length : 0;
  const dist = [5, 4, 3, 2, 1].map((r) => ({ r, n: reviewed.filter((o) => o.rating === r).length }));
  const maxN = Math.max(1, ...dist.map((d) => d.n));
  const low = reviewed.filter((o) => o.rating! <= 3).length;
  const shown = reviewed.filter((o) => (filter === "all" ? true : filter === "low" ? o.rating! <= 3 : o.rating === Number(filter)));
  const cust = (id: string) => customers.find((c) => c.id === id);

  const openReply = (o: Order) => {
    const c = cust(o.customerId);
    setReply(`Thank you so much, ${c ? firstName(c.name) : "dear"}! We're so glad the ${orderLabel(o)} made your day. It means a lot to our little Ikeja kitchen 🤍 See you at the next celebration!`);
    setReplyTo(o);
  };
  const sendReply = () => {
    const o = replyTo;
    if (!o || !reply.trim()) return;
    const c = cust(o.customerId);
    run((s) => {
      send(s, o.customerId, "whatsapp", reply.trim(), "review-request", { orderId: o.id });
      logEvent(s, { automation: "review-request", kind: "action", title: `Thank-you sent for ${o.number}'s review`, detail: c?.name, customerId: o.customerId, orderId: o.id, minutesSaved: 3 });
    });
    setHandled((h) => ({ ...h, [o.id]: "replied" }));
    setReplyTo(null);
    toast("Thank-you sent on WhatsApp", c?.name);
  };
  const makeItRight = (o: Order) => {
    const c = cust(o.customerId);
    const code = `SORRY${o.number.slice(3)}`;
    run((s) => {
      send(s, o.customerId, "whatsapp", `Hi ${c ? firstName(c.name) : "there"}, Temmie here. I'm truly sorry your ${orderLabel(o)} wasn't perfect. That's not our standard. Please use code ${code} for 20% off your next order, and I'll personally check it before it leaves the kitchen.`, "review-request", { orderId: o.id });
      logEvent(s, { automation: "review-request", kind: "action", title: `Apology and 20% voucher sent for ${o.number}`, detail: `${c?.name ?? "Customer"} · code ${code}`, customerId: o.customerId, orderId: o.id, minutesSaved: 8 });
    });
    setHandled((h) => ({ ...h, [o.id]: "made-right" }));
    toast("Apology and voucher sent", `${c?.name ?? "Customer"} · code ${code}`);
  };

  return (
    <div>
      <PageHead title="Reviews" sub="Ratings collected automatically on WhatsApp a day after delivery. Thank happy customers and fix the rest quickly." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Average rating" value={<span className="inline-flex items-center gap-1.5">{avg.toFixed(2)} <Star size={20} weight="fill" className="text-accent" /></span>} sub={`from ${reviewed.length} reviews`} />
        <Kpi label="Reviews" value={reviewed.length} sub={`${dist[0].n} five-star`} />
        <Kpi label="Delivered orders reviewed" value={pct(delivered ? reviewed.length / delivered : 0, 0)} sub={`${delivered} delivered`} />
        <Kpi label="Need attention" value={low} sub="3 stars or fewer" tone={low ? "down" : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit pb-5">
          <CardHead title="Rating distribution" />
          <div className="mt-4 grid gap-2.5 px-5" role="img" aria-label={dist.map((d) => `${d.r} stars: ${d.n}`).join(", ")}>
            {dist.map((d) => (
              <button key={d.r} onClick={() => setFilter(d.r >= 3 ? (String(d.r) as Filter) : "low")} className="grid grid-cols-[28px_1fr_32px] items-center gap-2 text-[13px]" aria-label={`Show ${d.r} star reviews`}>
                <span className="inline-flex items-center gap-0.5 text-ink-2">{d.r}<Star size={11} weight="fill" className="text-accent" /></span>
                <span className="h-3">
                  <span className="block h-3 rounded-e-[4px]" style={{ width: `${d.n ? Math.max(3, (d.n / maxN) * 100) : 0}%`, background: d.r <= 3 ? "var(--viz-2)" : "var(--viz-1)" }} />
                </span>
                <span className="tnum text-end font-semibold text-ink">{d.n}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-semibold text-ink">All reviews</h2>
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "5", label: "5★" },
                { value: "4", label: "4★" },
                { value: "3", label: "3★" },
                { value: "low", label: "3★ or less" },
              ]}
            />
          </div>
          {shown.length === 0 ? (
            <Empty icon={<ChatCircleText size={28} />} title="No reviews here" sub="Try another rating filter." />
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((o) => {
                const c = cust(o.customerId);
                const isLow = o.rating! <= 3;
                const done = handled[o.id];
                return (
                  <li key={o.id} className={cx("px-4 py-4 sm:px-5", isLow && "border-s-[3px] border-s-bad bg-bad-soft/40")}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">{c && <CustomerChip c={c} />}</div>
                      <span className="flex items-center gap-2 text-xs text-ink-3">
                        <Stars rating={o.rating!} />
                        {dateOnly(o.dueAt)}
                      </span>
                    </div>
                    {o.review && <p className="mt-2 text-[14px] leading-relaxed text-ink">&ldquo;{o.review}&rdquo;</p>}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/admin/orders/${o.id}`} className="text-xs text-ink-3 hover:text-ink hover:underline">
                        {o.number} · {orderLabel(o)}
                      </Link>
                      <span className="flex flex-wrap items-center gap-2">
                        {isLow && <Badge tone="bad"><Warning size={12} /> Low rating</Badge>}
                        {done && <Badge tone="ok">{done === "replied" ? "Thank-you sent" : "Voucher sent"}</Badge>}
                        {isLow && (
                          <Button size="sm" variant="danger" onClick={() => makeItRight(o)} disabled={done === "made-right"}>
                            <Heart size={14} /> Make it right
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => openReply(o)}>
                          <ChatCircleText size={14} /> Reply
                        </Button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={Boolean(replyTo)}
        onClose={() => setReplyTo(null)}
        title={`Reply to ${replyTo ? cust(replyTo.customerId)?.name ?? "customer" : ""}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReplyTo(null)}>Cancel</Button>
            <Button onClick={sendReply} disabled={!reply.trim()}>Send on WhatsApp</Button>
          </>
        }
      >
        {replyTo && (
          <div className="grid gap-4">
            <div className="rounded-xl bg-surface-2 p-3">
              <Stars rating={replyTo.rating!} />
              {replyTo.review && <p className="mt-1.5 text-[13px] text-ink-2">&ldquo;{replyTo.review}&rdquo;</p>}
            </div>
            <Field label="Your reply">{(fid) => <Textarea id={fid} value={reply} onChange={(e) => setReply(e.target.value)} data-autofocus />}</Field>
            <div>
              <p className="mb-2 text-xs text-ink-3">Preview</p>
              <Bubble>{reply || "Your reply will appear here."}</Bubble>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
