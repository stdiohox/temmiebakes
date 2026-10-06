import { DEFAULT_CAKE, FILLINGS, FLAVOURS, PACKAGES, ZONES, dayKey, depositFor, describeCake, pointsBooked, quoteCake, quoteCatering } from "../sim/pricing";
import type {
  AutoEvent, CakeConfig, Channel, Cohort, ContentDraft, Conversation, CateringQuote, Customer, DemoData, Enrollment, Occasion,
  Order, OrderItem, OrderStatus, Outbound, PackageId, PurchaseOrder, Segment, StockMove,
} from "../types";
import { ASSISTANT, AUTOMATIONS, COURSES, INGREDIENTS, KNOWLEDGE, PRODUCTS, RECIPES, STAFF, SUPPLIERS } from "./catalog";
import { rng } from "./rand";

const DAY = 86400000;
const HOUR = 3600000;

const FIRST = ["Adaeze", "Bimpe", "Chioma", "Damilola", "Ebun", "Funmi", "Halima", "Ifeoma", "Jumoke", "Kemi", "Lola", "Mojisola", "Nkechi", "Omolara", "Peju", "Ronke", "Simi", "Tolu", "Uche", "Yewande", "Zainab", "Amaka", "Bukola", "Folake", "Tobi", "Seyi", "Kunle", "Femi", "Tunde", "Chidi", "Emeka", "Segun", "Dayo", "Gbenga", "Ibrahim", "Obinna", "Rotimi", "Wale", "Yinka", "Sade"];
const LAST = ["Adebayo", "Okafor", "Balogun", "Eze", "Lawal", "Ogunleye", "Bello", "Nwachukwu", "Afolabi", "Adeleke", "Okonkwo", "Ibekwe", "Sanni", "Olatunji", "Ojo", "Fashola", "Oyelaran", "Ekwueme", "Danjuma", "Akinola", "Uzor", "Mbah", "Obi", "Ajayi", "Coker"];
const COMPANIES = ["Harbourline Logistics", "Kestrel Microfinance", "Orchid Health Clinics", "Tidewater Energy", "Bluepeak Advisory", "Lumen Pharma", "Crestview Schools", "Sapphire Realty"];
const KIDS = ["Tolu", "Ada", "Tobi", "Ife", "Dami", "Zara", "Kiki", "Ayo", "Nifemi", "Jide"];
const MESSAGES = ["Happy Birthday", "Happy 30th", "Happy Anniversary", "Congratulations", "Welcome Baby", "Happy Birthday Mummy", "Cheers to 40", "Well done Dr.", "Happy Birthday Boss"];
const COLOURS = ["Blush pink and gold", "Lilac and white", "Navy and silver", "Emerald and gold", "Pastel rainbow", "All white with gold leaf", "Red and black", "Baby blue"];

