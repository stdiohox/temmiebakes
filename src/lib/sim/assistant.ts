import type { OrderInput } from "../engine";
import type { AssistantSettings, CakeConfig, Cohort, Conversation, Course, Draft, Finish, KBEntry, Occasion, Order, PackageId, Product } from "../types";
import {
  DEFAULT_CAKE, FLAVOURS, PACKAGES, ZONES, dayKey, depositFor, describeCake, earliestSlot, pointsBooked, quoteCake, quoteCatering,
} from "./pricing";

// Tia, the simulated order assistant: deterministic intent + slot filling over the
// real price list, kitchen capacity and knowledge base. Production: workflows/02-ai-order-assistant.json.

export interface AssistantCtx {
  products: Product[];
  kb: KBEntry[];
  settings: AssistantSettings;
  orders: Order[];
  courses: Course[];
  cohorts: Cohort[];
  capacity: number;
  now: number;
}

export interface Reply {
  text: string;
  intent: "greeting" | "cake-quote" | "product" | "date" | "delivery" | "confirm" | "ordered" | "kb" | "class" | "class-booked" | "catering" | "track" | "handoff" | "fallback";
  extracted: string[];
  draft: Draft;
  quickReplies?: string[];
  productIds?: string[];
  handoff?: string;
  kbId?: string;
  createOrder?: Omit<OrderInput, "customerId" | "channel">;
  enrollCohortId?: string;
  cateringQuote?: { company: string; event: string; guests: number; dateISO: string; packageId: PackageId };
}

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const DAY = 86400000;

