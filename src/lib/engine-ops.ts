import { uid } from "./format";
import { logEvent, naira, send } from "./engine";
import type { Category, Cohort, DemoData, Product, Recipe } from "./types";

// Business-operations helpers for the back office (stock, menu, academy).
// Same contract as engine.ts: mutate an Immer draft via useDemo.getState().run(...).

type S = DemoData;
const nowIso = () => new Date().toISOString();
const firstName = (name: string) => name.split(" ")[0];
export const round500 = (n: number) => Math.round(n / 500) * 500;
export const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ---------------------------------------------------------------- stock

export function adjustStock(s: S, ingredientId: string, qty: number, reason: string) {
  const ing = s.ingredients.find((i) => i.id === ingredientId);
  if (!ing || !qty) return;
  const before = ing.stock;
  ing.stock = Math.max(0, +(ing.stock + qty).toFixed(2));
  const applied = +(ing.stock - before).toFixed(2);
  s.stockMoves.unshift({ id: uid("sm"), at: nowIso(), ingredientId, qty: applied, reason });
  logEvent(s, {
    automation: "stock-reorder",
    kind: ing.stock < ing.reorderAt ? "alert" : "action",
    title: `Stock adjusted: ${ing.name} ${applied > 0 ? "+" : ""}${applied} ${ing.unit}`,
    detail: `${reason} · now ${ing.stock} ${ing.unit}${ing.stock < ing.reorderAt ? " (below re-order level)" : ""}`,
    minutesSaved: 2,
  });
}

/** Ingredient cost of one batch of a recipe. */
export function recipeCost(s: Pick<S, "ingredients">, r?: Recipe) {
  if (!r) return 0;
  return r.ingredients.reduce((t, ri) => t + ri.qty * (s.ingredients.find((i) => i.id === ri.ingredientId)?.costPerUnitNGN ?? 0), 0);
}

/** Share (0-1) of a recipe's ingredient cost that comes from one ingredient. */
export function ingredientShare(s: Pick<S, "ingredients">, r: Recipe | undefined, ingredientId: string) {
  const total = recipeCost(s, r);
  if (!r || !total) return 0;
  const ri = r.ingredients.find((x) => x.ingredientId === ingredientId);
  const ing = s.ingredients.find((i) => i.id === ingredientId);
  return ri && ing ? (ri.qty * ing.costPerUnitNGN) / total : 0;
}

// ---------------------------------------------------------------- menu

export function setProductPrice(s: S, productId: string, priceNGN: number, reason: string) {
  const p = s.products.find((x) => x.id === productId);
  if (!p || priceNGN <= 0 || p.priceNGN === priceNGN) return;
  const before = p.priceNGN;
  p.priceNGN = Math.round(priceNGN);
  logEvent(s, {
    automation: "content",
    kind: "action",
    title: `Price updated: ${p.name}`,
    detail: `${naira(before)} to ${naira(p.priceNGN)} · ${reason}. Website, Tia and the menu now quote the new price`,
    minutesSaved: 6,
  });
}

export function setProductAvailable(s: S, productId: string, available: boolean) {
  const p = s.products.find((x) => x.id === productId);
  if (!p) return;
  p.available = available;
  logEvent(s, {
    automation: "ai-assistant",
    kind: "action",
    title: `${p.name} marked ${available ? "back in stock" : "sold out"}`,
    detail: available ? "Back on the website and in Tia's suggestions" : "Hidden from the website; Tia will suggest alternatives",
    minutesSaved: 3,
  });
}

export interface NewProduct {
  name: string;
  category: Category;
  priceNGN: number;
  unit: string;
  leadDays: number;
  ovenPoints: number;
  image: string;
  description: string;
}

