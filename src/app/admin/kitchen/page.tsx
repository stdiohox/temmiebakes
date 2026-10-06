"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDots, Cake, CheckCircle, Warning } from "@phosphor-icons/react";
import { PageHead } from "@/components/app/app-shell";
import { ORDER_STATUS, StatusBadge } from "@/components/app/bits";
import { advance, CapacityBar, dayLabel, isSunday, keyPlus, lagosTime, nextLabel, nextStatus } from "@/components/app/order-ops";
import { Badge, Button, Card, CardHead, cx, Empty, Field, Input } from "@/components/ui";
import { logEvent } from "@/lib/engine";
import { useNow } from "@/lib/hooks";
import { dayKey, describeCake, FINISH_LABEL, pointsBooked } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Ingredient, Order, OrderStatus, Product, Recipe } from "@/lib/types";

const GROUPS: OrderStatus[] = ["quoted", "confirmed", "baking", "decorating", "ready", "out-for-delivery", "delivered"];

/** Same maths as the engine's consumeStock, summed over orders. */
function ingredientNeeds(orders: Order[], products: Product[], recipes: Recipe[]) {
  const used: Record<string, number> = {};
  orders.forEach((o) =>
    o.items.forEach((it) => {
      const p = it.productId ? products.find((x) => x.id === it.productId) : undefined;
      const recipeId = it.custom ? "r-cake" : p?.recipeId;
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) return;
      const mult = it.custom ? Math.max(1, o.ovenPoints) : it.qty * (recipeId === "r-cake" ? p?.ovenPoints ?? 1 : 1);
      recipe.ingredients.forEach((ri) => (used[ri.ingredientId] = (used[ri.ingredientId] ?? 0) + ri.qty * mult));
    }),
  );
  return used;
}

const fmtQty = (n: number) => (n >= 10 ? Math.round(n).toString() : (+n.toFixed(2)).toString());

