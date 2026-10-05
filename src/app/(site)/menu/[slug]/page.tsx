"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ChatCircleDots, Clock, MagicWand, ShoppingBag, Warning } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { ProductCard, useAddProduct } from "@/components/site/product-card";
import { CATEGORY_LABEL, Eyebrow, leadLabel, openChannel, Stepper } from "@/components/site/site-bits";
import { Reveal } from "@/components/site/site-shell";
import { Button, Empty } from "@/components/ui";
import { naira } from "@/lib/engine";
import { useDemo } from "@/lib/store";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const product = useDemo((s) => s.products.find((p) => p.slug === slug));
  const products = useDemo((s) => s.products);
  const add = useAddProduct();
  const [qty, setQty] = useState(1);

  const related = useMemo(() => (product ? products.filter((p) => p.available && p.category === product.category && p.id !== product.id).slice(0, 4) : []), [products, product]);

  if (!product) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20">
        <Empty title="We couldn't find that treat" sub="It may have come off the menu. Have a look at what's baking this week." action={<Link href="/menu" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink">Back to the menu</Link>} />
      </div>
    );
  }

  const p = product;
  const isCake = p.category === "celebration-cakes";

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
      <Link href={`/menu?cat=${p.category}`} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={14} aria-hidden /> {CATEGORY_LABEL[p.category]}
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[1.1fr_1fr] md:gap-14">
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-surface-2 md:sticky md:top-24 md:self-start">
          <Image src={p.image} alt={p.name} fill priority sizes="(min-width: 768px) 55vw, 100vw" className="object-cover" />
        </motion.div>

        <div className="flex flex-col">
          <Eyebrow>{CATEGORY_LABEL[p.category]}</Eyebrow>
          <h1 className="mt-3 font-display text-4xl leading-[1.08] text-ink sm:text-5xl">{p.name}</h1>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="tnum font-display text-3xl text-brand">{naira(p.priceNGN)}</p>
            <p className="text-sm text-ink-3">{p.unit}</p>
          </div>
          <p className="mt-6 text-base leading-relaxed text-ink-2">{p.description}</p>

          <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm">
            <div className="bg-surface p-4">
              <dt className="flex items-center gap-1.5 text-[12px] uppercase tracking-wider text-ink-3"><Clock size={13} aria-hidden /> Notice</dt>
              <dd className="mt-1 font-medium text-ink">{leadLabel(p.leadDays)}</dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="flex items-center gap-1.5 text-[12px] uppercase tracking-wider text-ink-3"><Warning size={13} aria-hidden /> Allergens</dt>
              <dd className="mt-1 font-medium capitalize text-ink">{p.allergens.length ? p.allergens.join(", ") : "None listed"}</dd>
            </div>
          </dl>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Stepper value={qty} onChange={setQty} />
            <Button size="lg" className="flex-1 sm:flex-none" onClick={() => (add(p, qty), setQty(1))}>
              <ShoppingBag size={18} aria-hidden /> Add to basket · {naira(p.priceNGN * qty)}
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {isCake && (
              <Link href={`/cake-builder?base=${p.slug}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line-strong px-5 text-sm font-medium text-ink hover:bg-surface-2">
                <MagicWand size={16} aria-hidden /> Customise this cake
              </Link>
            )}
            <button type="button" onClick={() => openChannel("web", `Hi Tia, I have a question about the ${p.name}`)} className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-brand hover:bg-brand-soft">
              <ChatCircleDots size={16} aria-hidden /> Ask Tia about this
            </button>
          </div>

          <p className="mt-8 border-t border-line pt-5 text-[13px] leading-relaxed text-ink-3">Delivered across Lagos from our Ikeja kitchen, or collect from the studio Monday to Saturday. A 50% deposit books your date.</p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <Reveal>
            <h2 className="font-display text-3xl text-ink">You might also love</h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r, i) => (
              <Reveal key={r.id} delay={i * 0.05}>
                <ProductCard product={r} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
