import { uid } from "./format";
import { dayKey, depositFor, describeCake, pointsBooked, quoteCatering, ZONES } from "./sim/pricing";
import type {
  AutoEvent, AutomationId, CakeConfig, Channel, ConvChannel, Conversation, Customer, DemoData, Occasion, Order, OrderItem,
  OrderStatus, Outbound, OutboundChannel, PackageId, Segment,
} from "./types";
import type { Reply } from "./sim/assistant";

// The automation engine: every user action in the demo runs through here and
// mirrors a workflow in /workflows. Functions mutate an Immer draft.

type S = DemoData;
const HOUR = 3600000;
const DAY = 24 * HOUR;
const nowIso = () => new Date().toISOString();
export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export function logEvent(s: S, e: Omit<AutoEvent, "id" | "at"> & { at?: string }) {
  s.events.unshift({ id: uid("ev"), at: e.at ?? nowIso(), ...e });
  if (s.events.length > 2500) s.events.length = 2500;
}

const cust = (s: S, id: string) => s.customers.find((c) => c.id === id)!;
const firstName = (c: Customer) => c.name.split(" ")[0];
export const orderLabel = (o: Order) => (o.items[0]?.custom ? "custom cake" : o.items[0]?.name ?? "order") + (o.items.length > 1 ? ` + ${o.items.length - 1} more` : "");

export function send(s: S, customerId: string, channel: OutboundChannel, body: string, automationId?: AutomationId, opts: { orderId?: string; at?: number; status?: Outbound["status"] } = {}) {
  const at = opts.at ?? Date.now();
  const due = at <= Date.now() + 30000;
  const o: Outbound = {
    id: uid("ob"),
    channel,
    customerId,
    automationId,
    body,
    scheduledFor: new Date(at).toISOString(),
    sentAt: due ? new Date(at).toISOString() : undefined,
    status: opts.status ?? (due ? "sent" : "scheduled"),
    orderId: opts.orderId,
  };
  s.outbound.unshift(o);
  return o;
}

// ---------------------------------------------------------------- customers

export interface CustomerInput {
  name: string;
  phone?: string;
  instagram?: string;
  email?: string;
  zoneId?: string;
  source: Customer["source"];
  segment?: Segment;
  company?: string;
}

const normPhone = (p?: string) => (p ? p.replace(/\D/g, "").slice(-10) : "");

export function upsertCustomer(s: S, input: CustomerInput) {
  const phone = normPhone(input.phone);
  const ig = input.instagram?.toLowerCase();
  const existing = s.customers.find((c) => (phone && normPhone(c.phone) === phone) || (ig && c.instagram?.toLowerCase() === ig));
  if (existing) {
    if (input.zoneId) existing.zoneId = input.zoneId;
    if (input.email && !existing.email) existing.email = input.email;
    if (input.instagram && !existing.instagram) existing.instagram = input.instagram;
    if (input.phone && !existing.phone) existing.phone = input.phone;
    return { customer: existing, created: false };
  }
  const c: Customer = {
    id: uid("cu"),
    name: input.name || "New customer",
    phone: input.phone ?? "",
    email: input.email,
    instagram: input.instagram,
    company: input.company,
    zoneId: input.zoneId ?? "ikeja",
    segment: input.segment ?? (input.company ? "corporate" : "individual"),
    source: input.source,
    createdAt: nowIso(),
    tags: ["lead"],
    occasions: [],
    consentWhatsApp: true,
    firstResponseMins: +(0.3 + Math.random() * 0.6).toFixed(2),
  };
  s.customers.unshift(c);
  logEvent(s, { automation: "order-intake", kind: "trigger", title: `New customer captured from ${input.source === "web" ? "the website" : input.source}`, detail: c.name, customerId: c.id, minutesSaved: 4 });
  return { customer: c, created: true };
}

