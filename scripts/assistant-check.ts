// Walk scripted conversations through Tia: `npx tsx scripts/assistant-check.ts`
import { buildSeed } from "../src/lib/seed";
import { respond } from "../src/lib/sim/assistant";
import type { Conversation } from "../src/lib/types";

const d = buildSeed();
const ctx = { products: d.products, kb: d.kb, settings: d.assistant, orders: d.orders, courses: d.courses, cohorts: d.cohorts, capacity: d.dailyCapacity, now: Date.now() };
const scripts: [Conversation["channel"], string[]][] = [
  ["instagram", ["Hi", "How much is an 8 inch red velvet cake with fondant for my daughter's birthday?", "next Saturday", "deliver to Lekki", "yes send the link"]],
  ["whatsapp", ["Abeg how much be 2 dozen red velvet cupcakes? I need am tomorrow", "Ikeja", "ok"]],
  ["web", ["Do you run baking classes?", "Buttercream", "yes hold a seat", "My name is Ada Obi, 08031234567"]],
  ["web", ["We need breakfast for 60 staff on Monday"]],
  ["instagram", ["Do you deliver to Ajah?", "Can I get a discount?"]],
  ["whatsapp", ["Where is my order TB-1004?"]],
  ["web", ["I want a 3 tier wedding cake"]],
];
for (const [channel, lines] of scripts) {
  let conv: Conversation = { id: "t", channel, name: "Test User", status: "ai", draft: {}, messages: [], startedAt: "", lastAt: "", unread: 0 };
  console.log(`\n=== ${channel}`);
  for (const line of lines) {
    conv.messages.push({ id: "u", from: "user", text: line, at: "" });
    const r = respond(conv, line, ctx);
    console.log(`> ${line}\n< [${r.intent}${r.handoff ? " → " + r.handoff : ""}${r.createOrder ? " +ORDER" : ""}${r.enrollCohortId ? " +ENROL" : ""}${r.cateringQuote ? " +QUOTE" : ""}] ${r.text}`);
    conv = { ...conv, draft: r.draft, messages: [...conv.messages, { id: "a", from: "ai", text: r.text, at: "" }] };
  }
}
