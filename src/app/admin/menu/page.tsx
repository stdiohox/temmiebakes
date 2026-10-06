"use client";

import { useState } from "react";
import { Cookie, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { PageHead } from "@/components/app/app-shell";
import { Kpi } from "@/components/app/bits";
import { Badge, Button, Card, CardHead, Field, Input, Modal, Segmented, Select, Textarea, Thumb, Toggle, cx } from "@/components/ui";
import { naira } from "@/lib/engine";
import { addProduct, setProductAvailable, setProductPrice } from "@/lib/engine-ops";
import { BASE_BY_SIZE, DECORATION_EXTRA, DECORATION_LABEL, FILLINGS, FINISH_FACTOR, FINISH_LABEL, FLAVOURS, SERVINGS, SIZES } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Category, Decoration, Finish, Product } from "@/lib/types";

const CATEGORY: Record<Category, string> = {
  "celebration-cakes": "Celebration cakes",
  cupcakes: "Cupcakes",
  desserts: "Desserts",
  pastries: "Pastries",
  cookies: "Cookies & gifts",
  corporate: "Corporate",
};

type View = "menu" | "cake";

export default function MenuPage() {
  const [view, setView] = useState<View>("menu");
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <PageHead
        title="Menu & pricing"
        icon={<Cookie size={26} weight="duotone" className="text-brand" />}
        sub="One price list for the website, Tia and the cake builder. Change a price or mark something sold out here and every channel updates at once."
        actions={<Button onClick={() => setAdding(true)}><Plus size={16} /> Add product</Button>}
      />
      <Segmented className="mb-5" value={view} onChange={setView} options={[{ value: "menu", label: "Products" }, { value: "cake", label: "Custom cake price list" }]} />
      {view === "menu" ? <Products /> : <CakePriceList />}
      <AddProductModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function Products() {
  const products = useDemo((s) => s.products);
  const run = useDemo((s) => s.run);
  const [cat, setCat] = useState<Category | "all">("all");
  const [q, setQ] = useState("");

  const list = products.filter((p) => (cat === "all" || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const soldOut = products.filter((p) => !p.available).length;
  const avgMargin = products.reduce((t, p) => t + (p.priceNGN - p.costNGN) / p.priceNGN, 0) / Math.max(1, products.length);
  const avgPrice = products.reduce((t, p) => t + p.priceNGN, 0) / Math.max(1, products.length);
  const cats = Array.from(new Set(products.map((p) => p.category)));

  const commitPrice = (p: Product, raw: string) => {
    const v = Math.round(Number(raw));
    if (!v || v <= 0 || v === p.priceNGN) return;
    run((s) => setProductPrice(s, p.id, v, "edited on the menu"));
    toast("Price updated", `${p.name}: ${naira(p.priceNGN)} to ${naira(v)}`);
  };

  const flip = (p: Product, v: boolean) => {
    run((s) => setProductAvailable(s, p.id, v));
    toast(v ? `${p.name} is back on` : `${p.name} marked sold out`, v ? "Showing on the website again." : "Tia will offer alternatives until you switch it back on.", v ? "ok" : "info");
  };

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Products on the menu" value={products.length} sub={`${cats.length} categories`} />
        <Kpi label="Sold out right now" value={soldOut} sub={soldOut ? "Hidden from the website" : "Everything available"} tone={soldOut ? "down" : undefined} />
        <Kpi label="Average gross margin" value={`${Math.round(avgMargin * 100)}%`} sub="Price less ingredients and packaging" />
        <Kpi label="Average price" value={naira(Math.round(avgPrice / 500) * 500)} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 px-5 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <Field label="Search products" className="sm:w-64">
            {(id) => (
              <div className="relative">
                <MagnifyingGlass size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Red velvet, brownies..." className="ps-9" />
              </div>
            )}
          </Field>
          <Field label="Category" className="sm:w-56">
            {(id) => (
              <Select id={id} value={cat} onChange={(e) => setCat(e.target.value as Category | "all")}>
                <option value="all">All categories</option>
                {cats.map((c) => <option key={c} value={c}>{CATEGORY[c]}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <div className="relative mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13px]">
            <thead>
              <tr className="border-y border-line text-xs text-ink-3">
                <th className="px-5 py-2 text-start font-medium">Product</th>
                <th className="px-3 py-2 text-start font-medium">Category</th>
                <th className="px-3 py-2 text-start font-medium">Price (₦)</th>
                <th className="px-3 py-2 text-end font-medium">Lead time</th>
                <th className="px-3 py-2 text-end font-medium">Oven points</th>
                <th className="px-3 py-2 text-start font-medium">Tags</th>
                <th className="px-3 py-2 text-end font-medium">Cost</th>
                <th className="px-3 py-2 text-end font-medium">Margin</th>
                <th className="px-5 py-2 text-start font-medium">Available</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const margin = (p.priceNGN - p.costNGN) / p.priceNGN;
                return (
                  <tr key={p.id} className={cx("border-b border-line last:border-0", !p.available && "opacity-60")}>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <Thumb src={p.image} className="h-11 w-11 rounded-xl" sizes="44px" />
                        <span className="min-w-0">
                          <span className="block font-medium text-ink">{p.name}</span>
                          <span className="block text-xs text-ink-3">{p.unit}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">{CATEGORY[p.category]}</td>
                    <td className="px-3 py-2.5">
                      <Input
                        key={p.priceNGN}
                        type="number"
                        min={500}
                        step={500}
                        defaultValue={p.priceNGN}
                        aria-label={`Price of ${p.name} in naira`}
                        className="tnum h-9 w-28"
                        onBlur={(e) => commitPrice(p, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      />
                    </td>
                    <td className="tnum px-3 py-2.5 text-end text-ink-2">{p.leadDays} day{p.leadDays > 1 ? "s" : ""}</td>
                    <td className="tnum px-3 py-2.5 text-end text-ink-2">{p.ovenPoints}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {p.tags.length ? p.tags.map((t) => <Badge key={t} tone={t === "bestseller" ? "accent" : t === "new" ? "brand" : "neutral"}>{t.replace(/-/g, " ")}</Badge>) : <span className="text-ink-3">None</span>}
                      </div>
                    </td>
                    <td className="tnum px-3 py-2.5 text-end text-ink-2">{naira(p.costNGN)}</td>
                    <td className={cx("tnum px-3 py-2.5 text-end font-semibold", margin < 0.6 ? "text-bad" : "text-ok")}>{Math.round(margin * 100)}%</td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Toggle checked={p.available} onChange={(v) => flip(p, v)} label={`${p.name} available`} />
                        {!p.available && <Badge tone="bad">Sold out</Badge>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!list.length && <p className="px-5 py-8 text-center text-[13px] text-ink-3">No products match that search.</p>}
        </div>
      </Card>
    </div>
  );
}

function CakePriceList() {
  const pctLabel = (f: number) => (f === 1 ? "Base price" : f > 1 ? `+${Math.round((f - 1) * 100)}%` : `${Math.round((f - 1) * 100)}%`);
  return (
    <div className="grid gap-5">
      <p className="rounded-2xl border border-line bg-brand-soft px-5 py-3 text-[13px] text-ink-2">
        Read-only. Tia and the cake builder on the website quote custom cakes from this list, so every customer gets the same price for the same cake. Tiered cakes add the base price of each tier plus ₦15,000 per extra tier for stacking.
      </p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <PriceCard title="Base price by size" sub="Per tier, round, buttercream">
          {SIZES.map((z) => <PriceRow key={z} label={`${z}-inch, serves ${SERVINGS[z]}`} value={naira(BASE_BY_SIZE[z])} />)}
        </PriceCard>
        <PriceCard title="Finish" sub="Applied to the base and flavour total">
          {(Object.keys(FINISH_FACTOR) as Finish[]).map((f) => <PriceRow key={f} label={FINISH_LABEL[f]} value={pctLabel(FINISH_FACTOR[f])} />)}
        </PriceCard>
        <PriceCard title="Flavours" sub="Extra per tier">
          {FLAVOURS.map((f) => <PriceRow key={f.name} label={f.note ? `${f.name} (${f.note})` : f.name} value={f.extra ? `+${naira(f.extra)}` : "Included"} />)}
        </PriceCard>
        <div className="grid gap-5 self-start">
          <PriceCard title="Fillings" sub="Extra per tier">
            {FILLINGS.map((f) => <PriceRow key={f.name} label={f.name} value={f.extra ? `+${naira(f.extra)}` : "Included"} />)}
          </PriceCard>
          <PriceCard title="Decoration" sub="Flat extra, ×1.5 on tiered cakes">
            {(Object.keys(DECORATION_EXTRA) as Decoration[]).map((d) => <PriceRow key={d} label={DECORATION_LABEL[d]} value={DECORATION_EXTRA[d] ? `+${naira(DECORATION_EXTRA[d])}` : "Included"} />)}
          </PriceCard>
        </div>
      </div>
    </div>
  );
}

function PriceCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHead title={title} sub={sub} />
      <ul className="mt-2 divide-y divide-line px-5 pb-3">{children}</ul>
    </Card>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2 text-[13px]">
      <span className="text-ink-2">{label}</span>
      <span className="tnum shrink-0 font-semibold text-ink">{value}</span>
    </li>
  );
}

// ---------------------------------------------------------------- add product

function AddProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Add a product" wide>
      {open && <AddProductForm onClose={onClose} />}
    </Modal>
  );
}

function AddProductForm({ onClose }: { onClose: () => void }) {
  const products = useDemo((s) => s.products);
  const run = useDemo((s) => s.run);
  const images = Array.from(new Set(products.map((p) => p.image))).sort();
  const [f, setF] = useState({ name: "", category: "desserts" as Category, price: "15000", unit: "box of 6", lead: "1", points: "0.5", image: images[0] ?? "", description: "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const valid = f.name.trim().length > 2 && Number(f.price) > 0 && f.image;

  const save = () => {
    if (!valid) return;
    run((s) =>
      addProduct(s, {
        name: f.name.trim(),
        category: f.category,
        priceNGN: Math.round(Number(f.price)),
        unit: f.unit.trim() || "each",
        leadDays: Math.max(0, Math.round(Number(f.lead) || 1)),
        ovenPoints: Math.max(0, Number(f.points) || 0.5),
        image: f.image,
        description: f.description.trim() || `Freshly made ${f.name.trim().toLowerCase()} from our Ikeja kitchen.`,
      }),
    );
    toast("Product added", `${f.name.trim()} is live on the website and in Tia's menu.`);
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name">{(id) => <Input id={id} data-autofocus value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Salted caramel brownies" required />}</Field>
        <Field label="Category">
          {(id) => (
            <Select id={id} value={f.category} onChange={(e) => set("category", e.target.value as Category)}>
              {(Object.keys(CATEGORY) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY[c]}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Price (₦)">{(id) => <Input id={id} type="number" min={500} step={500} value={f.price} onChange={(e) => set("price", e.target.value)} />}</Field>
        <Field label="Unit" hint="For example: box of 6, 8-inch cake, tray serves 8">{(id) => <Input id={id} value={f.unit} onChange={(e) => set("unit", e.target.value)} />}</Field>
        <Field label="Lead time (days)">{(id) => <Input id={id} type="number" min={0} value={f.lead} onChange={(e) => set("lead", e.target.value)} />}</Field>
        <Field label="Oven points" hint="Kitchen capacity used per unit">{(id) => <Input id={id} type="number" min={0} step={0.5} value={f.points} onChange={(e) => set("points", e.target.value)} />}</Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Photo</legend>
        <div className="grid max-h-48 grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-8">
          {images.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => set("image", src)}
              aria-pressed={f.image === src}
              aria-label={`Use photo ${src.replace("/img/", "").replace(".jpg", "").replace(/-/g, " ")}`}
              className={cx("block aspect-square overflow-hidden rounded-xl ring-offset-2 ring-offset-surface", f.image === src ? "ring-2 ring-brand" : "opacity-80 hover:opacity-100")}
            >
              <Thumb src={src} className="h-full w-full" sizes="80px" />
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Description">{(id) => <Textarea id={id} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="What makes it special, in one or two sentences." />}</Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={!valid}>Add to menu</Button>
      </div>
    </form>
  );
}
