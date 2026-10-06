"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChatCircleDots, DotsThreeVertical, InstagramLogo, Phone, SealCheck, VideoCamera, WhatsappLogo, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { startConversation } from "@/lib/engine";
import { useDemo } from "@/lib/store";
import type { ConvChannel } from "@/lib/types";
import { Composer, Thread } from "../chat/thread";
import { useChat } from "../chat/use-chat";
import { cx, Logo } from "../ui";

function useEscape(onClose: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
}

const STARTERS = ["How much is an 8-inch red velvet cake?", "Cupcakes for tomorrow, delivered to Lekki", "Do you run baking classes?", "Breakfast for 40 staff"];

type Open = { channel: ConvChannel; prefill?: string } | null;

/** Floating launchers: website chat, WhatsApp mock and Instagram DM mock, all driven by Tia. */
export function SiteAssistant() {
  const [open, setOpen] = useState<Open>(null);
  const [convs, setConvs] = useState<Partial<Record<ConvChannel, string>>>({});
  const run = useDemo((s) => s.run);
  const seededAt = useDemo((s) => s.seededAt);
  const [seed, setSeed] = useState(seededAt);
  if (seed !== seededAt) {
    setSeed(seededAt);
    setConvs({});
    setOpen(null);
  }

  const ensure = useCallback(
    (channel: ConvChannel) => {
      const existing = convs[channel];
      if (existing && useDemo.getState().conversations.some((c) => c.id === existing)) return;
      const n = useDemo.getState().conversations.length + 1;
      const id = run((s) =>
        startConversation(s, {
          channel,
          name: channel === "instagram" ? `@guest.${n}` : channel === "whatsapp" ? `WhatsApp +234 80${n % 10} 555 ${String(1000 + n).slice(-4)}` : `Visitor ${n}`,
          handle: channel === "instagram" ? `@guest.${n}` : channel === "whatsapp" ? `+234 80${n % 10} 555 ${String(1000 + n).slice(-4)}` : undefined,
        }),
      );
      setConvs((c) => ({ ...c, [channel]: id }));
    },
    [convs, run],
  );

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ channel?: ConvChannel; prefill?: string }>).detail ?? {};
      const channel = d.channel ?? "web";
      ensure(channel);
      setOpen({ channel, prefill: d.prefill });
    };
    window.addEventListener("open-channel", on);
    return () => window.removeEventListener("open-channel", on);
  }, [ensure]);

  const fire = (channel: ConvChannel) => window.dispatchEvent(new CustomEvent("open-channel", { detail: { channel } }));
  const close = useCallback(() => setOpen(null), []);

  return (
    <>
      <div className="no-print fixed bottom-4 end-4 z-50 flex flex-col items-end gap-2.5">
        <AnimatePresence>
          {!open && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="flex flex-col items-end gap-2.5">
              <button onClick={() => fire("instagram")} className="grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(45deg,#f9a03f,#e1306c,#833ab4)] text-white shadow-lift transition-transform hover:scale-105" aria-label="Message on Instagram (demo)">
                <InstagramLogo size={24} weight="bold" />
              </button>
              <button onClick={() => fire("whatsapp")} className="grid h-12 w-12 place-items-center rounded-full bg-wa text-white shadow-lift transition-transform hover:scale-105" aria-label="Order on WhatsApp (demo)">
                <WhatsappLogo size={24} weight="fill" />
              </button>
              <button onClick={() => fire("web")} className="pulse-ring inline-flex h-14 items-center gap-2 rounded-full bg-brand pe-5 ps-4 text-brand-ink shadow-lift transition-transform hover:scale-[1.03]">
                <ChatCircleDots size={24} weight="fill" />
                <span className="text-sm font-semibold">Ask Tia</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {open?.channel === "web" && <WebChat key="web" convId={convs.web} prefill={open.prefill} onClose={close} />}
        {open?.channel === "whatsapp" && <PhoneChat key="wa" kind="whatsapp" convId={convs.whatsapp} prefill={open.prefill} onClose={close} />}
        {open?.channel === "instagram" && <PhoneChat key="ig" kind="instagram" convId={convs.instagram} prefill={open.prefill} onClose={close} />}
      </AnimatePresence>
    </>
  );
}