export function addProduct(s: S, input: NewProduct) {
  const peers = s.products.filter((p) => p.category === input.category);
  const ratio = peers.length ? peers.reduce((t, p) => t + p.costNGN / p.priceNGN, 0) / peers.length : 0.35;
  let slug = slugify(input.name) || "new-product";
  if (s.products.some((p) => p.slug === slug)) slug = `${slug}-${s.products.length + 1}`;
  const p: Product = {
    id: uid("pr"),
    slug,
    name: input.name,
    category: input.category,
    description: input.description,
    priceNGN: input.priceNGN,
    unit: input.unit,
    image: input.image,
    leadDays: input.leadDays,
    ovenPoints: input.ovenPoints,
    tags: ["new"],
    allergens: ["gluten", "dairy", "egg"],
    recipeId: peers[0]?.recipeId,
    costNGN: Math.round((input.priceNGN * ratio) / 100) * 100,
    available: true,
  };
  s.products.unshift(p);
  logEvent(s, {
    automation: "content",
    kind: "action",
    title: `New product added: ${p.name}`,
    detail: `${naira(p.priceNGN)} · ${p.unit} · live on the website and in Tia's menu`,
    minutesSaved: 15,
  });
  return p.id;
}

// ---------------------------------------------------------------- academy

export function createCohort(s: S, courseId: string, startISO: string, seats: number) {
  const course = s.courses.find((c) => c.id === courseId);
  if (!course) return;
  const ch: Cohort = { id: uid("ch"), courseId, startDate: startISO, seats, studentIds: [] };
  s.cohorts.push(ch);
  logEvent(s, {
    automation: "academy",
    kind: "action",
    title: `New cohort opened: ${course.title}`,
    detail: `Starts ${new Date(startISO).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${seats} seats · booking link live`,
    minutesSaved: 10,
  });
  return ch.id;
}

function enrolment(s: S, enrollmentId: string) {
  const e = s.enrollments.find((x) => x.id === enrollmentId);
  if (!e) return null;
  const ch = s.cohorts.find((x) => x.id === e.cohortId);
  const course = s.courses.find((x) => x.id === ch?.courseId);
  const c = s.customers.find((x) => x.id === e.customerId);
  if (!ch || !course || !c) return null;
  return { e, ch, course, c };
}

export function markEnrollmentPaid(s: S, enrollmentId: string) {
  const r = enrolment(s, enrollmentId);
  if (!r) return;
  const { e, course, c } = r;
  const amount = course.priceNGN - e.paidNGN;
  e.paidNGN = course.priceNGN;
  if (e.status === "reserved") e.status = "paid";
  send(s, c.id, "whatsapp", `Hi ${firstName(c.name)}, payment received for ${course.title}. Your seat is fully paid, see you in class!`, "academy");
  logEvent(s, { automation: "academy", kind: "action", title: `Class balance paid: ${course.title}`, detail: `${c.name} · ${naira(amount)} · receipt sent on WhatsApp`, customerId: c.id, minutesSaved: 5, revenueNGN: amount });
}

export function markAttended(s: S, enrollmentId: string) {
  const r = enrolment(s, enrollmentId);
  if (!r) return;
  r.e.status = "attending";
  logEvent(s, { automation: "academy", kind: "action", title: `Attendance marked: ${r.course.title}`, detail: r.c.name, customerId: r.c.id, minutesSaved: 1 });
}

export function issueCertificate(s: S, enrollmentId: string) {
  const r = enrolment(s, enrollmentId);
  if (!r) return;
  const { e, course, c } = r;
  e.status = "completed";
  e.certificate = true;
  if (!c.tags.includes("alumni")) c.tags.push("alumni");
  send(s, c.id, "whatsapp", `Congratulations ${firstName(c.name)}! 🎓 You've completed ${course.title} at Temmiebakes Academy. Your certificate is attached. Tag @temmiebakes when you post your bakes, we love to share our students' work.`, "academy", { status: "delivered" });
  logEvent(s, { automation: "academy", kind: "action", title: `Certificate issued: ${course.title}`, detail: `${c.name} · congratulations sent on WhatsApp`, customerId: c.id, minutesSaved: 8 });
}