// ---------- parsing ----------

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Lagos-local date key (YYYY-MM-DD) from natural phrases. */
export function parseDate(text: string, now: number): string | undefined {
  const t = text.toLowerCase();
  const lagosToday = new Date(now + 3600000);
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const plus = (n: number) => key(new Date(lagosToday.getTime() + n * DAY));
  if (/\b(today|tonight|this evening)\b/.test(t)) return plus(0);
  if (/\b(tomorrow|tmrw|tmr|tomoro)\b/.test(t)) return plus(1);
  if (/\bnext tomorrow\b/.test(t)) return plus(2);
  const wd = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}|\\b${d.slice(0, 3)}\\b`).test(t));
  if (wd >= 0) {
    let diff = (wd - lagosToday.getUTCDay() + 7) % 7 || 7;
    if (/next (week )?/.test(t) && diff < 7) diff += 7;
    return plus(diff);
  }
  const m = t.match(/(\d{1,2})(st|nd|rd|th)?\s*(of\s*)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/) ?? t.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})/);
  if (m) {
    const day = Number(/\d/.test(m[1]) ? m[1] : m[2]);
    const mon = MONTHS.indexOf((/\d/.test(m[1]) ? m[4] : m[1]).slice(0, 3));
    let d = new Date(Date.UTC(lagosToday.getUTCFullYear(), mon, day));
    if (d.getTime() < lagosToday.getTime() - DAY) d = new Date(Date.UTC(lagosToday.getUTCFullYear() + 1, mon, day));
    return key(d);
  }
  const n = t.match(/\b(on|for) (the )?(\d{1,2})(st|nd|rd|th)\b/);
  if (n) {
    const day = Number(n[3]);
    let d = new Date(Date.UTC(lagosToday.getUTCFullYear(), lagosToday.getUTCMonth(), day));
    if (d.getTime() < lagosToday.getTime() - DAY) d = new Date(Date.UTC(lagosToday.getUTCFullYear(), lagosToday.getUTCMonth() + 1, day));
    return key(d);
  }
  if (/next week\b/.test(t)) return plus(7);
  return undefined;
}

const ZONE_ALIASES: [RegExp, string][] = [
  [/gra/i, "gra-ikeja"], [/ikeja|allen|opebi|alausa|oregun/i, "ikeja"], [/ogba|agege/i, "ogba"], [/maryland|anthony|mende/i, "maryland"],
  [/magodo|isheri|ojodu|berger/i, "magodo"], [/gbagada|ifako|anthony/i, "gbagada"], [/yaba|akoka|unilag|sabo/i, "yaba"], [/surulere|ojuelegba|aguda/i, "surulere"],
  [/ikoyi|obalende/i, "ikoyi"], [/\bvi\b|victoria island|oniru/i, "victoria-island"], [/festac|amuwo/i, "festac"], [/lekki|chevron|jakande|osapa|ikate/i, "lekki"],
  [/ikorodu/i, "ikorodu"], [/ajah|sangotedo|abraham|badore/i, "ajah"],
];
export const parseZone = (t: string) => ZONE_ALIASES.find(([re]) => re.test(t))?.[1];

const FLAVOUR_ALIASES: [RegExp, string][] = [
  [/red ?velvet/i, "Red velvet"], [/oreo|cookies (and|&|n) cream/i, "Oreo cookies & cream"], [/funfetti|sprinkle/i, "Funfetti"], [/marble/i, "Marble"],
  [/lemon/i, "Lemon & blueberry"], [/coconut/i, "Coconut"], [/carrot/i, "Carrot & walnut"], [/banana/i, "Banana caramel"], [/choc/i, "Rich chocolate"], [/vanilla/i, "Vanilla bean"],
];

function parseCake(t: string): Partial<CakeConfig> {
  const out: Partial<CakeConfig> = {};
  const size = t.match(/(\d{1,2})\s*(-|\s)?(inch|inches|in\b|"|”)/i);
  if (size) {
    const n = Number(size[1]);
    out.sizeInches = ([6, 8, 10, 12] as const).reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
  }
  const tiers = t.match(/(\d|two|three|double|triple)[ -]?tier/i);
  if (tiers) out.tiers = /3|three|triple/i.test(tiers[1]) ? 3 : 2;
  const fl = FLAVOUR_ALIASES.find(([re]) => re.test(t));
  if (fl && /cake/i.test(t)) out.flavour = fl[1];
  const finishes: [RegExp, Finish][] = [[/fondant/i, "fondant"], [/whipp?ed/i, "whipped-cream"], [/naked/i, "naked"], [/drip/i, "drip"], [/buttercream/i, "buttercream"]];
  const f = finishes.find(([re]) => re.test(t));
  if (f) out.finish = f[1];
  if (/sugar flower|figurine|gold leaf|luxury|premium|3d/i.test(t)) out.decoration = "premium";
  else if (/theme|character|topper|edible print|cartoon|emoji|frozen|spiderman/i.test(t)) out.decoration = "themed";
  else if (/simple|plain|minimal/i.test(t)) out.decoration = "simple";
  if (/heart/i.test(t)) out.shape = "heart";
  else if (/square/i.test(t)) out.shape = "square";
  const msg = t.match(/(?:write|inscription|message)[: ]+["“']?(.+?)["”']?(?: on it| on the cake|$)/i);
  if (msg) out.message = msg[1].trim().replace(/[.!]$/, "");
  return out;
}

function parseOccasion(t: string): Occasion | undefined {
  if (/wedding/i.test(t)) return "wedding";
  if (/anniversary/i.test(t)) return "anniversary";
  if (/baby ?shower|gender reveal|naming/i.test(t)) return "baby-shower";
  if (/graduat|convocation/i.test(t)) return "graduation";
  if (/valentine/i.test(t)) return "valentine";
  if (/birthday|bday|b-day|\d+(st|nd|rd|th)\b/i.test(t)) return "birthday";
  if (/office|staff|company|corporate/i.test(t)) return "corporate";
  return undefined;
}

const PRODUCT_HINTS: [RegExp, string][] = [
  [/pink drip|macaron cake/i, "pink-drip-and-macaron-cake"], [/chocolate drip/i, "chocolate-drip-celebration"], [/black forest/i, "classic-black-forest"],
  [/fraisier|strawberry cake/i, "strawberry-fraisier"], [/gold drip|luxe/i, "gold-drip-luxe"], [/ice ?cream/i, "ice-cream-cone-drip-cake"], [/sprinkle (party )?cake/i, "sprinkle-party-cake"],
  [/red velvet cupcake/i, "red-velvet-cupcakes"], [/(oreo|cookies (and|&) cream) cupcake/i, "cookies-and-cream-cupcakes"], [/funfetti cupcake/i, "funfetti-cupcakes"],
  [/chocolate cupcake|fudge cupcake/i, "chocolate-fudge-cupcakes"], [/strawberry cupcake/i, "strawberry-cupcakes"], [/lemon cupcake/i, "lemon-meringue-cupcakes"], [/unicorn|swirl/i, "unicorn-swirl-cupcakes"],
  [/parfait/i, "oreo-cake-parfait-cups"], [/tiramisu/i, "classic-tiramisu-tray"], [/cheesecake/i, "blueberry-cheesecake"], [/lemon tart/i, "lemon-tarts"], [/tartlet/i, "fruit-tartlets"],
  [/macaron/i, "french-macarons"], [/brownie/i, "fudgy-brownies"], [/cinnamon/i, "cinnamon-rolls"], [/doughnut|donut/i, "glazed-doughnuts"], [/croissant/i, "butter-croissants"],
  [/banana bread/i, "banana-bread-loaf"], [/cookie basket|gift basket/i, "cookie-gift-basket"], [/cookie/i, "chocolate-chip-cookies"], [/honey cake/i, "honey-cake-slices"],
];

function parseQty(t: string) {
  const dz = t.match(/(\d+|a|one|two)\s*dozen/i);
  if (dz) return (/\d/.test(dz[1]) ? Number(dz[1]) : /two/i.test(dz[1]) ? 2 : 1) * 2;
  const m = t.match(/(\d+)\s*(box|boxes|pack|packs|set|sets|tray|trays|loaf|loaves)/i);
  if (m) return Number(m[1]);
  const c = t.match(/(\d+)\s*(cupcakes|pieces|pcs)/i);
  if (c) return Math.max(1, Math.round(Number(c[1]) / 6));
  return undefined;
}

const parsePhone = (t: string) => t.match(/(\+?234|0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}/)?.[0];
const parseName = (t: string) => t.match(/(?:[Mm]y name is|[Ii] am|I'm|[Tt]his is|[Nn]ame:)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/)?.[1];
const yes = (t: string) => /^(yes|yeah|yep|sure|ok|okay|go ahead|please do|send|send it|send link|abeg send|confirm|book it|do it|perfect|great)\b/i.test(t.trim()) || /\b(send (the|me the)? ?(payment )?link|i'?ll pay|let'?s do it|book it)\b/i.test(t);

function fmtDate(key: string) {
  return new Date(key + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// ---------- reply ----------

export function respond(conv: Conversation, text: string, ctx: AssistantCtx): Reply {
  const t = text.trim();
  const lower = t.toLowerCase();
  const d: Draft = { ...conv.draft, cake: conv.draft.cake ? { ...conv.draft.cake } : undefined };
  const extracted: string[] = [];
  const firstAI = !conv.messages.some((m) => m.from === "ai");
  const intro = firstAI && ctx.settings.discloseAI ? `Hi! I'm ${ctx.settings.name}, Koretbakes' AI assistant. ` : "";
  const out = (r: Omit<Reply, "extracted" | "draft">): Reply => ({ ...r, text: intro + r.text, extracted, draft: d });

  // ---- slot extraction
  const date = parseDate(t, ctx.now);
  if (date) ((d.date = date), extracted.push(`Date: ${fmtDate(date)}`));
  const zone = parseZone(t);
  if (zone) ((d.zoneId = zone), (d.fulfilment = "delivery"), extracted.push(`Area: ${ZONES.find((z) => z.id === zone)!.name}`));
  if (/pick ?up|collect|i'?ll come/i.test(t)) ((d.fulfilment = "pickup"), extracted.push("Pickup"));
  const occ = parseOccasion(t);
  if (occ) ((d.occasion = occ), extracted.push(`Occasion: ${occ}`));
  const phone = parsePhone(t);
  if (phone) ((d.phone = phone), extracted.push(`Phone: ${phone}`));
  const name = parseName(t);
  if (name) ((d.name = name), extracted.push(`Name: ${name}`));
  const classContext = /class|classes|train|training|learn|course|academy|teach/i.test(t) || Boolean(d.courseId) || d.awaiting === "course";
  const cakeBits = classContext ? {} : parseCake(t);
  const isCakeTalk = /cake/i.test(t) && !/cupcake|cheesecake|honey cake|pancake/i.test(t);
  const hint = PRODUCT_HINTS.find(([re]) => re.test(t));
  const product = hint && !classContext ? ctx.products.find((p) => p.slug === hint[1]) : undefined;
  if (product) ((d.productId = product.id), (d.cake = undefined), extracted.push(`Item: ${product.name}`));
  else if (Object.keys(cakeBits).length || (isCakeTalk && /custom|design|inch|tier|fondant|flavou?r|velvet|chocolate|vanilla/i.test(t))) {
    d.productId = undefined;
    d.cake = { ...(d.cake ?? {}), ...cakeBits };
    Object.entries(cakeBits).forEach(([k, v]) => extracted.push(`${k}: ${v}`));
  }
  const qty = parseQty(t);
  if (qty) ((d.qty = qty), extracted.push(`Qty: ${qty}`));
  const guests = t.match(/(\d{2,4})\s*(staff|people|guests|persons|pax|heads|employees)/i);
  if (guests) ((d.guests = Number(guests[1])), extracted.push(`Guests: ${guests[1]}`));

  // ---- handoff rules first
  const trig = ctx.settings.handoff.find((h) => h.enabled && h.keywords.some((k) => k && lower.includes(k)));
  if (trig) {
    const lead = trig.id === "h1" ? "I'm so sorry about that. " : trig.id === "h2" ? "I understand. Prices are set by Koret, so " : trig.id === "h4" ? "Congratulations! Wedding cakes come with a tasting and consultation, so " : "";
    return out({ intent: "handoff", handoff: trig.label, text: `${lead}I'm passing you to Koret directly${trig.id === "h4" ? " to book your tasting" : ""}. She'll reply here shortly.` });
  }

  // ---- track an order
  if (/where is my|track|status of|tb-\d{3,}/i.test(t)) {
    const num = t.match(/tb-?(\d{3,})/i)?.[1];
    const o = num ? ctx.orders.find((x) => x.number === `TB-${num}`) : conv.customerId ? ctx.orders.filter((x) => x.customerId === conv.customerId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] : undefined;
    if (o) {
      const human: Record<string, string> = { enquiry: "an enquiry", quoted: "quoted and waiting for the deposit", confirmed: "confirmed and booked in the kitchen", baking: "in the oven right now", decorating: "being decorated", ready: "boxed and ready", "out-for-delivery": "on its way to you", delivered: "delivered", cancelled: "cancelled" };
      return out({ intent: "track", text: `${o.number} is ${human[o.status]}.${o.status !== "delivered" ? " " : ""}${o.status !== "delivered" ? `It's due ${fmtDate(dayKey(o.dueAt))}.` : ""}${o.paymentStatus === "deposit" ? ` Balance of ${naira(o.totalNGN - o.paidNGN)} is due before dispatch.` : ""}` });
    }
    return out({ intent: "track", text: "Could you share your order number (it starts with TB-) or the phone number you ordered with?" });
  }

  // ---- classes
  if (classContext) {
    const course = ctx.courses.find((c) => lower.includes(c.title.toLowerCase().split(" ")[0]) || (/buttercream/i.test(t) && c.id === "co-buttercream") || (/fondant|sugar/i.test(t) && c.id === "co-fondant") || (/kid|child/i.test(t) && c.id === "co-kids") || (/online/i.test(t) && c.id === "co-online") || (/beginner|basic|start/i.test(t) && c.id === "co-beginner") || (/pastry|small chops/i.test(t) && c.id === "co-pastry") || (/parfait|dessert/i.test(t) && c.id === "co-desserts")) ?? (d.courseId ? ctx.courses.find((c) => c.id === d.courseId) : undefined);
    const next = (c: Course) => ctx.cohorts.filter((h) => h.courseId === c.id && new Date(h.startDate).getTime() > ctx.now).sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];
    if (course) {
      d.courseId = course.id;
      const h = next(course);
      const seats = h ? h.seats - h.studentIds.length : 0;
      if (d.awaiting === "contact" && (d.phone || name) && h) {
        d.awaiting = undefined;
        return out({ intent: "class-booked", enrollCohortId: h.id, text: `Thank you${d.name ? `, ${d.name.split(" ")[0]}` : ""}! Your seat for ${course.title} starting ${fmtDate(dayKey(h.startDate))} is reserved. The ${naira(course.priceNGN / 2)} deposit link is on its way to WhatsApp.` });
      }
      if ((yes(t) || /book|hold|reserve|register|sign me up/i.test(t)) && h) {
        if (conv.channel === "web" && !d.phone) {
          d.awaiting = "contact";
          return out({ intent: "class", text: "Lovely! What name and WhatsApp number should I reserve the seat under?" });
        }
        return out({ intent: "class-booked", enrollCohortId: h.id, text: `Done! I've reserved your seat for ${course.title} starting ${fmtDate(dayKey(h.startDate))}. A 50% deposit of ${naira(course.priceNGN / 2)} secures it; the link is on its way on WhatsApp.` });
      }
      return out({
        intent: "class",
        text: `${course.title} is ${course.days} ${course.mode === "online" ? "days of online lessons" : `day${course.days > 1 ? "s" : ""} at our Ikeja studio`} for ${naira(course.priceNGN)}: ${course.outline.slice(0, 3).join(", ").toLowerCase()} and more. ${h ? `The next class starts ${fmtDate(dayKey(h.startDate))} with ${seats} seat${seats === 1 ? "" : "s"} left.` : "A new date is being scheduled."} Would you like me to hold a seat?`,
        quickReplies: ["Yes, hold a seat", "What do I need to bring?"],
      });
    }
    const list = ctx.courses.slice(0, 5).map((c) => `${c.title} (${naira(c.priceNGN)})`).join(", ");
    d.awaiting = "course";
    return out({ intent: "class", text: `We've trained over 200 students! Current courses: ${list}, plus a kids' camp and an online business course. Which one interests you?`, quickReplies: ["Beginner Cake Baking", "Buttercream Mastery", "Kids Baking Camp"] });
  }

  // ---- corporate catering
  if (/breakfast|canap|corporate|office|staff|company|event|guests|dessert table/i.test(t) && (d.guests || /breakfast|canap|corporate|dessert table/i.test(t))) {
    const pkg: PackageId = /canap|cocktail|reception/i.test(t) ? "canape-reception" : /dessert table/i.test(t) ? "dessert-table" : /cake|cupcake|celebrat/i.test(t) ? "cake-and-cupcakes" : "breakfast-box";
    d.packageId = pkg;
    if (!d.guests) {
      d.awaiting = "guests";
      return out({ intent: "catering", text: `Our ${PACKAGES[pkg].name.toLowerCase()} is ${naira(PACKAGES[pkg].perGuestNGN)} per guest (${PACKAGES[pkg].includes.slice(0, 3).join(", ").toLowerCase()}). How many guests are you expecting, and on what date?` });
    }
    const q = quoteCatering(pkg, d.guests);
    const dateISO = d.date ? `${d.date}T08:00:00.000Z` : new Date(ctx.now + 7 * DAY).toISOString();
    return out({
      intent: "catering",
      cateringQuote: { company: /visitor|guest/i.test(conv.name) ? "Company to confirm" : `${conv.name} (company to confirm)`, event: PACKAGES[pkg].name, guests: q.guests, dateISO, packageId: pkg },
      text: `For ${q.guests} guests, the ${PACKAGES[pkg].name.toLowerCase()} comes to ${naira(q.totalNGN)} (${naira(q.perGuestNGN)} per guest${q.discountPct ? `, ${q.discountPct}% volume discount applied` : ""})${q.belowMinimum ? `; note the minimum is ${PACKAGES[pkg].minGuests} guests` : ""}. I've drafted a formal quote and Ifeoma will email it with an invoice within the hour. We can also set this up as a monthly order.`,
    });
  }

  // ---- confirm & create order
  if (d.awaiting === "confirm" && yes(t)) {
    const built = buildOrder(d, ctx);
    if (built) {
      if (conv.channel === "web" && !d.phone) {
        d.awaiting = "contact";
        return out({ intent: "confirm", text: "Almost done! What name and WhatsApp number should the order be under?" });
      }
      d.awaiting = undefined;
      return out({ intent: "ordered", createOrder: built.order, text: `Your order is in! ${built.summary}. Pay the ${ctx.settings.depositPct}% deposit of ${naira(depositFor(built.total, ctx.settings.depositPct))} with the link below to lock in ${fmtDate(d.date!)}. You'll get updates on WhatsApp as it bakes.` });
    }
  }
  if (d.awaiting === "contact" && (d.phone || name)) {
    if (d.courseId) {
      const h = ctx.cohorts.filter((x) => x.courseId === d.courseId && new Date(x.startDate).getTime() > ctx.now).sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];
      if (h) {
        d.awaiting = undefined;
        return out({ intent: "class-booked", enrollCohortId: h.id, text: `Thanks${d.name ? `, ${d.name.split(" ")[0]}` : ""}! Your seat is reserved. The deposit link is on its way on WhatsApp.` });
      }
    }
    const built = buildOrder(d, ctx);
    if (built) {
      d.awaiting = undefined;
      return out({ intent: "ordered", createOrder: built.order, text: `Thank you${d.name ? `, ${d.name.split(" ")[0]}` : ""}! ${built.summary}. Your ${ctx.settings.depositPct}% deposit link (${naira(depositFor(built.total, ctx.settings.depositPct))}) is on its way to WhatsApp.` });
    }
  }

  // ---- knowledge base (when not mid-order with new details)
  const kb = ctx.kb.filter((k) => k.approved).map((k) => ({ k, hits: k.keywords.filter((w) => lower.includes(w)).length })).sort((a, b) => b.hits - a.hits)[0];
  const orderish = Boolean(product || d.cake || d.productId);
  if (kb?.hits && !Object.keys(cakeBits).length && !product && !(zone && orderish) && !(date && orderish)) {
    return out({ intent: "kb", kbId: kb.k.id, text: kb.k.answer, quickReplies: ["See the menu", "Build a custom cake"] });
  }

  // ---- product / cake flow
  if (d.cake || d.productId) {
    let leadDays = 1;
    let points = 1;
    let price = 0;
    let what = "";
    let productIds: string[] | undefined;
    if (d.cake) {
      const cake: CakeConfig = { ...DEFAULT_CAKE, decoration: "simple", ...d.cake };
      const q = quoteCake(cake);
      leadDays = q.leadDays;
      points = q.ovenPoints;
      price = q.totalNGN;
      what = describeCake(cake);
      d.quoteNGN = price;
    } else {
      const p = ctx.products.find((x) => x.id === d.productId)!;
      const qn = d.qty ?? 1;
      leadDays = p.leadDays;
      points = p.ovenPoints * qn;
      price = p.priceNGN * qn;
      what = `${qn > 1 ? `${qn} × ` : ""}${p.name} (${p.unit})`;
      productIds = [p.id];
      d.quoteNGN = price;
    }
    const pieces: string[] = [];
    if (!conv.draft.quoteNGN || conv.draft.quoteNGN !== price) pieces.push(`${/^(8|11|18)/.test(what) ? "An" : "A"} ${what} comes to ${naira(price)}${d.cake && !d.cake.flavour ? " (red velvet assumed, any flavour works)" : ""}.`);

    // date & capacity
    if (!d.date) {
      d.awaiting = "date";
      pieces.push(`It needs ${leadDays} day${leadDays > 1 ? "s" : ""}' notice. What date do you need it?`);
      return out({ intent: d.cake ? "cake-quote" : "product", productIds, text: pieces.join(" "), quickReplies: ["This Saturday", "Next Friday", "Tomorrow"] });
    }
    const earliest = dayKey(ctx.now + leadDays * DAY);
    if (d.date < earliest) {
      const alt = earliestSlot(ctx.orders, ctx.capacity, leadDays, points, ctx.now);
      d.date = alt;
      pieces.push(`That's a bit too soon for this design (it needs ${leadDays} day${leadDays > 1 ? "s" : ""}). The earliest we can do is ${fmtDate(alt)}. Shall I book that?`);
      d.awaiting = "confirm";
      return out({ intent: "date", productIds, text: pieces.join(" "), quickReplies: ["Yes, that works", "Something quicker?"] });
    }
    if (pointsBooked(ctx.orders, d.date) + points > ctx.capacity || new Date(d.date + "T12:00:00Z").getUTCDay() === 0) {
      const alt = earliestSlot(ctx.orders, ctx.capacity, Math.max(leadDays, Math.ceil((new Date(d.date).getTime() - ctx.now) / DAY)), points, ctx.now);
      pieces.push(`${fmtDate(d.date)} is fully booked in the kitchen, I'm afraid. The next free day is ${fmtDate(alt)}. Would that work?`);
      d.date = alt;
      d.awaiting = "confirm";
      return out({ intent: "date", productIds, text: pieces.join(" "), quickReplies: ["Yes, that works", "Pickup instead?"] });
    }
    if (!d.fulfilment) {
      d.awaiting = "zone";
      pieces.push(`${fmtDate(d.date)} is available. Would you like delivery (which area?) or pickup from our Ikeja studio?`);
      return out({ intent: "date", productIds, text: pieces.join(" "), quickReplies: ["Deliver to Lekki", "Deliver to Ikeja", "I'll pick up"] });
    }
    const fee = d.fulfilment === "delivery" ? ZONES.find((z) => z.id === d.zoneId)?.feeNGN ?? 0 : 0;
    const total = price + fee;
    if (total > 500000 && ctx.settings.handoff.find((h) => h.id === "h5")?.enabled) {
      return out({ intent: "handoff", handoff: "Very large order (over ₦500k)", text: `${pieces.join(" ")} For an order of this size, Koret will confirm the details personally. She'll message you shortly.` });
    }
    d.awaiting = "confirm";
    pieces.push(`${d.fulfilment === "delivery" ? `Delivery to ${ZONES.find((z) => z.id === d.zoneId)?.name} is ${naira(fee)}, so your` : "Pickup is free, so your"} total is ${naira(total)}. A ${ctx.settings.depositPct}% deposit of ${naira(depositFor(total, ctx.settings.depositPct))} confirms your ${fmtDate(d.date)} slot. Shall I send the payment link?`);
    return out({ intent: "confirm", productIds, text: pieces.join(" "), quickReplies: ["Yes, send the link", "Change the date"] });
  }

  // ---- general questions
  if (/menu|price ?list|what do you (sell|have)|how much|wetin|price/i.test(t)) {
    const best = ctx.products.filter((p) => p.tags.includes("bestseller")).slice(0, 4);
    return out({ intent: "product", productIds: best.map((p) => p.id), text: `Celebration cakes start from ${naira(32000)} for a 6-inch, signature designs from ${naira(52000)}, cupcakes from ${naira(13500)} a box and parfaits from ${naira(11000)}. Here are this week's favourites. Or tell me what you have in mind and I'll quote a custom cake.`, quickReplies: ["8-inch red velvet cake", "Cupcakes for tomorrow", "Corporate breakfast"] });
  }
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|howdy|hiya|sup|how far)\b/i.test(t)) {
    return out({ intent: "greeting", text: "What are we celebrating? I can quote a custom cake, check dates, share the menu, book a class or plan corporate catering.", quickReplies: ["Birthday cake", "See the menu", "Baking classes", "Corporate breakfast"] });
  }
  if (kb?.hits) return out({ intent: "kb", kbId: kb.k.id, text: kb.k.answer });
  return out({ intent: "fallback", text: "I can help with custom cakes, treats, delivery, classes and corporate catering. What would you like? If you'd rather speak to Koret, just say so.", quickReplies: ["Quote a cake", "See the menu", "Speak to Koret"] });
}

