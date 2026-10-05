// Seed sanity check: `npx tsx scripts/seed-check.ts`
import { buildSeed } from "../src/lib/seed";
import { dayKey, pointsBooked } from "../src/lib/sim/pricing";

const d = buildSeed();
const now = Date.now();
const by = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((a, x) => ((a[f(x)] = (a[f(x)] ?? 0) + 1), a), {});
console.log({
  kb: Math.round(JSON.stringify(d).length / 1024),
  products: d.products.length,
  customers: d.customers.length,
  orders: d.orders.length,
  upcoming: d.orders.filter((o) => new Date(o.dueAt).getTime() > now).length,
  statuses: by(d.orders, (o) => o.status),
  channels: by(d.orders, (o) => o.channel),
  next7: Array.from({ length: 8 }, (_, i) => { const k = dayKey(now + i * 864e5); return `${k}:${pointsBooked(d.orders, k)}`; }).join(" "),
  revenue30d: d.orders.filter((o) => now - new Date(o.createdAt).getTime() < 30 * 864e5 && o.status !== "cancelled").reduce((s, o) => s + o.totalNGN, 0),
  events: d.events.length,
  outbound: d.outbound.length,
  quotes: d.quotes.length,
  enrollments: d.enrollments.length,
});
