"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Reveals `text` word by word so simulated AI output feels like it streams.
 * Only animates when `active` is true; otherwise returns the full text.
 */
export function useStream(text: string, active: boolean, wordsPerTick = 2, tickMs = 32) {
  const reduce = useReducedMotion();
  const animate = active && !reduce;
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const [state, setState] = useState({ text, count: 0 });
  // Reset during render when the text changes (no effect needed)
  if (state.text !== text) setState({ text, count: 0 });

  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => {
      setState((s) => (s.count >= tokens.length ? s : { ...s, count: s.count + wordsPerTick * 2 }));
    }, tickMs);
    return () => clearInterval(id);
  }, [animate, tokens, wordsPerTick, tickMs]);

  if (!animate) return { shown: text, done: true };
  return { shown: tokens.slice(0, state.count).join(""), done: state.count >= tokens.length };
}

/** Simulated "thinking" latency, scaled to the length of the reply. */
export function thinkDelay(text = "") {
  return Math.min(2200, 650 + text.length * 4 + Math.random() * 400);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Re-render every `ms` so relative times ("2m ago") stay fresh. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
