"use client";

import Image from "next/image";
import { Checks, PaperPlaneRight, Robot, Sparkle } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { timeOnly } from "@/lib/format";
import { naira } from "@/lib/engine";
import { useStream } from "@/lib/hooks";
import { useDemo } from "@/lib/store";
import type { ChatMessage, Conversation } from "@/lib/types";
import { cx } from "../ui";

export type ThreadVariant = "web" | "whatsapp" | "dm" | "inbox";

export function Thread({
  conv,
  typing,
  freshId,
  variant,
  onQuick,
  intro,
  linkTarget = "_self",
}: {
  conv?: Conversation;
  typing: "ai" | "agent" | null;
  freshId: string | null;
  variant: ThreadVariant;
  onQuick: (t: string) => void;
  intro?: { text: string; quick: string[] };
  linkTarget?: "_self" | "_blank";
}) {
  const end = useRef<HTMLDivElement>(null);
  const msgs = conv?.messages ?? [];
  const last = msgs[msgs.length - 1];

  useEffect(() => {
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    end.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [msgs.length, typing]);

  const lastAi = [...msgs].reverse().find((m) => m.from === "ai");
  const showQuick = conv?.status === "ai" && lastAi && last?.id === lastAi.id && !typing;

  return (
    <div className="flex flex-col gap-2.5" role="log" aria-live="polite" aria-relevant="additions">
      {intro && !msgs.length && (
        <>
          {intro.text && <Bubble variant={variant} from="ai" text={intro.text} />}
          <QuickReplies items={intro.quick} onPick={onQuick} variant={variant} />
        </>
      )}
      {msgs.map((m) => (
        <Message key={m.id} m={m} variant={variant} fresh={m.id === freshId || (freshId === "__pending__" && m.id === lastAi?.id)} linkTarget={linkTarget} />
      ))}
      {typing && <Typing variant={variant} who={typing} />}
      {showQuick && lastAi.quickReplies?.length ? <QuickReplies items={lastAi.quickReplies} onPick={onQuick} variant={variant} /> : null}
      <div ref={end} />
    </div>
  );
}

function Message({ m, variant, fresh, linkTarget }: { m: ChatMessage; variant: ThreadVariant; fresh: boolean; linkTarget: "_self" | "_blank" }) {
  const { shown, done } = useStream(m.text, fresh && m.from === "ai");
  if (m.from === "system") {
    return (
      <div className="my-1 self-center rounded-full bg-accent-soft px-3 py-1 text-center text-[11.5px] font-medium text-accent">
        {m.text}
      </div>
    );
  }
  return (
    <>
      {done ? <Bubble variant={variant} from={m.from} text={shown} at={m.at} /> : (
        <>
          <div aria-hidden className="contents"><Bubble variant={variant} from={m.from} text={shown} at={m.at} /></div>
          <p className="sr-only">{m.text}</p>
        </>
      )}
      {m.productIds?.length && (done || !fresh) ? <ProductStrip ids={m.productIds} variant={variant} target={linkTarget} /> : null}
      {m.card && (done || !fresh) ? <CardView card={m.card} variant={variant} /> : null}
    </>
  );
}

function Bubble({ variant, from, text, at }: { variant: ThreadVariant; from: ChatMessage["from"]; text: string; at?: string }) {
  const mine = from === "user";
  const wa = variant === "whatsapp";
  return (
    <div className={cx("flex max-w-[86%] flex-col", mine ? "items-end self-end" : "items-start self-start")}>
      {!mine && variant !== "whatsapp" && (
        <span className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-ink-3">
          {from === "ai" ? (
            <>
              <Sparkle size={11} weight="fill" className="text-brand" /> Tia · AI assistant
            </>
          ) : (
            "Koret"
          )}
        </span>
      )}
      <div
        dir="auto"
        className={cx(
          "whitespace-pre-line px-3.5 py-2 text-[14px] leading-relaxed",
          wa
            ? mine
              ? "rounded-xl rounded-tr-sm bg-wa-out text-ink shadow-sm"
              : "rounded-xl rounded-tl-sm bg-surface text-ink shadow-sm"
            : mine
              ? "rounded-2xl rounded-br-md bg-brand text-brand-ink"
              : from === "agent"
                ? "rounded-2xl rounded-bl-md border border-accent/30 bg-accent-soft text-ink"
                : "rounded-2xl rounded-bl-md bg-surface-2 text-ink",
        )}
      >
        {wa && !mine && from === "agent" && <span className="mb-0.5 block text-[11px] font-semibold text-accent">Koret</span>}
        {text || " "}
        {wa && at && (
          <span className="ms-2 inline-flex translate-y-0.5 items-center gap-0.5 text-[10.5px] text-ink-3">
            {timeOnly(at)}
            {mine && <Checks size={13} className="text-info" />}
          </span>
        )}
      </div>
    </div>
  );
}

function ProductStrip({ ids, variant, target }: { ids: string[]; variant: ThreadVariant; target: "_self" | "_blank" }) {
  const products = useDemo((s) => s.products);
  const list = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  return (
    <div className={cx("no-scrollbar -mx-1 flex max-w-full gap-2 self-start overflow-x-auto px-1 pb-1", variant === "inbox" && "max-w-[86%]")}>
      {list.map((p) => (
        <a key={p!.id} href={`/menu/${p!.slug}`} target={target} className="w-40 shrink-0 overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-soft">
          <div className="relative h-24">
            <Image src={p!.image} alt={p!.name} fill sizes="160px" className="object-cover" />
          </div>
          <div className="p-2">
            <p className="tnum text-[13px] font-semibold text-ink">{naira(p!.priceNGN)}</p>
            <p className="truncate text-[12px] text-ink-2">{p!.name}</p>
            <p className="truncate text-[11px] text-ink-3">{p!.unit}</p>
          </div>
        </a>
      ))}
    </div>
  );
}

function CardView({ card, variant }: { card: NonNullable<ChatMessage["card"]>; variant: ThreadVariant }) {
  const order = useDemo((s) => (card.kind === "order" ? s.orders.find((o) => o.id === card.refId) : undefined));
  const cohort = useDemo((s) => (card.kind === "class" ? s.cohorts.find((c) => c.id === card.refId) : undefined));
  const course = useDemo((s) => s.courses.find((c) => c.id === cohort?.courseId));
  const quote = useDemo((s) => (card.kind === "catering" ? s.quotes.find((q) => q.id === card.refId) : undefined));
  const box = cx("w-64 self-start rounded-2xl border p-3 text-[13px]", variant === "whatsapp" ? "border-transparent bg-surface shadow-sm" : "border-brand/25 bg-brand-soft/60");
  if (order)
    return (
      <div className={box}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">Order {order.number}</p>
        <p className="mt-1 line-clamp-2 font-medium text-ink">{order.items.map((i) => (i.custom ? "Custom cake" : `${i.qty} × ${i.name}`)).join(", ")}</p>
        <p className="mt-1 text-ink-2">Total {naira(order.totalNGN)} · deposit {naira(order.depositNGN)}</p>
        <a href={`/track/${order.number}`} target="_blank" className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-full bg-brand text-[12.5px] font-semibold text-brand-ink">
          {order.paymentStatus === "unpaid" ? `Pay deposit ${naira(order.depositNGN)}` : "Track order"}
        </a>
      </div>
    );
  if (cohort && course)
    return (
      <div className={box}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">Seat reserved</p>
        <p className="mt-1 font-medium text-ink">{course.title}</p>
        <p className="mt-1 text-ink-2">Starts {new Date(cohort.startDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · deposit {naira(course.priceNGN / 2)}</p>
      </div>
    );
  if (quote)
    return (
      <div className={box}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">Catering quote {quote.number}</p>
        <p className="mt-1 font-medium text-ink">{quote.guests} guests · {naira(quote.totalNGN)}</p>
        <p className="mt-1 text-ink-2">Formal quote and invoice on the way by email</p>
      </div>
    );
  return null;
}

function QuickReplies({ items, onPick, variant }: { items: string[]; onPick: (t: string) => void; variant: ThreadVariant }) {
  return (
    <div className="flex flex-wrap gap-1.5 self-start">
      {items.map((q) => (
        <button
          key={q}
          dir="auto"
          onClick={() => onPick(q)}
          className={cx(
            "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
            variant === "whatsapp" ? "border-wa/40 bg-surface text-wa hover:bg-wa/10" : "border-brand/30 text-brand hover:bg-brand-soft",
          )}
        >
          {q}
        </button>
      ))}
    </div>
  );
}

function Typing({ variant, who }: { variant: ThreadVariant; who: "ai" | "agent" }) {
  return (
    <div className="flex items-center gap-2 self-start">
      <div className={cx("flex items-center gap-1 rounded-2xl px-3.5 py-3", variant === "whatsapp" ? "bg-surface shadow-sm" : "bg-surface-2")}>
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-3" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-3" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-3" />
      </div>
      <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
        {who === "ai" ? <Robot size={12} /> : null}
        {who === "ai" ? "thinking" : "agent typing"}
      </span>
    </div>
  );
}

export function Composer({ onSend, placeholder, variant, disabled, autoFocus }: { onSend: (t: string) => void; placeholder: string; variant: ThreadVariant; disabled?: boolean; autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = ref.current?.value ?? "";
        if (!v.trim()) return;
        onSend(v);
        ref.current!.value = "";
      }}
      className="flex items-center gap-2"
    >
      <label className="sr-only" htmlFor={`composer-${variant}`}>Message</label>
      <input
        id={`composer-${variant}`}
        ref={ref}
        dir="auto"
        data-autofocus
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        className={cx(
          "h-11 min-w-0 flex-1 px-4 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none",
          variant === "whatsapp" ? "rounded-full bg-surface focus-visible:ring-2 focus-visible:ring-wa" : "rounded-full border border-control bg-surface focus:border-brand",
        )}
      />
      <button type="submit" disabled={disabled} className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-50", variant === "whatsapp" ? "bg-wa" : "bg-brand")} aria-label="Send">
        <PaperPlaneRight size={18} weight="fill" className="rtl:-scale-x-100" />
      </button>
    </form>
  );
}
