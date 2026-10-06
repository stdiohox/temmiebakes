"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Cake, Check, Lightning, Printer, Sparkle, Star, X } from "@phosphor-icons/react";
import { CHANNEL, ChannelIcon, CustomerChip, Money, ORDER_STATUS, OUT_CHANNEL, OUT_STATUS, PaymentBadge, StatusBadge } from "@/components/app/bits";
import { PageHead } from "@/components/app/app-shell";
import { advance, assignRider, flowFor, lagosDateTime, lagosTime, nextLabel, nextStatus } from "@/components/app/order-ops";
import { Badge, Button, Card, CardHead, cx, Empty, Field, Modal, Select, Thumb } from "@/components/ui";
import { naira, pay } from "@/lib/engine";
import { ago } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { describeCake, FINISH_LABEL, quoteCake } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Order } from "@/lib/types";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const order = useDemo((s) => s.orders.find((o) => o.id === id));
  const customers = useDemo((s) => s.customers);
  const orders = useDemo((s) => s.orders);
  const staff = useDemo((s) => s.staff);
  const zones = useDemo((s) => s.zones);
  const outbound = useDemo((s) => s.outbound);
  const events = useDemo((s) => s.events);
  const run = useDemo((s) => s.run);
  const now = useNow();
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!order) {
    return (
      <Card>
        <Empty title="Order not found" sub="It may have been removed when the demo was reset." action={<Link href="/admin/orders" className="text-sm font-medium text-brand hover:underline">Back to orders</Link>} />
      </Card>
    );
  }

  const o = order;
  const c = customers.find((x) => x.id === o.customerId);
  const zone = zones.find((z) => z.id === (o.zoneId ?? c?.zoneId));
  const riders = staff.filter((s) => s.kind === "rider");
  const pastOrders = orders.filter((x) => x.customerId === o.customerId && x.id !== o.id && x.status !== "cancelled").length;
  const msgs = outbound.filter((m) => m.orderId === o.id).sort((a, b) => (a.scheduledFor < b.scheduledFor ? 1 : -1));
  const evs = events.filter((e) => e.orderId === o.id);
  const balance = o.totalNGN - o.paidNGN;
  const ns = nextStatus(o);
  const nl = nextLabel(o);
  const closed = o.status === "cancelled" || o.status === "delivered";

  const record = (kind: "deposit" | "balance") => {
    run((s) => pay(s, o.id, kind));
    toast(kind === "deposit" ? `Deposit of ${naira(o.depositNGN)} recorded` : `Balance of ${naira(balance)} recorded`, "Receipt sent to the customer on WhatsApp.");
  };

  return (
    <div>
      <Link href="/admin/orders" className="no-print mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft size={14} /> All orders
      </Link>
      <div className="no-print">
        <PageHead
          title={o.number}
          sub={
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge status={o.status} />
              <PaymentBadge status={o.paymentStatus} />
              <span className="inline-flex items-center gap-1 text-ink-2"><ChannelIcon channel={o.channel} size={14} /> {CHANNEL[o.channel].label}</span>
              {o.assistedByAI && <Badge tone="accent"><Sparkle size={11} weight="fill" /> Taken by Tia</Badge>}
              <span>Due {lagosDateTime(o.dueAt)}</span>
            </span>
          }
          actions={
            <>
              {!closed && <Button variant="danger" onClick={() => setConfirmCancel(true)}><X size={15} /> Cancel order</Button>}
              {ns && nl && <Button onClick={() => advance(o.id, ns, "Koret")}>{nl} <ArrowRight size={15} /></Button>}
            </>
          }
        />
      </div>

      <div className="no-print grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 content-start gap-4">
          <Card>
            <CardHead title="Items" sub={`${o.ovenPoints} oven points · ${o.occasion.replace(/-/g, " ")}`} />
            <ul className="divide-y divide-line px-5 pb-2 pt-2">
              {o.items.map((it, i) => (
                <li key={i} className="flex items-start justify-between gap-4 py-3">
                  <div className="flex min-w-0 gap-3">
                    {it.custom?.referencePhoto?.startsWith("/img/") ? <Thumb src={it.custom.referencePhoto} className="h-14 w-14 rounded-xl" sizes="56px" /> : it.custom ? <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Cake size={24} /></span> : null}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{it.qty} × {it.custom ? "Custom celebration cake" : it.name}</p>
                      {it.custom && (
                        <>
                          <p className="mt-0.5 text-[13px] text-ink-2">{describeCake(it.custom)}</p>
                          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                            <dt className="text-ink-3">Colours</dt><dd className="text-ink">{it.custom.colours || "Not specified"}</dd>
                            <dt className="text-ink-3">Message</dt><dd className="text-ink">{it.custom.message ? `"${it.custom.message}"` : "No message"}</dd>
                            <dt className="text-ink-3">Serves</dt><dd className="text-ink">{quoteCake(it.custom).servings} guests</dd>
                            {it.custom.referencePhoto && (<><dt className="text-ink-3">Reference</dt><dd className="text-ink">Photo attached</dd></>)}
                          </dl>
                        </>
                      )}
                      {it.notes && <p className="mt-1 text-xs text-ink-3">Note: {it.notes}</p>}
                    </div>
                  </div>
                  <Money ngn={it.qty * it.unitPriceNGN} className="shrink-0 text-sm text-ink" />
                </li>
              ))}
            </ul>
            <div className="grid gap-1.5 border-t border-line px-5 py-4 text-[13px]">
              <Row label="Subtotal" v={o.subtotalNGN} />
              {o.deliveryFeeNGN > 0 && <Row label={`Delivery${zone ? ` (${zone.name})` : ""}`} v={o.deliveryFeeNGN} />}
              {o.discountNGN > 0 && <Row label="Discount" v={-o.discountNGN} />}
              <Row label="Total" v={o.totalNGN} strong />
              <Row label="Deposit required" v={o.depositNGN} />
              <Row label="Paid so far" v={o.paidNGN} />
              <Row label="Balance" v={balance} strong tone={balance > 0 ? "text-warn" : "text-ok"} />
              {o.status !== "cancelled" && balance > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {o.paidNGN === 0 && <Button size="sm" onClick={() => record("deposit")}>Record deposit ({naira(o.depositNGN)})</Button>}
                  <Button size="sm" variant={o.paidNGN === 0 ? "outline" : "primary"} onClick={() => record("balance")}>
                    {o.paidNGN === 0 ? `Record full payment (${naira(balance)})` : `Record balance (${naira(balance)})`}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Progress" sub="Every step is timestamped with who moved it" />
            {o.status === "cancelled" && <p className="mx-5 mt-3 rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad">This order was cancelled and its oven points released.</p>}
            <ol className="px-5 py-4">
              {flowFor(o).map((st, i, arr) => {
                const h = [...o.history].reverse().find((x) => x.status === st);
                const idx = arr.indexOf(o.status);
                const done = o.status === "cancelled" ? Boolean(h) : i <= idx;
                const current = st === o.status;
                return (
                  <li key={st} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < arr.length - 1 && <span aria-hidden className={cx("absolute start-[11px] top-6 h-[calc(100%-20px)] w-px", done && i < idx ? "bg-brand" : "bg-line")} />}
                    <span className={cx("relative grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px]", current ? "border-brand bg-brand text-brand-ink" : done ? "border-brand bg-brand-soft text-brand" : "border-line-strong bg-surface text-ink-3")}>
                      {done && !current ? <Check size={12} weight="bold" /> : i + 1}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className={cx("text-[13.5px]", current ? "font-semibold text-ink" : done ? "text-ink" : "text-ink-3")}>{st === "delivered" && o.fulfilment === "pickup" ? "Collected" : ORDER_STATUS[st].label}</p>
                      {h && <p className="text-xs text-ink-3">{lagosDateTime(h.at)} · {h.by}</p>}
                    </div>
                  </li>
                );
              })}
              {o.status === "cancelled" && (
                <li className="flex gap-3 pt-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-bad-soft text-bad"><X size={12} weight="bold" /></span>
                  <p className="pt-0.5 text-[13.5px] text-bad">Cancelled{o.history.find((h) => h.status === "cancelled") && ` · ${lagosDateTime(o.history.find((h) => h.status === "cancelled")!.at)} · ${o.history.find((h) => h.status === "cancelled")!.by}`}</p>
                </li>
              )}
            </ol>
          </Card>

          <Card>
            <CardHead title="Messages sent for this order" sub="Quotes, receipts and status updates, all automatic" />
            {msgs.length ? (
              <ul className="divide-y divide-line px-5 pb-3 pt-2">
                {msgs.map((m) => {
                  const Icon = OUT_CHANNEL[m.channel].icon;
                  return (
                    <li key={m.id} className="flex gap-3 py-3">
                      <Icon size={18} weight="fill" className={cx("mt-0.5 shrink-0", m.channel === "whatsapp" ? "text-wa" : "text-ink-2")} aria-label={OUT_CHANNEL[m.channel].label} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-relaxed text-ink">{m.body}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                          <Badge tone={OUT_STATUS[m.status]}>{m.status}</Badge>
                          {m.status === "scheduled" ? `Scheduled ${lagosDateTime(m.scheduledFor)}` : ago(m.sentAt ?? m.scheduledFor, now)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty title="No messages yet" sub="Messages appear here as the order moves along." />
            )}
          </Card>

          <Card>
            <CardHead title="Automation timeline" sub="What the system did for this order" />
            {evs.length ? (
              <ul className="px-5 pb-4 pt-2">
                {evs.map((e) => (
                  <li key={e.id} className="flex gap-3 py-2">
                    <span className={cx("mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full", e.kind === "alert" ? "bg-warn-soft text-warn" : e.kind === "ai" ? "bg-accent-soft text-accent" : "bg-brand-soft text-brand")}>
                      <Lightning size={12} weight="fill" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] text-ink">{e.title}</p>
                      <p className="text-xs text-ink-3">{ago(e.at, now)}{e.detail ? ` · ${e.detail}` : ""}{e.minutesSaved ? ` · ${e.minutesSaved} min saved` : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No automation events yet" />
            )}
          </Card>
        </div>

        <div className="grid content-start gap-4">
          {c && (
            <Card className="p-5">
              <h3 className="mb-3 text-[15px] font-semibold text-ink">Customer</h3>
              <CustomerChip c={c} />
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                <dt className="text-ink-3">Phone</dt><dd className="text-ink"><a href={`tel:${c.phone}`} className="hover:underline">{c.phone || "Not given"}</a></dd>
                <dt className="text-ink-3">Zone</dt><dd className="text-ink">{zones.find((z) => z.id === c.zoneId)?.name ?? "Unknown"}</dd>
                {c.instagram && (<><dt className="text-ink-3">Instagram</dt><dd className="truncate text-ink">{c.instagram}</dd></>)}
                <dt className="text-ink-3">Past orders</dt><dd className="text-ink">{pastOrders}</dd>
              </dl>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="mb-3 text-[15px] font-semibold text-ink">{o.fulfilment === "delivery" ? "Delivery" : "Pickup"}</h3>
            {o.fulfilment === "delivery" ? (
              <div className="grid gap-3 text-[13px]">
                <p className="text-ink">{o.address ?? "Address to be confirmed"}</p>
                {zone && <p className="text-ink-3">{zone.name} · {naira(zone.feeNGN)} · about {zone.etaMins} min from Ikeja</p>}
                <Field label="Rider">
                  {(fid) => (
                    <Select
                      id={fid}
                      value={o.riderId ?? ""}
                      disabled={closed}
                      onChange={(e) => e.target.value && assignRider(o.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {riders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                  )}
                </Field>
              </div>
            ) : (
              <p className="text-[13px] text-ink-2">Collecting from the Ikeja studio at {lagosTime(o.dueAt)}.</p>
            )}
          </Card>

          {(o.rating || o.reviewRequested) && (
            <Card className="p-5">
              <h3 className="mb-2 text-[15px] font-semibold text-ink">Review</h3>
              {o.rating ? (
                <>
                  <p className="flex gap-0.5 text-accent-bright" aria-label={`${o.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, i) => <Star key={i} size={16} weight={i < o.rating! ? "fill" : "regular"} />)}
                  </p>
                  {o.review && <p className="mt-2 text-[13px] leading-relaxed text-ink">&ldquo;{o.review}&rdquo;</p>}
                </>
              ) : (
                <p className="text-[13px] text-ink-3">Review requested on WhatsApp. Waiting for a reply.</p>
              )}
            </Card>
          )}

          <Card className="p-5">
            <h3 className="mb-1 text-[15px] font-semibold text-ink">Production ticket</h3>
            <p className="mb-3 text-[13px] text-ink-3">A clean sheet for the decorator&rsquo;s station.</p>
            <Button variant="outline" className="w-full" onClick={() => window.print()}><Printer size={16} /> Print ticket</Button>
          </Card>
        </div>
      </div>

      <ProductionTicket o={o} customerName={c?.name ?? ""} zoneName={zone?.name} />

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={`Cancel ${o.number}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Keep order</Button>
            <Button variant="danger" onClick={() => ((advance(o.id, "cancelled", "Koret"), setConfirmCancel(false)))}>Cancel order</Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-2">
          This releases {o.ovenPoints} oven points on {lagosDateTime(o.dueAt)} so Tia can offer the slot to someone else.
          {o.paidNGN > 0 && ` ${naira(o.paidNGN)} has been paid; handle the refund or date change with the customer.`}
        </p>
      </Modal>
    </div>
  );
}

function Row({ label, v, strong, tone }: { label: string; v: number; strong?: boolean; tone?: string }) {
  return (
    <p className={cx("flex justify-between gap-4", strong && "font-semibold")}>
      <span className={strong ? "text-ink" : "text-ink-2"}>{label}</span>
      <Money ngn={v} className={tone ?? "text-ink"} />
    </p>
  );
}

/** Hidden on screen; the only thing that prints. */
function ProductionTicket({ o, customerName, zoneName }: { o: Order; customerName: string; zoneName?: string }) {
  return (
    <section className="print-page hidden print:block" aria-label="Production ticket">
      <div className="border-b-2 border-ink pb-3">
        <p className="text-xs uppercase tracking-wider">Koretbakes production ticket</p>
        <h1 className="font-display text-3xl font-semibold">{o.number}</h1>
        <p className="text-sm">
          {customerName} · Due {lagosDateTime(o.dueAt)} · {o.fulfilment === "pickup" ? "Pickup at Ikeja studio" : `Delivery to ${zoneName ?? "Lagos"}`}
        </p>
      </div>
      {o.items.map((it, i) => (
        <div key={i} className="border-b border-line py-4">
          <p className="text-lg font-semibold">{it.qty} × {it.custom ? "Custom celebration cake" : it.name}</p>
          {it.custom && (
            <table className="mt-2 w-full text-sm">
              <tbody>
                {[
                  ["Shape", it.custom.shape],
                  ["Size", `${quoteCake(it.custom).tierSizes.map((z) => `${z}"`).join(" + ")}${it.custom.tiers > 1 ? ` (${it.custom.tiers} tiers)` : ""}`],
                  ["Sponge", it.custom.flavour],
                  ["Filling", it.custom.filling],
                  ["Finish", FINISH_LABEL[it.custom.finish]],
                  ["Decoration", it.custom.decoration],
                  ["Colours", it.custom.colours || "Not specified"],
                  ["Message", it.custom.message ? `"${it.custom.message}"` : "None"],
                  ["Reference photo", it.custom.referencePhoto ? "Attached in the order chat" : "None"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="w-40 py-1 align-top font-medium">{k}</td>
                    <td className="py-1">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {it.notes && <p className="mt-2 text-sm">Notes: {it.notes}</p>}
        </div>
      ))}
      <p className="mt-4 text-sm">Oven points: {o.ovenPoints} · Occasion: {o.occasion.replace(/-/g, " ")}</p>
      <p className="mt-8 text-sm">Decorator: ____________________ Checked by: ____________________</p>
    </section>
  );
}
