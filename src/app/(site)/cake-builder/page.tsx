"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CalendarCheck, Check, Cookie, Fire, ShoppingBag, Storefront, Truck, Users, WhatsappLogo } from "@phosphor-icons/react";
import { Suspense, useMemo, useState } from "react";
import { CAKE_PHOTOS, Eyebrow, openChannel, prettyDay } from "@/components/site/site-bits";
import { Button, cx, Field, Input, Segmented, Select, Skeleton } from "@/components/ui";
import { naira } from "@/lib/engine";
import { useNow } from "@/lib/hooks";
import { dayKey, DECORATION_LABEL, DEFAULT_CAKE, depositFor, describeCake, earliestSlot, FILLINGS, FINISH_LABEL, FLAVOURS, pointsBooked, quoteCake, SERVINGS, SIZES, ZONES } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { CakeConfig, Decoration, Finish, Product, Shape } from "@/lib/types";

const EASE = [0.16, 1, 0.3, 1] as const;
const DAY = 86400000;
const STEPS = ["Shape & size", "Flavour", "Finish", "Make it yours", "Date & delivery"];
const SHAPES: Shape[] = ["round", "square", "heart"];
const FINISHES = Object.keys(FINISH_LABEL) as Finish[];
const DECORATIONS = Object.keys(DECORATION_LABEL) as Decoration[];
const FINISH_NOTE: Record<Finish, string> = { buttercream: "Smooth or textured, our classic", "whipped-cream": "Light and less sweet", naked: "Rustic, sponge peeks through", drip: "Glossy ganache drip", fondant: "Sharp, sculpted, themed" };

/** Approximate a signature cake as a builder config. */
function presetFor(p?: Product): CakeConfig {
  if (!p) return DEFAULT_CAKE;
  const t = `${p.name} ${p.description}`.toLowerCase();
  const flavour = t.includes("red velvet") ? "Red velvet" : /chocolate|black forest/.test(p.name.toLowerCase()) ? "Rich chocolate" : /funfetti|sprinkle/.test(t) ? "Funfetti" : /orange|lemon/.test(t) ? "Lemon & blueberry" : "Vanilla bean";
  const filling = /ganache/.test(t) ? "Chocolate ganache" : /cream cheese/.test(t) ? "Cream cheese" : /strawberr|berry|cherr/.test(t) ? "Strawberry compote" : /caramel/.test(t) ? "Salted caramel" : "Vanilla buttercream";
  const finish: Finish = /drip/.test(t) ? "drip" : /naked/.test(t) ? "naked" : /whipped cream|black forest/.test(t) ? "whipped-cream" : /fondant|wedding/.test(t) ? "fondant" : "buttercream";
  const decoration: Decoration = p.tags.includes("premium") || p.tags.includes("wedding") ? "premium" : p.tags.some((x) => ["kids", "new", "instagram-favourite"].includes(x)) ? "themed" : "simple";
  const wedding = p.tags.includes("wedding");
  return { ...DEFAULT_CAKE, shape: "round", sizeInches: wedding ? 10 : 8, tiers: wedding ? 2 : 1, flavour, filling, finish, decoration, colours: "As pictured", message: "", referencePhoto: p.image };
}

const previewFor = (c: CakeConfig) =>
  c.referencePhoto ?? (c.tiers > 1 ? "/img/cake-wedding-berry.jpg" : c.finish === "drip" ? "/img/cake-chocolate-drip.jpg" : c.finish === "fondant" ? "/img/cake-kids-emoji.jpg" : c.finish === "naked" ? "/img/cake-floral.jpg" : c.finish === "whipped-cream" ? "/img/cake-black-forest.jpg" : "/img/cake-piping.jpg");

export default function CakeBuilderPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-16"><Skeleton className="h-[70dvh] rounded-[2rem]" /></div>}>
      <Builder />
    </Suspense>
  );
}

