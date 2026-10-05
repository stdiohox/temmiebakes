"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Package, Phone, ShoppingCart, TrendUp, WhatsappLogo, CheckCircle } from "@phosphor-icons/react";
import { PageHead } from "@/components/app/app-shell";
import { Kpi, Money } from "@/components/app/bits";
import { Badge, Button, Card, CardHead, Empty, Field, Input, Modal, Segmented, Select, cx } from "@/components/ui";
import { draftReorder, logEvent, naira, receivePO, sendPO } from "@/lib/engine";
import { adjustStock, ingredientShare, round500 } from "@/lib/engine-ops";
import { ago, money } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Ingredient, PurchaseOrder } from "@/lib/types";

type Tab = "ingredients" | "orders" | "margins";

const PO_TONE: Record<PurchaseOrder["status"], "warn" | "info" | "ok"> = { draft: "warn", sent: "info", received: "ok" };
const PO_LABEL: Record<PurchaseOrder["status"], string> = { draft: "Draft", sent: "Sent to supplier", received: "Received" };

export default function StockPage() {
  const [tab, setTab] = useState<Tab>("ingredients");
  const purchaseOrders = useDemo((s) => s.purchaseOrders);
  const openPOs = purchaseOrders.filter((p) => p.status !== "received").length;

  return (
    <div>
      <PageHead
        title="Stock & costing"
        icon={<Package size={26} weight="duotone" className="text-brand" />}
        sub="Ingredients are deducted from recipes when an order goes into the oven. Low items become draft purchase orders you can send to suppliers on WhatsApp."
      />
      <Segmented
        className="mb-5 max-w-full overflow-x-auto"
        value={tab}
        onChange={setTab}
        options={[
          { value: "ingredients", label: "Ingredients" },
          { value: "orders", label: <>Purchase orders{openPOs > 0 && <span className="ms-1.5 rounded-full bg-accent-soft px-1.5 text-[11px] text-accent">{openPOs}</span>}</> },
          { value: "margins", label: "Recipes & margins" },
        ]}
      />
      {tab === "ingredients" && <Ingredients />}
      {tab === "orders" && <PurchaseOrders />}
      {tab === "margins" && <Margins />}
    </div>
  );
}

// ---------------------------------------------------------------- ingredients