export default function KitchenPage() {
  const orders = useDemo((s) => s.orders);
  const products = useDemo((s) => s.products);
  const recipes = useDemo((s) => s.recipes);
  const ingredients = useDemo((s) => s.ingredients);
  const customers = useDemo((s) => s.customers);
  const cap = useDemo((s) => s.dailyCapacity);
  const run = useDemo((s) => s.run);
  const now = useNow();
  const today = dayKey(now);
  const days = Array.from({ length: 14 }, (_, i) => keyPlus(now, i));

  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked && days.includes(picked) ? picked : isSunday(today) ? days[1] : today;
  const [capDraft, setCapDraft] = useState<string | null>(null);

  const dayOrders = (key: string) => orders.filter((o) => o.status !== "cancelled" && o.status !== "enquiry" && dayKey(o.dueAt) === key);
  const selOrders = dayOrders(selected).sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1));

  // Bake sheet
  const byProduct = new Map<string, { name: string; qty: number; done: number }>();
  const customCakes: { o: Order; desc: string; finish: string; colours: string; message: string; size: string }[] = [];
  selOrders.forEach((o) =>
    o.items.forEach((it) => {
      const finished = ["ready", "out-for-delivery", "delivered"].includes(o.status);
      if (it.custom) {
        customCakes.push({ o, desc: describeCake(it.custom), finish: FINISH_LABEL[it.custom.finish], colours: it.custom.colours, message: it.custom.message, size: `${it.custom.tiers > 1 ? `${it.custom.tiers} tiers, ` : ""}${it.custom.sizeInches}"` });
      } else {
        const k = it.productId ?? it.name;
        const row = byProduct.get(k) ?? { name: it.name, qty: 0, done: 0 };
        row.qty += it.qty;
        if (finished) row.done += it.qty;
        byProduct.set(k, row);
      }
    }),
  );
  const toBake = selOrders.filter((o) => o.status === "confirmed" || o.status === "quoted");
  const needs = ingredientNeeds(toBake, products, recipes);
  const needRows = Object.entries(needs)
    .map(([id, qty]) => ({ ing: ingredients.find((i) => i.id === id), qty }))
    .filter((r): r is { ing: Ingredient; qty: number } => Boolean(r.ing))
    .sort((a, b) => b.qty / Math.max(0.01, b.ing.stock) - a.qty / Math.max(0.01, a.ing.stock));
  const shortfalls = needRows.filter((r) => r.qty > r.ing.stock).length;

  const saveCapacity = () => {
    const n = Math.round(Number(capDraft));
    if (!capDraft || !Number.isFinite(n) || n < 1 || n > 200) {
      toast("Capacity not saved", "Enter a number of oven points between 1 and 200.", "warn");
      return;
    }
    run((s) => {
      s.dailyCapacity = n;
      logEvent(s, { automation: "capacity-guard", kind: "action", title: `Daily kitchen capacity set to ${n} oven points`, detail: "Tia uses this when offering dates", minutesSaved: 2 });
    });
    setCapDraft(null);
    toast("Daily capacity updated", `Tia will now offer dates against ${n} oven points per day.`);
  };

  return (
    <div>
      <PageHead
        title="Kitchen calendar"
        icon={<CalendarDots size={26} className="text-brand" />}
        sub="Oven points booked for the next two weeks. Tap a day to see its production list and bake sheet."
      />

      <div className="mb-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {days.map((k) => {
            const closed = isSunday(k);
            const list = dayOrders(k);
            const used = pointsBooked(orders, k);
            const customs = list.reduce((t, o) => t + o.items.filter((i) => i.custom).length, 0);
            const active = k === selected;
            return (
              <button
                key={k}
                type="button"
                disabled={closed}
                aria-pressed={active}
                onClick={() => setPicked(k)}
                className={cx(
                  "rounded-2xl border p-3 text-left transition-colors",
                  closed ? "cursor-not-allowed border-dashed border-line bg-transparent opacity-60" : active ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <p className="flex items-center justify-between gap-1 text-[12px] text-ink-3">
                  <span>{dayLabel(k, { weekday: "short" })}</span>
                  {k === today && <span className="font-semibold text-brand">Today</span>}
                </p>
                <p className="font-display text-lg font-semibold text-ink">{dayLabel(k, { day: "numeric", month: "short" })}</p>
                {closed ? (
                  <p className="mt-2 text-xs text-ink-3">Closed</p>
                ) : (
                  <>
                    <p className="tnum mt-1 text-[12.5px] text-ink">
                      <span className={cx("font-semibold", used / cap > 0.85 && "text-warn")}>{used}</span>
                      <span className="text-ink-3">/{cap} pts</span>
                    </p>
                    <CapacityBar used={used} cap={cap} className="mt-1.5" />
                    <p className="mt-2 text-[11.5px] text-ink-3">{list.length} orders{customs ? ` · ${customs} custom` : ""}</p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-w-0">
          <CardHead
            title={`Production list · ${dayLabel(selected, { weekday: "long", day: "numeric", month: "long" })}`}
            sub={`${selOrders.length} orders · ${pointsBooked(orders, selected)} of ${cap} oven points booked`}
          />
          {selOrders.length === 0 ? (
            <Empty icon={<Cake size={28} />} title="Nothing booked for this day" sub="Tia will offer this date to new customers." />
          ) : (
            <div className="grid gap-5 px-5 py-4">
              {GROUPS.map((st) => {
                const list = selOrders.filter((o) => o.status === st);
                if (!list.length) return null;
                return (
                  <section key={st}>
                    <h4 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink">
                      <StatusBadge status={st} /> <span className="tnum text-ink-3">{list.length}</span>
                    </h4>
                    <ul className="grid gap-2">
                      {list.map((o) => {
                        const ns = nextStatus(o);
                        const nl = nextLabel(o);
                        const c = customers.find((x) => x.id === o.customerId);
                        return (
                          <li key={o.id} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-[13px]">
                                <Link href={`/admin/orders/${o.id}`} className="font-semibold text-ink hover:underline">{o.number}</Link>
                                <span className="text-ink-3"> · {c?.name} · due {lagosTime(o.dueAt)} · {o.fulfilment === "pickup" ? "pickup" : "delivery"} · {o.ovenPoints} pts</span>
                              </p>
                              <ul className="mt-1 grid gap-0.5 text-[12.5px] text-ink-2">
                                {o.items.map((it, i) => (
                                  <li key={i}>{it.qty} × {it.custom ? describeCake(it.custom) : it.name}{it.custom?.message ? `, "${it.custom.message}"` : ""}</li>
                                ))}
                              </ul>
                            </div>
                            {ns && nl && (
                              <Button size="sm" variant={st === "quoted" ? "ghost" : "secondary"} onClick={() => advance(o.id, ns)} aria-label={`${nl} for ${o.number}`}>
                                <CheckCircle size={15} /> {nl}
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHead title={selected === today ? "Today's bake sheet" : `Bake sheet · ${dayLabel(selected)}`} sub="What to produce, summed across every order" />
            <div className="px-5 py-4">
              {byProduct.size === 0 && customCakes.length === 0 ? (
                <p className="text-[13px] text-ink-3">Nothing to bake.</p>
              ) : (
                <>
                  {byProduct.size > 0 && (
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-left text-xs text-ink-3"><th className="pb-1.5 font-medium">Product</th><th className="pb-1.5 text-right font-medium">Qty</th></tr>
                      </thead>
                      <tbody>
                        {[...byProduct.values()].sort((a, b) => b.qty - a.qty).map((r) => (
                          <tr key={r.name} className="border-t border-line">
                            <td className="py-1.5 text-ink">{r.name}</td>
                            <td className="tnum py-1.5 text-right font-semibold text-ink">{r.qty}{r.done ? <span className="ms-1 text-xs font-normal text-ok">({r.done} done)</span> : null}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {customCakes.length > 0 && (
                    <div className={byProduct.size ? "mt-4" : ""}>
                      <p className="mb-1.5 text-xs font-medium text-ink-3">Custom cakes ({customCakes.length})</p>
                      <ul className="grid gap-2">
                        {customCakes.map((cc, i) => (
                          <li key={i} className="rounded-xl bg-surface-2 px-3 py-2 text-[12.5px]">
                            <p className="font-medium text-ink">{cc.o.number} · {cc.size} · {cc.finish}</p>
                            <p className="text-ink-2">{cc.desc}</p>
                            <p className="text-ink-3">{cc.colours}{cc.message ? ` · "${cc.message}"` : ""} · {ORDER_STATUS[cc.o.status].label}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHead
              title="Ingredients needed"
              sub="From recipes for orders not yet in the oven, against current stock"
              action={shortfalls ? <Badge tone="bad"><Warning size={12} weight="fill" /> {shortfalls} short</Badge> : needRows.length ? <Badge tone="ok">Covered</Badge> : undefined}
            />
            <div className="px-5 py-4">
              {needRows.length === 0 ? (
                <p className="text-[13px] text-ink-3">Everything for this day is already baking or done.</p>
              ) : (
                <div className="relative scrollbar-thin overflow-x-auto">
                  <table className="w-full min-w-[300px] text-[13px]">
                    <thead>
                      <tr className="text-left text-xs text-ink-3">
                        <th className="pb-1.5 font-medium">Ingredient</th>
                        <th className="pb-1.5 text-right font-medium">Need</th>
                        <th className="pb-1.5 text-right font-medium">In stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {needRows.map(({ ing, qty }) => {
                        const short = qty > ing.stock;
                        const low = !short && ing.stock - qty < ing.reorderAt;
                        return (
                          <tr key={ing.id} className="border-t border-line">
                            <td className="py-1.5 text-ink">
                              {ing.name}
                              {short && <span className="ms-1.5 text-xs text-bad">short {fmtQty(qty - ing.stock)} {ing.unit}</span>}
                              {low && <span className="ms-1.5 text-xs text-warn">below reorder after</span>}
                            </td>
                            <td className="tnum py-1.5 text-right text-ink">{fmtQty(qty)} {ing.unit}</td>
                            <td className={cx("tnum py-1.5 text-right", short ? "font-semibold text-bad" : "text-ink-2")}>{fmtQty(ing.stock)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {shortfalls > 0 && (
                <p className="mt-3 text-xs text-ink-3">
                  Shortfalls are flagged to <Link href="/admin/stock" className="font-medium text-brand hover:underline">Stock &amp; costing</Link>, where a purchase order can be drafted.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[15px] font-semibold text-ink">Daily capacity</h3>
            <p className="mt-1 text-[13px] text-ink-3">
              Oven points the kitchen can handle per day. Tia uses this when quoting dates: once a day is full she offers the next free one.
            </p>
            <div className="mt-3 flex items-end gap-2">
              <Field label="Oven points per day" className="flex-1">
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min={1}
                    max={200}
                    value={capDraft ?? String(cap)}
                    onChange={(e) => setCapDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveCapacity()}
                  />
                )}
              </Field>
              <Button onClick={saveCapacity} disabled={capDraft === null || Number(capDraft) === cap}>Save</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
