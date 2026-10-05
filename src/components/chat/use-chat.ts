"use client";

import { useCallback, useRef, useState } from "react";
import { addUserMessage, applyReply, staffMessage } from "@/lib/engine";
import { sleep, thinkDelay } from "@/lib/hooks";
import { respond } from "@/lib/sim/assistant";
import { useDemo } from "@/lib/store";

/**
 * Drives one conversation: customer message → simulated thinking → streamed reply
 * from Tia with all side effects (customer, order, class seat, catering quote, handoff).
 * After a handoff Temmie replies, so the story never dead-ends.
 */
export function useChat(convId: string | undefined) {
  const [typing, setTyping] = useState<"ai" | "agent" | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const busy = useRef(false);
  const queue = useRef<string[]>([]);

  const send = useCallback(
    async function send(text: string, alreadyShown = false): Promise<void> {
      const t = text.trim();
      if (!convId || !t) return;
      const { run } = useDemo.getState();
      if (busy.current) {
        run((s) => addUserMessage(s, convId, t));
        queue.current.push(t);
        return;
      }
      busy.current = true;
      if (!alreadyShown) run((s) => addUserMessage(s, convId, t));
      try {
        const st = useDemo.getState();
        const cv = st.conversations.find((c) => c.id === convId);
        if (!cv) {
          queue.current = [];
          return;
        }
        if (cv.status !== "ai") {
          await sleep(900);
          setTyping("agent");
          await sleep(2200);
          setTyping(null);
          run((s) => staffMessage(s, convId, "Thanks, noted! Give me a moment to check with the kitchen and I'll come right back to you."));
          return;
        }
        const reply = respond(cv, t, { products: st.products, kb: st.kb, settings: st.assistant, orders: st.orders, courses: st.courses, cohorts: st.cohorts, capacity: st.dailyCapacity, now: Date.now() });
        await sleep(350);
        setTyping("ai");
        await sleep(thinkDelay(reply.text));
        setTyping(null);
        let aiId: string | undefined;
        setFreshId("__pending__");
        run((s) => {
          applyReply(s, convId, reply);
          const c = s.conversations.find((x) => x.id === convId)!;
          aiId = [...c.messages].reverse().find((m) => m.from === "ai")?.id;
        });
        setFreshId(aiId ?? null);
        if (reply.handoff) {
          await sleep(2600);
          setTyping("agent");
          await sleep(2400);
          setTyping(null);
          if (!useDemo.getState().conversations.some((c) => c.id === convId)) return;
          const first = cv.name.split(" ")[0];
          run((s) => staffMessage(s, convId, `Hi ${/visitor|guest/i.test(first) ? "there" : first}, Temmie here! I've read your chat with Tia. Let me sort this out for you personally.`));
        }
      } finally {
        busy.current = false;
        const next = queue.current.shift();
        if (next) void send(next, true);
      }
    },
    [convId],
  );

  return { send, typing, freshId };
}