function buildOrder(d: Draft, ctx: AssistantCtx) {
  if (!d.date || !d.fulfilment) return null;
  const dueAt = `${d.date}T13:00:00.000Z`;
  if (d.cake) {
    const cake: CakeConfig = { ...DEFAULT_CAKE, decoration: "simple", ...d.cake };
    const q = quoteCake(cake);
    const fee = d.fulfilment === "delivery" ? ZONES.find((z) => z.id === d.zoneId)?.feeNGN ?? 0 : 0;
    return {
      total: q.totalNGN + fee,
      summary: `${describeCake(cake)[0].toUpperCase() + describeCake(cake).slice(1)}, for ${fmtDate(d.date)}`,
      order: { items: [{ name: `Custom cake: ${describeCake(cake)}`, qty: 1, unitPriceNGN: q.totalNGN, custom: cake }], fulfilment: d.fulfilment, zoneId: d.zoneId, dueAt, occasion: d.occasion ?? "birthday", ovenPoints: q.ovenPoints, assistedByAI: true, status: "quoted" as const },
    };
  }
  const p = ctx.products.find((x) => x.id === d.productId);
  if (!p) return null;
  const qty = d.qty ?? 1;
  const fee = d.fulfilment === "delivery" ? ZONES.find((z) => z.id === d.zoneId)?.feeNGN ?? 0 : 0;
  return {
    total: p.priceNGN * qty + fee,
    summary: `${qty > 1 ? `${qty} × ` : ""}${p.name} for ${fmtDate(d.date)}`,
    order: { items: [{ productId: p.id, name: p.name, qty, unitPriceNGN: p.priceNGN }], fulfilment: d.fulfilment, zoneId: d.zoneId, dueAt, occasion: d.occasion ?? "just-because", ovenPoints: p.ovenPoints * qty, assistedByAI: true, status: "quoted" as const },
  };
}

export const FLAVOUR_NAMES = FLAVOURS.map((f) => f.name);
