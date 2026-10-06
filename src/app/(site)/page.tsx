"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight, ChatCircleDots, InstagramLogo, Quotes } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Reveal } from "@/components/site/site-shell";
import { ProductCard } from "@/components/site/product-card";
import { CATEGORIES, Eyebrow, openChannel, Stars } from "@/components/site/site-bits";
import { cx } from "@/components/ui";
import { naira } from "@/lib/engine";
import { BASE_BY_SIZE, DEFAULT_CAKE, quoteCake, SIZES, ZONES } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProofStrip />
      <Bestsellers />
      <CategoryBento />
      <BuilderTeaser />
      <CorporateAndClasses />
      <Reviews />
      <InstagramGrid />
    </>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 md:min-h-[calc(100dvh-8rem)] md:grid-cols-[1.05fr_1fr] md:gap-8 md:pb-16 md:pt-6">
      <div>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">
          Ikeja kitchen · delivered across Lagos
        </motion.p>
        <motion.h1 initial={{ y: 18 }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.05, ease: EASE }} className="mt-4 font-display text-[2.25rem] leading-[1.04] text-ink sm:text-5xl md:text-[2.4rem] lg:text-[3.5rem]">
          Celebration cakes <span className="italic text-brand">Lagos remembers</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.12, ease: EASE }} className="mt-5 max-w-md text-base leading-relaxed text-ink-2 sm:text-lg">
          Custom cakes, desserts and pastries, baked to order in Ikeja and delivered to your door.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.18, ease: EASE }} className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/cake-builder" className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-brand-ink transition-colors hover:bg-brand-2 active:scale-[0.98]">
            Order a cake <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
          <button type="button" onClick={() => openChannel("web")} className="inline-flex h-12 items-center gap-2 rounded-full border border-line-strong px-5 text-[15px] font-medium text-ink transition-colors hover:bg-surface-2 active:scale-[0.98]">
            <ChatCircleDots size={18} aria-hidden /> Ask Tia
          </button>
        </motion.div>
      </div>

      <div className="relative mx-auto w-full max-w-md md:max-w-none">
        <motion.div initial={{ scale: 0.97 }} animate={{ scale: 1 }} transition={{ duration: 1.1, ease: EASE }} className="relative ms-auto aspect-[4/5] w-[82%] overflow-hidden rounded-[2rem] bg-surface-2 md:max-h-[68dvh] md:w-[78%]">
          <Image src="/img/cake-drip-pink.jpg" alt="Tall pink drip cake topped with macarons" fill priority sizes="(min-width: 768px) 40vw, 80vw" className="object-cover" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.25, ease: EASE }} className="absolute bottom-[-6%] start-0 aspect-square w-[42%] overflow-hidden rounded-[1.6rem] border-[6px] border-bg bg-surface-2 shadow-lift">
          <Image src="/img/cupcake-pink.jpg" alt="Pink swirl cupcakes" fill loading="eager" sizes="(min-width: 768px) 18vw, 40vw" className="object-cover" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.45, ease: EASE }} className="absolute start-[4%] top-[8%] rounded-2xl border border-line bg-surface/90 px-4 py-3 shadow-soft backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">8&quot; custom cake</p>
          <p className="tnum mt-0.5 font-display text-xl text-ink">from {naira(BASE_BY_SIZE[8])}</p>
        </motion.div>
      </div>
    </section>
  );
}