export function addOccasion(s: S, customerId: string, type: Occasion, label: string, dateISO: string) {
  const c = cust(s, customerId);
  const mmdd = dateISO.slice(5, 10);
  if (!c.occasions.some((o) => o.date === mmdd && o.type === type)) c.occasions.push({ type, label, date: mmdd });
}

// ---------------------------------------------------------------- orders

export interface OrderInput {
  customerId: string;
  channel: Channel;
  items: OrderItem[];
  fulfilment: "delivery" | "pickup";
  zoneId?: string;
  address?: string;
  dueAt: string;
  occasion: Occasion;
  ovenPoints: number;
  assistedByAI?: boolean;
  status?: "quoted" | "confirmed" | "enquiry";
  by?: string;
}

export function capacityLeft(s: S, dueISO: string) {
  return s.dailyCapacity - pointsBooked(s.orders, dayKey(dueISO));
}

export function createOrder(s: S, input: OrderInput) {
  const zone = ZONES.find((z) => z.id === input.zoneId);
  const subtotal = input.items.reduce((t, i) => t + i.qty * i.unitPriceNGN, 0);
  const deliveryFee = input.fulfilment === "delivery" ? zone?.feeNGN ?? 0 : 0;
  const total = subtotal + deliveryFee;
  const n = s.orders.reduce((m, o) => Math.max(m, Number(o.number.slice(3))), 1000) + 1;
  const status = input.status ?? "quoted";
  const o: Order = {
    id: uid("or"),
    number: `TB-${n}`,
    customerId: input.customerId,
    channel: input.channel,
    items: input.items,
    subtotalNGN: subtotal,
    deliveryFeeNGN: deliveryFee,
    discountNGN: 0,
    totalNGN: total,
    depositNGN: depositFor(total, s.assistant.depositPct),
    paidNGN: 0,
    paymentStatus: "unpaid",
    status,
    occasion: input.occasion,
    dueAt: input.dueAt,
    fulfilment: input.fulfilment,
    zoneId: input.fulfilment === "delivery" ? input.zoneId : undefined,
    address: input.address,
    ovenPoints: input.ovenPoints,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    history: [{ at: nowIso(), status: "enquiry", by: input.by ?? (input.assistedByAI ? "Tia (AI)" : "Ifeoma") }],
    assistedByAI: Boolean(input.assistedByAI),
  };
  if (status !== "enquiry") o.history.push({ at: nowIso(), status: "quoted", by: o.history[0].by });
  o.quoteSentAt = nowIso();
  s.orders.unshift(o);
  const c = cust(s, input.customerId);
  c.lastOrderAt = nowIso();
  c.tags = Array.from(new Set([...c.tags.filter((t) => t !== "lead"), "first-order"]));
  if (input.occasion !== "corporate" && input.occasion !== "just-because") addOccasion(s, c.id, input.occasion, input.occasion === "birthday" ? `${firstName(c)}'s celebration` : input.occasion, input.dueAt);

  logEvent(s, { automation: "order-intake", kind: "trigger", title: `${o.number} created from ${input.channel === "web" ? "the website" : input.channel}`, detail: `${c.name} · ${orderLabel(o)} · due ${new Date(input.dueAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`, customerId: c.id, orderId: o.id, minutesSaved: 8 });
  const left = capacityLeft(s, input.dueAt);
  logEvent(s, { automation: "capacity-guard", kind: left < 3 ? "alert" : "action", title: `Kitchen capacity checked: ${Math.max(0, left)} oven points left that day`, detail: left < 3 ? "Day is nearly full; Tia will offer the next free date to new customers" : undefined, orderId: o.id, minutesSaved: 3 });
  const channel: OutboundChannel = input.channel === "instagram" ? "instagram" : "whatsapp";
  send(s, c.id, channel, `Hi ${firstName(c)}, here's your quote for ${orderLabel(o)}: ${naira(total)}${deliveryFee ? ` incl. ${naira(deliveryFee)} delivery` : ""}. A ${s.assistant.depositPct}% deposit of ${naira(o.depositNGN)} books your slot: pay.koretbakes.ng/${o.number}`, "order-intake", { orderId: o.id });
  send(s, c.id, channel, `Hi ${firstName(c)}, just checking you saw your quote for the ${orderLabel(o)} (${naira(total)}). Your slot is held until tonight: pay.koretbakes.ng/${o.number}`, "quote-follow-up", { orderId: o.id, at: Date.now() + 6 * HOUR });
  logEvent(s, { automation: "quote-follow-up", kind: "action", title: `Quote sent; follow-up scheduled in 6 hours`, detail: `${o.number} · ${naira(total)}`, customerId: c.id, orderId: o.id, minutesSaved: 5 });
  return o;
}