function Ingredients() {
  const ingredients = useDemo((s) => s.ingredients);
  const suppliers = useDemo((s) => s.suppliers);
  const stockMoves = useDemo((s) => s.stockMoves);
  const run = useDemo((s) => s.run);
  const now = useNow();
  const [adjusting, setAdjusting] = useState<Ingredient | null>(null);

  const low = ingredients.filter((i) => i.stock < i.reorderAt);
  const stockValue = ingredients.reduce((t, i) => t + i.stock * i.costPerUnitNGN, 0);
  const spend7d = ingredients.reduce((t, i) => t + i.usage7d * i.costPerUnitNGN, 0);
  const rows = [...ingredients].sort((a, b) => a.stock / a.reorderAt - b.stock / b.reorderAt);

  const reorder = () => {
    const created = run((s) => draftReorder(s));
    if (created.length) toast(`${created.length} purchase order${created.length > 1 ? "s" : ""} drafted`, "Grouped by supplier. Review them in Purchase orders and send on WhatsApp.");
    else toast("Nothing new to re-order", low.length ? "Every low item is already on an open purchase order." : "All ingredients are above their re-order level.", "info");
  };

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Below re-order level" value={low.length} sub={low.length ? low.slice(0, 2).map((i) => i.name).join(", ") + (low.length > 2 ? ` +${low.length - 2}` : "") : "All stocked"} tone={low.length ? "down" : "up"} />
        <Kpi label="Stock value on hand" value={money(stockValue)} sub={`${ingredients.length} ingredients and packaging`} />
        <Kpi label="Ingredient spend, last 7 days" value={money(spend7d)} sub="From recipe deductions" />
        <Kpi label="Suppliers" value={suppliers.length} sub="All reachable on WhatsApp" />
      </div>

      <Card>
        <CardHead
          title="Ingredients"
          sub="Sorted by how close each item is to its re-order level"
          action={
            <Button size="sm" onClick={reorder}>
              <ShoppingCart size={15} /> Draft re-order for low items
            </Button>
          }
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-y border-line text-start text-xs text-ink-3">
                <th className="px-5 py-2 text-start font-medium">Ingredient</th>
                <th className="px-3 py-2 text-end font-medium">In stock</th>
                <th className="px-3 py-2 text-end font-medium">Re-order at</th>
                <th className="px-3 py-2 text-start font-medium">Level</th>
                <th className="px-3 py-2 text-end font-medium">Days of cover</th>
                <th className="px-3 py-2 text-end font-medium">Cost per unit</th>
                <th className="px-3 py-2 text-start font-medium">Supplier</th>
                <th className="px-5 py-2 text-end font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const isLow = i.stock < i.reorderAt;
                const cover = i.usage7d > 0 ? i.stock / (i.usage7d / 7) : Infinity;
                const fill = Math.min(1, i.stock / (i.reorderAt * 2));
                return (
                  <tr key={i.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5 font-medium text-ink">{i.name}</td>
                    <td className="tnum px-3 py-2.5 text-end text-ink">{i.stock} <span className="text-ink-3">{i.unit}</span></td>
                    <td className="tnum px-3 py-2.5 text-end text-ink-2">{i.reorderAt}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16">
                          <div className={cx("h-1.5 rounded-full", isLow ? "bg-bad" : fill < 0.65 ? "bg-warn" : "bg-ok")} style={{ width: `${Math.max(6, fill * 100)}%` }} />
                        </div>
                        <Badge tone={isLow ? "bad" : "ok"}>{isLow ? "Low" : "OK"}</Badge>
                      </div>
                    </td>
                    <td className={cx("tnum px-3 py-2.5 text-end", cover < 3 ? "font-semibold text-bad" : cover < 6 ? "text-warn" : "text-ink-2")}>
                      {Number.isFinite(cover) ? `${cover.toFixed(1)} days` : "No usage"}
                    </td>
                    <td className="tnum px-3 py-2.5 text-end text-ink-2">{naira(i.costPerUnitNGN)}</td>
                    <td className="px-3 py-2.5 text-ink-2">{suppliers.find((x) => x.id === i.supplierId)?.name}</td>
                    <td className="px-5 py-2.5 text-end">
                      <Button size="sm" variant="outline" onClick={() => setAdjusting(i)}>Adjust stock</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHead title="Recent stock movements" sub="Recipe deductions, deliveries and manual adjustments" />
        <ul className="mt-2 divide-y divide-line px-5 pb-3">
          {stockMoves.slice(0, 8).map((m) => {
            const ing = ingredients.find((i) => i.id === m.ingredientId);
            return (
              <li key={m.id} className="flex items-center gap-3 py-2 text-[13px]">
                <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full", m.qty > 0 ? "bg-ok-soft text-ok" : "bg-surface-2 text-ink-2")}>
                  {m.qty > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{ing?.name}</span>
                  <span className="block truncate text-xs text-ink-3">{m.reason}</span>
                </span>
                <span className={cx("tnum shrink-0", m.qty > 0 ? "text-ok" : "text-ink-2")}>{m.qty > 0 ? "+" : ""}{m.qty} {ing?.unit}</span>
                <span className="hidden w-20 shrink-0 text-end text-xs text-ink-3 sm:block">{ago(m.at, now)}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <AdjustModal ing={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
}

const REASONS = ["Stock count correction", "Delivery received", "Wastage or spoilt", "Used for a class", "Used in production"];

function AdjustModal({ ing, onClose }: { ing: Ingredient | null; onClose: () => void }) {
  return (
    <Modal open={!!ing} onClose={onClose} title={ing ? `Adjust stock: ${ing.name}` : "Adjust stock"}>
      {ing && <AdjustForm key={ing.id} ing={ing} onClose={onClose} />}
    </Modal>
  );
}

function AdjustForm({ ing, onClose }: { ing: Ingredient; onClose: () => void }) {
  const run = useDemo((s) => s.run);
  const [dir, setDir] = useState<"add" | "remove">("remove");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState(REASONS[0]);
  const n = Math.abs(Number(qty) || 0);
  const after = Math.max(0, +(ing.stock + (dir === "add" ? n : -n)).toFixed(2));

  const save = () => {
    if (!n) return;
    run((s) => adjustStock(s, ing.id, dir === "add" ? n : -n, reason));
    toast("Stock updated", `${ing.name}: ${ing.stock} to ${after} ${ing.unit}`);
    onClose();
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <p className="text-[13px] text-ink-3">Currently <span className="tnum font-semibold text-ink">{ing.stock} {ing.unit}</span>, re-order at {ing.reorderAt}.</p>
      <Segmented value={dir} onChange={setDir} options={[{ value: "remove", label: "Remove" }, { value: "add", label: "Add" }]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={`Quantity (${ing.unit})`}>{(id) => <Input id={id} type="number" min={0} step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} />}</Field>
        <Field label="Reason">
          {(id) => (
            <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </Select>
          )}
        </Field>
      </div>
      <p className="text-[13px] text-ink-2">
        New level: <span className={cx("tnum font-semibold", after < ing.reorderAt ? "text-bad" : "text-ok")}>{after} {ing.unit}</span>
        {after < ing.reorderAt && " (below re-order level)"}
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={!n}>Save adjustment</Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- purchase orders

function PurchaseOrders() {
  const purchaseOrders = useDemo((s) => s.purchaseOrders);
  const suppliers = useDemo((s) => s.suppliers);
  const ingredients = useDemo((s) => s.ingredients);
  const run = useDemo((s) => s.run);
  const now = useNow();

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHead title="Purchase orders" sub="Drafted automatically when stock drops below the re-order level" />
        {purchaseOrders.length === 0 ? (
          <Empty icon={<ShoppingCart size={28} />} title="No purchase orders yet" sub="Use “Draft re-order for low items” on the Ingredients tab." />
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {purchaseOrders.map((po) => {
              const sup = suppliers.find((x) => x.id === po.supplierId);
              return (
                <li key={po.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">{sup?.name}</p>
                      <Badge tone={PO_TONE[po.status]}>{PO_LABEL[po.status]}</Badge>
                      <span className="text-xs text-ink-3">{ago(po.createdAt, now)}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-2">
                      {po.lines.map((l) => {
                        const ing = ingredients.find((i) => i.id === l.ingredientId);
                        return `${ing?.name} × ${l.qty} ${ing?.unit}`;
                      }).join(" · ")}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-3">Total <Money ngn={po.totalNGN} className="font-semibold text-ink" /></p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {po.status === "draft" && (
                      <Button size="sm" onClick={() => { run((s) => sendPO(s, po.id)); toast(`Sent to ${sup?.name}`, `Purchase order for ${naira(po.totalNGN)} sent on WhatsApp. Delivery in ${sup?.leadDays} day${sup && sup.leadDays > 1 ? "s" : ""}.`); }}>
                        <WhatsappLogo size={15} weight="fill" /> Send on WhatsApp
                      </Button>
                    )}
                    {po.status !== "received" && (
                      <Button size="sm" variant="outline" onClick={() => { run((s) => receivePO(s, po.id)); toast("Delivery received", "Stock levels updated from the purchase order."); }}>
                        <CheckCircle size={15} /> Mark received
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card className="self-start">
        <CardHead title="Suppliers" sub="Purchase orders go out on WhatsApp" />
        <ul className="mt-2 divide-y divide-line px-5 pb-3">
          {suppliers.map((s) => (
            <li key={s.id} className="py-3">
              <p className="text-[13.5px] font-medium text-ink">{s.name}</p>
              <p className="text-xs text-ink-3">{s.items}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
                <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-ink hover:underline"><Phone size={13} /> {s.phone}</a>
                <span>Delivers in {s.leadDays} day{s.leadDays > 1 ? "s" : ""}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- margins

function Margins() {
  const products = useDemo((s) => s.products);
  const ingredients = useDemo((s) => s.ingredients);
  const recipes = useDemo((s) => s.recipes);
  const run = useDemo((s) => s.run);
  const [ingId, setIngId] = useState("in-butter");
  const [pctStr, setPctStr] = useState("20");
  const [applied, setApplied] = useState<Record<string, true>>({});
  const pctUp = Math.max(0, Number(pctStr) || 0) / 100;
  const scenario = `${ingId}:${pctUp}`;
  const ing = ingredients.find((i) => i.id === ingId);

  const rows = products
    .map((p) => {
      const margin = p.priceNGN ? (p.priceNGN - p.costNGN) / p.priceNGN : 0;
      const share = ingredientShare({ ingredients }, recipes.find((r) => r.id === p.recipeId), ingId);
      const newCost = p.costNGN * (1 + share * pctUp);
      const newMargin = p.priceNGN ? (p.priceNGN - newCost) / p.priceNGN : 0;
      const suggested = round500(newCost / (1 - margin));
      return { p, margin, share, newCost, newMargin, suggested };
    })
    .sort((a, b) => a.margin - b.margin);
  const affected = rows.filter((r) => r.share > 0 && pctUp > 0 && r.suggested > r.p.priceNGN && !applied[`${scenario}:${r.p.id}`]);
  const avgMargin = rows.reduce((t, r) => t + r.margin, 0) / Math.max(1, rows.length);

  const apply = (list: typeof rows) => {
    if (!list.length) return;
    run((s) => {
      list.forEach((r) => {
        const p = s.products.find((x) => x.id === r.p.id);
        if (!p) return;
        const before = p.priceNGN;
        p.priceNGN = r.suggested;
        logEvent(s, {
          automation: "content",
          kind: "action",
          title: `Price updated: ${p.name}`,
          detail: `${naira(before)} to ${naira(r.suggested)} to hold a ${Math.round(r.margin * 100)}% margin after ${ing?.name.toLowerCase()} +${Math.round(pctUp * 100)}%`,
          minutesSaved: 6,
        });
      });
    });
    setApplied((a) => ({ ...a, ...Object.fromEntries(list.map((r) => [`${scenario}:${r.p.id}`, true as const])) }));
    toast(list.length === 1 ? `${list[0].p.name} repriced` : `${list.length} products repriced`, "Website, Tia and the menu now quote the new prices.");
  };

  return (
    <div className="grid gap-5">
      <Card>
        <CardHead
          title="Price change simulator"
          sub="Lagos prices move fast. See what an ingredient increase does to every margin, and the price that keeps your margin where it is."
        />
        <div className="grid grid-cols-1 gap-3 px-5 pb-5 pt-4 sm:grid-cols-[1fr_160px_auto] sm:items-end">
          <Field label="Ingredient">
            {(id) => (
              <Select id={id} value={ingId} onChange={(e) => setIngId(e.target.value)}>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({naira(i.costPerUnitNGN)} per {i.unit})</option>)}
              </Select>
            )}
          </Field>
          <Field label="Price increase (%)">{(id) => <Input id={id} type="number" min={0} max={300} value={pctStr} onChange={(e) => setPctStr(e.target.value)} />}</Field>
          <div className="flex flex-wrap gap-1.5">
            {[10, 20, 35, 50].map((v) => (
              <Button key={v} size="sm" variant={Number(pctStr) === v ? "primary" : "secondary"} onClick={() => setPctStr(String(v))}>+{v}%</Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-line px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-ink-2">
            <TrendUp size={15} className="me-1 inline text-accent" />
            {pctUp > 0
              ? <>{ing?.name} +{Math.round(pctUp * 100)}% affects <span className="font-semibold text-ink">{rows.filter((r) => r.share > 0).length}</span> products. {affected.length} still need a new price.</>
              : "Enter an increase to see the effect."}
          </p>
          <Button size="sm" variant="accent" disabled={!affected.length} onClick={() => apply(affected)}>
            Apply suggested prices ({affected.length})
          </Button>
        </div>
      </Card>

      <Card>
        <CardHead title="Margins by product" sub={`Lowest margin first · average ${Math.round(avgMargin * 100)}% · items under 60% are highlighted`} />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="border-y border-line text-xs text-ink-3">
                <th className="px-5 py-2 text-start font-medium">Product</th>
                <th className="px-3 py-2 text-end font-medium">Price</th>
                <th className="px-3 py-2 text-end font-medium">Cost</th>
                <th className="px-3 py-2 text-end font-medium">Margin</th>
                <th className="px-3 py-2 text-end font-medium">Margin %</th>
                <th className="px-3 py-2 text-end font-medium">New cost</th>
                <th className="px-3 py-2 text-end font-medium">New margin</th>
                <th className="px-3 py-2 text-end font-medium">Suggested price</th>
                <th className="px-5 py-2 text-end font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const hit = r.share > 0 && pctUp > 0;
                const done = applied[`${scenario}:${r.p.id}`];
                const lowNow = r.margin < 0.6;
                const lowNew = hit && r.newMargin < 0.6;
                return (
                  <tr key={r.p.id} className={cx("border-b border-line last:border-0", lowNow && "bg-bad-soft/60")}>
                    <td className="px-5 py-2.5">
                      <span className="font-medium text-ink">{r.p.name}</span>
                      {lowNow && <Badge tone="bad" className="ms-2">Under 60%</Badge>}
                    </td>
                    <td className="tnum px-3 py-2.5 text-end text-ink">{naira(r.p.priceNGN)}</td>
                    <td className="tnum px-3 py-2.5 text-end text-ink-2">{naira(r.p.costNGN)}</td>
                    <td className="tnum px-3 py-2.5 text-end text-ink-2">{naira(r.p.priceNGN - r.p.costNGN)}</td>
                    <td className={cx("tnum px-3 py-2.5 text-end font-semibold", lowNow ? "text-bad" : "text-ok")}>{Math.round(r.margin * 100)}%</td>
                    <td className="tnum px-3 py-2.5 text-end text-ink-2">{hit ? naira(r.newCost) : <span className="text-ink-3">no change</span>}</td>
                    <td className={cx("tnum px-3 py-2.5 text-end", hit ? (lowNew ? "font-semibold text-bad" : "text-warn") : "text-ink-3")}>
                      {hit ? `${Math.round(r.newMargin * 100)}%` : `${Math.round(r.margin * 100)}%`}
                    </td>
                    <td className="tnum px-3 py-2.5 text-end font-semibold text-ink">{hit && r.suggested > r.p.priceNGN && !done ? naira(r.suggested) : <span className="font-normal text-ink-3">No change</span>}</td>
                    <td className="px-5 py-2.5 text-end">
                      {done ? (
                        <Badge tone="ok">Applied</Badge>
                      ) : hit && r.suggested > r.p.priceNGN ? (
                        <Button size="sm" variant="outline" onClick={() => apply([r])}>Apply suggested price</Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-ink-3">
          Estimate: product cost × that ingredient&apos;s share of the recipe cost × the increase. Suggested prices are rounded to the nearest ₦500.
        </p>
      </Card>
    </div>
  );
}
