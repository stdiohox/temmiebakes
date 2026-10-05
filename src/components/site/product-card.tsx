"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock, Plus } from "@phosphor-icons/react";
import { naira } from "@/lib/engine";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Product } from "@/lib/types";
import { cx } from "../ui";
import { leadLabel } from "./site-bits";

export function useAddProduct() {
  const addToCart = useDemo((s) => s.addToCart);
  return (p: Product, qty = 1) => {
    addToCart({ productId: p.id, name: p.name, qty, unitPriceNGN: p.priceNGN });
    toast("Added to basket", `${qty} × ${p.name} · ${naira(p.priceNGN * qty)}`);
  };
}

const TAG_LABEL: Record<string, string> = { bestseller: "Bestseller", new: "New", kids: "Kids", gift: "Gift", premium: "Premium", wedding: "Wedding" };

export function ProductCard({ product: p, className, sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 90vw" }: { product: Product; className?: string; sizes?: string }) {
  const add = useAddProduct();
  const tag = p.tags.find((t) => TAG_LABEL[t]);
  return (
    <article className={cx("group flex flex-col", className)}>
      <Link href={`/menu/${p.slug}`} className="relative block aspect-[4/5] overflow-hidden rounded-[1.6rem] bg-surface-2">
        <Image src={p.image} alt={p.name} fill sizes={sizes} className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.04]" />
        {tag && <span className="absolute start-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11.5px] font-semibold text-ink backdrop-blur">{TAG_LABEL[tag]}</span>}
      </Link>
      <div className="mt-3 flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 className="font-display text-[1.15rem] leading-snug text-ink">
            <Link href={`/menu/${p.slug}`} className="hover:text-brand">
              {p.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-[13px] text-ink-3">{p.unit}</p>
        </div>
        <p className="tnum shrink-0 pt-0.5 text-[15px] font-semibold text-ink">{naira(p.priceNGN)}</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 px-1">
        <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-2">
          <Clock size={14} aria-hidden /> {leadLabel(p.leadDays)}
        </span>
        <button
          type="button"
          onClick={() => add(p)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-medium text-ink transition-colors hover:border-brand hover:bg-brand hover:text-brand-ink active:scale-[0.98]"
          aria-label={`Add ${p.name} to basket`}
        >
          <Plus size={14} weight="bold" aria-hidden /> Add to basket
        </button>
      </div>
    </article>
  );
}
