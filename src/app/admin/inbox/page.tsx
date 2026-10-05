"use client";

import Link from "next/link";
import { ArrowLeft, ArrowsClockwise, CheckCircle, Flag, HandPalm, PaperPlaneRight, Plus, Robot, UserCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { PageHead } from "@/components/app/app-shell";
import { CONV_CHANNEL } from "@/components/app/bits";
import { Thread } from "@/components/chat/thread";
import { useChat } from "@/components/chat/use-chat";
import { Badge, Button, Card, Empty, Segmented, cx } from "@/components/ui";
import { startConversation, staffMessage } from "@/lib/engine";
import { ago } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { ZONES } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Conversation, ConvChannel } from "@/lib/types";

type Filter = "all" | "handoff" | "ai" | "staff";

// Scripted first messages for "Simulate a DM", so the pitch can show Tia live on any channel.
const SAMPLES: { channel: ConvChannel; name: string; handle: string; text: string }[] = [
  { channel: "instagram", name: "Folake Adeyemi", handle: "@folakes_world", text: "Hi! How much for an 8 inch red velvet cake for my husband's birthday on Saturday? We're in Yaba" },
  { channel: "whatsapp", name: "Chinedu Okafor", handle: "+234 803 555 0192", text: "Good evening ma, abeg una get cupcakes for 24 people? Na for office party for Friday, Victoria Island" },
  { channel: "instagram", name: "Amaka Nwosu", handle: "@amaka.n", text: "When is your next buttercream class? I want to start my own cake business" },
  { channel: "whatsapp", name: "Tunde Bakare", handle: "+234 805 222 7781", text: "We need breakfast boxes for 60 staff on the 20th, for a strategy offsite in Ikeja. Can you quote?" },
  { channel: "instagram", name: "Ruth Eze", handle: "@ruthie.eze", text: "Do you do 3 tier wedding cakes? Wedding is in December" },
  { channel: "whatsapp", name: "Kemi Ojo", handle: "+234 816 449 0012", text: "Where is my order? It was supposed to arrive by 2pm" },
];

export default function Inbox() {
  const conversations = useDemo((s) => s.conversations);
  const run = useDemo((s) => s.run);
  const now = useNow(30000);
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState<string | undefined>(conversations[0]?.id);
  const [mobileThread, setMobileThread] = useState(false);
  const [sampleIdx, setSampleIdx] = useState(0);

  const list = conversations.filter((c) => filter === "all" || c.status === filter).sort((a, b) => (a.status === "handoff" ? -1 : 0) - (b.status === "handoff" ? -1 : 0) || (a.lastAt < b.lastAt ? 1 : -1));
  const conv = conversations.find((c) => c.id === sel);
  const counts = { handoff: conversations.filter((c) => c.status === "handoff").length, ai: conversations.filter((c) => c.status === "ai").length };

  const open = (id: string) => {
    setSel(id);
    setMobileThread(true);
  };

  const simulate = () => {
    const s = SAMPLES[sampleIdx % SAMPLES.length];
    setSampleIdx((i) => i + 1);
    let id = "";
    run((st) => {
      id = startConversation(st, { channel: s.channel, name: s.name, handle: s.handle });
    });
    setFilter("all");
    open(id);
    toast(`New ${CONV_CHANNEL[s.channel].label} message`, `${s.name}: Tia is replying`, "info");
    // the thread's hook picks this up once it is mounted with the new id
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("inbox-simulate", { detail: { id, text: s.text } })), 120);
  };

  return (
    <>
      <PageHead
        title="DMs & chats"
        sub="Instagram, WhatsApp and website chats in one place. Tia answers instantly, captures the order details and hands anything sensitive to you."
        actions={<Button onClick={simulate}><Plus size={16} weight="bold" /> Simulate a new DM</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_300px]">
        <Card className={cx("flex min-h-0 flex-col overflow-hidden lg:h-[calc(100dvh-210px)]", mobileThread && "hidden lg:flex")}>
          <div className="border-b border-line p-3">
            <Segmented<Filter>
              className="w-full overflow-x-auto"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "handoff", label: `Needs you${counts.handoff ? ` · ${counts.handoff}` : ""}` },
                { value: "ai", label: "Tia" },
                { value: "staff", label: "You" },
              ]}
            />
          </div>
          <ul className="scrollbar-thin flex-1 divide-y divide-line overflow-y-auto">
            {list.map((c) => <ConvRow key={c.id} c={c} active={c.id === sel} now={now} onOpen={() => open(c.id)} />)}
            {!list.length && <li className="p-6 text-sm text-ink-3">Nothing here right now.</li>}
          </ul>
        </Card>

        <div className={cx("min-w-0", !mobileThread && "hidden lg:block")}>
          {conv ? <ConvPane key={conv.id} conv={conv} onBack={() => setMobileThread(false)} /> : <Card className="grid h-full place-items-center p-10"><Empty title="Pick a conversation" sub="Or simulate a new DM to watch Tia work." /></Card>}
        </div>

        {conv && <div className="hidden xl:block"><Captured conv={conv} /></div>}
      </div>
    </>
  );
}

