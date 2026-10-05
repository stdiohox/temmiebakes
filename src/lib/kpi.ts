import { dayKey, pointsBooked } from "./sim/pricing";
import type { Category, Channel, DemoData } from "./types";

// Owner KPIs, computed live from the demo data.

const DAY = 86400000;
const WEEK = 7 * DAY;
const t = (iso: string) => new Date(iso).getTime();

export function kpis(d: Pick<DemoData, "orders" | "customers" | "events" | "products" | "enrollments" | "quotes" | "goLiveAt" | "dailyCapacity" | "conversations">, now = Date.now()) {
  const goLive = t(d.goLiveAt);
  const live = d.orders.filter((o) => o.status !== "cancelled");
  const sold = live.filter((o) => !["enquiry", "quoted"].includes(o.status));
  const in30 = (iso: string) => now - t(iso) < 30 * DAY && t(iso) <= now;
  const prev30 = (iso: string) => now - t(iso) >= 30 * DAY && now - t(iso) < 60 * DAY;

  const rev = (from: (iso: string) => boolean) => sold.filter((o) => from(o.dueAt)).reduce((s, o) => s + o.totalNGN, 0);
  const academy30 = d.enrollments.filter((e) => in30(e.createdAt)).reduce((s, e) => s + e.paidNGN, 0);
  const revenue30 = rev(in30) + academy30;
  const revenuePrev = rev(prev30) + d.enrollments.filter((e) => prev30(e.createdAt)).reduce((s, e) => s + e.paidNGN, 0);
  const orders30 = sold.filter((o) => in30(o.dueAt));
  const aov = orders30.length ? orders30.reduce((s, o) => s + o.totalNGN, 0) / orders30.length : 0;

  // response time: customers who enquired in the window
  const resp = (from: number, to: number) => {
    const xs = d.customers.filter((c) => t(c.createdAt) >= from && t(c.createdAt) < to && c.firstResponseMins !== undefined).map((c) => c.firstResponseMins!);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  };
  const responseNow = resp(now - 30 * DAY, now + 1);
  const responseBefore = resp(0, goLive);

  // enquiry → paid order conversion
  const conv = (from: number, to: number) => {
    const xs = d.orders.filter((o) => t(o.createdAt) >= from && t(o.createdAt) < to && t(o.dueAt) < now + 3 * DAY);
    const won = xs.filter((o) => o.paymentStatus !== "unpaid" && o.status !== "cancelled").length;
    return xs.length ? won / xs.length : 0;
  };
  const conversionNow = conv(goLive, now);
  const conversionBefore = conv(0, goLive);

  const upcoming = live.filter((o) => t(o.dueAt) > now);
  const outstanding = upcoming.reduce((s, o) => s + Math.max(0, o.totalNGN - o.paidNGN), 0);
  const unpaidQuotes = live.filter((o) => o.status === "quoted" || o.status === "enquiry").reduce((s, o) => s + o.totalNGN, 0);

  const next7 = Array.from({ length: 7 }, (_, i) => dayKey(now + i * DAY)).filter((k) => new Date(k + "T12:00:00Z").getUTCDay() !== 0);
  const utilisation = next7.reduce((s, k) => s + pointsBooked(d.orders, k), 0) / (next7.length * d.dailyCapacity);

  const custOrders = new Map<string, number>();
  sold.forEach((o) => custOrders.set(o.customerId, (custOrders.get(o.customerId) ?? 0) + 1));
  const buyers = [...custOrders.values()];
  const repeatRate = buyers.length ? buyers.filter((n) => n >= 2).length / buyers.length : 0;

  const delivered = (from: number, to: number) => d.orders.filter((o) => o.status === "delivered" && t(o.dueAt) >= from && t(o.dueAt) < to);
  const onTime = (xs: ReturnType<typeof delivered>) => (xs.length ? xs.filter((o) => !o.lateMins).length / xs.length : 0);
  const onTimeNow = onTime(delivered(now - 30 * DAY, now));
  const onTimeBefore = onTime(delivered(0, goLive));

  const rated = d.orders.filter((o) => o.rating);
  const rating = rated.length ? rated.reduce((s, o) => s + o.rating!, 0) / rated.length : 0;

  // margin: product cost, custom cakes at 36% ingredient + packaging cost
  const cost = (o: (typeof sold)[number]) => o.items.reduce((s, i) => s + i.qty * (i.custom ? i.unitPriceNGN * 0.36 : d.products.find((p) => p.id === i.productId)?.costNGN ?? i.unitPriceNGN * 0.4), 0);
  const cost30 = orders30.reduce((s, o) => s + cost(o), 0);
  const goods30 = orders30.reduce((s, o) => s + o.subtotalNGN, 0);
  const margin = goods30 ? 1 - cost30 / goods30 : 0;

  const mins = d.events.filter((e) => now - t(e.at) < 28 * DAY).reduce((s, e) => s + e.minutesSaved, 0);
  const hoursSavedWeek = mins / 60 / 4;
  const influenced = d.events.filter((e) => now - t(e.at) < 30 * DAY).reduce((s, e) => s + (e.revenueNGN ?? 0), 0) + orders30.filter((o) => o.assistedByAI).reduce((s, o) => s + o.totalNGN, 0);
  const aiShare = orders30.length ? orders30.filter((o) => o.assistedByAI).length / orders30.length : 0;

  const byChannel = (["instagram", "whatsapp", "web", "corporate", "walk-in", "phone"] as Channel[]).map((c) => ({ channel: c, value: orders30.filter((o) => o.channel === c).reduce((s, o) => s + o.totalNGN, 0), count: orders30.filter((o) => o.channel === c).length }));

  const catOf = (i: (typeof sold)[number]["items"][number]): Category | "custom" => (i.custom ? "custom" : d.products.find((p) => p.id === i.productId)?.category ?? "corporate");
  const mix: Record<string, number> = {};
  orders30.forEach((o) => o.items.forEach((i) => (mix[catOf(i)] = (mix[catOf(i)] ?? 0) + i.qty * i.unitPriceNGN)));
  mix.academy = academy30;

  const top: Record<string, { name: string; qty: number; value: number }> = {};
  orders30.forEach((o) => o.items.forEach((i) => {
    const key = i.custom ? "custom" : i.productId ?? i.name;
    top[key] ??= { name: i.custom ? "Custom celebration cakes" : i.name, qty: 0, value: 0 };
    top[key].qty += i.qty;
    top[key].value += i.qty * i.unitPriceNGN;
  }));

  const weeks = Array.from({ length: 16 }, (_, i) => {
    const end = now - (15 - i) * WEEK;
    const start = end - WEEK;
    const cs = d.customers.filter((c) => t(c.createdAt) >= start && t(c.createdAt) < end && c.firstResponseMins !== undefined);
    return {
      label: new Date(end).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      revenue: sold.filter((o) => t(o.dueAt) >= start && t(o.dueAt) < end).reduce((s, o) => s + o.totalNGN, 0),
      response: cs.length ? cs.reduce((s, c) => s + c.firstResponseMins!, 0) / cs.length : null,
      hoursSaved: d.events.filter((e) => t(e.at) >= start && t(e.at) < end).reduce((s, e) => s + e.minutesSaved, 0) / 60,
      afterGoLive: end > goLive,
    };
  });

  const corporatePipeline = d.quotes.filter((q) => q.status === "sent").reduce((s, q) => s + q.totalNGN, 0);
  const openChats = d.conversations.filter((c) => c.status === "handoff" || c.unread > 0).length;

  return {
    revenue30, revenuePrev, growth: revenuePrev ? revenue30 / revenuePrev - 1 : 0, orders30: orders30.length, aov,
    responseNow, responseBefore, conversionNow, conversionBefore, outstanding, unpaidQuotes, utilisation, repeatRate, onTimeNow, onTimeBefore,
    rating, ratedCount: rated.length, margin, hoursSavedWeek, influenced, aiShare, byChannel, mix,
    top: Object.values(top).sort((a, b) => b.value - a.value).slice(0, 6), weeks, corporatePipeline, academy30, openChats,
  };
}

export type Kpis = ReturnType<typeof kpis>;