export function pay(s: S, orderId: string, kind: "deposit" | "balance" | "full") {
  const o = s.orders.find((x) => x.id === orderId);
  if (!o) return;
  const c = cust(s, o.customerId);
  const amount = kind === "deposit" ? o.depositNGN : kind === "balance" ? o.totalNGN - o.paidNGN : o.totalNGN - o.paidNGN;
  o.paidNGN = Math.min(o.totalNGN, o.paidNGN + amount);
  o.paymentStatus = o.paidNGN >= o.totalNGN ? "paid" : "deposit";
  if (o.status === "enquiry" || o.status === "quoted") moveOrder(s, o.id, "confirmed", "Paystack");
  o.updatedAt = nowIso();
  // cancel pending quote nudges
  s.outbound.forEach((m) => m.orderId === o.id && m.automationId === "quote-follow-up" && m.status === "scheduled" && (m.status = "failed"));
  send(s, c.id, "whatsapp", `Payment received: ${naira(amount)} for ${o.number}. ${o.paymentStatus === "paid" ? "You're fully paid, thank you!" : `Balance of ${naira(o.totalNGN - o.paidNGN)} is due before dispatch.`} See you on ${new Date(o.dueAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })} 🎂`, "payment-reminders", { orderId: o.id, status: "delivered" });
  logEvent(s, { automation: "payment-reminders", kind: "action", title: `${kind === "deposit" ? "Deposit" : "Payment"} received for ${o.number}`, detail: `${naira(amount)} via Paystack · receipt sent`, customerId: c.id, orderId: o.id, minutesSaved: 5, revenueNGN: amount });
  if (o.paymentStatus === "deposit") {
    const at = new Date(o.dueAt).getTime() - 2 * DAY;
    send(s, c.id, "whatsapp", `Hi ${firstName(c)}, your ${orderLabel(o)} is coming up. The balance of ${naira(o.totalNGN - o.paidNGN)} is due before dispatch: pay.koretbakes.ng/${o.number}`, "payment-reminders", { orderId: o.id, at: Math.max(at, Date.now() + HOUR) });
  }
}

const STATUS_MSG: Partial<Record<OrderStatus, (o: Order, s: S) => string>> = {
  baking: (o) => `Your ${orderLabel(o)} is in the oven right now 🍰`,
  ready: (o) => (o.fulfilment === "pickup" ? `Your ${orderLabel(o)} is ready for pickup at our Ikeja studio (10am-6pm).` : `Your ${orderLabel(o)} is boxed and ready. We'll send the rider details shortly.`),
  "out-for-delivery": (o, s) => `Your ${orderLabel(o)} is on its way with ${s.staff.find((x) => x.id === o.riderId)?.name.split(" ")[0] ?? "our rider"}! ETA about ${ZONES.find((z) => z.id === o.zoneId)?.etaMins ?? 45} minutes.`,
  delivered: (o) => `Delivered! Enjoy your ${orderLabel(o)} and happy celebrating 🎉`,
};

