import { naira } from "../engine";
import type { Category, ContentDraft, Product } from "../types";

// Simulated AI content studio: deterministic templates with variant rotation,
// so "Regenerate" gives a fresh take without any API. Copy rule: no em or en dashes.

export type ContentKind = ContentDraft["kind"];
export type ContentTone = "playful" | "luxurious" | "warm";
export type ContentAngle = "birthday" | "valentine" | "corporate" | "weekend";

export const KIND_LABEL: Record<ContentKind, string> = {
  "instagram-post": "Instagram post caption",
  "reel-script": "Reel script",
  story: "Story text",
  "whatsapp-broadcast": "WhatsApp broadcast",
  "menu-copy": "Menu description",
};

export const TONE_LABEL: Record<ContentTone, string> = { playful: "Playful", luxurious: "Luxurious", warm: "Warm" };
export const ANGLE_LABEL: Record<ContentAngle, string> = { birthday: "Birthday", valentine: "Valentine's", corporate: "Corporate", weekend: "Weekend treats" };

const pick = <T,>(arr: T[], v: number) => arr[((v % arr.length) + arr.length) % arr.length];

const OPENERS: Record<ContentTone, string[]> = {
  playful: ["Okay, who's celebrating? 🎉", "Warning: may cause spontaneous happy dancing 💃", "Tag the friend who still owes you cake 👀", "Plot twist: dessert first 🍰"],
  luxurious: ["Some moments deserve more than ordinary.", "Crafted slowly, finished by hand, made to be remembered.", "Elegance you can slice.", "Quiet luxury, generously layered."],
  warm: ["Made with love in our Ikeja kitchen 🤍", "Nothing says 'I thought of you' quite like cake.", "From our oven to your table, with love.", "Baked fresh this morning, just for you 🤍"],
};

const ANGLES: Record<ContentAngle, string[]> = {
  birthday: ["Birthday coming up? Let's make it unforgettable.", "Another trip around the sun deserves a proper centrepiece.", "Make the birthday girl (or boy) feel like royalty."],
  valentine: ["Say it with something sweeter than roses this Valentine's.", "Love, layered. Spoil your person this Valentine's.", "For the one who has everything except this."],
  corporate: ["Impress the boardroom, reward the team, wow your clients.", "Office celebrations, product launches, end-of-month wins: we deliver across Lagos.", "Branded treats your team will actually talk about."],
  weekend: ["Weekend loading. Treats included.", "Friday plans: collect dessert, put feet up.", "Your weekend just got a lot sweeter."],
};

const CTAS = ["DM 'CAKE' or tap the link in bio to order.", "Send 'CAKE' on WhatsApp or tap the link in bio.", "DM 'CAKE' now, weekend slots fill fast.", "Tap the link in bio or DM 'CAKE' to book your date."];

const CATEGORY_TAGS: Record<Category, string[]> = {
  "celebration-cakes": ["#birthdaycakelagos", "#customcakeslagos"],
  cupcakes: ["#lagoscupcakes", "#cupcakeslagos"],
  desserts: ["#lagosdesserts", "#dessertlagos"],
  pastries: ["#lagospastries", "#freshbakeslagos"],
  cookies: ["#lagoscookies", "#cookieslagos"],
  corporate: ["#corporatecateringlagos", "#lagosevents"],
};
const ANGLE_TAGS: Record<ContentAngle, string> = { birthday: "#lagosbirthdays", valentine: "#valentineslagos", corporate: "#lagoscorporate", weekend: "#weekendtreats" };

export function hashtags(p: Product, angle: ContentAngle, v: number) {
  const base = ["#koretbakes", "#lagoscakes", "#cakesinlagos", "#ikejabakery"];
  const extra = [...CATEGORY_TAGS[p.category], ANGLE_TAGS[angle]];
  const rotated = extra.slice(v % extra.length).concat(extra.slice(0, v % extra.length));
  // 4 brand tags plus 1 or 2 rotating ones: 5 or 6 in total
  return [...base, ...rotated.slice(0, 1 + ((v + 1) % 2))].join(" ");
}