function ConvRow({ c, active, now, onOpen }: { c: Conversation; active: boolean; now: number; onOpen: () => void }) {
  const Ch = CONV_CHANNEL[c.channel];
  const last = c.messages[c.messages.length - 1];
  return (
    <li>
      <button onClick={onOpen} aria-current={active ? "true" : undefined} className={cx("flex w-full items-start gap-3 px-3.5 py-3 text-start transition-colors", active ? "bg-brand-soft/70" : "hover:bg-surface-2")}>
        <Ch.icon size={20} weight="fill" className={cx("mt-0.5 shrink-0", Ch.color)} aria-label={Ch.label} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">{c.name}</span>
            <span className="shrink-0 text-[11px] text-ink-3">{ago(c.lastAt, now)}</span>
          </span>
          <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">{last ? `${last.from === "ai" ? "Tia: " : last.from === "agent" ? "You: " : ""}${last.text}` : "New conversation"}</span>
          <span className="mt-1.5 flex items-center gap-1.5">
            <StatusPill status={c.status} />
            {c.unread > 0 && <span className="rounded-full bg-accent-bright px-1.5 text-[11px] font-semibold text-[#1b1407]">{c.unread}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function StatusPill({ status }: { status: Conversation["status"] }) {
  if (status === "handoff") return <Badge tone="brand">Needs you</Badge>;
  if (status === "ai") return <Badge tone="ok">Tia handling</Badge>;
  if (status === "staff") return <Badge tone="info">You</Badge>;
  return <Badge>Closed</Badge>;
}

function ConvPane({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const run = useDemo((s) => s.run);
  const { send, typing, freshId } = useChat(conv.id);
  const [as, setAs] = useState<"customer" | "temmie">(conv.status === "ai" ? "customer" : "temmie");
  const [text, setText] = useState("");
  const Ch = CONV_CHANNEL[conv.channel];

  // Simulated DMs from the header button arrive as a window event
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; text: string }>).detail;
      if (d.id === conv.id) void send(d.text);
    };
    window.addEventListener("inbox-simulate", h);
    return () => window.removeEventListener("inbox-simulate", h);
  }, [conv.id, send]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    if (as === "customer") void send(t);
    else {
      run((s) => staffMessage(s, conv.id, t));
      toast("Sent as Temmie", `${Ch.label} · ${conv.name}`, "ok");
    }
  };

  const takeOver = () => {
    run((s) => {
      const c = s.conversations.find((x) => x.id === conv.id);
      if (c) {
        c.status = "staff";
        c.unread = 0;
        c.messages.push({ id: `m-${c.messages.length}-${c.id}`, from: "system", text: "Temmie took over the chat", at: new Date().toISOString() });
      }
    });
    setAs("temmie");
  };
  const handBack = () => {
    run((s) => {
      const c = s.conversations.find((x) => x.id === conv.id);
      if (c) {
        c.status = "ai";
        c.messages.push({ id: `m-${c.messages.length}-${c.id}`, from: "system", text: "Handed back to Tia", at: new Date().toISOString() });
      }
    });
    setAs("customer");
    toast("Tia is back on this chat", undefined, "info");
  };
  const review = (v: "approved" | "flagged") => {
    run((s) => {
      const c = s.conversations.find((x) => x.id === conv.id);
      if (c) c.review = v;
    });
    toast(v === "approved" ? "Marked as a good answer" : "Flagged for Tia's training", v === "flagged" ? "It will show up under Tia settings." : undefined, v === "approved" ? "ok" : "info");
  };

  return (
    <Card className="flex flex-col overflow-hidden lg:h-[calc(100dvh-210px)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
        <button onClick={onBack} className="grid h-8 w-8 place-items-center rounded-full text-ink-2 hover:bg-surface-2 lg:hidden" aria-label="Back to conversations"><ArrowLeft size={18} /></button>
        <Ch.icon size={20} weight="fill" className={Ch.color} aria-label={Ch.label} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{conv.name}</p>
          <p className="truncate text-xs text-ink-3">{conv.handle ?? Ch.label}{conv.handoffReason && conv.status === "handoff" ? ` · ${conv.handoffReason}` : ""}</p>
        </div>
        {conv.status === "ai" ? (
          <Button size="sm" variant="outline" onClick={takeOver}><HandPalm size={15} /> Take over</Button>
        ) : (
          <Button size="sm" variant="outline" onClick={handBack}><Robot size={15} /> Hand back to Tia</Button>
        )}
      </div>

      <div className="scrollbar-thin min-h-[360px] flex-1 overflow-y-auto bg-bg/60 px-3 py-4 sm:px-5">
        <Thread conv={conv} typing={typing} freshId={freshId} variant="inbox" onQuick={(t) => void send(t)} />
      </div>

      <div className="border-t border-line p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-3">Type as</span>
          <div className="flex items-center gap-1 rounded-full bg-surface-2 p-0.5" role="group" aria-label="Send as">
            <button onClick={() => setAs("customer")} aria-pressed={as === "customer"} className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium", as === "customer" ? "bg-surface text-ink shadow-soft" : "text-ink-3")}><UserCircle size={14} /> Customer (demo)</button>
            <button onClick={() => setAs("temmie")} aria-pressed={as === "temmie"} className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium", as === "temmie" ? "bg-surface text-ink shadow-soft" : "text-ink-3")}><CheckCircle size={14} /> Temmie</button>
          </div>
          <span className="flex-1" />
          <button onClick={() => review("approved")} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-1", conv.review === "approved" ? "bg-ok-soft text-ok" : "text-ink-3 hover:bg-surface-2")}><CheckCircle size={14} /> Good answer</button>
          <button onClick={() => review("flagged")} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-1", conv.review === "flagged" ? "bg-warn-soft text-warn" : "text-ink-3 hover:bg-surface-2")}><Flag size={14} /> Flag</button>
        </div>
        <form onSubmit={submit} className="flex items-center gap-2">
          <label htmlFor="inbox-composer" className="sr-only">Message</label>
          <input
            id="inbox-composer"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={as === "customer" ? `Write as ${conv.name.split(" ")[0]}, Tia will reply` : "Reply as Temmie"}
            className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-4 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-brand"
          />
          <button type="submit" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-brand-ink active:scale-95" aria-label="Send"><PaperPlaneRight size={18} weight="fill" /></button>
        </form>
      </div>
    </Card>
  );
}

