"use client";

import { Bank, CheckCircle, CreditCard, LockSimple, SpinnerGap } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { naira } from "@/lib/engine";
import { sleep } from "@/lib/hooks";
import { Button, Modal, Segmented } from "../ui";

type Phase = "form" | "processing" | "done";

/** Simulated Paystack checkout. Nothing is charged; `onPaid` runs after a short processing state. */
export function PaystackModal({ open, onClose, amountNGN, email, label, onPaid }: { open: boolean; onClose: () => void; amountNGN: number; email?: string; label: string; onPaid: () => void }) {
  const [method, setMethod] = useState<"card" | "transfer">("card");
  const [phase, setPhase] = useState<Phase>("form");

  const close = () => {
    if (phase === "processing") return;
    setPhase("form");
    onClose();
  };

  const submit = async () => {
    setPhase("processing");
    await sleep(1500);
    setPhase("done");
    await sleep(700);
    onPaid();
    setPhase("form");
  };

  return (
    <Modal open={open} onClose={close} title={<span className="inline-flex items-center gap-2"><LockSimple size={16} aria-hidden /> Paystack checkout (demo)</span>}>
      <div className="flex items-start justify-between gap-4 rounded-2xl bg-surface-2 p-4">
        <div className="min-w-0">
          <p className="text-[13px] text-ink-3">{email || "customer@temmiebakes.ng"}</p>
          <p className="mt-1 text-sm text-ink-2">{label}</p>
        </div>
        <p className="tnum shrink-0 font-display text-2xl text-ink">{naira(amountNGN)}</p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {phase === "form" ? (
          <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-4">
            <Segmented
              value={method}
              onChange={setMethod}
              options={[
                { value: "card", label: <span className="inline-flex items-center gap-1.5"><CreditCard size={15} aria-hidden /> Card</span> },
                { value: "transfer", label: <span className="inline-flex items-center gap-1.5"><Bank size={15} aria-hidden /> Bank transfer</span> },
              ]}
            />
            {method === "card" ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="col-span-2 rounded-[10px] border border-line-strong px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wider text-ink-3">Card number</p>
                  <p className="tnum mt-0.5 text-sm text-ink">5399 8300 0000 4081</p>
                </div>
                <div className="rounded-[10px] border border-line-strong px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wider text-ink-3">Expiry</p>
                  <p className="tnum mt-0.5 text-sm text-ink">09 / 28</p>
                </div>
                <div className="rounded-[10px] border border-line-strong px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wider text-ink-3">CVV</p>
                  <p className="tnum mt-0.5 text-sm text-ink">•••</p>
                </div>
                <p className="col-span-2 text-xs text-ink-3">Test card prefilled. No money moves in this demo.</p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-line p-4">
                <p className="text-[13px] text-ink-3">Transfer exactly {naira(amountNGN)} to</p>
                <p className="tnum mt-2 font-display text-2xl tracking-wide text-ink">9920 418 337</p>
                <p className="mt-1 text-sm text-ink-2">Wema Bank · Paystack-Temmiebakes</p>
                <p className="mt-3 text-xs text-ink-3">Account expires in 30 minutes. Confirmation is automatic.</p>
              </div>
            )}
            <Button size="lg" className="mt-5 w-full" onClick={submit}>
              {method === "card" ? `Pay ${naira(amountNGN)}` : "I've sent the money"}
            </Button>
          </motion.div>
        ) : (
          <motion.div key={phase} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-10 text-center" role="status">
            {phase === "processing" ? (
              <>
                <SpinnerGap size={36} className="animate-spin text-brand" aria-hidden />
                <p className="text-sm font-medium text-ink">Processing payment</p>
                <p className="text-xs text-ink-3">Confirming with your bank</p>
              </>
            ) : (
              <>
                <CheckCircle size={40} weight="fill" className="text-ok" aria-hidden />
                <p className="text-sm font-semibold text-ink">Payment successful</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
