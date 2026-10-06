"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ProductCard } from "@/components/site/product-card";
import { CATEGORIES, PageIntro } from "@/components/site/site-bits";
import { Reveal } from "@/components/site/site-shell";
import { cx, Empty, Skeleton } from "@/components/ui";
import { useDemo } from "@/lib/store";
import type { Category } from "@/lib/types";

const TAGS = [
  { id: "bestseller", label: "Bestseller" },
  { id: "new", label: "New" },
  { id: "kids", label: "Kids" },
  { id: "gift", label: "Gift" },
];

export default function MenuPage() {
  return (
    <>
      <PageIntro eyebrow="The menu" title={<>Baked to order, <span className="italic text-brand">never from the freezer</span></>} sub="Every cake, box and tray is made for your date. Add to your basket and pay a 50% deposit to lock in your slot." />
      <Suspense fallback={<MenuSkeleton />}>
        <Menu />
      </Suspense>
    </>
  );
}

function MenuSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="aspect-[4/5] rounded-[1.6rem]" />
      ))}
    </div>
  );
}

function Menu() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const raw = params.get("cat");
  const cat = CATEGORIES.some((c) => c.id === raw) ? (raw as Category) : "all";
  const products = useDemo((s) => s.products);
  const [q, setQ] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const setCat = (id: string) => router.replace(id === "all" ? path : `${path}?cat=${id}`, { scroll: false });
  const toggleTag = (t: string) => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.available &&
        p.category !== "corporate" &&
        (cat === "all" || p.category === cat) &&
        tags.every((t) => p.tags.includes(t)) &&
        (!term || `${p.name} ${p.description} ${p.unit}`.toLowerCase().includes(term)),
    );
  }, [products, cat, tags, q]);

  const tabs = [{ id: "all", label: "Everything" }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="sticky top-[4.5rem] z-30 -mx-4 border-b border-line bg-bg/90 px-4 pb-3 pt-2 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Menu categories">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={cat === t.id}
              onClick={() => setCat(t.id)}
              className={cx("h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors", cat === t.id ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block sm:w-72">
            <span className="sr-only">Search the menu</span>
            <MagnifyingGlass size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search red velvet, brownies..."
              className="h-10 w-full rounded-full border border-line-strong bg-surface ps-9 pe-4 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tag">
            {TAGS.map((t) => {
              const on = tags.includes(t.id);
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => toggleTag(t.id)} className={cx("inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px] font-medium transition-colors", on ? "border-brand bg-brand-soft text-brand" : "border-line-strong text-ink-2 hover:text-ink")}>
                  {t.label}
                  {on && <X size={12} aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-6 text-[13px] text-ink-3" aria-live="polite">
        {list.length} {list.length === 1 ? "item" : "items"}
      </p>
      {list.length ? (
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i, 7) * 0.04}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      ) : (
        <Empty
          title="Nothing matches yet"
          sub="Try another word or clear the filters. Tia can also tell you what we can bake for your date."
          action={
            <button type="button" onClick={() => (setQ(""), setTags([]))} className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink hover:bg-surface-2">
              Clear filters
            </button>
          }
        />
      )}
    </div>
  );
}
