import type { CakeConfig, Decoration, Finish, Order, PackageId, Shape, Zone } from "../types";

// Single source of truth for prices, lead times and oven capacity.
// Used by the cake builder, the AI assistant, checkout and the kitchen board.

export const SIZES = [6, 8, 10, 12] as const;
export const BASE_BY_SIZE: Record<number, number> = { 6: 32000, 8: 48000, 10: 75000, 12: 110000 };
export const SERVINGS: Record<number, number> = { 6: 10, 8: 20, 10: 35, 12: 50 };
export const POINTS_BY_SIZE: Record<number, number> = { 6: 1, 8: 1.5, 10: 2, 12: 3 };

export const FLAVOURS: { name: string; extra: number; note?: string }[] = [
  { name: "Vanilla bean", extra: 0 },
  { name: "Rich chocolate", extra: 0 },
  { name: "Red velvet", extra: 5000 },
  { name: "Funfetti", extra: 0 },
  { name: "Marble", extra: 0 },
  { name: "Lemon & blueberry", extra: 4000 },
  { name: "Coconut", extra: 3000 },
  { name: "Carrot & walnut", extra: 6000, note: "contains nuts" },
  { name: "Banana caramel", extra: 4000 },
  { name: "Oreo cookies & cream", extra: 5000 },
];

export const FILLINGS: { name: string; extra: number }[] = [
  { name: "Vanilla buttercream", extra: 0 },
  { name: "Chocolate ganache", extra: 4000 },
  { name: "Cream cheese", extra: 5000 },
  { name: "Strawberry compote", extra: 4000 },
  { name: "Salted caramel", extra: 4000 },
];

export const SHAPE_FACTOR: Record<Shape, number> = { round: 1, square: 1.1, heart: 1.15 };
export const FINISH_FACTOR: Record<Finish, number> = { buttercream: 1, "whipped-cream": 0.9, naked: 0.95, drip: 1.08, fondant: 1.3 };
export const DECORATION_EXTRA: Record<Decoration, number> = { simple: 0, themed: 20000, premium: 45000 };
export const FINISH_LABEL: Record<Finish, string> = { buttercream: "Buttercream", "whipped-cream": "Whipped cream", naked: "Semi-naked", drip: "Drip", fondant: "Fondant" };
export const DECORATION_LABEL: Record<Decoration, string> = { simple: "Simple (piping, sprinkles, message)", themed: "Themed (toppers, colours, edible print)", premium: "Premium (sugar flowers, figurines, gold leaf)" };

export const DEFAULT_CAKE: CakeConfig = {
  shape: "round",
  sizeInches: 8,
  tiers: 1,
  flavour: "Red velvet",
  filling: "Cream cheese",
  finish: "buttercream",
  decoration: "themed",
  colours: "Blush pink and gold",
  message: "Happy Birthday",
};

const round500 = (n: number) => Math.round(n / 500) * 500;

export interface CakeQuote {
  totalNGN: number;
  lines: { label: string; amountNGN: number }[];
  servings: number;
  leadDays: number;
  ovenPoints: number;
  tierSizes: number[];
}