function Captured({ conv }: { conv: Conversation }) {
  const order = useDemo((s) => s.orders.find((o) => o.id === conv.orderId));
  const products = useDemo((s) => s.products);
  const d = conv.draft;
  const zone = ZONES.find((z) => z.id === d.zoneId);
  const product = products.find((p) => p.id === d.productId);
  const rows: [string, string | undefined][] = [
    ["Name", d.name],
    ["Phone", d.phone],
    ["Occasion", d.occasion],
    ["Cake", d.cake ? [d.cake.tiers && d.cake.tiers > 1 ? `${d.cake.tiers}-tier` : "", d.cake.sizeInches ? `${d.cake.sizeInches}"` : "", d.cake.flavour?.toLowerCase(), "cake"].filter(Boolean).join(" ") : undefined],
    ["Product", product ? `${d.qty ?? 1} × ${product.name}` : undefined],
    ["Date", d.date ? new Date(d.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" }) : undefined],
    ["Delivery", zone ? `${zone.name}` : d.fulfilment === "pickup" ? "Pickup in Ikeja" : undefined],
    ["Guests", d.guests ? String(d.guests) : undefined],
  ];
  const filled = rows.filter(([, v]) => v);
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3"><ArrowsClockwise size={13} className="text-brand" /> Captured by Tia</p>
      {filled.length ? (
        <dl className="mt-3 grid gap-2 text-[13px]">
          {filled.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[80px_1fr] gap-2">
              <dt className="text-ink-3">{k}</dt>
              <dd className="font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="mt-3 text-sm text-ink-3">Details appear here as the customer types: size, flavour, date, area and contact.</p>}
      {order && (
        <Link href={`/admin/orders/${order.id}`} className="mt-4 block rounded-xl border border-brand/25 bg-brand-soft/60 p-3 text-[13px]">
          <span className="block font-semibold text-ink">Order {order.number}</span>
          <span className="block text-ink-3">Created by Tia. Open the order</span>
        </Link>
      )}
      {conv.customerId && <Link href={`/admin/customers/${conv.customerId}`} className="mt-3 inline-block text-xs font-medium text-brand underline">Customer profile</Link>}
    </Card>
  );
}