export function moveOrder(s: S, orderId: string, status: OrderStatus, by = "Kitchen") {
  const o = s.orders.find((x) => x.id === orderId);
  if (!o || o.status === status) return;
  o.status = status;
  o.updatedAt = nowIso();
  o.history.push({ at: nowIso(), status, by });
  const c = cust(s, o.customerId);
  logEvent(s, { automation: "order-updates", kind: "action", title: `${o.number} moved to ${status.replace(/-/g, " ")}`, detail: `${c.name} · ${orderLabel(o)}`, customerId: c.id, orderId: o.id, minutesSaved: 1 });
  const msg = STATUS_MSG[status]?.(o, s);
  if (msg && s.automations.find((a) => a.id === "order-updates")?.active) {
    send(s, c.id, "whatsapp", `Hi ${firstName(c)}! ${msg}`, "order-updates", { orderId: o.id, status: "delivered" });
    logEvent(s, { automation: "order-updates", kind: "action", title: `Customer updated on WhatsApp (${status.replace(/-/g, " ")})`, customerId: c.id, orderId: o.id, minutesSaved: 3 });
  }
  if (status === "baking") consumeStock(s, o);
  if (status === "out-for-delivery" && !o.riderId && o.fulfilment === "delivery") o.riderId = "st-musa";
  if (status === "out-for-delivery" && o.paymentStatus !== "paid") {
    logEvent(s, { automation: "payment-reminders", kind: "alert", title: `${o.number} dispatched with a balance of ${naira(o.totalNGN - o.paidNGN)}`, detail: "Rider will collect by transfer on delivery", orderId: o.id, minutesSaved: 0 });
  }
  if (status === "delivered") {
    o.lateMins = Date.now() > new Date(o.dueAt).getTime() + 15 * 60000 ? Math.round((Date.now() - new Date(o.dueAt).getTime()) / 60000) : 0;
    if (s.automations.find((a) => a.id === "review-request")?.active) {
      o.reviewRequested = true;
      send(s, c.id, "whatsapp", `Hi ${firstName(c)}, we hope the ${orderLabel(o)} was a hit! Could you rate it 1-5 and share a photo for our page?`, "review-request", { orderId: o.id, at: Date.now() + DAY });
      logEvent(s, { automation: "review-request", kind: "action", title: `Review request scheduled for tomorrow (${o.number})`, customerId: c.id, orderId: o.id, minutesSaved: 3 });
    }
  }
  if (status === "cancelled") logEvent(s, { automation: "capacity-guard", kind: "action", title: `${o.number} cancelled: ${o.ovenPoints} oven points released`, orderId: o.id, minutesSaved: 1 });
}

export function recordReview(s: S, orderId: string, rating: number, text: string) {
  const o = s.orders.find((x) => x.id === orderId);
  if (!o) return;
  o.rating = rating;
  o.review = text;
  logEvent(s, { automation: "review-request", kind: "trigger", title: `${rating}★ review received for ${o.number}`, detail: text.slice(0, 80), customerId: o.customerId, orderId, minutesSaved: 0 });
  if (rating <= 3) logEvent(s, { automation: "review-request", kind: "alert", title: "Low rating: Temmie alerted to follow up personally", orderId, minutesSaved: 0 });
}

// ---------------------------------------------------------------- stock