function Builder() {
  const params = useSearchParams();
  const baseSlug = params.get("base");
  const base = useDemo((s) => (baseSlug ? s.products.find((p) => p.slug === baseSlug) : undefined));
  const orders = useDemo((s) => s.orders);
  const capacity = useDemo((s) => s.dailyCapacity);
  const depositPct = useDemo((s) => s.assistant.depositPct);
  const addToCart = useDemo((s) => s.addToCart);
  const now = useNow(60000);

  const [cfg, setCfg] = useState<CakeConfig>(() => presetFor(base));
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [date, setDate] = useState("");
  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">("delivery");
  const [zoneId, setZoneId] = useState("ikeja");
  const [added, setAdded] = useState(false);

  const set = <K extends keyof CakeConfig>(k: K, v: CakeConfig[K]) => {
    setCfg((c) => ({ ...c, [k]: v }));
    setAdded(false);
  };
  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
  };

  const q = quoteCake(cfg);
  const earliest = useMemo(() => earliestSlot(orders, capacity, q.leadDays, q.ovenPoints, now), [orders, capacity, q.leadDays, q.ovenPoints, now]);
  const leadMin = dayKey(now + q.leadDays * DAY);
  const chosen = date || earliest;
  const booked = pointsBooked(orders, chosen);
  const sunday = new Date(`${chosen}T12:00:00Z`).getUTCDay() === 0;
  const problem = chosen < leadMin ? `This design needs ${q.leadDays} days notice.` : sunday ? "The kitchen is closed on Sundays." : booked + q.ovenPoints > capacity ? `${prettyDay(chosen)} is fully booked.` : null;
  const zone = ZONES.find((z) => z.id === zoneId) ?? ZONES[0];
  const fee = fulfilment === "delivery" ? zone.feeNGN : 0;
  const fulfilLabel = fulfilment === "delivery" ? `delivery to ${zone.name}` : "pickup from the Ikeja studio";

  const addToBasket = () => {
    if (problem) return;
    addToCart({
      name: `Custom ${cfg.tiers > 1 ? `${cfg.tiers}-tier ` : ""}${cfg.sizeInches}" ${cfg.flavour.toLowerCase()} cake`,
      qty: 1,
      unitPriceNGN: q.totalNGN,
      custom: cfg,
      notes: `Due ${prettyDay(chosen, true)} (${chosen}) · ${fulfilment === "delivery" ? `Delivery to ${zone.name}` : "Pickup from Ikeja studio"}${cfg.message ? ` · Message: "${cfg.message}"` : ""}`,
    });
    setAdded(true);
    toast("Custom cake added to basket", `${naira(q.totalNGN)} · due ${prettyDay(chosen)}`);
  };

  const sendToTia = () =>
    openChannel(
      "whatsapp",
      `Hi Tia, I designed a cake on your website: ${describeCake(cfg)}. Colours: ${cfg.colours || "your choice"}.${cfg.message ? ` Message: "${cfg.message}".` : ""} For ${prettyDay(chosen, true)}, ${fulfilLabel}. Builder quote ${naira(q.totalNGN)}. Can you confirm?`,
    );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
      <header className="max-w-2xl">
        <Eyebrow>Custom cake builder</Eyebrow>
        <h1 className="mt-3 font-display text-[2.3rem] leading-[1.05] text-ink sm:text-6xl">
          Build your cake, <span className="italic text-brand">price it live</span>
        </h1>
        {base ? (
          <p className="mt-4 text-[15px] text-ink-2">
            Starting from our <Link href={`/menu/${base.slug}`} className="font-medium text-brand underline-offset-2 hover:underline">{base.name}</Link>. Change anything you like.
          </p>
        ) : (
          <p className="mt-4 text-[15px] text-ink-2">Five quick steps. The quote and the earliest date update as you choose.</p>
        )}
      </header>

      {/* Mobile running total */}
      <div className="sticky top-[4.5rem] z-30 -mx-4 mt-6 flex items-center justify-between gap-3 border-y border-line bg-bg/90 px-4 py-2.5 backdrop-blur-xl lg:hidden">
        <span className="text-[13px] text-ink-2">
          Serves {q.servings} · ready {prettyDay(chosen)}
        </span>
        <a href="#summary" className="tnum inline-flex items-center gap-1.5 font-display text-lg text-brand">
          {naira(q.totalNGN)} <ArrowRight size={14} aria-hidden className="rotate-90" />
        </a>
      </div>

      <div className="mt-6 grid gap-8 lg:mt-10 lg:grid-cols-[1fr_380px] lg:gap-10">
        <div className="min-w-0">
          <ol className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Builder steps">
            {STEPS.map((s, i) => (
              <li key={s} className="shrink-0">
                <button type="button" onClick={() => go(i)} aria-current={i === step ? "step" : undefined} className={cx("inline-flex h-9 items-center gap-2 rounded-full pe-4 ps-1.5 text-[13px] font-medium transition-colors", i === step ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2")}>
                  <span className={cx("grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold", i === step ? "bg-bg text-ink" : i < step ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-2")}>{i < step ? <Check size={12} weight="bold" aria-hidden /> : i + 1}</span>
                  {s}
                </button>
              </li>
            ))}
          </ol>

          <div className="relative mt-6 overflow-hidden">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.section key={step} custom={dir} initial={{ opacity: 0, x: dir * 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -28 }} transition={{ duration: 0.4, ease: EASE }} aria-label={STEPS[step]}>
                {step === 0 && (
                  <div className="flex flex-col gap-8">
                    <Group title="Shape">
                      <div className="grid grid-cols-3 gap-3">
                        {SHAPES.map((s) => (
                          <Option key={s} on={cfg.shape === s} onClick={() => set("shape", s)} title={s[0].toUpperCase() + s.slice(1)} sub={s === "round" ? "Included" : s === "square" ? "+10%" : "+15%"} icon={<ShapeIcon shape={s} />} />
                        ))}
                      </div>
                    </Group>
                    <Group title="Size" hint="Bottom tier; upper tiers step down 2 inches">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {SIZES.map((z) => (
                          <Option key={z} on={cfg.sizeInches === z} onClick={() => set("sizeInches", z)} title={`${z} inch`} sub={`Serves about ${SERVINGS[z]}`} />
                        ))}
                      </div>
                    </Group>
                    <Group title="Tiers">
                      <div className="grid grid-cols-3 gap-3">
                        {([1, 2, 3] as const).map((t) => (
                          <Option key={t} on={cfg.tiers === t} onClick={() => set("tiers", t)} title={t === 1 ? "Single" : `${t} tiers`} sub={t === 1 ? "Classic" : `+2 days notice`} />
                        ))}
                      </div>
                    </Group>
                  </div>
                )}

                {step === 1 && (
                  <div className="flex flex-col gap-8">
                    <Group title="Sponge flavour">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {FLAVOURS.map((f) => (
                          <Option key={f.name} on={cfg.flavour === f.name} onClick={() => set("flavour", f.name)} title={f.name} sub={`${f.extra ? `+${naira(f.extra)} per tier` : "Included"}${f.note ? ` · ${f.note}` : ""}`} row />
                        ))}
                      </div>
                    </Group>
                    <Group title="Filling">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {FILLINGS.map((f) => (
                          <Option key={f.name} on={cfg.filling === f.name} onClick={() => set("filling", f.name)} title={f.name} sub={f.extra ? `+${naira(f.extra)} per tier` : "Included"} row />
                        ))}
                      </div>
                    </Group>
                  </div>
                )}

                {step === 2 && (
                  <div className="flex flex-col gap-8">
                    <Group title="Finish">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {FINISHES.map((f) => (
                          <Option key={f} on={cfg.finish === f} onClick={() => set("finish", f)} title={FINISH_LABEL[f]} sub={FINISH_NOTE[f]} row />
                        ))}
                      </div>
                    </Group>
                    <Group title="Decoration">
                      <div className="grid grid-cols-1 gap-3">
                        {DECORATIONS.map((d) => {
                          const [name, rest] = DECORATION_LABEL[d].split(" (");
                          return <Option key={d} on={cfg.decoration === d} onClick={() => set("decoration", d)} title={name} sub={rest?.replace(")", "")} row />;
                        })}
                      </div>
                    </Group>
                  </div>
                )}

                {step === 3 && (
                  <div className="flex flex-col gap-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Colours" hint="e.g. Lilac and silver, or match the invite">
                        {(id) => <Input id={id} value={cfg.colours} onChange={(e) => set("colours", e.target.value)} maxLength={60} />}
                      </Field>
                      <Field label="Message on the cake" hint={`${cfg.message.length}/40 characters`}>
                        {(id) => <Input id={id} value={cfg.message} onChange={(e) => set("message", e.target.value)} maxLength={40} placeholder="Happy 30th, Tolu" />}
                      </Field>
                    </div>
                    <Group title="Reference photo" hint="Optional. Pick one for inspiration and we will match the mood.">
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
                        {CAKE_PHOTOS.map((src) => {
                          const on = cfg.referencePhoto === src;
                          return (
                            <button key={src} type="button" aria-pressed={on} aria-label={`Use ${src.split("/").pop()?.replace(".jpg", "").replace(/-/g, " ")} as reference`} onClick={() => set("referencePhoto", on ? undefined : src)} className={cx("relative aspect-square overflow-hidden rounded-2xl bg-surface-2 ring-offset-2 ring-offset-bg transition", on ? "ring-2 ring-brand" : "opacity-90 hover:opacity-100")}>
                              <Image src={src} alt="" fill sizes="(min-width: 640px) 160px, 30vw" className="object-cover" />
                              {on && (
                                <span className="absolute end-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-brand text-brand-ink">
                                  <Check size={13} weight="bold" aria-hidden />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </Group>
                  </div>
                )}

                {step === 4 && (
                  <div className="flex flex-col gap-7">
                    <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr] sm:items-start">
                      <Field label="Date needed" error={problem ?? undefined} hint={`Earliest available: ${prettyDay(earliest, true)}`}>
                        {(id) => <Input id={id} type="date" min={earliest} value={chosen} onChange={(e) => (setDate(e.target.value), setAdded(false))} />}
                      </Field>
                      <CapacityMeter dayLabel={prettyDay(chosen, true)} booked={booked} points={q.ovenPoints} capacity={capacity} ok={!problem} />
                    </div>
                    {problem && (
                      <button type="button" onClick={() => setDate(earliest)} className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand">
                        <CalendarCheck size={16} aria-hidden /> Use {prettyDay(earliest, true)} instead
                      </button>
                    )}
                    <Group title="How would you like it?">
                      <Segmented
                        value={fulfilment}
                        onChange={setFulfilment}
                        options={[
                          { value: "delivery", label: <span className="inline-flex items-center gap-1.5"><Truck size={15} aria-hidden /> Delivery</span> },
                          { value: "pickup", label: <span className="inline-flex items-center gap-1.5"><Storefront size={15} aria-hidden /> Pickup in Ikeja</span> },
                        ]}
                      />
                    </Group>
                    {fulfilment === "delivery" ? (
                      <Field label="Delivery area" hint={`About ${zone.etaMins} minutes from our kitchen`} className="sm:max-w-sm">
                        {(id) => (
                          <Select id={id} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                            {ZONES.map((z) => (
                              <option key={z.id} value={z.id}>
                                {z.name} · {naira(z.feeNGN)}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                    ) : (
                      <p className="text-sm text-ink-2">Collect from our Ikeja studio between 10am and 6pm. We will send directions on WhatsApp.</p>
                    )}
                  </div>
                )}
              </motion.section>
            </AnimatePresence>
          </div>

          <div className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-5">
            <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}>
              <ArrowLeft size={16} aria-hidden /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => go(step + 1)}>
                Next: {STEPS[step + 1]} <ArrowRight size={16} aria-hidden />
              </Button>
            ) : (
              <Button onClick={addToBasket} disabled={!!problem}>
                <ShoppingBag size={16} aria-hidden /> Add to basket
              </Button>
            )}
          </div>
        </div>

        <aside id="summary" className="scroll-mt-28 lg:sticky lg:top-24 lg:self-start" aria-label="Your cake summary">
          <div className="overflow-hidden rounded-[1.6rem] border border-line bg-surface shadow-soft">
            <div className="relative aspect-[16/10] bg-surface-2">
              <AnimatePresence initial={false}>
                <motion.div key={previewFor(cfg)} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                  <Image src={previewFor(cfg)} alt="" fill sizes="380px" className="object-cover" />
                </motion.div>
              </AnimatePresence>
              <span className="absolute start-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11.5px] font-medium text-ink backdrop-blur">{cfg.referencePhoto ? "Your reference" : "Similar style"}</span>
            </div>
            <div className="p-5">
              <p className="font-display text-xl leading-snug text-ink first-letter:uppercase">{describeCake(cfg)}</p>
              {(cfg.colours || cfg.message) && (
                <p className="mt-1.5 text-[13px] text-ink-3">
                  {cfg.colours}
                  {cfg.colours && cfg.message ? " · " : ""}
                  {cfg.message && <>&ldquo;{cfg.message}&rdquo;</>}
                </p>
              )}
              <ul className="mt-4 divide-y divide-line text-sm">
                {q.lines.map((l) => (
                  <li key={l.label} className="flex justify-between gap-3 py-2">
                    <span className="text-ink-2 first-letter:uppercase">{l.label}</span>
                    <span className="tnum shrink-0 text-ink">{naira(l.amountNGN)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-end justify-between gap-3 border-t border-line-strong pt-3">
                <span className="text-sm font-medium text-ink">Cake total</span>
                <motion.span key={q.totalNGN} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="tnum font-display text-3xl text-brand">
                  {naira(q.totalNGN)}
                </motion.span>
              </div>
              <p className="mt-1 text-end text-[12px] text-ink-3">
                {fee ? `+ ${naira(fee)} delivery to ${zone.name} at checkout` : "Free pickup in Ikeja"} · {depositPct}% deposit {naira(depositFor(q.totalNGN + fee, depositPct))}
              </p>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-[13px]">
                <Fact icon={<Users size={15} aria-hidden />} label="Serves" value={`About ${q.servings}`} />
                <Fact icon={<CalendarCheck size={15} aria-hidden />} label="Notice" value={`${q.leadDays} days`} />
                <Fact icon={<Fire size={15} aria-hidden />} label="Oven points" value={String(q.ovenPoints)} />
                <Fact icon={<Cookie size={15} aria-hidden />} label="Earliest" value={prettyDay(earliest)} />
              </dl>

              <div className={cx("mt-5 rounded-2xl px-4 py-3 text-[13px]", problem ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok")} role="status">
                {problem ? `${problem} Earliest free date is ${prettyDay(earliest, true)}.` : `Booked for ${prettyDay(chosen, true)}, ${fulfilLabel}.`}
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {added ? (
                  <Link href="/checkout" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-bg">
                    In your basket · Go to checkout <ArrowRight size={16} aria-hidden />
                  </Link>
                ) : (
                  <Button size="lg" onClick={addToBasket} disabled={!!problem}>
                    <ShoppingBag size={18} aria-hidden /> Add to basket
                  </Button>
                )}
                <Button size="lg" variant="outline" onClick={sendToTia}>
                  <WhatsappLogo size={18} aria-hidden /> Send to Tia on WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="font-display text-xl text-ink">{title}</legend>
      {hint && <p className="mt-0.5 text-[13px] text-ink-3">{hint}</p>}
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

function Option({ on, onClick, title, sub, icon, row }: { on: boolean; onClick: () => void; title: string; sub?: string; icon?: React.ReactNode; row?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "relative flex w-full rounded-2xl border p-4 text-start transition-[border-color,background-color,transform] duration-200 active:scale-[0.99]",
        row ? "items-center gap-3" : "flex-col items-start gap-2",
        on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      {icon && <span className={cx(on ? "text-brand" : "text-ink-3")}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold text-ink">{title}</span>
        {sub && <span className="mt-0.5 block text-[12.5px] text-ink-3">{sub}</span>}
      </span>
      <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors", row ? "" : "absolute end-3 top-3", on ? "border-brand bg-brand text-brand-ink" : "border-line-strong")} aria-hidden>
        {on && <Check size={11} weight="bold" />}
      </span>
    </button>
  );
}

function ShapeIcon({ shape }: { shape: Shape }) {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      {shape === "round" && <circle cx="17" cy="17" r="12" />}
      {shape === "square" && <rect x="5.5" y="5.5" width="23" height="23" rx="3" />}
      {shape === "heart" && <path d="M17 28s-11-6.6-11-14a6 6 0 0 1 11-3.3A6 6 0 0 1 28 14c0 7.4-11 14-11 14z" />}
    </svg>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-ink-3">
        {icon} {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
    </div>
  );
}

function CapacityMeter({ dayLabel, booked, points, capacity, ok }: { dayLabel: string; booked: number; points: number; capacity: number; ok: boolean }) {
  const used = Math.min(1, booked / capacity);
  const mine = Math.max(0, Math.min(1 - used, points / capacity));
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[13px] font-medium text-ink-2">Kitchen capacity on {dayLabel}</p>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${booked} of ${capacity} oven points booked; your cake needs ${points}`}>
        <motion.span className="h-full bg-ink-3" animate={{ width: `${used * 100}%` }} transition={{ duration: 0.5, ease: EASE }} />
        <motion.span className={cx("h-full", ok ? "bg-brand" : "bg-bad")} animate={{ width: `${mine * 100}%` }} transition={{ duration: 0.5, ease: EASE }} />
      </div>
      <p className="tnum mt-2 text-[12.5px] text-ink-3">
        {booked} of {capacity} oven points booked · your cake needs {points}
      </p>
    </div>
  );
}