export function buildSeed(): DemoData {
  const r = rng(51023);
  const now = Date.now();
  const goLive = now - 70 * DAY;
  const iso = (t: number) => new Date(t).toISOString();
  const events: AutoEvent[] = [];
  let ev = 0;
  const log = (e: Omit<AutoEvent, "id">) => events.push({ id: `ev_${++ev}`, ...e });

  // ---------- customers ----------
  const customers: Customer[] = [];
  const zoneWeights: [string, number][] = [["ikeja", 22], ["gra-ikeja", 10], ["ogba", 9], ["maryland", 8], ["magodo", 8], ["gbagada", 7], ["yaba", 6], ["surulere", 6], ["ikoyi", 5], ["victoria-island", 4], ["lekki", 7], ["festac", 3], ["ikorodu", 2], ["ajah", 3]];
  for (let i = 0; i < 168; i++) {
    const seg: Segment = i < 10 ? "corporate" : i < 46 ? "student" : i < 52 ? "reseller" : "individual";
    const first = r.pick(FIRST);
    const last = r.pick(LAST);
    const createdAt = now - Math.floor(160 * Math.pow(r.next(), 0.6)) * DAY - r.int(0, 20) * HOUR;
    const post = createdAt >= goLive;
    const occs: Customer["occasions"] = [];
    if (seg === "individual" || seg === "student") {
      const n = r.int(1, 3);
      for (let k = 0; k < n; k++) {
        // a share of occasions fall in the next 30 days so reminders have work to do
        const t = r.chance(0.28) ? now + r.int(3, 30) * DAY : now + r.int(31, 360) * DAY;
        const mmdd = new Date(t).toISOString().slice(5, 10);
        const type: Occasion = r.weighted([["birthday", 70], ["anniversary", 20], ["just-because", 10]]);
        occs.push({ type, label: type === "birthday" ? (k === 0 ? `${first}'s birthday` : `${r.pick(KIDS)}'s birthday`) : type === "anniversary" ? "Wedding anniversary" : "Mother's Day treat", date: mmdd });
      }
    }
    customers.push({
      id: `cu-${String(i + 1).padStart(3, "0")}`,
      name: seg === "corporate" ? `${first} ${last}` : `${first} ${last}`,
      company: seg === "corporate" ? COMPANIES[i % COMPANIES.length] : undefined,
      phone: `+234 ${r.pick(["803", "806", "809", "812", "816", "703", "813", "802", "907"])} ${r.int(100, 999)} ${r.int(1000, 9999)}`,
      email: r.chance(0.6) || seg === "corporate" ? `${first}.${last}${r.int(1, 99)}@${seg === "corporate" ? COMPANIES[i % COMPANIES.length].toLowerCase().replace(/[^a-z]/g, "") + ".com" : r.pick(["gmail.com", "yahoo.com", "outlook.com"])}`.toLowerCase() : undefined,
      instagram: r.chance(0.7) ? `@${first.toLowerCase()}${r.pick(["_", ".", ""])}${last.toLowerCase().slice(0, r.int(3, 6))}${r.chance(0.4) ? r.int(1, 99) : ""}` : undefined,
      zoneId: r.weighted(zoneWeights),
      segment: seg,
      source: seg === "student" ? "class" : seg === "corporate" ? r.pick(["referral", "web", "phone"] as const) : post ? r.weighted([["instagram", 46], ["whatsapp", 30], ["web", 16], ["referral", 8]]) : r.weighted([["instagram", 55], ["whatsapp", 35], ["walk-in", 5], ["referral", 5]]),
      createdAt: iso(createdAt),
      tags: [],
      occasions: occs,
      consentWhatsApp: r.chance(0.92),
      firstResponseMins: post ? +(0.3 + r.next() * 1.4).toFixed(2) : r.int(35, 340),
    });
  }

  // ---------- orders ----------
  const orders: Order[] = [];
  const singles = PRODUCTS.filter((p) => p.category !== "celebration-cakes");
  const signature = PRODUCTS.filter((p) => p.category === "celebration-cakes" && p.priceNGN < 200000);
  let num = 1001;

  const randomCake = (): CakeConfig => ({
    ...DEFAULT_CAKE,
    shape: r.weighted([["round", 80], ["square", 10], ["heart", 10]]),
    sizeInches: r.weighted([[6, 20], [8, 50], [10, 22], [12, 8]]),
    tiers: r.weighted([[1, 80], [2, 16], [3, 4]]),
    flavour: r.pick(FLAVOURS).name,
    filling: r.pick(FILLINGS).name,
    finish: r.weighted([["buttercream", 45], ["whipped-cream", 15], ["drip", 18], ["fondant", 14], ["naked", 8]]),
    decoration: r.weighted([["simple", 30], ["themed", 50], ["premium", 20]]),
    colours: r.pick(COLOURS),
    message: r.pick(MESSAGES),
  });

  const makeOrder = (c: Customer, due: number, created: number, opts: { forceStatus?: OrderStatus; channel?: Channel; corporate?: boolean; lost?: boolean } = {}) => {
    const post = created >= goLive;
    const items: OrderItem[] = [];
    let occasion: Occasion = r.weighted([["birthday", 62], ["anniversary", 9], ["just-because", 12], ["baby-shower", 5], ["graduation", 5], ["valentine", 2], ["wedding", 1]]);
    let points = 0;
    if (opts.corporate) {
      occasion = "corporate";
      const p = r.pick(singles);
      const qty = r.int(6, 20);
      items.push({ productId: p.id, name: p.name, qty, unitPriceNGN: p.priceNGN });
      points += p.ovenPoints * Math.ceil(qty / 2);
    } else if (r.chance(0.5)) {
      const cake = randomCake();
      const q = quoteCake(cake);
      items.push({ name: `Custom cake: ${describeCake(cake)}`, qty: 1, unitPriceNGN: q.totalNGN, custom: cake });
      points += q.ovenPoints;
    } else if (r.chance(0.45)) {
      const p = r.pick(signature);
      items.push({ productId: p.id, name: p.name, qty: 1, unitPriceNGN: p.priceNGN });
      points += p.ovenPoints;
    }
    if (!items.length || r.chance(0.35)) {
      const p = r.pick(singles);
      const qty = r.weighted([[1, 60], [2, 30], [3, 10]]);
      items.push({ productId: p.id, name: p.name, qty, unitPriceNGN: p.priceNGN });
      points += p.ovenPoints * qty;
    }
    const subtotal = items.reduce((s, i) => s + i.qty * i.unitPriceNGN, 0);
    const fulfilment = r.chance(0.78) ? "delivery" : "pickup";
    const zone = ZONES.find((z) => z.id === c.zoneId)!;
    const deliveryFee = fulfilment === "delivery" ? zone.feeNGN : 0;
    const total = subtotal + deliveryFee;
    const channel: Channel = opts.channel ?? (opts.corporate ? "corporate" : post ? r.weighted([["instagram", 44], ["whatsapp", 32], ["web", 18], ["walk-in", 3], ["phone", 3]]) : r.weighted([["instagram", 52], ["whatsapp", 38], ["walk-in", 5], ["phone", 5]]));
    const o: Order = {
      id: `or-${num}`,
      number: `TB-${num++}`,
      customerId: c.id,
      channel,
      items,
      subtotalNGN: subtotal,
      deliveryFeeNGN: deliveryFee,
      discountNGN: 0,
      totalNGN: total,
      depositNGN: depositFor(total, 50),
      paidNGN: 0,
      paymentStatus: "unpaid",
      status: "confirmed",
      occasion,
      dueAt: iso(due),
      fulfilment,
      zoneId: fulfilment === "delivery" ? zone.id : undefined,
      address: fulfilment === "delivery" ? `${r.int(2, 48)} ${r.pick(["Allen Avenue", "Opebi Road", "Toyin Street", "Adeniyi Jones", "Isaac John Street", "Admiralty Way", "Bode Thomas", "Herbert Macaulay Way", "Ogunlana Drive", "Awolowo Road"])}, ${zone.name}` : undefined,
      riderId: fulfilment === "delivery" ? r.pick(["st-musa", "st-emeka"]) : undefined,
      ovenPoints: Math.round(points * 2) / 2,
      createdAt: iso(created),
      updatedAt: iso(Math.min(now - HOUR, due)),
      history: [],
      assistedByAI: post && channel !== "walk-in" && channel !== "phone" && r.chance(0.82),
    };
    // status by timing
    const hoursToDue = (due - now) / HOUR;
    let status: OrderStatus;
    if (opts.lost) status = "cancelled";
    else if (opts.forceStatus) status = opts.forceStatus;
    else if (hoursToDue < -2) status = r.chance(post ? 0.015 : 0.04) ? "cancelled" : "delivered";
    else if (hoursToDue < 3) status = fulfilment === "delivery" ? r.pick(["out-for-delivery", "ready"] as const) : "ready";
    else if (hoursToDue < 20) status = r.pick(["baking", "decorating"] as const);
    else if (hoursToDue < 72) status = r.weighted([["confirmed", 70], ["baking", 20], ["quoted", 10]]);
    else status = r.weighted([["confirmed", 60], ["quoted", 25], ["enquiry", 15]]);
    o.status = status;
    if (status === "delivered" || status === "out-for-delivery" || status === "ready") ((o.paidNGN = total), (o.paymentStatus = "paid"));
    else if (status === "baking" || status === "decorating") ((o.paidNGN = r.chance(0.6) ? total : o.depositNGN), (o.paymentStatus = o.paidNGN === total ? "paid" : "deposit"));
    else if (status === "confirmed") ((o.paidNGN = o.depositNGN), (o.paymentStatus = "deposit"));
    if (status === "quoted") o.quoteSentAt = iso(created + (post ? 2 * 60000 : r.int(1, 5) * HOUR));
    const steps: OrderStatus[] = ["enquiry", "quoted", "confirmed", "baking", "decorating", "ready", "out-for-delivery", "delivered"];
    const upto = status === "cancelled" ? 2 : steps.indexOf(status);
    for (let k = 0; k <= upto; k++) {
      const t = k <= 2 ? created + k * (post ? 6 : 90) * 60000 : due - (steps.length - 1 - k) * 2.5 * HOUR;
      o.history.push({ at: iso(Math.min(t, now)), status: steps[k], by: k <= 2 ? (o.assistedByAI ? "Tia (AI)" : "Ifeoma") : k >= 6 ? "Dispatch" : "Kitchen" });
    }
    if (opts.lost) {
      o.history = o.history.slice(0, 2);
      o.quoteSentAt = iso(created + (post ? 2 * 60000 : r.int(1, 6) * HOUR));
      o.history.push({ at: iso(created + 2 * DAY), status: "cancelled", by: "Quote expired" });
    } else if (status === "cancelled") o.history.push({ at: iso(created + DAY), status: "cancelled", by: "Ifeoma" });
    if (status === "delivered") {
      o.lateMins = r.chance(post ? 0.06 : 0.3) ? r.int(20, 95) : 0;
      if (post && r.chance(0.72)) {
        o.reviewRequested = true;
        if (r.chance(0.68)) {
          o.rating = r.weighted([[5, 72], [4, 22], [3, 6]]);
          o.review = o.rating === 5 ? r.pick(["Absolutely beautiful and so moist. Everyone asked who made it!", "Exactly like the picture. Delivered on time too.", "The red velvet is the best in Lagos, no cap.", "My daughter screamed when she saw it. Thank you Temmie!", "Tasted as good as it looked. Will order again."]) : o.rating === 4 ? r.pick(["Lovely cake, delivery was a bit late but worth it.", "Great taste, colours slightly different from my reference."]) : "Cake was nice but the icing had started melting by the time it arrived.";
        }
      }
    }
    return o;
  };

  // historical + upcoming orders, respecting daily oven capacity for future days
  const capacity = 20;
  customers.forEach((c) => {
    const created = new Date(c.createdAt).getTime();
    const n0 = c.segment === "corporate" ? r.int(2, 6) : c.segment === "reseller" ? r.int(3, 7) : c.segment === "student" ? r.int(0, 2) : r.weighted([[1, 38], [2, 26], [3, 18], [4, 10], [6, 8]]);
    // newer customers have had less time to re-order; without this, orders bunch into the last few weeks
    const n = n0 && Math.max(1, Math.round(n0 * Math.min(1, (now - created) / (120 * DAY))));
    for (let k = 0; k < n; k++) {
      const placed = created + r.int(0, Math.max(1, Math.floor((now - created) / DAY))) * DAY + r.int(8, 21) * HOUR;
      if (placed > now) continue;
      const lead = r.int(1, 6);
      let due = placed + lead * DAY;
      due = Math.floor(due / DAY) * DAY + (r.pick([10, 11, 12, 13, 14, 15, 16, 17]) - 1) * HOUR; // Lagos 10:00-17:00
      if (new Date(due).getUTCDay() === 0) due += DAY;
      const o = makeOrder(c, due, placed, { corporate: c.segment === "corporate" && r.chance(0.7) });
      if (dayKey(due) >= dayKey(now) && pointsBooked(orders, dayKey(due)) + o.ovenPoints > capacity * (dayKey(due) === dayKey(now) ? 0.9 : 0.72)) continue;
      orders.push(o);
      // after go-live, reminders and re-order nudges bring customers back more often, ramping up over time
      if (placed >= goLive && c.segment === "individual" && r.chance(0.5 * Math.min(1, (placed - goLive) / (70 * DAY)))) {
        const again = placed + r.int(2, 9) * DAY;
        let due2 = Math.floor((again + r.int(1, 4) * DAY) / DAY) * DAY + (r.pick([10, 11, 12, 13, 14, 15, 16]) - 1) * HOUR;
        if (new Date(due2).getUTCDay() === 0) due2 += DAY;
        const o2 = again < now ? makeOrder(c, due2, again) : null;
        if (o2 && !(dayKey(due2) >= dayKey(now) && pointsBooked(orders, dayKey(due2)) + o2.ovenPoints > capacity * 0.72)) orders.push(o2);
      }
      // enquiries that never paid: slow replies lost far more of these before automation
      const post = placed >= goLive;
      if (due < now && r.chance(post ? 0.32 : 0.85)) orders.push(makeOrder(c, due, placed - r.int(1, 30) * HOUR, { lost: true }));
    }
  });
  // a busy, believable next 7 days
  for (let d = 0; d <= 7; d++) {
    const t = Math.floor((now + d * DAY) / DAY) * DAY;
    if (new Date(t).getUTCDay() === 0) continue;
    let guard = 0;
    while (pointsBooked(orders, dayKey(t + 12 * HOUR)) < capacity * (d === 0 ? 0.85 : d < 3 ? 0.7 : 0.5) && guard++ < 20) {
      const c = r.pick(customers.filter((x) => x.segment === "individual"));
      const due = t + (r.pick([10, 11, 12, 13, 14, 15, 16, 17]) - 1) * HOUR;
      if (due < now + HOUR) continue; // today's filler only books slots still ahead, never past revenue
      const placed = Math.min(now - HOUR, due - r.int(1, 6) * DAY);
      const o = makeOrder(c, due, placed);
      if (pointsBooked(orders, dayKey(due)) + o.ovenPoints > capacity * 0.8) break;
      orders.push(o);
    }
  }
  orders.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  orders.forEach((o, i) => ((o.number = `TB-${1001 + i}`), (o.id = `or-${1001 + i}`)));
  // customer last order + tags
  customers.forEach((c) => {
    const os = orders.filter((o) => o.customerId === c.id && o.status !== "cancelled");
    c.lastOrderAt = os.map((o) => o.createdAt).sort().pop();
    const spend = os.reduce((s, o) => s + o.totalNGN, 0);
    c.tags = [
      os.length >= 4 ? "vip" : os.length >= 2 ? "repeat" : os.length === 1 ? "first-order" : "lead",
      spend > 400000 ? "big-spender" : "",
      c.segment !== "individual" ? c.segment : "",
      os.some((o) => o.items.some((i) => i.custom)) ? "custom-cakes" : "",
      os.some((o) => o.items.some((i) => i.productId && PRODUCTS.find((p) => p.id === i.productId)?.category === "cupcakes")) ? "cupcakes" : "",
    ].filter(Boolean);
  });

  // ---------- conversations (hero stories) ----------
  const cBy = (i: number) => customers[i];
  const p = (slug: string) => PRODUCTS.find((x) => x.slug === slug)!.id;
  const convs: { cust: number; channel: Conversation["channel"]; handle?: string; status: Conversation["status"]; reason?: string; mins: number; msgs: [Conversation["messages"][number]["from"], string, string[]?][] }[] = [
    { cust: 60, channel: "instagram", status: "ai", mins: 14, msgs: [
      ["user", "Hi dear, how much is the pink drip cake? For my daughter's 7th birthday on Saturday"],
      ["ai", "Hi! I'm Tia, Temmiebakes' AI assistant. The Pink Drip & Macaron Cake is ₦72,000 for an 8-inch tall cake (serves about 24). Saturday is available. Would you like it delivered, and to which area?", [p("pink-drip-and-macaron-cake")]],
      ["user", "Yes deliver to Magodo. Can you write Happy 7th Birthday Ife on it"],
      ["ai", "Of course. Delivery to Magodo is ₦4,000, so your total is ₦76,000. A 50% deposit of ₦38,000 confirms your Saturday slot. Shall I send the payment link?"],
    ] },
    { cust: 64, channel: "whatsapp", status: "ai", mins: 52, msgs: [
      ["user", "Good evening. Abeg how much be 10 inch red velvet cake with fondant? Na for my husband 40th"],
      ["ai", "Good evening! I'm Tia, Temmiebakes' AI assistant. A 10-inch round red velvet with cream cheese filling and a fondant finish, themed decoration, comes to ₦139,500 and serves about 35. When is the party?"],
      ["user", "Next week Friday"],
      ["ai", "Next Friday is available. Fondant designs need 4 days' notice, so we're fine. Would you like 'Happy 40th' in gold? I can also add 12 red velvet cupcakes for the guests at ₦30,000."],
    ] },
    { cust: 71, channel: "instagram", status: "handoff", reason: "Complaint or refund", mins: 34, msgs: [
      ["user", "My cake arrived and the icing had melted on one side 😩"],
      ["ai", "I'm so sorry, that's not the experience we want for you. I'm passing this straight to Temmie so she can make it right."],
      ["system", "Handed to Temmie · reason: Complaint or refund"],
    ] },
    { cust: 14, channel: "web", status: "ai", mins: 300, msgs: [
      ["user", "Do you run baking classes for beginners?"],
      ["ai", "Yes! We've trained over 200 students. Beginner Cake Baking is 3 days for ₦120,000, with ingredients, an apron and a certificate included. The next class starts soon and there are 4 seats left. Would you like me to hold one for you?"],
    ] },
    { cust: 3, channel: "web", status: "staff", mins: 2200, msgs: [
      ["user", "We need breakfast for 60 staff on Monday for our quarterly meeting. Can you do it?"],
      ["ai", "We can. The corporate breakfast box is ₦7,500 per guest (croissant or cinnamon roll, wrap, fruit, banana bread and juice), so 60 guests comes to ₦450,000. I've drafted a quote, and Ifeoma will send it on your company letterhead within the hour."],
      ["agent", "Hello, Ifeoma here. Quote CQ-214 is in your inbox. We can also set this up monthly with 5% off."],
    ] },
    { cust: 86, channel: "instagram", status: "ai", mins: 8, msgs: [
      ["user", "Una dey deliver to Lekki? I want cupcakes tomorrow"],
      ["ai", "Yes we do! Delivery to Lekki Phase 1 is ₦9,500. Cupcakes need 24 hours' notice, so tomorrow works if we confirm today. Our bestsellers are Red Velvet (₦15,000 for 6) and Cookies & Cream (₦16,000 for 6). Which one would you like?", [p("red-velvet-cupcakes"), p("cookies-and-cream-cupcakes")]],
    ] },
  ];
  const conversations: Conversation[] = convs.map((s, k) => {
    const c = cBy(s.cust);
    const end = now - s.mins * 60000;
    const start = end - (s.msgs.length - 1) * 70000;
    return {
      id: `cv-${k + 1}`,
      channel: s.channel,
      customerId: c.id,
      name: c.name,
      handle: s.handle ?? (s.channel === "whatsapp" ? c.phone : s.channel === "instagram" ? c.instagram ?? `@${c.name.toLowerCase().replace(/[^a-z]+/g, ".")}` : undefined),
      status: s.status,
      handoffReason: s.reason,
      draft: {},
      messages: s.msgs.map(([from, text, productIds], j) => ({ id: `m-${k}-${j}`, from, text, at: iso(start + j * 70000), productIds })),
      startedAt: iso(start),
      lastAt: iso(end),
      unread: s.status === "ai" && s.mins < 60 ? 1 : 0,
      review: s.mins > 1000 ? "approved" : undefined,
    };
  });

  // ---------- corporate quotes ----------
  const corpCustomers = customers.filter((c) => c.segment === "corporate");
  const EVENTS = ["Quarterly town hall breakfast", "Product launch reception", "Staff appreciation day", "Board meeting breakfast", "End-of-year party", "Client cocktail evening", "Founders' day celebration"];
  const quotes: CateringQuote[] = Array.from({ length: 14 }, (_, k) => {
    const c = corpCustomers[k % corpCustomers.length];
    const pkg: PackageId = r.pick(Object.keys(PACKAGES) as PackageId[]);
    const guests = r.pick([20, 30, 40, 60, 80, 120, 150]);
    const q = quoteCatering(pkg, guests);
    const created = now - r.int(1, 60) * DAY;
    const status = k < 3 ? "draft" : r.weighted([["sent", 35], ["accepted", 45], ["declined", 20]]) as CateringQuote["status"];
    return {
      id: `cq-${k + 1}`,
      number: `CQ-${201 + k}`,
      customerId: c.id,
      company: c.company!,
      event: r.pick(EVENTS),
      guests: q.guests,
      date: iso(created + r.int(5, 30) * DAY),
      packageId: pkg,
      extras: r.chance(0.4) ? [{ name: "Branded cupcake toppers", priceNGN: 15000 }] : [],
      perGuestNGN: q.perGuestNGN,
      totalNGN: q.totalNGN,
      status,
      recurring: status === "accepted" && r.chance(0.4) ? "monthly" : undefined,
      createdAt: iso(created),
      sentAt: status === "draft" ? undefined : iso(created + 40 * 60000),
    };
  });
  quotes.push({ id: "cq-15", number: "CQ-214", customerId: cBy(3).id, company: cBy(3).company!, event: "Quarterly meeting breakfast", guests: 60, date: iso(now + 4 * DAY), packageId: "breakfast-box", extras: [], perGuestNGN: 7500, totalNGN: 450000, status: "sent", createdAt: iso(now - 37 * HOUR), sentAt: iso(now - 36 * HOUR) });

  // ---------- academy ----------
  const students = customers.filter((c) => c.segment === "student");
  const cohorts: Cohort[] = [];
  const enrollments: Enrollment[] = [];
  COURSES.forEach((co, k) => {
    const past: Cohort = { id: `ch-${co.id}-1`, courseId: co.id, startDate: iso(now - r.int(20, 80) * DAY), seats: co.level === "Kids" ? 15 : 12, studentIds: [] };
    const next: Cohort = { id: `ch-${co.id}-2`, courseId: co.id, startDate: iso(now + (k + 1) * 6 * DAY), seats: co.level === "Kids" ? 15 : co.mode === "online" ? 40 : 12, studentIds: [] };
    cohorts.push(past, next);
    [past, next].forEach((ch, j) => {
      const take = j === 0 ? r.int(6, 10) : r.int(3, Math.min(8, ch.seats - 3));
      for (let s = 0; s < take; s++) {
        const st = students[(k * 7 + s * 3 + j * 11) % students.length];
        if (ch.studentIds.includes(st.id)) continue;
        ch.studentIds.push(st.id);
        const paid = j === 0 ? co.priceNGN : r.chance(0.6) ? co.priceNGN : co.priceNGN / 2;
        enrollments.push({ id: `en-${enrollments.length + 1}`, cohortId: ch.id, customerId: st.id, paidNGN: paid, status: j === 0 ? "completed" : paid === co.priceNGN ? "paid" : "reserved", certificate: j === 0, createdAt: iso(new Date(ch.startDate).getTime() - r.int(5, 25) * DAY) });
      }
    });
  });

  // ---------- events & outbound ----------
  const outbound: Outbound[] = [];
  let oId = 0;
  const cust = (id: string) => customers.find((c) => c.id === id)!;
  const first = (id: string) => cust(id).name.split(" ")[0];
  const push = (o: Omit<Outbound, "id">) => outbound.push({ id: `ob-${++oId}`, ...o });
  orders.forEach((o) => {
    const created = new Date(o.createdAt).getTime();
    if (created < goLive) return;
    const label = o.items[0].custom ? "custom cake" : o.items[0].name;
    if (o.channel !== "walk-in" && o.channel !== "phone") log({ at: o.createdAt, automation: "order-intake", kind: "trigger", title: `New ${o.channel === "instagram" ? "Instagram DM" : o.channel === "whatsapp" ? "WhatsApp" : o.channel === "web" ? "website" : "corporate"} enquiry logged as ${o.number}`, detail: `${cust(o.customerId).name} · ${label}`, customerId: o.customerId, orderId: o.id, minutesSaved: 6 });
    if (o.assistedByAI) log({ at: iso(created + 50000), automation: "ai-assistant", kind: "ai", title: `Tia quoted ${o.number} in under a minute`, detail: `₦${o.totalNGN.toLocaleString()} incl. delivery · capacity checked for ${dayKey(o.dueAt)}`, customerId: o.customerId, orderId: o.id, minutesSaved: 12 });
    if (o.paymentStatus !== "unpaid") log({ at: iso(created + 25 * 60000), automation: "payment-reminders", kind: "action", title: `Deposit received for ${o.number}`, detail: `₦${o.depositNGN.toLocaleString()} via Paystack · slot booked`, customerId: o.customerId, orderId: o.id, minutesSaved: 4 });
    if (o.status === "delivered") {
      const due = new Date(o.dueAt).getTime();
      log({ at: iso(due - 50 * 60000), automation: "order-updates", kind: "action", title: `${o.number} out for delivery: customer notified`, detail: `Rider ETA sent on WhatsApp`, customerId: o.customerId, orderId: o.id, minutesSaved: 4 });
      if (o.reviewRequested) {
        log({ at: iso(due + DAY), automation: "review-request", kind: "action", title: `Review requested for ${o.number}`, detail: o.rating ? `Rated ${o.rating}/5` : "Awaiting reply", customerId: o.customerId, orderId: o.id, minutesSaved: 3 });
        if (due + DAY < now) push({ channel: "whatsapp", customerId: o.customerId, automationId: "review-request", body: `Hi ${first(o.customerId)}, we hope the ${label} was a hit! Could you rate it 1-5 and share a photo for our page?`, scheduledFor: iso(due + DAY), sentAt: iso(due + DAY), status: o.rating ? "replied" : "read", orderId: o.id });
      }
    }
    if (o.status === "quoted") push({ channel: o.channel === "instagram" ? "instagram" : "whatsapp", customerId: o.customerId, automationId: "quote-follow-up", body: `Hi ${first(o.customerId)}, just checking you saw your quote for the ${label} (₦${o.totalNGN.toLocaleString()}). Your slot is held until tonight. Pay the deposit here: pay.temmiebakes.ng/${o.number}`, scheduledFor: iso(created + 6 * HOUR), sentAt: created + 6 * HOUR < now ? iso(created + 6 * HOUR) : undefined, status: created + 6 * HOUR < now ? "delivered" : "scheduled", orderId: o.id });
    if (["confirmed", "baking", "decorating"].includes(o.status) && o.paymentStatus === "deposit") {
      const at = new Date(o.dueAt).getTime() - 2 * DAY;
      push({ channel: "whatsapp", customerId: o.customerId, automationId: "payment-reminders", body: `Hi ${first(o.customerId)}, your ${label} is scheduled for ${new Date(o.dueAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}. The balance of ₦${(o.totalNGN - o.paidNGN).toLocaleString()} is due before dispatch: pay.temmiebakes.ng/${o.number}`, scheduledFor: iso(Math.max(at, created + HOUR)), sentAt: at < now ? iso(at) : undefined, status: at < now ? "read" : "scheduled", orderId: o.id });
    }
  });
  // occasion reminders that turned into orders (revenue influenced) + upcoming reminders
  customers.forEach((c) => {
    c.occasions.forEach((oc) => {
      const year = new Date(now).getUTCFullYear();
      const t = new Date(`${year}-${oc.date}T09:00:00Z`).getTime();
      const remindAt = t - 14 * DAY;
      if (remindAt > now && remindAt < now + 16 * DAY) push({ channel: "whatsapp", customerId: c.id, automationId: "occasion-reminders", body: `Hi ${c.name.split(" ")[0]}! ${oc.label} is on ${new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}. Shall we bake something special? Order this week and get free delivery.`, scheduledFor: iso(remindAt), status: "scheduled" });
    });
  });
  for (let d = 69; d >= 0; d--) {
    const t = now - d * DAY;
    const ramp = Math.min(1, (70 - d) / 21) * 0.6 + 0.4;
    const n = (lo: number, hi: number) => Math.max(1, Math.round(r.int(lo, hi) * ramp));
    const occ = n(1, 4), reo = n(2, 6), upd = n(6, 12), stock = r.chance(0.3);
    const occRev = r.chance(0.45) ? r.pick([48000, 52000, 58000, 62000, 72000]) : 0;
    log({ at: iso(t - 14 * HOUR), automation: "occasion-reminders", kind: "action", title: `${occ} birthday & anniversary reminders sent`, detail: occRev ? `1 turned into an order (₦${occRev.toLocaleString()})` : "Personal offers with last year's cake photo", minutesSaved: occ * 6, revenueNGN: occRev || undefined });
    log({ at: iso(t - 13 * HOUR), automation: "reorder-nudge", kind: "action", title: `${reo} re-order nudges sent to treat customers`, detail: "Flavour of the week + one-tap re-order", minutesSaved: reo * 4, revenueNGN: r.chance(0.35) ? r.pick([12000, 14500, 15000, 24000]) : undefined });
    log({ at: iso(t - 17.5 * HOUR), automation: "daily-report", kind: "action", title: "Morning kitchen brief sent to Temmie", detail: `${upd} bakes · ${Math.max(1, upd - 3)} deliveries · balances due flagged`, minutesSaved: 20 });
    log({ at: iso(t - 10 * HOUR), automation: "order-updates", kind: "action", title: `${upd} order status updates sent`, detail: "Baking, ready and out-for-delivery messages with photos", minutesSaved: upd * 3 });
    if (stock) log({ at: iso(t - 16 * HOUR), automation: "stock-reorder", kind: "alert", title: "Low stock: purchase order drafted", detail: r.pick(["Icing sugar and whipping cream to Ikeja Baking Supplies", "Cream cheese and butter to Lagos Dairy Hub", "Strawberries and eggs to Fresh Farm", "Cake boxes to Boxit Packaging"]), minutesSaved: 15 });
  }
  conversations.forEach((cv) => cv.status === "handoff" && log({ at: cv.messages.find((m) => m.from === "system")!.at, automation: "ai-assistant", kind: "handoff", title: "Handed to Temmie", detail: cv.handoffReason, customerId: cv.customerId, minutesSaved: 2 }));
  quotes.filter((q) => q.sentAt).forEach((q) => log({ at: q.sentAt!, automation: "corporate", kind: "action", title: `Catering quote ${q.number} sent to ${q.company}`, detail: `${q.guests} guests · ₦${q.totalNGN.toLocaleString()}`, customerId: q.customerId, minutesSaved: 35 }));
  enrollments.filter((e) => new Date(e.createdAt).getTime() > goLive).forEach((e) => log({ at: e.createdAt, automation: "academy", kind: "action", title: "Class seat booked and payment link sent", detail: COURSES.find((c) => c.id === cohorts.find((x) => x.id === e.cohortId)!.courseId)!.title, customerId: e.customerId, minutesSaved: 10 }));

  // ---------- stock moves & purchase orders ----------
  const stockMoves: StockMove[] = [];
  INGREDIENTS.forEach((ing, k) => {
    for (let j = 0; j < 3; j++) stockMoves.push({ id: `sm-${k}-${j}`, at: iso(now - r.int(0, 6) * DAY - r.int(1, 12) * HOUR), ingredientId: ing.id, qty: -+(ing.usage7d / 3).toFixed(2), reason: "Used in production" });
    if (k % 4 === 0) stockMoves.push({ id: `sm-${k}-in`, at: iso(now - r.int(3, 9) * DAY), ingredientId: ing.id, qty: Math.round(ing.reorderAt * 1.5), reason: "Delivery received" });
  });
  const purchaseOrders: PurchaseOrder[] = [
    { id: "po-1", supplierId: "su-dairy", lines: [{ ingredientId: "in-cheese", qty: 6 }, { ingredientId: "in-cream", qty: 12 }], totalNGN: 6 * 14000 + 12 * 7800, status: "draft", createdAt: iso(now - 3 * HOUR) },
    { id: "po-2", supplierId: "su-ikeja", lines: [{ ingredientId: "in-icing", qty: 20 }, { ingredientId: "in-flour", qty: 25 }], totalNGN: 20 * 2800 + 25 * 1600, status: "sent", createdAt: iso(now - DAY) },
    { id: "po-3", supplierId: "su-box", lines: [{ ingredientId: "in-boxes", qty: 60 }, { ingredientId: "in-cupbox", qty: 40 }], totalNGN: 60 * 900 + 40 * 500, status: "received", createdAt: iso(now - 6 * DAY) },
  ];

  // ---------- content ----------
  const content: ContentDraft[] = [
    { id: "ct-1", kind: "instagram-post", productId: p("pink-drip-and-macaron-cake"), title: "Pink Drip & Macaron Cake", body: "Pink, tall and dripping with white chocolate 💗 Our Pink Drip & Macaron Cake serves 24 and steals every party. 8\" from ₦72,000. DM 'PINK' or tap the link in bio to order.\n\n#temmiebakes #lagoscakes #cakesinlagos #ikejacakes #birthdaycakelagos", status: "approved", createdAt: iso(now - DAY), scheduledFor: iso(now + 6 * HOUR) },
    { id: "ct-2", kind: "whatsapp-broadcast", title: "Weekend treats broadcast", body: "Weekend treats are here 🧁 Red velvet cupcakes, Oreo parfait cups and fresh cinnamon rolls. Order by Thursday 6pm for Saturday delivery. Reply MENU for the full list.", status: "draft", createdAt: iso(now - 4 * HOUR) },
    { id: "ct-3", kind: "reel-script", productId: p("chocolate-drip-celebration"), title: "Reel: the perfect drip", body: "0-2s: Close-up of ganache pouring.\n2-5s: Spin the turntable, drips falling.\n5-8s: Add rosettes and gold sprinkles.\n8-10s: Slice reveal.\nCaption: 'Satisfying? Wait for the slice.' CTA: Order your drip cake, link in bio.", status: "draft", createdAt: iso(now - 2 * DAY) },
    { id: "ct-4", kind: "instagram-post", title: "Academy: new Buttercream Mastery class", body: "Ready to pipe like a pro? Buttercream Mastery is back: 2 days of rosettes, ombre, sharp edges and drips. Ingredients and certificate included. ₦95,000, 12 seats only. DM 'CLASS' to book.\n\n#temmiebakesacademy #bakingclasslagos #learntobake", status: "published", createdAt: iso(now - 8 * DAY) },
  ];

  return {
    seededAt: iso(now),
    goLiveAt: iso(goLive),
    staff: STAFF,
    zones: ZONES,
    products: PRODUCTS,
    customers,
    orders,
    conversations,
    outbound: outbound.sort((a, b) => (a.scheduledFor < b.scheduledFor ? 1 : -1)),
    automations: AUTOMATIONS,
    events: events.sort((a, b) => (a.at < b.at ? 1 : -1)),
    ingredients: INGREDIENTS,
    suppliers: SUPPLIERS,
    recipes: RECIPES,
    stockMoves,
    purchaseOrders,
    courses: COURSES,
    cohorts,
    enrollments,
    quotes,
    content,
    kb: KNOWLEDGE,
    assistant: ASSISTANT,
    dailyCapacity: capacity,
  };
}