export function consumeStock(s: S, o: Order) {
  const used: Record<string, number> = {};
  o.items.forEach((it) => {
    const p = it.productId ? s.products.find((x) => x.id === it.productId) : undefined;
    const recipeId = it.custom ? "r-cake" : p?.recipeId;
    const recipe = s.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const mult = it.custom ? Math.max(1, o.ovenPoints) : it.qty * (recipeId === "r-cake" ? p?.ovenPoints ?? 1 : 1);
    recipe.ingredients.forEach((ri) => (used[ri.ingredientId] = (used[ri.ingredientId] ?? 0) + ri.qty * mult));
  });
  const low: string[] = [];
  Object.entries(used).forEach(([id, qty]) => {
    const ing = s.ingredients.find((i) => i.id === id);
    if (!ing) return;
    const before = ing.stock;
    ing.stock = Math.max(0, +(ing.stock - qty).toFixed(2));
    s.stockMoves.unshift({ id: uid("sm"), at: nowIso(), ingredientId: id, qty: -+qty.toFixed(2), reason: `Used for ${o.number}` });
    if (before >= ing.reorderAt && ing.stock < ing.reorderAt) low.push(id);
  });
  logEvent(s, { automation: "stock-reorder", kind: "action", title: `Ingredients deducted for ${o.number}`, detail: `${Object.keys(used).length} items updated from the recipe`, orderId: o.id, minutesSaved: 4 });
  if (low.length) draftReorder(s, low);
}

export function draftReorder(s: S, ingredientIds?: string[]) {
  const ids = ingredientIds ?? s.ingredients.filter((i) => i.stock < i.reorderAt).map((i) => i.id);
  const bySupplier: Record<string, string[]> = {};
  ids.forEach((id) => {
    const ing = s.ingredients.find((i) => i.id === id)!;
    if (s.purchaseOrders.some((po) => po.status !== "received" && po.lines.some((l) => l.ingredientId === id))) return;
    (bySupplier[ing.supplierId] ??= []).push(id);
  });
  const created: string[] = [];
  Object.entries(bySupplier).forEach(([supplierId, list]) => {
    const lines = list.map((id) => {
      const ing = s.ingredients.find((i) => i.id === id)!;
      return { ingredientId: id, qty: Math.ceil(Math.max(ing.reorderAt * 2 - ing.stock, ing.usage7d)) };
    });
    const total = lines.reduce((t, l) => t + l.qty * s.ingredients.find((i) => i.id === l.ingredientId)!.costPerUnitNGN, 0);
    const id = uid("po");
    s.purchaseOrders.unshift({ id, supplierId, lines, totalNGN: total, status: "draft", createdAt: nowIso() });
    created.push(id);
    const sup = s.suppliers.find((x) => x.id === supplierId)!;
    logEvent(s, { automation: "stock-reorder", kind: "alert", title: `Low stock: purchase order drafted for ${sup.name}`, detail: lines.map((l) => s.ingredients.find((i) => i.id === l.ingredientId)!.name).join(", "), minutesSaved: 15 });
  });
  return created;
}

export function sendPO(s: S, poId: string) {
  const po = s.purchaseOrders.find((p) => p.id === poId);
  if (!po) return;
  po.status = "sent";
  const sup = s.suppliers.find((x) => x.id === po.supplierId)!;
  logEvent(s, { automation: "stock-reorder", kind: "action", title: `Purchase order sent to ${sup.name} on WhatsApp`, detail: `${naira(po.totalNGN)} · delivery in ${sup.leadDays} day${sup.leadDays > 1 ? "s" : ""}`, minutesSaved: 10 });
}

export function receivePO(s: S, poId: string) {
  const po = s.purchaseOrders.find((p) => p.id === poId);
  if (!po || po.status === "received") return;
  po.status = "received";
  po.lines.forEach((l) => {
    const ing = s.ingredients.find((i) => i.id === l.ingredientId)!;
    ing.stock = +(ing.stock + l.qty).toFixed(2);
    s.stockMoves.unshift({ id: uid("sm"), at: nowIso(), ingredientId: ing.id, qty: l.qty, reason: "Delivery received" });
  });
  logEvent(s, { automation: "stock-reorder", kind: "action", title: "Delivery received: stock levels updated", detail: s.suppliers.find((x) => x.id === po.supplierId)?.name, minutesSaved: 5 });
}

// ---------------------------------------------------------------- academy