export const leadText = (days: number) => (days <= 1 ? "24 hours' notice" : `${days} days' notice`);

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const noDashes = (s: string) => s.replace(/\s*[–—]\s*/g, ", ");

export interface GenInput {
  kind: ContentKind;
  product: Product;
  tone: ContentTone;
  angle: ContentAngle;
  variant: number;
}

export function generateContent({ kind, product: p, tone, angle, variant: v }: GenInput): { title: string; body: string } {
  const opener = pick(OPENERS[tone], v);
  const angleLine = pick(ANGLES[angle], v + 1);
  const cta = pick(CTAS, v + 2);
  const price = `${p.unit} from ${naira(p.priceNGN)}`;
  const lead = leadText(p.leadDays);
  const tags = hashtags(p, angle, v);
  let body: string;

  switch (kind) {
    case "instagram-post": {
      const layouts = [
        `${opener}\n\n${p.name}: ${lower(p.description)}\n\n${angleLine} ${price}, order with ${lead}.\n\n${cta}\n\n${tags}`,
        `${angleLine}\n\nMeet the ${p.name}. ${p.description}\n\n📍 Ikeja, delivering across Lagos\n💸 ${price}\n⏰ ${lead}\n\n${cta}\n\n${tags}`,
        `${opener} ${angleLine}\n\n${p.description} That's our ${p.name}, ${price}.\n\nBook early: we need ${lead}. ${cta}\n\n${tags}`,
      ];
      body = pick(layouts, v);
      break;
    }
    case "reel-script": {
      const hooks = [`"POV: you ordered the ${p.name}"`, `"Wait for the slice..."`, `"How we make Lagos' favourite ${p.category === "cupcakes" ? "cupcakes" : "cakes"}"`];
      body = [
        `Hook (0-2s): On-screen text ${pick(hooks, v)}. Close-up of the ${p.name} on the turntable.`,
        `2-5s: Quick cuts of the finishing touches, piping and sprinkles. Trending sound, upbeat.`,
        `5-8s: ${tone === "luxurious" ? "Slow pan with soft light, gold details catching the light." : tone === "playful" ? "Speed-up of the team boxing it, a little dance at the door." : "Koret placing it in the box with a handwritten note."}`,
        `8-10s: The reveal. Text overlay: "${price}. ${lead}."`,
        ``,
        `Caption: ${opener} ${angleLine} ${cta}`,
        ``,
        tags,
      ].join("\n");
      break;
    }
    case "story": {
      body = [
        `Frame 1: Photo of the ${p.name}. Text: "${pick(["Fresh out of the oven", "New on the menu", "Your next celebration?"], v)}"`,
        `Frame 2: Poll sticker: "${pick(["Chocolate or red velvet?", "Birthday or just because?", "Would you share this? Yes / Never"], v + 1)}"`,
        `Frame 3: Text: "${price}. ${lead}." ${angleLine}`,
        `Frame 4: Link sticker "Order now" + text: "${cta}"`,
      ].join("\n");
      break;
    }
    case "whatsapp-broadcast": {
      const greet = pick(["Hi {{firstName}}! ", "Hello {{firstName}} 👋 ", "Good morning {{firstName}}! "], v);
      body = `${greet}${angleLine} Our ${p.name} is ${price} (${lower(p.description.split(".")[0])}). We need ${lead}, so reply CAKE today to book your date, or tap the link in our Instagram bio. ${tone === "warm" ? "Thank you for always supporting us 🤍" : tone === "playful" ? "Don't say we didn't warn you 😄" : "Limited slots each week."}`;
      break;
    }
    case "menu-copy": {
      const intros = [p.description, `${opener.replace(/[🎉💃👀🍰🤍]/gu, "").trim()} ${p.description}`, `${p.description} ${angleLine}`];
      body = `${p.name}\n${pick(intros, v)}\n\n${price} · ${lead}${p.allergens.length ? ` · contains ${p.allergens.join(", ")}` : ""}`;
      break;
    }
  }
  return { title: `${KIND_LABEL[kind]}: ${p.name}`, body: noDashes(body) };
}