function ProofStrip() {
  const orders = useDemo((s) => s.orders);
  const { delivered, rating, rated } = useMemo(() => {
    const done = orders.filter((o) => o.status === "delivered");
    const r = orders.filter((o) => typeof o.rating === "number");
    return { delivered: done.length, rated: r.length, rating: r.length ? r.reduce((t, o) => t + (o.rating ?? 0), 0) / r.length : 0 };
  }, [orders]);
  const stats = [
    { value: delivered.toLocaleString("en-GB"), label: "orders delivered" },
    { value: rating.toFixed(1), label: `average from ${rated} reviews`, stars: true },
    { value: "200+", label: "students trained" },
    { value: String(ZONES.length), label: "Lagos delivery areas" },
  ];
  return (
    <section aria-label="Temmiebakes in numbers" className="border-y border-line bg-surface/60">
      <div className="mx-auto grid max-w-6xl grid-cols-2 px-4 sm:px-6 md:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.06} className={cx("py-7 md:py-9", i % 2 === 1 && "ps-5", i > 0 && "md:border-s md:border-line md:ps-8", i < 2 && "border-b border-line md:border-b-0")}>
            <p className="tnum font-display text-4xl text-ink sm:text-[2.6rem]">{s.value}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
              {s.stars && <Stars value={rating} size={12} />}
              {s.label}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Bestsellers() {
  const products = useDemo((s) => s.products);
  const best = useMemo(() => products.filter((p) => p.available && p.tags.includes("bestseller")), [products]);
  return (
    <section className="mx-auto mt-20 max-w-6xl sm:mt-28">
      <Reveal className="flex items-end justify-between gap-4 px-4 sm:px-6">
        <div>
          <Eyebrow>Most ordered</Eyebrow>
          <h2 className="mt-2 font-display text-3xl text-ink sm:text-[2.6rem]">The bestsellers</h2>
        </div>
        <Link href="/menu" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand hover:underline">
          Full menu <ArrowRight size={14} aria-hidden />
        </Link>
      </Reveal>
      <div className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 pb-2 sm:scroll-px-6 sm:px-6" tabIndex={0} aria-label="Bestseller products, scroll sideways">
        {best.map((p) => (
          <ProductCard key={p.id} product={p} className="w-[72%] shrink-0 snap-start sm:w-[42%] md:w-[30%] lg:w-[23%]" sizes="(min-width: 1024px) 23vw, (min-width: 640px) 42vw, 72vw" />
        ))}
      </div>
    </section>
  );
}

function CategoryBento() {
  const [first, ...rest] = CATEGORIES;
  return (
    <section className="mx-auto mt-24 max-w-6xl px-4 sm:mt-32 sm:px-6">
      <Reveal className="max-w-xl">
        <Eyebrow>Shop by craving</Eyebrow>
        <h2 className="mt-2 font-display text-3xl text-ink sm:text-[2.6rem]">Everything from the Ikeja oven</h2>
      </Reveal>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:grid-rows-[15rem_15rem]">
        <Reveal className="col-span-2 h-full md:row-span-2">
          <BentoTile cat={first} big />
        </Reveal>
        {rest.map((c, i) => (
          <Reveal key={c.id} delay={0.05 * (i + 1)} className="h-full">
            <BentoTile cat={c} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function BentoTile({ cat, big }: { cat: (typeof CATEGORIES)[number]; big?: boolean }) {
  return (
    <Link href={`/menu?cat=${cat.id}`} className={cx("group relative block h-full overflow-hidden rounded-[1.6rem] bg-surface-2", big ? "min-h-[22rem]" : "min-h-[11rem] md:min-h-0")}>
      <Image src={cat.image} alt="" fill sizes={big ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"} className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.05]" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" aria-hidden />
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white sm:p-5">
        <span className="min-w-0">
          <span className={cx("block font-display leading-tight", big ? "text-3xl sm:text-4xl" : "text-lg sm:text-xl")}>{cat.label}</span>
          {big && <span className="mt-1 block text-sm text-white/85">{cat.blurb}</span>}
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur transition-colors group-hover:bg-white group-hover:text-black" aria-hidden>
          <ArrowUpRight size={16} />
        </span>
      </span>
    </Link>
  );
}

function BuilderTeaser() {
  const [size, setSize] = useState<(typeof SIZES)[number]>(8);
  const q = quoteCake({ ...DEFAULT_CAKE, sizeInches: size });
  return (
    <section className="mx-auto mt-24 max-w-6xl px-4 sm:mt-32 sm:px-6">
      <div className="grid overflow-hidden rounded-[2rem] bg-brand text-brand-ink md:grid-cols-[1.1fr_1fr]">
        <Reveal className="flex flex-col justify-center p-7 sm:p-12">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] opacity-80">Custom cake builder</p>
          <h2 className="mt-3 font-display text-3xl leading-tight sm:text-5xl">Design it, see the price, book the date</h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed opacity-85">No more waiting for a quote in the DMs. Pick size, flavour and finish, and the price updates as you go, with the earliest date our oven can fit you in.</p>
          <Link href="/cake-builder" className="mt-7 inline-flex h-12 w-fit items-center gap-2 rounded-full bg-brand-ink px-6 text-[15px] font-semibold text-brand transition-transform active:scale-[0.98]">
            Start designing <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
        </Reveal>
        <Reveal delay={0.1} className="p-4 pt-0 sm:p-8 md:ps-0">
          <div className="rounded-[1.6rem] bg-surface p-5 text-ink shadow-lift sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-lg">Live example</p>
              <div role="group" aria-label="Cake size" className="inline-flex gap-0.5 rounded-full bg-surface-2 p-1">
                {SIZES.map((z) => (
                  <button key={z} type="button" aria-pressed={z === size} onClick={() => setSize(z)} className={cx("rounded-full px-2.5 py-1 text-xs font-medium transition-colors", z === size ? "bg-brand text-brand-ink" : "text-ink-2 hover:text-ink")}>
                    {z}&quot;
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-[13px] text-ink-3">
              {DEFAULT_CAKE.flavour}, {DEFAULT_CAKE.filling.toLowerCase()}, themed decoration
            </p>
            <ul className="mt-4 divide-y divide-line text-sm">
              {q.lines.map((l) => (
                <li key={l.label} className="flex justify-between gap-3 py-2">
                  <span className="text-ink-2">{l.label}</span>
                  <span className="tnum text-ink">{naira(l.amountNGN)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-end justify-between gap-3 border-t border-line-strong pt-3">
              <span className="text-[13px] text-ink-3">Serves {q.servings} · {q.leadDays} days notice</span>
              <motion.span key={q.totalNGN} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="tnum font-display text-2xl text-brand">
                {naira(q.totalNGN)}
              </motion.span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CorporateAndClasses() {
  return (
    <section className="mx-auto mt-24 grid max-w-6xl gap-4 px-4 sm:mt-32 sm:px-6 md:grid-cols-[1.4fr_1fr]">
      <Reveal>
        <Link href="/corporate" className="group relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-[2rem] bg-surface-2 p-6 text-white sm:p-9">
          <Image src="/img/catering-breakfast-toast.jpg" alt="" fill sizes="(min-width: 768px) 58vw, 100vw" className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.04]" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" aria-hidden />
          <span className="relative">
            <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80">For offices and events</span>
            <span className="mt-2 block max-w-md font-display text-3xl leading-tight sm:text-4xl">Corporate breakfasts, canapés and dessert tables</span>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium">
              Get an instant quote <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-1" />
            </span>
          </span>
        </Link>
      </Reveal>
      <Reveal delay={0.08}>
        <Link href="/classes" className="group flex h-full min-h-[26rem] flex-col overflow-hidden rounded-[2rem] border border-line bg-surface">
          <span className="relative block aspect-[16/10] overflow-hidden">
            <Image src="/img/class-group.jpg" alt="" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.04]" />
          </span>
          <span className="flex flex-1 flex-col p-6 sm:p-7">
            <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">Temmiebakes Academy</span>
            <span className="mt-2 font-display text-2xl leading-tight text-ink sm:text-3xl">Learn to bake like a pro</span>
            <span className="mt-2 text-sm leading-relaxed text-ink-2">Hands-on classes in Ikeja, from first sponge to running a cake business. Over 200 students trained.</span>
            <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-medium text-brand">
              See classes <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-1" />
            </span>
          </span>
        </Link>
      </Reveal>
    </section>
  );
}

function Reviews() {
  const orders = useDemo((s) => s.orders);
  const customers = useDemo((s) => s.customers);
  const reviews = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; text: string; name: string; item: string }[] = [];
    for (const o of orders) {
      if (o.rating !== 5 || !o.review || seen.has(o.review)) continue;
      seen.add(o.review);
      const c = customers.find((x) => x.id === o.customerId);
      out.push({ id: o.id, text: o.review, name: c?.name.split(" ")[0] ?? "A customer", item: o.items[0]?.custom ? "Custom cake" : o.items[0]?.name ?? "Order" });
      if (out.length === 3) break;
    }
    return out;
  }, [orders, customers]);
  if (!reviews.length) return null;
  const [lead, ...others] = reviews;
  return (
    <section className="mx-auto mt-24 max-w-6xl px-4 sm:mt-32 sm:px-6">
      <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:gap-14">
        <Reveal>
          <Eyebrow>Straight from the WhatsApp replies</Eyebrow>
          <Quotes size={44} weight="fill" className="mt-6 text-brand-soft" aria-hidden />
          <blockquote className="mt-2 font-display text-3xl leading-snug text-ink sm:text-[2.6rem] sm:leading-[1.15]">{lead.text}</blockquote>
          <p className="mt-5 flex items-center gap-3 text-sm text-ink-2">
            <Stars value={5} /> <span className="font-semibold text-ink">{lead.name}</span> · {lead.item}
          </p>
        </Reveal>
        <div className="flex flex-col gap-4 md:pt-16">
          {others.map((r, i) => (
            <Reveal key={r.id} delay={0.08 * (i + 1)} className={cx("rounded-[1.6rem] border border-line bg-surface p-6", i === 1 && "md:ms-10")}>
              <Stars value={5} size={13} />
              <p className="mt-3 text-[15px] leading-relaxed text-ink">{r.text}</p>
              <p className="mt-3 text-[13px] text-ink-3">
                <span className="font-semibold text-ink-2">{r.name}</span> · {r.item}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const GRID = ["/img/cake-gold-drip.jpg", "/img/dessert-macarons.jpg", "/img/cupcake-mint-row.jpg", "/img/cake-floral.jpg", "/img/pastry-doughnut-pink.jpg", "/img/dessert-cake-parfait.jpg"];

function InstagramGrid() {
  return (
    <section className="mx-auto mt-24 max-w-6xl px-4 sm:mt-32 sm:px-6">
      <Reveal className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Eyebrow>@temmiebakes</Eyebrow>
          <h2 className="mt-2 font-display text-3xl text-ink sm:text-[2.6rem]">Fresh from the feed</h2>
        </div>
        <button type="button" onClick={() => openChannel("instagram")} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-bg transition-transform active:scale-[0.98]">
          <InstagramLogo size={18} aria-hidden /> Order on Instagram
        </button>
      </Reveal>
      <div className="mt-8 grid grid-cols-3 gap-1.5 sm:gap-3">
        {GRID.map((src, i) => (
          <Reveal key={src} delay={i * 0.04}>
            <button type="button" onClick={() => openChannel("instagram", "Hi dear, how much is this one? I saw it on your page")} className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-surface-2 sm:rounded-2xl" aria-label="Ask about this post on Instagram">
              <Image src={src} alt="" fill sizes="(min-width: 640px) 33vw, 32vw" className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.06]" />
              <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100" aria-hidden>
                <InstagramLogo size={28} />
              </span>
            </button>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