export function enroll(s: S, cohortId: string, customerId: string, paidNGN: number) {
  const ch = s.cohorts.find((c) => c.id === cohortId);
  if (!ch || ch.studentIds.includes(customerId) || ch.studentIds.length >= ch.seats) return;
  ch.studentIds.push(customerId);
  const course = s.courses.find((c) => c.id === ch.courseId)!;
  const c = cust(s, customerId);
  if (c.segment === "individual") c.segment = "student";
  s.enrollments.unshift({ id: uid("en"), cohortId, customerId, paidNGN, status: paidNGN >= course.priceNGN ? "paid" : "reserved", createdAt: nowIso() });
  send(s, customerId, "whatsapp", `Hi ${firstName(c)}, your seat for ${course.title} starting ${new Date(ch.startDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} is ${paidNGN >= course.priceNGN ? "confirmed" : "reserved"}. ${paidNGN < course.priceNGN ? `Balance ${naira(course.priceNGN - paidNGN)} due before class. ` : ""}Bring an apron and an appetite!`, "academy");
  send(s, customerId, "whatsapp", `Reminder: ${course.title} starts tomorrow at 10am at our Ikeja studio. See you there!`, "academy", { at: new Date(ch.startDate).getTime() - DAY });
  logEvent(s, { automation: "academy", kind: "action", title: `Seat booked: ${course.title}`, detail: `${c.name} · ${ch.studentIds.length}/${ch.seats} seats · reminder scheduled`, customerId, minutesSaved: 10, revenueNGN: paidNGN });
}

// ---------------------------------------------------------------- corporate

export function createQuote(s: S, a: { customerId: string; company: string; event: string; guests: number; dateISO: string; packageId: PackageId; extras?: { name: string; priceNGN: number }[] }) {
  const q = quoteCatering(a.packageId, a.guests);
  const extras = a.extras ?? [];
  const n = s.quotes.reduce((m, x) => Math.max(m, Number(x.number.slice(3))), 200) + 1;
  const quote = { id: uid("cq"), number: `CQ-${n}`, customerId: a.customerId, company: a.company, event: a.event, guests: q.guests, date: a.dateISO, packageId: a.packageId, extras, perGuestNGN: q.perGuestNGN, totalNGN: q.totalNGN + extras.reduce((t, e) => t + e.priceNGN, 0), status: "draft" as const, createdAt: nowIso() };
  s.quotes.unshift(quote);
  logEvent(s, { automation: "corporate", kind: "action", title: `Catering quote ${quote.number} drafted for ${a.company}`, detail: `${q.guests} guests · ${naira(quote.totalNGN)}`, customerId: a.customerId, minutesSaved: 30 });
  return quote.id;
}

export function setQuoteStatus(s: S, quoteId: string, status: "sent" | "accepted" | "declined") {
  const q = s.quotes.find((x) => x.id === quoteId);
  if (!q) return;
  q.status = status;
  if (status === "sent") {
    q.sentAt = nowIso();
    send(s, q.customerId, "email", `Hello, please find attached quote ${q.number} for your ${q.event} (${q.guests} guests, ${naira(q.totalNGN)}). We'll check in on Thursday. Koretbakes`, "corporate");
    logEvent(s, { automation: "corporate", kind: "action", title: `Quote ${q.number} emailed to ${q.company}`, detail: "PDF quote + follow-up in 2 days", customerId: q.customerId, minutesSaved: 10 });
  }
  if (status === "accepted") {
    createOrder(s, { customerId: q.customerId, channel: "corporate", items: [{ name: `Catering: ${q.event} (${q.guests} guests)`, qty: q.guests, unitPriceNGN: q.perGuestNGN }], fulfilment: "delivery", zoneId: s.customers.find((c) => c.id === q.customerId)?.zoneId, dueAt: q.date, occasion: "corporate", ovenPoints: Math.ceil(q.guests / 15), status: "confirmed", by: "Ifeoma" });
    logEvent(s, { automation: "corporate", kind: "trigger", title: `${q.company} accepted ${q.number}`, detail: "Order created and invoice sent", customerId: q.customerId, minutesSaved: 15, revenueNGN: q.totalNGN });
  }
}