/** Itemised quote for a custom cake. Tiers step down 2 inches each (12 → 10 → 8). */
export function quoteCake(c: CakeConfig): CakeQuote {
  const tierSizes = Array.from({ length: c.tiers }, (_, i) => Math.max(6, c.sizeInches - i * 2));
  const lines: CakeQuote["lines"] = [];
  const base = tierSizes.reduce((s, z) => s + BASE_BY_SIZE[z], 0);
  lines.push({ label: `${c.tiers > 1 ? `${c.tiers}-tier ` : ""}${tierSizes.map((z) => `${z}"`).join(" + ")} ${c.shape} base`, amountNGN: base });
  if (c.tiers > 1) lines.push({ label: "Tier stacking & dowels", amountNGN: 15000 * (c.tiers - 1) });
  const flavour = FLAVOURS.find((f) => f.name === c.flavour)?.extra ?? 0;
  if (flavour) lines.push({ label: `${c.flavour} flavour`, amountNGN: flavour * c.tiers });
  const filling = FILLINGS.find((f) => f.name === c.filling)?.extra ?? 0;
  if (filling) lines.push({ label: `${c.filling} filling`, amountNGN: filling * c.tiers });
  const subtotal = lines.reduce((s, l) => s + l.amountNGN, 0);
  const shapeAdj = subtotal * (SHAPE_FACTOR[c.shape] - 1);
  if (shapeAdj) lines.push({ label: `${c.shape[0].toUpperCase() + c.shape.slice(1)} shape`, amountNGN: round500(shapeAdj) });
  const finishAdj = (subtotal + shapeAdj) * (FINISH_FACTOR[c.finish] - 1);
  if (finishAdj) lines.push({ label: `${FINISH_LABEL[c.finish]} finish`, amountNGN: round500(finishAdj) });
  if (DECORATION_EXTRA[c.decoration]) lines.push({ label: `${c.decoration[0].toUpperCase() + c.decoration.slice(1)} decoration`, amountNGN: DECORATION_EXTRA[c.decoration] * (c.tiers > 1 ? 1.5 : 1) });
  const totalNGN = round500(lines.reduce((s, l) => s + l.amountNGN, 0));
  const servings = tierSizes.reduce((s, z) => s + SERVINGS[z], 0);
  const leadDays = (c.decoration === "premium" ? 5 : c.decoration === "themed" ? 3 : 2) + (c.tiers > 1 ? 2 : 0) + (c.finish === "fondant" ? 1 : 0);
  const ovenPoints = tierSizes.reduce((s, z) => s + POINTS_BY_SIZE[z], 0) + (c.decoration === "premium" ? 2 : c.decoration === "themed" ? 1 : 0);
  return { totalNGN, lines, servings, leadDays, ovenPoints, tierSizes };
}

export function describeCake(c: CakeConfig) {
  const tiers = c.tiers > 1 ? `${c.tiers}-tier ` : "";
  return `${tiers}${c.sizeInches}" ${c.shape} ${c.flavour.toLowerCase()} cake, ${c.filling.toLowerCase()}, ${FINISH_LABEL[c.finish].toLowerCase()} finish, ${c.decoration} decoration`;
}

export const ZONES: Zone[] = [
  { id: "ikeja", name: "Ikeja", feeNGN: 2500, etaMins: 30 },
  { id: "gra-ikeja", name: "GRA Ikeja", feeNGN: 2500, etaMins: 30 },
  { id: "ogba", name: "Ogba", feeNGN: 3000, etaMins: 35 },
  { id: "maryland", name: "Maryland", feeNGN: 3500, etaMins: 40 },
  { id: "magodo", name: "Magodo", feeNGN: 4000, etaMins: 45 },
  { id: "gbagada", name: "Gbagada", feeNGN: 4500, etaMins: 50 },
  { id: "yaba", name: "Yaba", feeNGN: 5500, etaMins: 55 },
  { id: "surulere", name: "Surulere", feeNGN: 6000, etaMins: 60 },
  { id: "ikoyi", name: "Ikoyi", feeNGN: 8000, etaMins: 75 },
  { id: "victoria-island", name: "Victoria Island", feeNGN: 8000, etaMins: 75 },
  { id: "festac", name: "Festac", feeNGN: 9000, etaMins: 80 },
  { id: "lekki", name: "Lekki Phase 1", feeNGN: 9500, etaMins: 90 },
  { id: "ikorodu", name: "Ikorodu", feeNGN: 11000, etaMins: 95 },
  { id: "ajah", name: "Ajah", feeNGN: 12000, etaMins: 110 },
];

export const PACKAGES: Record<PackageId, { name: string; perGuestNGN: number; minGuests: number; includes: string[]; image: string }> = {
  "breakfast-box": {
    name: "Corporate breakfast box",
    perGuestNGN: 7500,
    minGuests: 20,
    includes: ["Croissant or cinnamon roll", "Mini sandwich wrap", "Fruit cup", "Banana bread slice", "Juice or yoghurt"],
    image: "/img/catering-breakfast-toast.jpg",
  },
  "canape-reception": {
    name: "Canapé reception",
    perGuestNGN: 11000,
    minGuests: 30,
    includes: ["6 savoury canapés per guest", "4 mini desserts per guest", "Small chops by @1005foodhub", "Service staff for 3 hours"],
    image: "/img/dessert-tartlets.jpg",
  },
  "dessert-table": {
    name: "Dessert table",
    perGuestNGN: 9000,
    minGuests: 40,
    includes: ["Centrepiece cake", "Cupcakes and cake pops", "Parfait cups and tarts", "Branded styling and signage"],
    image: "/img/dessert-parfait-cups.jpg",
  },
  "cake-and-cupcakes": {
    name: "Office celebration (cake + cupcakes)",
    perGuestNGN: 4500,
    minGuests: 20,
    includes: ["Branded celebration cake", "One cupcake per guest", "Logo toppers", "Same-week delivery"],
    image: "/img/cupcake-swirl.jpg",
  },
};

export function quoteCatering(packageId: PackageId, guests: number) {
  const p = PACKAGES[packageId];
  const g = Math.max(guests, p.minGuests);
  const discount = g >= 150 ? 0.12 : g >= 100 ? 0.08 : 0;
  const perGuest = round500(p.perGuestNGN * (1 - discount));
  return { guests: g, perGuestNGN: perGuest, totalNGN: perGuest * g, discountPct: discount * 100, belowMinimum: guests < p.minGuests };
}

export function depositFor(totalNGN: number, pct: number) {
  return round500((totalNGN * pct) / 100);
}

/** Lagos-time date key (YYYY-MM-DD) for an instant. */
export function dayKey(t: number | string) {
  const d = new Date(typeof t === "string" ? new Date(t).getTime() + 3600000 : t + 3600000);
  return d.toISOString().slice(0, 10);
}

/** Oven points already booked for a Lagos calendar day. */
export function pointsBooked(orders: Order[], key: string) {
  return orders.filter((o) => o.status !== "cancelled" && o.status !== "enquiry" && dayKey(o.dueAt) === key).reduce((s, o) => s + o.ovenPoints, 0);
}

/** Earliest Lagos day (Mon-Sat) that meets the lead time and still has capacity. */
export function earliestSlot(orders: Order[], capacity: number, leadDays: number, points: number, from = Date.now()) {
  for (let d = leadDays; d < leadDays + 30; d++) {
    const t = from + d * 86400000;
    const key = dayKey(t);
    if (new Date(key + "T12:00:00Z").getUTCDay() === 0) continue;
    if (pointsBooked(orders, key) + points <= capacity) return key;
  }
  return dayKey(from + leadDays * 86400000);
}
