"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { DemoData, OrderItem, Role } from "./types";

// All demo state lives here and is saved to localStorage. Engine functions
// (src/lib/engine.ts) are applied through `run`, which hands them an Immer draft.

export interface Prefs {
  role: Role;
  cart: OrderItem[];
}

export interface DemoStore extends DemoData, Prefs {
  ready: boolean;
  run: <T>(fn: (s: DemoStore) => T) => T;
  setPrefs: (p: Partial<Prefs>) => void;
  reset: () => Promise<void>;
  addToCart: (item: OrderItem) => void;
  updateCartQty: (index: number, qty: number) => void;
  clearCart: () => void;
}

// Persisting ~1MB of JSON on every click blocks the main thread; batch writes instead.
let pending: { name: string; value: string } | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const flush = () => {
  if (!pending) return;
  try {
    localStorage.setItem(pending.name, pending.value);
  } catch {
    /* quota or private mode: the demo keeps working in memory */
  }
  pending = null;
};
if (typeof window !== "undefined") window.addEventListener("pagehide", flush);
const debouncedLocalStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    pending = { name, value };
    clearTimeout(timer);
    timer = setTimeout(flush, 500);
  },
  removeItem: (name) => localStorage.removeItem(name),
};

const PREFS: Prefs = { role: "owner", cart: [] };
const EMPTY = {} as DemoData;

export const useDemo = create<DemoStore>()(
  persist(
    immer((set) => ({
      ...EMPTY,
      ...PREFS,
      ready: false,
      run: <T,>(fn: (s: DemoStore) => T) => {
        let out: T | undefined;
        set((s) => {
          out = fn(s as DemoStore);
        });
        return out as T;
      },
      setPrefs: (p) => set((s) => void Object.assign(s, p)),
      addToCart: (item) =>
        set((s) => {
          const same = !item.custom && s.cart.find((c) => c.productId && c.productId === item.productId);
          if (same) same.qty += item.qty;
          else s.cart.push(item);
        }),
      updateCartQty: (index, qty) =>
        set((s) => {
          if (qty <= 0) s.cart.splice(index, 1);
          else if (s.cart[index]) s.cart[index].qty = qty;
        }),
      clearCart: () => set((s) => void (s.cart = [])),
      reset: async () => {
        const { buildSeed } = await import("./seed"); // seed generator only loads when needed
        set(() => ({ ...buildSeed(), ...PREFS, ready: true }));
      },
    })),
    {
      name: "temmiebakes-demo",
      version: 1,
      storage: createJSONStorage(() => debouncedLocalStorage),
      skipHydration: true,
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { ready, run, setPrefs, reset, addToCart, updateCartQty, clearCart, ...rest } = s;
        return rest;
      },
      migrate: () => ({}) as DemoStore, // older shapes are discarded and re-seeded
    },
  ),
);

/** Rehydrate from localStorage, seeding a fresh demo when nothing is stored. */
export async function bootDemo() {
  try {
    await useDemo.persist.rehydrate();
  } catch {
    // storage unavailable (private mode): fall through to a fresh seed
  }
  const s = useDemo.getState();
  if (!s.seededAt || !s.products?.length) await s.reset();
  else useDemo.setState({ ready: true });
}
