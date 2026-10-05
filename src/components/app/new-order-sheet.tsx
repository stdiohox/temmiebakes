"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cake, Plus, Trash } from "@phosphor-icons/react";
import { createOrder, naira, upsertCustomer } from "@/lib/engine";
import { describeCake, DEFAULT_CAKE, FINISH_LABEL, FLAVOURS, pointsBooked, quoteCake, SIZES } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { CakeConfig, Finish, Occasion, OrderItem } from "@/lib/types";
import { Button, Field, Input, Segmented, Select, Sheet } from "../ui";
import { dayLabel, isSunday } from "./order-ops";

// Log a walk-in or phone order straight into the system (same engine path as Tia's orders).

const OCCASIONS: { value: Occasion; label: string }[] = [
  { value: "birthday", label: "Birthday" },
  { value: "anniversary", label: "Anniversary" },
  { value: "wedding", label: "Wedding" },
  { value: "baby-shower", label: "Baby shower" },
  { value: "graduation", label: "Graduation" },
  { value: "corporate", label: "Corporate" },
  { value: "valentine", label: "Valentine" },
  { value: "just-because", label: "Just because" },
];

type Line = OrderItem & { points: number };

export function NewOrderSheet({ defaultDate, onClose }: { defaultDate: string | null; onClose: () => void }) {
  return (
    <Sheet open={defaultDate !== null} onClose={onClose} title="New walk-in or phone order" width={560}>
      {defaultDate && <NewOrderForm key={defaultDate} defaultDate={defaultDate} onDone={onClose} />}
    </Sheet>
  );
}