// ---------------------------------------------------------------- campaigns

export function runOccasionReminders(s: S) {
  const now = Date.now();
  let n = 0;
  s.customers.forEach((c) => {
    c.occasions.forEach((oc) => {
      const year = new Date(now).getUTCFullYear();
      let t = new Date(`${year}-${oc.date}T09:00:00Z`).getTime();
      if (t < now) t = new Date(`${year + 1}-${oc.date}T09:00:00Z`).getTime();
      const days = (t - now) / DAY;
      if (days > 14.5 || days < 0) return;
      if (s.outbound.some((o) => o.customerId === c.id && o.automationId === "occasion-reminders" && now - new Date(o.scheduledFor).getTime() < 20 * DAY)) return;
      send(s, c.id, "whatsapp", `Hi ${firstName(c)}! ${oc.label} is on ${new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}. Shall we bake something special? Order this week and get free delivery 🎂`, "occasion-reminders");
      n++;
    });
  });
  logEvent(s, { automation: "occasion-reminders", kind: "action", title: n ? `${n} occasion reminders sent` : "No occasions in the next 14 days", detail: n ? "Personal offers, free delivery this week" : undefined, minutesSaved: n * 6 });
  return n;
}

export function runReorderNudges(s: S) {
  const now = Date.now();
  let n = 0;
  s.customers.forEach((c) => {
    if (!c.lastOrderAt || c.segment === "corporate") return;
    const days = (now - new Date(c.lastOrderAt).getTime()) / DAY;
    if (days < 45 || days > 120) return;
    if (s.outbound.some((o) => o.customerId === c.id && o.automationId === "reorder-nudge" && now - new Date(o.scheduledFor).getTime() < 30 * DAY)) return;
    const last = s.orders.filter((o) => o.customerId === c.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    send(s, c.id, c.instagram ? "instagram" : "whatsapp", `Hi ${firstName(c)}, it's been a while! ${last ? `Your ${orderLabel(last)} is still a favourite here, and` : ""} new honey cake slices just landed. Reply YES to re-order.`, "reorder-nudge");
    n++;
  });
  logEvent(s, { automation: "reorder-nudge", kind: "action", title: `${n} re-order nudges sent`, detail: "Customers quiet for 45-120 days", minutesSaved: n * 4 });
  return n;
}

// ---------------------------------------------------------------- conversations

export function startConversation(s: S, a: { channel: ConvChannel; name: string; handle?: string; customerId?: string }) {
  const cv: Conversation = { id: uid("cv"), channel: a.channel, name: a.name, handle: a.handle, customerId: a.customerId, status: "ai", draft: {}, messages: [], startedAt: nowIso(), lastAt: nowIso(), unread: 0 };
  s.conversations.unshift(cv);
  return cv.id;
}

export function addUserMessage(s: S, convId: string, text: string) {
  const cv = s.conversations.find((c) => c.id === convId);
  if (!cv) return;
  cv.messages.push({ id: uid("m"), from: "user", text, at: nowIso() });
  cv.lastAt = nowIso();
  cv.unread += 1;
  if (cv.messages.filter((m) => m.from === "user").length === 1) logEvent(s, { automation: "ai-assistant", kind: "trigger", title: `New ${cv.channel === "instagram" ? "Instagram DM" : cv.channel === "whatsapp" ? "WhatsApp" : "website chat"}`, detail: text.slice(0, 80), customerId: cv.customerId, minutesSaved: 0 });
}

export function staffMessage(s: S, convId: string, text: string, staffName = "Temmie") {
  const cv = s.conversations.find((c) => c.id === convId);
  if (!cv) return;
  cv.messages.push({ id: uid("m"), from: "agent", text, at: nowIso() });
  cv.status = "staff";
  cv.lastAt = nowIso();
  cv.unread = 0;
  void staffName;
}

export function applyReply(s: S, convId: string, r: Reply) {
  const cv = s.conversations.find((c) => c.id === convId);
  if (!cv) return;
  cv.draft = r.draft;
  cv.unread = 0;
  cv.lastAt = nowIso();

  const ensureCustomer = () => {
    if (cv.customerId) {
      const c = cust(s, cv.customerId);
      if (r.draft.zoneId) c.zoneId = r.draft.zoneId;
      if (r.draft.phone && !c.phone) c.phone = r.draft.phone;
      return c.id;
    }
    const { customer } = upsertCustomer(s, { name: r.draft.name ?? cv.name, phone: r.draft.phone ?? (cv.channel === "whatsapp" ? cv.handle : undefined), instagram: cv.channel === "instagram" ? cv.handle : undefined, zoneId: r.draft.zoneId, source: cv.channel });
    cv.customerId = customer.id;
    cv.name = customer.name;
    return customer.id;
  };

  let card: Conversation["messages"][number]["card"];
  if (r.createOrder) {
    const customerId = ensureCustomer();
    const o = createOrder(s, { ...r.createOrder, customerId, channel: cv.channel === "web" ? "web" : cv.channel, assistedByAI: true });
    cv.orderId = o.id;
    card = { kind: "order", refId: o.id };
  }
  if (r.enrollCohortId) {
    const customerId = ensureCustomer();
    const course = s.courses.find((c) => c.id === s.cohorts.find((x) => x.id === r.enrollCohortId)?.courseId);
    enroll(s, r.enrollCohortId, customerId, course ? course.priceNGN / 2 : 0);
    card = { kind: "class", refId: r.enrollCohortId };
  }
  if (r.cateringQuote) {
    const customerId = ensureCustomer();
    const id = createQuote(s, { customerId, company: r.cateringQuote.company, event: r.cateringQuote.event, guests: r.cateringQuote.guests, dateISO: r.cateringQuote.dateISO, packageId: r.cateringQuote.packageId });
    card = { kind: "catering", refId: id };
  }
  cv.messages.push({ id: uid("m"), from: "ai", text: r.text, at: nowIso(), productIds: r.productIds, quickReplies: r.quickReplies, card });
  logEvent(s, { automation: "ai-assistant", kind: "ai", title: `Tia replied (${r.intent})`, detail: r.extracted.length ? `Captured ${r.extracted.join(" · ")}` : r.kbId ? `Answered from knowledge base` : undefined, customerId: cv.customerId, minutesSaved: 3 });

  if (r.handoff) {
    cv.status = "handoff";
    cv.handoffReason = r.handoff;
    ensureCustomer();
    cv.messages.push({ id: uid("m"), from: "system", text: `Handed to Temmie · reason: ${r.handoff}`, at: nowIso() });
    logEvent(s, { automation: "ai-assistant", kind: "handoff", title: "Handed to Temmie", detail: r.handoff, customerId: cv.customerId, minutesSaved: 2 });
  }
}

// ---------------------------------------------------------------- scheduler

export function tick(s: S) {
  const now = Date.now();
  let sent = 0;
  for (const o of s.outbound) {
    if (o.status === "scheduled" && new Date(o.scheduledFor).getTime() <= now) {
      o.status = "sent";
      o.sentAt = nowIso();
      sent++;
    } else if (o.sentAt && now - new Date(o.sentAt).getTime() < 15 * 60000) {
      const r = Math.random();
      if (o.status === "sent" && r < 0.6) o.status = "delivered";
      else if (o.status === "delivered" && r < 0.4) o.status = "read";
    }
  }
  if (sent) logEvent(s, { automation: "order-updates", kind: "action", title: `Scheduler sent ${sent} due message${sent > 1 ? "s" : ""}`, minutesSaved: sent * 3 });
}

export type { CakeConfig };