function WebChat({ convId, onClose, prefill }: { convId?: string; onClose: () => void; prefill?: string }) {
  useEscape(onClose);
  const conv = useDemo((s) => s.conversations.find((c) => c.id === convId));
  const { send, typing, freshId } = useChat(convId);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className="no-print fixed inset-x-2 bottom-2 z-[65] flex h-[min(640px,calc(100dvh-16px))] flex-col overflow-hidden rounded-[1.6rem] border border-line bg-surface shadow-lift sm:inset-x-auto sm:bottom-4 sm:end-4 sm:w-[400px]"
      role="dialog"
      aria-label="Chat with Tia"
    >
      <div className="on-brand flex items-center gap-3 bg-brand px-4 py-3 text-brand-ink">
        <span className="relative">
          <Logo size={36} />
          <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-brand bg-[#5cbf8a]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Tia · Temmiebakes</p>
          <p className="text-xs">AI assistant · replies instantly, day or night</p>
        </div>
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Close chat">
          <X size={18} />
        </button>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4">
        <Thread conv={conv} typing={typing} freshId={freshId} variant="web" onQuick={send} intro={{ text: "Hi! I'm Tia, Temmiebakes' AI assistant. I can quote custom cakes, check delivery dates, take orders, book classes and plan corporate catering.", quick: prefill ? [prefill] : STARTERS }} />
      </div>
      <div className="border-t border-line p-3">
        <Composer onSend={send} placeholder="Ask about cakes, prices, delivery..." variant="web" autoFocus />
        <p className="mt-2 text-center text-[11px] text-ink-3">AI assistant · Temmie can take over at any time</p>
      </div>
    </motion.div>
  );
}

function PhoneChat({ kind, convId, onClose, prefill }: { kind: "whatsapp" | "instagram"; convId?: string; onClose: () => void; prefill?: string }) {
  useEscape(onClose);
  const conv = useDemo((s) => s.conversations.find((c) => c.id === convId));
  const { send, typing, freshId } = useChat(convId);
  const ig = kind === "instagram";
  return (
    <motion.div className="no-print fixed inset-0 z-[65] grid place-items-center bg-[#12060e]/55 p-3 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        initial={{ y: 30, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className={cx("relative flex h-[min(760px,calc(100dvh-24px))] w-[min(390px,100%)] flex-col overflow-hidden rounded-[2.6rem] border-[10px] border-[#111] shadow-lift", ig ? "bg-surface" : "bg-wa-bg")}
        role="dialog"
        aria-modal="true"
        aria-label={ig ? "Instagram DM demo" : "WhatsApp demo"}
      >
        <div className={cx("flex items-center justify-between px-5 pt-2 text-[11px] font-semibold", ig ? "bg-surface text-ink" : "on-brand bg-wa text-white")}>
          <span>9:41</span>
          <span className="h-5 w-24 rounded-full bg-[#111]" />
          <span>5G</span>
        </div>
        <div className={cx("flex items-center gap-2.5 px-3 pb-2.5 pt-1.5", ig ? "border-b border-line bg-surface text-ink" : "on-brand bg-wa text-white")}>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-black/10">
            <ArrowLeft size={20} />
          </button>
          <Logo size={34} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[15px] font-semibold leading-tight">
              {ig ? "temmiebakes" : "Temmiebakes"} <SealCheck size={15} weight="fill" className={ig ? "text-info" : "text-[#b9f5c8]"} />
            </p>
            <p className={cx("text-[11.5px]", ig ? "text-ink-3" : "text-white")}>{typing ? (typing === "ai" ? "typing..." : "Temmie is typing...") : ig ? "Dessert Shop · replies instantly" : "Business account · AI assisted"}</p>
          </div>
          {!ig && (
            <>
              <VideoCamera size={20} aria-hidden />
              <Phone size={19} aria-hidden />
            </>
          )}
          <DotsThreeVertical size={20} aria-hidden />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-3" style={ig ? undefined : { backgroundImage: "radial-gradient(rgb(0 0 0 / 0.035) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
          <div className={cx("mx-auto mb-3 w-fit rounded-lg px-3 py-1.5 text-center text-[11.5px]", ig ? "bg-surface-2 text-ink-2" : "bg-[#fdf4c5] text-[#54470f]")}>
            Simulated {ig ? "Instagram DM" : "WhatsApp Business"} chat · same AI as the website
          </div>
          <Thread conv={conv} typing={typing} freshId={freshId} variant={ig ? "web" : "whatsapp"} onQuick={send} intro={{ text: "", quick: [prefill ?? (ig ? "Hi dear, how much is the pink drip cake?" : "Abeg how much be 2 dozen cupcakes? Deliver to Ikeja tomorrow")] }} />
        </div>
        <div className={cx("px-2 pb-3 pt-1", ig ? "bg-surface" : "bg-wa-bg")}>
          <Composer onSend={send} placeholder={ig ? "Message..." : "Message"} variant={ig ? "web" : "whatsapp"} autoFocus />
        </div>
      </motion.div>
    </motion.div>
  );
}