function NewOrderForm({ defaultDate, onDone }: { defaultDate: string; onDone: () => void }) {
  const router = useRouter();
  const customers = useDemo((s) => s.customers);
  const products = useDemo((s) => s.products);
  const zones = useDemo((s) => s.zones);
  const orders = useDemo((s) => s.orders);
  const cap = useDemo((s) => s.dailyCapacity);
  const run = useDemo((s) => s.run);

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [custQuery, setCustQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"walk-in" | "phone">("walk-in");
  const [status, setStatus] = useState<"confirmed" | "quoted">("confirmed");
  const [occasion, setOccasion] = useState<Occasion>("birthday");

  const sellable = products.filter((p) => p.available && p.category !== "corporate");
  const [productId, setProductId] = useState(sellable[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [lines, setLines] = useState<Line[]>([]);

  const [cake, setCake] = useState<CakeConfig>({ ...DEFAULT_CAKE, decoration: "simple" });
  const cakeQuote = quoteCake(cake);

  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("14:00");
  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">("pickup");
  const [zoneId, setZoneId] = useState("ikeja");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const q = custQuery.trim().toLowerCase();
  const matches = q ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "~")).slice(0, 6) : [];
  const picked = customers.find((c) => c.id === customerId);

  const subtotal = lines.reduce((t, l) => t + l.qty * l.unitPriceNGN, 0);
  const zone = zones.find((z) => z.id === zoneId);
  const fee = fulfilment === "delivery" ? zone?.feeNGN ?? 0 : 0;
  const points = Math.round(lines.reduce((t, l) => t + l.points, 0) * 2) / 2;
  const booked = date ? pointsBooked(orders, date) : 0;
  const over = booked + points > cap;

  const addProduct = () => {
    const p = products.find((x) => x.id === productId);
    if (!p || qty < 1) return;
    setLines((ls) => [...ls, { productId: p.id, name: p.name, qty, unitPriceNGN: p.priceNGN, points: p.ovenPoints * qty }]);
    setQty(1);
  };
  const addCake = () => {
    setLines((ls) => [...ls, { name: "Custom celebration cake", qty: 1, unitPriceNGN: cakeQuote.totalNGN, custom: { ...cake }, points: cakeQuote.ovenPoints }]);
  };

  const submit = () => {
    if (mode === "existing" && !picked) return setError("Pick a customer or switch to new customer.");
    if (mode === "new" && (!name.trim() || phone.replace(/\D/g, "").length < 10)) return setError("Add the customer's name and a valid phone number.");
    if (!lines.length) return setError("Add at least one item or a custom cake.");
    if (!date) return setError("Choose a date.");
    if (isSunday(date)) return setError("The studio is closed on Sundays. Pick another day.");
    if (fulfilment === "delivery" && !address.trim()) return setError("Add a delivery address.");
    setError("");
    const order = run((s) => {
      const cid = mode === "existing" ? picked!.id : upsertCustomer(s, { name: name.trim(), phone: phone.trim(), zoneId, source: channel }).customer.id;
      return createOrder(s, {
        customerId: cid,
        channel,
        items: lines.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, unitPriceNGN: l.unitPriceNGN, custom: l.custom })),
        fulfilment,
        zoneId: fulfilment === "delivery" ? zoneId : undefined,
        address: fulfilment === "delivery" ? address.trim() : undefined,
        dueAt: new Date(`${date}T${time || "12:00"}:00+01:00`).toISOString(),
        occasion,
        ovenPoints: Math.max(0.5, points),
        status,
        by: "Ifeoma",
      });
    });
    toast(`${order.number} logged`, status === "confirmed" ? "Booked into the kitchen. Payment link sent on WhatsApp." : "Quote sent on WhatsApp with a follow-up in 6 hours.");
    onDone();
    router.push(`/admin/orders/${order.id}`);
  };

  return (
    <div className="grid gap-6 px-5 py-5">
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Customer</h3>
          <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "existing", label: "Existing" }, { value: "new", label: "New customer" }]} />
        </div>
        {mode === "existing" ? (
          picked ? (
            <div className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-surface-2 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{picked.name}</span>
                <span className="block truncate text-xs text-ink-3">{picked.phone}</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => setCustomerId("")}>Change</Button>
            </div>
          ) : (
            <Field label="Search by name or phone">
              {(id) => (
                <div className="relative">
                  <Input id={id} value={custQuery} onChange={(e) => setCustQuery(e.target.value)} placeholder="e.g. Adaeze or 0803" autoComplete="off" />
                  {matches.length > 0 && (
                    <ul className="mt-1 grid gap-0.5 rounded-[10px] border border-line bg-surface p-1">
                      {matches.map((c) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => ((setCustomerId(c.id), setCustQuery(""), setZoneId(c.zoneId)))} className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-surface-2">
                            <span className="truncate text-ink">{c.name}</span>
                            <span className="shrink-0 text-xs text-ink-3">{c.phone}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {q && !matches.length && <p className="mt-1 text-xs text-ink-3">No match. Switch to New customer to add them.</p>}
                </div>
              )}
            </Field>
          )
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Chiamaka Obi" />}</Field>
            <Field label="Phone (WhatsApp)">{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 123 4567" inputMode="tel" />}</Field>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Channel">
            {(id) => (
              <Select id={id} value={channel} onChange={(e) => setChannel(e.target.value as "walk-in" | "phone")}>
                <option value="walk-in">Walk-in</option>
                <option value="phone">Phone call</option>
              </Select>
            )}
          </Field>
          <Field label="Occasion">
            {(id) => (
              <Select id={id} value={occasion} onChange={(e) => setOccasion(e.target.value as Occasion)}>
                {OCCASIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as "confirmed" | "quoted")}>
                <option value="confirmed">Confirmed</option>
                <option value="quoted">Quote only</option>
              </Select>
            )}
          </Field>
        </div>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-ink">From the catalogue</h3>
        <div className="grid grid-cols-[1fr_72px_auto] items-end gap-2">
          <Field label="Product">
            {(id) => (
              <Select id={id} value={productId} onChange={(e) => setProductId(e.target.value)}>
                {sellable.map((p) => <option key={p.id} value={p.id}>{p.name} · {naira(p.priceNGN)}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Qty">{(id) => <Input id={id} type="number" min={1} max={50} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />}</Field>
          <Button variant="secondary" onClick={addProduct} aria-label="Add product to order"><Plus size={16} /> Add</Button>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-line bg-surface-2/50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Cake size={17} className="text-brand" /> Quick custom cake</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Size">
            {(id) => (
              <Select id={id} value={cake.sizeInches} onChange={(e) => setCake({ ...cake, sizeInches: Number(e.target.value) as CakeConfig["sizeInches"] })}>
                {SIZES.map((z) => <option key={z} value={z}>{z} inch</option>)}
              </Select>
            )}
          </Field>
          <Field label="Tiers">
            {(id) => (
              <Select id={id} value={cake.tiers} onChange={(e) => setCake({ ...cake, tiers: Number(e.target.value) as CakeConfig["tiers"] })}>
                {[1, 2, 3].map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Flavour" className="col-span-2">
            {(id) => (
              <Select id={id} value={cake.flavour} onChange={(e) => setCake({ ...cake, flavour: e.target.value })}>
                {FLAVOURS.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Finish" className="col-span-2">
            {(id) => (
              <Select id={id} value={cake.finish} onChange={(e) => setCake({ ...cake, finish: e.target.value as Finish })}>
                {(Object.keys(FINISH_LABEL) as Finish[]).map((f) => <option key={f} value={f}>{FINISH_LABEL[f]}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Decoration" className="col-span-2">
            {(id) => (
              <Select id={id} value={cake.decoration} onChange={(e) => setCake({ ...cake, decoration: e.target.value as CakeConfig["decoration"] })}>
                <option value="simple">Simple</option>
                <option value="themed">Themed</option>
                <option value="premium">Premium</option>
              </Select>
            )}
          </Field>
          <Field label="Colours" className="col-span-2">{(id) => <Input id={id} value={cake.colours} onChange={(e) => setCake({ ...cake, colours: e.target.value })} />}</Field>
          <Field label="Message on cake" className="col-span-2">{(id) => <Input id={id} value={cake.message} onChange={(e) => setCake({ ...cake, message: e.target.value })} />}</Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <span className="text-ink-2">
            <span className="tnum font-semibold text-ink">{naira(cakeQuote.totalNGN)}</span> · serves {cakeQuote.servings} · {cakeQuote.ovenPoints} oven pts · {cakeQuote.leadDays} days notice
          </span>
          <Button size="sm" variant="outline" onClick={addCake}><Plus size={14} /> Add cake</Button>
        </div>
      </section>

      {lines.length > 0 && (
        <section className="grid gap-2">
          <h3 className="text-sm font-semibold text-ink">Order items</h3>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {lines.map((l, i) => (
              <li key={i} className="flex items-start justify-between gap-3 px-3 py-2.5 text-[13px]">
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{l.qty} × {l.name}</span>
                  {l.custom && <span className="block text-xs text-ink-3">{describeCake(l.custom)}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tnum text-ink">{naira(l.qty * l.unitPriceNGN)}</span>
                  <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="rounded-full p-1 text-ink-3 hover:bg-surface-2 hover:text-bad" aria-label={`Remove ${l.name}`}>
                    <Trash size={15} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-ink">When and where</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" hint={date ? (isSunday(date) ? "Sunday: studio closed" : `${dayLabel(date)} · ${booked}/${cap} pts booked`) : undefined}>
            {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Time">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
        </div>
        <Segmented value={fulfilment} onChange={setFulfilment} options={[{ value: "pickup", label: "Pickup in Ikeja" }, { value: "delivery", label: "Delivery" }]} />
        {fulfilment === "delivery" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Zone">
              {(id) => (
                <Select id={id} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                  {zones.map((z) => <option key={z.id} value={z.id}>{z.name} · {naira(z.feeNGN)}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Address">{(id) => <Input id={id} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 Opebi Road" />}</Field>
          </div>
        )}
      </section>

      <section className="grid gap-1.5 rounded-2xl bg-surface-2 p-4 text-[13px]">
        <p className="flex justify-between"><span className="text-ink-2">Items</span><span className="tnum text-ink">{naira(subtotal)}</span></p>
        <p className="flex justify-between"><span className="text-ink-2">Delivery</span><span className="tnum text-ink">{naira(fee)}</span></p>
        <p className="flex justify-between text-sm font-semibold"><span className="text-ink">Total</span><span className="tnum text-ink">{naira(subtotal + fee)}</span></p>
        <p className={over ? "text-warn" : "text-ink-3"}>
          Uses {points} oven points. {over ? `That day would be over capacity (${booked + points}/${cap}).` : `${Math.max(0, cap - booked - points)} points left that day after this order.`}
        </p>
      </section>

      {error && <p role="alert" className="text-[13px] text-bad">{error}</p>}
      <div className="flex justify-end gap-2 pb-2">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button onClick={submit}>{status === "confirmed" ? "Create order" : "Send quote"}</Button>
      </div>
    </div>
  );
}
