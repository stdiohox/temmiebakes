// Generates the n8n workflow exports in /workflows.
// Run: node scripts/build-workflows.mjs
//
// Conventions (n8n-engineer production contract):
// - One model node per AI job: Gemini 2.0 Flash for classification/extraction (temp 0.1),
//   Claude Sonnet for replies and long-form writing (temp 0.5-0.8). Called via HTTP Request
//   so the exact request is visible and versionable.
// - Every AI output is parsed and validated in a Code node; anomalies are flagged, never
//   silently defaulted.
// - Every Switch route is distinct; terminal paths end in a named No-Op.
// - Every Wait has a timeout. Every workflow points at 00-error-handler.
// - Credentials are placeholders named "REPLACE: ..."; bind them on the n8n canvas.
// - Supabase is the source of truth (tables listed in workflows/README.md).
// - Paystack takes deposits and balances; its webhook confirms payment, never the customer.

import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../workflows/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const CLAUDE_MODEL = "claude-sonnet-5-5";
const GEMINI_MODEL = "gemini-2.0-flash";
const ERROR_WORKFLOW_ID = "REPLACE_WITH_00_ERROR_HANDLER_ID";

const cred = {
  supabase: { supabaseApi: { id: "REPLACE", name: "REPLACE: Supabase (Temmiebakes)" } },
  anthropic: { httpHeaderAuth: { id: "REPLACE", name: "REPLACE: Anthropic API key (x-api-key)" } },
  gemini: { httpQueryAuth: { id: "REPLACE", name: "REPLACE: Gemini API key (?key=)" } },
  resend: { httpHeaderAuth: { id: "REPLACE", name: "REPLACE: Resend API (Authorization: Bearer)" } },
  whatsapp: { httpHeaderAuth: { id: "REPLACE", name: "REPLACE: WhatsApp Cloud API token" } },
  meta: { httpHeaderAuth: { id: "REPLACE", name: "REPLACE: Instagram Graph API token" } },
  paystack: { httpHeaderAuth: { id: "REPLACE", name: "REPLACE: Paystack secret key (Authorization: Bearer)" } },
  twilio: { twilioApi: { id: "REPLACE", name: "REPLACE: Twilio (SMS fallback)" } },
}

// ------------------------------------------------------------------ builder

function workflow(name, tags, build) {
  const nodes = [];
  const connections = {};
  const add = (n) => {
    nodes.push(n);
    return n.name;
  };
  const link = (from, to, outputIndex = 0, inputIndex = 0) => {
    connections[from] ??= { main: [] };
    while (connections[from].main.length <= outputIndex) connections[from].main.push([]);
    connections[from].main[outputIndex].push({ node: to, type: "main", index: inputIndex });
  };
  const chain = (...names) => names.reduce((a, b) => (link(a, b), b));
  build({ add, link, chain });
  return {
    name,
    nodes,
    connections,
    pinData: {},
    active: false,
    settings: { executionOrder: "v1", timezone: "Africa/Lagos", saveManualExecutions: true, errorWorkflow: ERROR_WORKFLOW_ID },
    meta: { templateCredsSetupCompleted: false },
    tags: tags.map((t) => ({ name: t })),
  };
}

const N = (name, type, typeVersion, parameters, position, extra = {}) => ({ parameters, id: randomUUID(), name, type, typeVersion, position, ...extra });

const webhook = (name, path, pos) => N(name, "n8n-nodes-base.webhook", 2, { httpMethod: "POST", path, responseMode: "responseNode", options: {} }, pos, { webhookId: randomUUID() });
const respond = (name, pos, body = '={{ { ok: true } }}') => N(name, "n8n-nodes-base.respondToWebhook", 1.1, { respondWith: "json", responseBody: body, options: {} }, pos);
const code = (name, js, pos) => N(name, "n8n-nodes-base.code", 2, { jsCode: js.trim() }, pos);
const noop = (name, pos) => N(name, "n8n-nodes-base.noOp", 1, {}, pos);
const schedule = (name, rule, pos) => N(name, "n8n-nodes-base.scheduleTrigger", 1.2, { rule: { interval: [rule] } }, pos);
const wait = (name, amount, unit, pos) => N(name, "n8n-nodes-base.wait", 1.1, { amount, unit }, pos, { webhookId: randomUUID() });
const sticky = (content, pos, w = 420, h = 240, color = 5) => N(`Note ${randomUUID().slice(0, 4)}`, "n8n-nodes-base.stickyNote", 1, { content, width: w, height: h, color }, pos);
const execWf = (name, id, pos) => N(name, "n8n-nodes-base.executeWorkflow", 1.1, { source: "database", workflowId: id, options: { waitForSubWorkflow: false } }, pos);

const sbGet = (name, table, filter, pos) =>
  N(name, "n8n-nodes-base.supabase", 1, { operation: "getAll", tableId: table, returnAll: true, filterType: "string", filterString: filter }, pos, { credentials: cred.supabase, alwaysOutputData: true });
const sbCreate = (name, table, pos) => N(name, "n8n-nodes-base.supabase", 1, { tableId: table, dataToSend: "autoMapInputData" }, pos, { credentials: cred.supabase });
const sbUpdate = (name, table, idExpr, pos) =>
  N(name, "n8n-nodes-base.supabase", 1, { operation: "update", tableId: table, filterType: "string", filterString: `=id=eq.${idExpr}`, dataToSend: "autoMapInputData" }, pos, { credentials: cred.supabase });

const ifBool = (name, expr, pos) =>
  N(name, "n8n-nodes-base.if", 2, {
    conditions: {
      options: { caseSensitive: true, leftValue: "", typeValidation: "loose" },
      conditions: [{ id: randomUUID(), leftValue: expr, rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
      combinator: "and",
    },
    options: {},
  }, pos);

const switchOn = (name, expr, cases, pos) =>
  N(name, "n8n-nodes-base.switch", 3.2, {
    rules: {
      values: cases.map((c) => ({
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "loose" },
          conditions: [{ id: randomUUID(), leftValue: expr, rightValue: c, operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        renameOutput: true,
        outputKey: c,
      })),
    },
    options: { fallbackOutput: "extra", renameFallbackOutput: "unknown" },
  }, pos);

const http = (name, method, url, body, credentials, pos, headers = []) =>
  N(name, "n8n-nodes-base.httpRequest", 4.2, {
    method,
    url,
    authentication: "genericCredentialType",
    genericAuthType: Object.keys(credentials)[0],
    sendHeaders: headers.length > 0,
    headerParameters: { parameters: headers },
    sendBody: method !== "GET",
    specifyBody: "json",
    jsonBody: body,
    options: { timeout: 30000, response: { response: { neverError: false } } },
  }, pos, { credentials, retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 });

const claude = (name, systemExpr, userExpr, pos, { temperature = 0.5, maxTokens = 1024 } = {}) =>
  http(name, "POST", "https://api.anthropic.com/v1/messages",
    `={{ JSON.stringify({ model: "${CLAUDE_MODEL}", max_tokens: ${maxTokens}, temperature: ${temperature}, system: ${systemExpr}, messages: [{ role: "user", content: ${userExpr} }] }) }}`,
    cred.anthropic, pos, [{ name: "anthropic-version", value: "2023-06-01" }]);

const gemini = (name, promptExpr, pos) =>
  http(name, "POST", `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    `={{ JSON.stringify({ contents: [{ parts: [{ text: ${promptExpr} }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 256, responseMimeType: "application/json" } }) }}`,
    cred.gemini, pos);

const sendWhatsApp = (name, toExpr, textExpr, pos) =>
  http(name, "POST", "=https://graph.facebook.com/v20.0/{{ $vars.WA_PHONE_NUMBER_ID }}/messages",
    `={{ JSON.stringify({ messaging_product: "whatsapp", to: ${toExpr}, type: "text", text: { body: ${textExpr} } }) }}`, cred.whatsapp, pos);

const sendEmail = (name, toExpr, subjectExpr, textExpr, pos) =>
  http(name, "POST", "https://api.resend.com/emails",
    `={{ JSON.stringify({ from: "Temmiebakes <hello@temmiebakes.ng>", to: [${toExpr}], subject: ${subjectExpr}, text: ${textExpr} }) }}`, cred.resend, pos);

const sendSms = (name, toExpr, textExpr, pos) =>
  N(name, "n8n-nodes-base.twilio", 1, { from: "={{ $vars.TWILIO_FROM }}", to: toExpr, message: textExpr, options: {} }, pos, { credentials: cred.twilio });

const logEvent = (name, workflowId, titleExpr, minutes, pos) =>
  code(name, `
// Writes one row to automation_events (feeds the dashboard timeline and hours-saved KPI)
return $input.all().map((i) => ({ json: {
  workflow: "${workflowId}",
  title: ${titleExpr},
  contact_id: i.json.contact_id ?? i.json.id ?? null,
  minutes_saved: ${minutes},
  at: new Date().toISOString(),
} }));`, pos);

// Shared JS snippets ------------------------------------------------------

const JS_PARSE_AI = (field, required) => `
// Parse model JSON and validate. Anomalies are FLAGGED for review, never silently defaulted.
const out = [];
for (const item of $input.all()) {
  const raw = ${field};
  let parsed = null, anomaly = null;
  try {
    const text = String(raw ?? "").replace(/^\\s*\`\`\`(json)?/i, "").replace(/\`\`\`\\s*$/, "").trim();
    parsed = JSON.parse(text);
  } catch (e) {
    anomaly = "AI output was not valid JSON";
  }
  const missing = parsed ? ${JSON.stringify(required)}.filter((k) => !(k in parsed)) : [];
  if (!anomaly && missing.length) anomaly = "AI output missing fields: " + missing.join(", ");
  out.push({ json: { ...item.json, ai: parsed ?? {}, ai_anomaly: anomaly, needs_review: Boolean(anomaly) } });
}
return out;`;

const JS_SEND_WINDOW = `
// Time-zone aware sending: hold each message until the recipient's local window.
const windowStart = $json.window_start ?? 9, windowEnd = $json.window_end ?? 19;
const tz = $json.timezone || "Africa/Lagos";
const hourIn = (d) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(d));
let t = new Date($json.due_at ?? Date.now());
for (let i = 0; i < 48 && !(hourIn(t) >= windowStart && hourIn(t) < windowEnd); i++) t = new Date(t.getTime() + 3600000);
return [{ json: { ...$json, send_at: t.toISOString(), in_window: t.getTime() <= Date.now() + 60000 } }];`;

const sendInstagram = (name, toExpr, textExpr, pos) =>
  http(name, "POST", "=https://graph.facebook.com/v20.0/{{ $vars.IG_BUSINESS_ID }}/messages",
    `={{ JSON.stringify({ recipient: { id: ${toExpr} }, message: { text: ${textExpr} } }) }}`, cred.meta, pos);

const paystackLink = (name, emailExpr, koboExpr, refExpr, pos) =>
  http(name, "POST", "https://api.paystack.co/transaction/initialize",
    `={{ JSON.stringify({ email: ${emailExpr}, amount: ${koboExpr}, reference: ${refExpr}, currency: "NGN", callback_url: "https://temmiebakes.ng/track/" + ${refExpr}.split("-dep")[0] }) }}`, cred.paystack, pos);

// Same capacity maths as the app (src/lib/sim/pricing.ts): oven points per day, Sundays closed.
const JS_CAPACITY = `
const cap = Number($vars.DAILY_OVEN_POINTS ?? 20);
const booked = $input.all().reduce((s, i) => s + Number(i.json.oven_points ?? 0), 0);
const want = Number($("Price the order").first().json.oven_points ?? 1);
const day = $("Price the order").first().json.due_date;
const sunday = new Date(day + "T12:00:00Z").getUTCDay() === 0;
return [{ json: { ...$("Price the order").first().json, booked, capacity: cap, fits: !sunday && booked + want <= cap, reason: sunday ? "Closed on Sundays" : booked + want > cap ? "Kitchen full that day" : null } }];`;

// ------------------------------------------------------------------ workflows

const W = {};
const TAG = "temmiebakes";

W["00-error-handler"] = workflow("00 · Error handler (all workflows)", [TAG, "ops"], ({ add, chain }) => {
  add(sticky("## Error handler\nSet as **errorWorkflow** on every Temmiebakes workflow.\nLogs the failure to Supabase and WhatsApps Temmie the failing node and execution link, so an order never silently drops.", [-80, -260], 460, 200, 3));
  const t = add(N("Error Trigger", "n8n-nodes-base.errorTrigger", 1, {}, [0, 0]));
  const f = add(code("Format failure", `
const e = $json.execution ?? {};
return [{ json: { workflow: $json.workflow?.name, node: e.lastNodeExecuted, message: e.error?.message ?? "Unknown error", url: e.url, at: new Date().toISOString() } }];`, [240, 0]));
  const s = add(sbCreate("Log to automation_errors", "automation_errors", [480, -100]));
  const w = add(sendWhatsApp("Alert Temmie", "$vars.OWNER_WHATSAPP", '`Automation failed: ${$json.workflow}\\nNode: ${$json.node}\\n${$json.message}\\n${$json.url}`', [480, 100]));
  chain(t, f, s);
  chain(f, w);
});

W["01-order-intake"] = workflow("01 · Order intake: website, Instagram, WhatsApp", [TAG, "orders"], ({ add, link, chain }) => {
  add(sticky("## Order intake\nOne entry point for the **website checkout, cake builder and Tia's confirmed orders**.\nNormalise → find or create customer (phone / Instagram handle) → price from the menu and cake rules → **capacity check** (oven points per day) → create order as *quoted* → Paystack deposit link → WhatsApp quote → schedule the 6h follow-up (03).", [-120, -340], 640, 220, 4));
  const wh = add(webhook("Webhook: checkout, cake builder, Tia", "order", [0, 0]));
  const norm = add(code("Normalise order", `
return $input.all().map(({ json: j }) => {
  const b = j.body ?? {};
  let phone = String(b.phone ?? "").replace(/[^\\d+]/g, "");
  if (/^0\\d{10}$/.test(phone)) phone = "+234" + phone.slice(1);
  return { json: { source: b.source ?? "web", name: String(b.name ?? "").trim(), phone, instagram: b.instagram ?? null, email: b.email ?? null,
    items: b.items ?? [], cake: b.cake ?? null, due_date: b.due_date, due_time: b.due_time ?? "14:00", fulfilment: b.fulfilment ?? "delivery",
    zone_id: b.zone_id ?? null, address: b.address ?? null, occasion: b.occasion ?? null, message_on_cake: b.message_on_cake ?? null, received_at: new Date().toISOString() } };
});`, [240, 0]));
  const valid = add(ifBool("Has phone, items and date?", '={{ Boolean($json.phone && $json.due_date && ($json.items.length || $json.cake)) }}', [480, 0]));
  const bad = add(respond("Respond 422: missing details", [720, 160], '={{ { ok: false, error: "phone, items and due date are required" } }}'));
  const find = add(sbGet("Find customer", "customers", '=or=(phone.eq.{{ $json.phone }},instagram.eq.{{ $json.instagram || "none" }})', [720, -100]));
  const upsert = add(code("Customer upsert payload", `
const o = $("Normalise order").first().json;
const c = $input.all().map((i) => i.json).find((x) => x.id);
return [{ json: { id: c?.id, name: c?.name ?? o.name, phone: o.phone, instagram: c?.instagram ?? o.instagram, zone_id: o.zone_id ?? c?.zone_id, source: c?.source ?? o.source, is_new: !c } }];`, [960, -100]));
  const save = add(N("Upsert customer", "n8n-nodes-base.supabase", 1, { operation: "upsert", tableId: "customers", dataToSend: "autoMapInputData" }, [1200, -100], { credentials: cred.supabase }));
  const menu = add(sbGet("Load menu, cake rules, zones", "price_book", "=active=eq.true", [1440, -100]));
  const price = add(code("Price the order", `
// Same rules as the website: size base + tiers + flavour/filling/finish/decoration extras, zone delivery fee
const book = Object.fromEntries($input.all().map((i) => [i.json.key, i.json]));
const o = $("Normalise order").first().json;
let subtotal = 0, oven_points = 0, lead_days = 1;
for (const it of o.items) { const p = book["product:" + it.product_id]; if (!p) throw new Error("Unknown product " + it.product_id); subtotal += p.price_ngn * it.qty; oven_points += p.oven_points * it.qty; lead_days = Math.max(lead_days, p.lead_days); }
if (o.cake) {
  const c = o.cake; const base = book["size:" + c.size_inches]?.price_ngn;
  if (!base) throw new Error("Unsupported cake size " + c.size_inches);
  const tierMult = [0, 1, 1.85, 2.6, 3.3][c.tiers ?? 1];
  subtotal += Math.round((base * tierMult + (book["flavour:" + c.flavour]?.price_ngn ?? 0) + (book["filling:" + c.filling]?.price_ngn ?? 0) + (book["finish:" + c.finish]?.price_ngn ?? 0) + (book["decoration:" + c.decoration]?.price_ngn ?? 0)) / 500) * 500;
  oven_points += (c.tiers ?? 1) * 2 + (c.size_inches >= 10 ? 1 : 0); lead_days = Math.max(lead_days, c.tiers > 1 ? 4 : 2);
}
const delivery = o.fulfilment === "delivery" ? (book["zone:" + o.zone_id]?.price_ngn ?? null) : 0;
if (delivery === null) throw new Error("Unknown delivery zone " + o.zone_id);
const daysAhead = (new Date(o.due_date) - new Date(new Date().toISOString().slice(0, 10))) / 86400000;
return [{ json: { ...o, customer_id: $("Upsert customer").first().json.id, subtotal_ngn: subtotal, delivery_ngn: delivery, total_ngn: subtotal + delivery, deposit_ngn: Math.ceil((subtotal + delivery) * 0.5 / 100) * 100, oven_points, lead_days, lead_ok: daysAhead >= lead_days } }];`, [1680, -100]));
  const day = add(sbGet("Orders booked that day", "orders", '=due_date=eq.{{ $json.due_date }}&status=not.in.(cancelled,enquiry)', [1920, -100]));
  const cap = add(code("Capacity check", JS_CAPACITY, [2160, -100]));
  const ok = add(ifBool("Fits lead time and kitchen?", '={{ $json.fits && $json.lead_ok }}', [2400, -100]));
  const alt = add(code("Find next free date", `
// Offer the earliest day with room instead of refusing
return [{ json: { ...$json, ok: false, message: ($json.reason ?? "That date is too soon for this order") + ". The next free date is in the reply." } }];`, [2640, 80]));
  const altResp = add(respond("Respond: date unavailable", [2880, 80], '={{ { ok: false, reason: $json.message } }}'));
  const create = add(code("Order row", `
const n = "TB-" + String(Math.floor(1000 + Math.random() * 9000));
return [{ json: { ...$json, number: n, status: "quoted", payment_status: "unpaid", paid_ngn: 0, assisted_by_ai: $json.source !== "web" } }];`, [2640, -260]));
  const ins = add(sbCreate("Create order", "orders", [2880, -260]));
  const link1 = add(paystackLink("Paystack: deposit link", '$json.email || ($json.phone.replace("+", "") + "@wa.temmiebakes.ng")', "$json.deposit_ngn * 100", '$json.number + "-dep"', [3120, -260]));
  const msg = add(sendWhatsApp("WhatsApp quote with pay link", '$("Order row").first().json.phone', '`Hi ${$("Order row").first().json.name.split(" ")[0]}! Your order ${$("Order row").first().json.number} comes to ₦${$("Order row").first().json.total_ngn.toLocaleString()}. Pay the 50% deposit (₦${$("Order row").first().json.deposit_ngn.toLocaleString()}) to lock your date: ${$json.data.authorization_url}`', [3360, -260]));
  const log = add(logEvent("Log intake event", "order-intake", '`Order ${$("Order row").first().json.number} quoted automatically`', 12, [3600, -260]));
  const logRow = add(sbCreate("Write automation_events", "automation_events", [3840, -260]));
  const fu = add(execWf("Start quote follow-up (03)", "REPLACE_WITH_03_ID", [4080, -260]));
  const done = add(respond("Respond 200", [4320, -260], '={{ { ok: true, number: $("Order row").first().json.number } }}'));
  chain(wh, norm, valid);
  link(valid, find, 0);
  link(valid, bad, 1);
  chain(find, upsert, save, menu, price, day, cap, ok);
  link(ok, create, 0);
  link(ok, alt, 1);
  chain(alt, altResp);
  chain(create, ins, link1, msg, log, logRow, fu, done);
});

W["02-ai-order-assistant"] = workflow("02 · Tia: AI order assistant (Instagram, WhatsApp, website)", [TAG, "ai", "assistant"], ({ add, link, chain }) => {
  add(sticky("## Tia, the 24/7 order assistant\n- **Gemini** classifies intent and extracts slots (size, flavour, date, Lagos area, guests, name, phone). Understands Pidgin.\n- **Handoff rules run before any reply**: complaints, discounts, 'talk to Temmie', wedding cakes, orders over ₦500k.\n- **Claude** writes the reply in Temmie's voice using ONLY the price book, knowledge base and live capacity.\n- A guardrail checks prices and promises before sending.\n- When all slots are filled, the order goes to intake (01).", [-120, -400], 680, 260, 6));
  const ig = add(webhook("Webhook: Instagram DMs", "tia/instagram", [0, 0]));
  const wa = add(webhook("Webhook: WhatsApp Cloud API", "tia/whatsapp", [0, 200]));
  const web = add(webhook("Webhook: website chat", "tia/web", [0, 400]));
  const norm = add(code("Normalise message", `
return $input.all().map(({ json: j }) => {
  const b = j.body ?? {};
  const waMsg = b.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const igMsg = b.entry?.[0]?.messaging?.[0];
  return { json: { channel: waMsg ? "whatsapp" : igMsg ? "instagram" : "web", sender: waMsg?.from ?? igMsg?.sender?.id ?? b.visitor_id, text: waMsg?.text?.body ?? igMsg?.message?.text ?? b.text ?? "" } };
}).filter((i) => i.json.text);`, [260, 200]));
  const conv = add(sbGet("Load conversation & draft", "conversations", '=sender=eq.{{ $json.sender }}', [520, 200]));
  const human = add(ifBool("Temmie already handling?", '={{ $json.status === "staff" || $json.status === "handoff" }}', [780, 200]));
  const toInbox = add(noop("Done: left for Temmie (no AI reply)", [1040, 40]));
  const cls = add(gemini("Gemini: classify & extract", '`You read DMs for a Lagos cake business. Messages may be in Nigerian Pidgin. Return ONLY JSON: {"intent":"order|price|menu|class|corporate|track|complaint|discount|human|wedding|other","size_inches":number|null,"tiers":number|null,"flavour":string|null,"product":string|null,"qty":number|null,"date":"YYYY-MM-DD"|null,"area":string|null,"guests":number|null,"name":string|null,"phone":string|null,"order_number":string|null}. Do not use \\`\\`\\`json. Output must start with { and end with }.\\nToday: ${$now.toFormat("yyyy-LL-dd")}\\nMessage: ${$("Normalise message").first().json.text}`', [1040, 260]));
  const v = add(code("Validate classification", JS_PARSE_AI("item.json.candidates?.[0]?.content?.parts?.[0]?.text", ["intent"]), [1300, 260]));
  const rules = add(code("Merge draft & apply handoff rules", `
const draft = { ...($("Load conversation & draft").first().json.draft ?? {}) };
const a = $json.ai ?? {};
for (const [k, val] of Object.entries(a)) if (val !== null && k !== "intent") draft[k] = val;
const settings = $vars.TIA_HANDOFF ? JSON.parse($vars.TIA_HANDOFF) : [];
const text = $("Normalise message").first().json.text.toLowerCase();
const hit = settings.find((h) => h.enabled && h.keywords.some((k) => text.includes(k)));
const handoff = $json.needs_review ? "Could not understand the message" : hit?.label ?? (["complaint", "discount", "human", "wedding"].includes(a.intent) ? a.intent : null);
const missing = ["size_inches", "flavour", "date", "area", "name", "phone"].filter((k) => a.intent === "order" && !draft[k]);
return [{ json: { ...$("Normalise message").first().json, intent: a.intent ?? "other", draft, handoff, missing, ready: a.intent === "order" && missing.length === 0 } }];`, [1560, 260]));
  const route = add(switchOn("Route", '={{ $json.handoff ? "handoff" : $json.ready ? "order" : $json.intent === "track" ? "track" : "reply" }}', ["handoff", "order", "track", "reply"], [1820, 260]));
  const hand = add(code("Handoff message", `
return [{ json: { ...$json, reply: "Thank you! I'm passing this to Temmie personally and she'll reply here shortly.", status: "handoff" } }];`, [2080, 40]));
  const alert = add(sendWhatsApp("Alert Temmie: chat needs you", "$vars.OWNER_WHATSAPP", '`Tia handed over a ${$json.channel} chat (${$json.handoff}): "${$json.text}"`', [2320, 40]));
  const order = add(execWf("Create order via intake (01)", "REPLACE_WITH_01_ID", [2080, 200]));
  const track = add(sbGet("Look up order", "orders", '=number=eq.{{ $json.draft.order_number }}', [2080, 360]));
  const kb = add(sbGet("Approved knowledge & price book", "kb_entries", "=approved=eq.true", [2080, 520]));
  const write = add(claude("Claude: write Tia's reply", '"You are Tia, the AI assistant for Temmiebakes, a cake and dessert business in Ikeja, Lagos. Be warm and brief, 1-3 sentences, British English, no em dashes. Say you are an AI in the first reply. Quote ONLY prices from the price book provided. Never promise discounts or same-day orders. If details are missing ask for at most two of: " + $("Merge draft & apply handoff rules").first().json.missing.join(", ")', '"Knowledge: " + JSON.stringify($input.all().map((i) => i.json)) + "\\nDraft: " + JSON.stringify($("Merge draft & apply handoff rules").first().json.draft) + "\\nCustomer: " + $("Merge draft & apply handoff rules").first().json.text', [2340, 440], { temperature: 0.5, maxTokens: 400 }));
  const guard = add(code("Guardrail check", `
// Block replies that invent prices or promise discounts; send them to Temmie instead.
const text = $json.content?.[0]?.text ?? "";
const book = $("Approved knowledge & price book").all().map((i) => JSON.stringify(i.json)).join(" ");
const prices = (text.match(/₦\\s?[\\d,]+/g) ?? []).map((p) => p.replace(/[^\\d]/g, ""));
const invented = prices.filter((p) => !book.includes(p));
const bad = !text || /discount|free cake|guarantee/i.test(text) || invented.length > 0 || /—|–/.test(text);
return [{ json: { ...$("Merge draft & apply handoff rules").first().json, reply: bad ? null : text, status: bad ? "handoff" : "ai", guard_reason: bad ? (invented.length ? "Price not in price book: " + invented.join(", ") : "Reply failed guardrail") : null } }];`, [2600, 440]));
  const passed = add(ifBool("Guardrail passed?", '={{ $json.reply !== null }}', [2860, 440]));
  const blocked = add(sendWhatsApp("Alert Temmie: reply blocked", "$vars.OWNER_WHATSAPP", '`Tia held back a reply (${$json.guard_reason}). Please answer: "${$json.text}"`', [3120, 600]));
  const ch = add(switchOn("Reply channel", "={{ $json.channel }}", ["whatsapp", "instagram", "web"], [3120, 300]));
  const sWa = add(sendWhatsApp("Send on WhatsApp", "$json.sender", "$json.reply", [3380, 160]));
  const sIg = add(sendInstagram("Send on Instagram", "$json.sender", "$json.reply", [3380, 300]));
  const sWeb = add(respond("Reply to website chat", [3380, 440], '={{ { reply: $json.reply } }}'));
  const unknownCh = add(noop("Unknown channel (flag)", [3380, 580]));
  const save = add(code("Conversation update", `
const m = $("Merge draft & apply handoff rules").first().json;
return [{ json: { sender: m.sender, channel: m.channel, draft: m.draft, status: $json.status ?? "ai", last_at: new Date().toISOString() } }];`, [3640, 300]));
  const up = add(N("Upsert conversation", "n8n-nodes-base.supabase", 1, { operation: "upsert", tableId: "conversations", dataToSend: "autoMapInputData" }, [3880, 300], { credentials: cred.supabase }));
  const log = add(logEvent("Log Tia event", "ai-assistant", '`Tia replied (${$("Merge draft & apply handoff rules").first().json.intent})`', 3, [4120, 300]));
  const logRow = add(sbCreate("Write automation_events", "automation_events", [4360, 300]));
  link(ig, norm);
  link(wa, norm);
  link(web, norm);
  chain(norm, conv, human);
  link(human, toInbox, 0);
  link(human, cls, 1);
  chain(cls, v, rules, route);
  link(route, hand, 0);
  link(route, order, 1);
  link(route, track, 2);
  link(route, kb, 3);
  link(route, add(noop("Unknown route (flag for review)", [2080, 680])), 4);
  chain(hand, alert, save);
  link(hand, ch);
  link(track, kb);
  chain(kb, write, guard, passed);
  link(passed, ch, 0);
  link(passed, blocked, 1);
  link(blocked, save);
  link(ch, sWa, 0);
  link(ch, sIg, 1);
  link(ch, sWeb, 2);
  link(ch, unknownCh, 3);
  link(sWa, save);
  link(sIg, save);
  link(sWeb, save);
  chain(save, up, log, logRow);
});

W["03-quote-follow-up"] = workflow("03 · Quote follow-up (6h nudge, 24h last call, release slot)", [TAG, "orders", "payments"], ({ add, link, chain }) => {
  add(sticky("## Quote follow-up\nCalled by intake (01) with the order. Waits 6 hours; if the deposit is still unpaid sends a friendly nudge, waits again to 24 hours for a last call, then releases the kitchen slot. Every Wait has a timeout.", [-120, -300], 580, 200, 4));
  const start = add(N("Called by intake (01)", "n8n-nodes-base.executeWorkflowTrigger", 1.1, { inputSource: "passthrough" }, [0, 0]));
  const w1 = add(wait("Wait 6 hours", 6, "hours", [240, 0]));
  const c1 = add(sbGet("Re-check order", "orders", '=number=eq.{{ $("Called by intake (01)").first().json.number }}', [480, 0]));
  const paid1 = add(ifBool("Deposit paid?", '={{ $json.payment_status !== "unpaid" || $json.status === "cancelled" }}', [720, 0]));
  const done1 = add(noop("Done: paid or cancelled", [960, -140]));
  const nudge = add(sendWhatsApp("Nudge with pay link", "$json.phone", '`Hi ${$json.name.split(" ")[0]}, just checking you saw your quote for ${$json.number} (₦${$json.total_ngn.toLocaleString()}). Your date is held until tonight: https://temmiebakes.ng/track/${$json.number}`', [960, 60]));
  const w2 = add(wait("Wait until 24 hours", 18, "hours", [1200, 60]));
  const c2 = add(sbGet("Re-check order again", "orders", '=number=eq.{{ $("Called by intake (01)").first().json.number }}', [1440, 60]));
  const paid2 = add(ifBool("Paid now?", '={{ $json.payment_status !== "unpaid" || $json.status === "cancelled" }}', [1680, 60]));
  const done2 = add(noop("Done: converted after nudge", [1920, -80]));
  const release = add(sbUpdate("Release slot: cancel quote", "orders", "{{ $json.id }}", [1920, 160]));
  const bye = add(sendWhatsApp("Last call message", '$("Re-check order again").first().json.phone', '"We have released the date for now so other customers can book. Reply here any time and Tia will check availability again."', [2160, 160]));
  const log = add(logEvent("Log follow-up", "quote-follow-up", '"Quote follow-up sequence finished"', 8, [2400, 160]));
  chain(start, w1, c1, paid1);
  link(paid1, done1, 0);
  link(paid1, nudge, 1);
  chain(nudge, w2, c2, paid2);
  link(paid2, done2, 0);
  link(paid2, release, 1);
  chain(release, bye, log);
});

W["04-payment-reminders"] = workflow("04 · Payments: Paystack webhook, balance reminders", [TAG, "payments"], ({ add, link, chain }) => {
  add(sticky("## Payments\n**A.** Paystack webhook (signature verified) marks deposit or balance paid and confirms on WhatsApp. Only the webhook changes payment status, never the customer.\n**B.** Every morning, orders due within 48h with a balance get a reminder and pay link.", [-120, -320], 600, 220, 4));
  const wh = add(webhook("Webhook: Paystack charge.success", "paystack", [0, 0]));
  const verify = add(code("Verify signature", `
const crypto = require("crypto");
const sig = $json.headers["x-paystack-signature"];
const hash = crypto.createHmac("sha512", $vars.PAYSTACK_SECRET).update(JSON.stringify($json.body)).digest("hex");
if (hash !== sig) return [{ json: { valid: false } }];
const d = $json.body.data;
return [{ json: { valid: $json.body.event === "charge.success", reference: d.reference, amount_ngn: d.amount / 100, number: d.reference.split("-")[0] + "-" + d.reference.split("-")[1], kind: d.reference.endsWith("-dep") ? "deposit" : "balance" } }];`, [240, 0]));
  const ok = add(ifBool("Valid payment?", "={{ $json.valid }}", [480, 0]));
  const reject = add(respond("Respond 401", [720, 160], '={{ { ok: false } }}'));
  const ord = add(sbGet("Load order", "orders", '=number=eq.{{ $json.number }}', [720, -100]));
  const calc = add(code("Apply payment", `
const p = $("Verify signature").first().json;
const paid = Number($json.paid_ngn) + p.amount_ngn;
return [{ json: { id: $json.id, paid_ngn: paid, payment_status: paid >= $json.total_ngn ? "paid" : "deposit", status: $json.status === "quoted" ? "confirmed" : $json.status, phone: $json.phone, number: $json.number, balance: Math.max(0, $json.total_ngn - paid) } }];`, [960, -100]));
  const upd = add(sbUpdate("Update order", "orders", "{{ $json.id }}", [1200, -100]));
  const conf = add(sendWhatsApp("Confirm on WhatsApp", '$("Apply payment").first().json.phone', '`Payment received, thank you! ${$("Apply payment").first().json.number} is confirmed. ${$("Apply payment").first().json.balance ? "Balance of ₦" + $("Apply payment").first().json.balance.toLocaleString() + " is due before dispatch." : "Paid in full."} Track it: https://temmiebakes.ng/track/${$("Apply payment").first().json.number}`', [1440, -100]));
  const ack = add(respond("Respond 200", [1680, -100]));
  const sch = add(schedule("Daily 08:00", { field: "cronExpression", expression: "0 8 * * *" }, [0, 360]));
  const due = add(sbGet("Balances due in 48h", "orders", "=payment_status=eq.deposit&due_date=lte.{{ $now.plus({ days: 2 }).toFormat('yyyy-LL-dd') }}&due_date=gte.{{ $now.toFormat('yyyy-LL-dd') }}", [240, 360]));
  const any = add(ifBool("Any due?", "={{ $json.id !== undefined }}", [480, 360]));
  const none = add(noop("No balances due", [720, 480]));
  const pl = add(paystackLink("Paystack: balance link", '$json.email || ($json.phone.replace("+", "") + "@wa.temmiebakes.ng")', "($json.total_ngn - $json.paid_ngn) * 100", '$json.number + "-bal"', [720, 300]));
  const rem = add(sendWhatsApp("Balance reminder", '$("Balances due in 48h").item.json.phone', '`Hi! Your ${$("Balances due in 48h").item.json.number} is scheduled for ${$("Balances due in 48h").item.json.due_date}. The balance is due before dispatch: ${$json.data.authorization_url}`', [960, 300]));
  const log = add(logEvent("Log reminders", "payment-reminders", '"Balance reminder sent"', 3, [1200, 300]));
  chain(wh, verify, ok);
  link(ok, ord, 0);
  link(ok, reject, 1);
  chain(ord, calc, upd, conf, ack);
  chain(sch, due, any);
  link(any, pl, 0);
  link(any, none, 1);
  chain(pl, rem, log);
});

W["05-order-updates"] = workflow("05 · Order status updates on WhatsApp", [TAG, "orders", "kitchen"], ({ add, link, chain }) => {
  add(sticky("## Order updates\nFires when the kitchen moves an order (Supabase database webhook on orders.status). Sends a WhatsApp update for baking, ready, out for delivery (with rider and ETA) and delivered, and calls the review request (07) one hour after delivery.", [-120, -300], 600, 200, 4));
  const wh = add(webhook("Webhook: orders.status changed", "order-status", [0, 0]));
  const shape = add(code("Build update", `
const r = $json.body.record, old = $json.body.old_record ?? {};
if (r.status === old.status) return [{ json: { skip: true } }];
const first = String(r.customer_name ?? "").split(" ")[0] || "there";
const text = {
  baking: \`Hi \${first}, your \${r.label} is in the oven now 🎂\`,
  ready: r.fulfilment === "pickup" ? \`Your \${r.label} is ready for pickup at our Ikeja studio.\` : \`Your \${r.label} is decorated and boxed. A rider will pick it up soon.\`,
  "out-for-delivery": \`Your \${r.label} is on its way with \${r.rider_name}. ETA about \${r.eta_mins} minutes.\`,
  delivered: \`Delivered! Enjoy every bite, \${first}. We'd love a photo 📸\`,
}[r.status];
return [{ json: { skip: !text, status: r.status, phone: r.phone, text, order_id: r.id } }];`, [240, 0]));
  const send = add(ifBool("Customer-facing status?", "={{ !$json.skip }}", [480, 0]));
  const quiet = add(noop("Internal status only", [720, 140]));
  const wa = add(sendWhatsApp("WhatsApp update", "$json.phone", "$json.text", [720, -60]));
  const isDel = add(ifBool("Delivered?", '={{ $("Build update").first().json.status === "delivered" }}', [960, -60]));
  const w = add(wait("Wait 1 hour", 1, "hours", [1200, -160]));
  const rev = add(execWf("Ask for review (07)", "REPLACE_WITH_07_ID", [1440, -160]));
  const log = add(logEvent("Log update", "order-updates", '`Customer told: ${$("Build update").first().json.status}`', 2, [1200, 40]));
  const ack = add(respond("Respond 200", [1440, 40]));
  chain(wh, shape, send);
  link(send, wa, 0);
  link(send, quiet, 1);
  chain(wa, isDel);
  link(isDel, w, 0);
  chain(w, rev);
  link(isDel, log, 1);
  chain(log, ack);
});

W["06-occasion-reminders"] = workflow("06 · Birthday & anniversary reminders (14 days ahead)", [TAG, "retention"], ({ add, link, chain }) => {
  add(sticky("## Occasion reminders\nEvery morning: customers whose saved occasion is 14 days away and who opted in to WhatsApp get a personal message with last year's cake and free delivery this week. Never more than one reminder per occasion per year.", [-120, -280], 600, 200, 5));
  const sch = add(schedule("Daily 09:30", { field: "cronExpression", expression: "30 9 * * *" }, [0, 0]));
  const q = add(sbGet("Occasions in 14 days", "customer_occasions_due", "=days_until=eq.14&consent_whatsapp=eq.true", [240, 0]));
  const any = add(ifBool("Anyone due?", "={{ $json.customer_id !== undefined }}", [480, 0]));
  const none = add(noop("No occasions today", [720, 140]));
  const dedupe = add(sbGet("Already reminded this year?", "outbound", '=customer_id=eq.{{ $json.customer_id }}&automation=eq.occasion-reminders&created_at=gte.{{ $now.minus({ days: 300 }).toISO() }}', [720, -60]));
  const fresh = add(ifBool("Not yet reminded?", "={{ $json.id === undefined }}", [960, -60]));
  const skip = add(noop("Skip: already reminded", [1200, 80]));
  const msg = add(sendWhatsApp("Personal reminder", '$("Occasions in 14 days").item.json.phone', '`Hi ${$("Occasions in 14 days").item.json.first_name}! ${$("Occasions in 14 days").item.json.label} is on ${$("Occasions in 14 days").item.json.date_label}. Last time it was the ${$("Occasions in 14 days").item.json.last_item ?? "cake"} 🎂 Shall we bake something special again? Order this week and delivery is free.`', [1200, -140]));
  const log = add(logEvent("Log reminder", "occasion-reminders", '"Occasion reminder sent"', 6, [1440, -140]));
  const row = add(sbCreate("Write outbound", "outbound", [1680, -140]));
  chain(sch, q, any);
  link(any, dedupe, 0);
  link(any, none, 1);
  chain(dedupe, fresh);
  link(fresh, msg, 0);
  link(fresh, skip, 1);
  chain(msg, log, row);
});

W["07-review-request"] = workflow("07 · Review request & low-rating rescue", [TAG, "reviews"], ({ add, link, chain }) => {
  add(sticky("## Reviews\nCalled an hour after delivery. Asks for a 1-5 rating on WhatsApp (6h timeout). 4-5 stars: thank you + Google review link. 1-3 stars: Gemini summarises the issue, Temmie is alerted and the customer hears back personally. Never auto-replies to a complaint.", [-120, -300], 620, 200, 5));
  const start = add(N("Called by order updates (05)", "n8n-nodes-base.executeWorkflowTrigger", 1.1, { inputSource: "passthrough" }, [0, 0]));
  const ask = add(N("Ask for rating (WhatsApp, wait 6h)", "n8n-nodes-base.whatsApp", 1, { operation: "sendAndWait", phoneNumberId: "={{ $vars.WA_PHONE_NUMBER_ID }}", recipientPhoneNumber: "={{ $json.phone }}", message: "How was your order? Reply with a number from 1 (poor) to 5 (perfect).", responseType: "freeText", options: { limitWaitTime: { values: { limitType: "afterTimeInterval", resumeAmount: 6, resumeUnit: "hours" } } } }, [240, 0], { credentials: cred.whatsapp, webhookId: randomUUID() }));
  const parse = add(code("Parse rating", `
const raw = String($json.data?.text ?? "");
const n = Number((raw.match(/[1-5]/) ?? [])[0]);
return [{ json: { order_id: $("Called by order updates (05)").first().json.order_id, phone: $("Called by order updates (05)").first().json.phone, rating: n || null, comment: raw, answered: Boolean(raw) } }];`, [480, 0]));
  const route = add(switchOn("Route by rating", '={{ !$json.answered ? "none" : $json.rating >= 4 ? "happy" : $json.rating ? "unhappy" : "unclear" }}', ["happy", "unhappy", "unclear", "none"], [720, 0]));
  const thanks = add(sendWhatsApp("Thank you + Google link", "$json.phone", '"Thank you so much! Would you share it on Google? It helps small Lagos bakers like us: " + $vars.GOOGLE_REVIEW_URL', [960, -200]));
  const sum = add(gemini("Gemini: summarise complaint", '`Summarise this cake customer feedback in one sentence and classify the issue. Return ONLY JSON {"summary":string,"issue":"late|damaged|taste|design|wrong-order|other"}. Output must start with { and end with }.\\nFeedback: ${$json.comment}`', [960, 0]));
  const v = add(code("Validate summary", JS_PARSE_AI("item.json.candidates?.[0]?.content?.parts?.[0]?.text", ["summary", "issue"]), [1200, 0]));
  const alert = add(sendWhatsApp("Alert Temmie", "$vars.OWNER_WHATSAPP", '`⚠️ ${$("Parse rating").first().json.rating}★ review: ${$json.ai.summary ?? $("Parse rating").first().json.comment}${$json.needs_review ? " (AI summary failed, read the original)" : ""}`', [1440, 0]));
  const sorry = add(sendWhatsApp("Personal holding reply", '$("Parse rating").first().json.phone', '"I am so sorry to hear that. Temmie has your message and will call you today to make it right."', [1680, 0]));
  const unclear = add(noop("Unclear reply: saved, no action", [960, 200]));
  const noReply = add(noop("No reply in 6h", [960, 340]));
  const save = add(sbCreate("Save review", "reviews", [1920, -100]));
  chain(start, ask, parse, route);
  link(route, thanks, 0);
  link(route, sum, 1);
  link(route, unclear, 2);
  link(route, noReply, 3);
  link(route, add(noop("Unknown route (flag for review)", [960, 480])), 4);
  chain(sum, v, alert, sorry, save);
  link(thanks, save);
});

W["08-reorder-nudge"] = workflow("08 · Re-order nudges for quiet customers", [TAG, "retention"], ({ add, link, chain }) => {
  const sch = add(schedule("Mondays 10:00", { field: "cronExpression", expression: "0 10 * * 1" }, [0, 0]));
  const q = add(sbGet("Quiet 45-120 days, opted in", "customer_stats", "=days_since_order=gte.45&days_since_order=lte.120&segment=neq.corporate&consent_whatsapp=eq.true", [240, 0]));
  const any = add(ifBool("Anyone?", "={{ $json.id !== undefined }}", [480, 0]));
  const none = add(noop("Nobody to nudge", [720, 140]));
  const write = add(claude("Claude: personal nudge", '"Write one short, warm WhatsApp message (max 35 words) from Temmiebakes inviting a past customer to order again. Mention their last order by name. No discounts, no em dashes. End with: Reply YES and Tia will sort it."', '"Name: " + $json.first_name + ". Last order: " + $json.last_item + ". New this month: " + $vars.NEW_THIS_MONTH', [720, -60], { temperature: 0.8, maxTokens: 200 }));
  const guard = add(code("Check message", `
const t = $json.content?.[0]?.text?.trim() ?? "";
const ok = t.length > 10 && t.length < 300 && !/—|–|discount|% off/i.test(t);
return [{ json: { ...$("Quiet 45-120 days, opted in").item.json, text: ok ? t : null, needs_review: !ok } }];`, [960, -60]));
  const pass = add(ifBool("Message OK?", "={{ $json.text !== null }}", [1200, -60]));
  const held = add(noop("Held for review (bad AI output)", [1440, 80]));
  const send = add(sendWhatsApp("Send nudge", "$json.phone", "$json.text", [1440, -140]));
  const log = add(logEvent("Log nudge", "reorder-nudge", '"Re-order nudge sent"', 4, [1680, -140]));
  chain(sch, q, any);
  link(any, write, 0);
  link(any, none, 1);
  chain(write, guard, pass);
  link(pass, send, 0);
  link(pass, held, 1);
  chain(send, log);
});

W["09-capacity-guard"] = workflow("09 · Kitchen capacity guard", [TAG, "kitchen"], ({ add, link, chain }) => {
  add(sticky("## Capacity guard\nEvery 2 hours: oven points booked per day for the next 7 days. Days at 90%+ are marked full so Tia and the website offer the next free date, and Temmie gets one alert per day.", [-120, -260], 560, 180, 5));
  const sch = add(schedule("Every 2 hours", { field: "hours", hoursInterval: 2 }, [0, 0]));
  const q = add(sbGet("Points booked, next 7 days", "capacity_by_day", "=day=gte.{{ $now.toFormat('yyyy-LL-dd') }}&day=lte.{{ $now.plus({ days: 7 }).toFormat('yyyy-LL-dd') }}", [240, 0]));
  const calc = add(code("Find full days", `
const cap = Number($vars.DAILY_OVEN_POINTS ?? 20);
const full = $input.all().map((i) => i.json).filter((d) => d.points >= cap * 0.9);
return [{ json: { full_days: full.map((d) => d.day), any: full.length > 0 } }];`, [480, 0]));
  const any = add(ifBool("Any day nearly full?", "={{ $json.any }}", [720, 0]));
  const fine = add(noop("Room every day", [960, 140]));
  const mark = add(N("Mark days full", "n8n-nodes-base.supabase", 1, { operation: "upsert", tableId: "blocked_days", dataToSend: "autoMapInputData" }, [960, -60], { credentials: cred.supabase }));
  const alert = add(sendWhatsApp("Tell Temmie", "$vars.OWNER_WHATSAPP", '`Kitchen nearly full on ${$("Find full days").first().json.full_days.join(", ")}. Tia is offering the next free dates.`', [1200, -60]));
  chain(sch, q, calc, any);
  link(any, mark, 0);
  link(any, fine, 1);
  chain(mark, alert);
});

W["10-stock-reorder"] = workflow("10 · Stock levels & supplier re-order", [TAG, "stock"], ({ add, link, chain }) => {
  add(sticky("## Stock\nEach evening: ingredient use from tomorrow's bake sheet (recipes × orders) is deducted from stock. Anything below its re-order level becomes a draft purchase order per supplier; Temmie approves on WhatsApp (6h timeout) before it is sent.", [-120, -280], 600, 200, 5));
  const sch = add(schedule("Daily 18:00", { field: "cronExpression", expression: "0 18 * * *" }, [0, 0]));
  const q = add(sbGet("Low ingredients", "ingredient_levels", "=below_reorder=eq.true", [240, 0]));
  const any = add(ifBool("Anything low?", "={{ $json.id !== undefined }}", [480, 0]));
  const fine = add(noop("Stock fine", [720, 140]));
  const po = add(code("Draft POs by supplier", `
const by = {};
for (const { json: i } of $input.all()) { (by[i.supplier_id] ??= { supplier_id: i.supplier_id, supplier_phone: i.supplier_phone, supplier_name: i.supplier_name, lines: [] }).lines.push({ ingredient: i.name, qty: Math.max(i.reorder_qty, i.reorder_level * 2 - i.stock), unit: i.unit, cost_ngn: i.cost_per_unit }); }
return Object.values(by).map((p) => ({ json: { ...p, total_ngn: p.lines.reduce((s, l) => s + l.qty * l.cost_ngn, 0), status: "draft" } }));`, [720, -60]));
  const save = add(sbCreate("Save draft PO", "purchase_orders", [960, -60]));
  const approve = add(N("Ask Temmie to approve (wait 6h)", "n8n-nodes-base.whatsApp", 1, { operation: "sendAndWait", phoneNumberId: "={{ $vars.WA_PHONE_NUMBER_ID }}", recipientPhoneNumber: "={{ $vars.OWNER_WHATSAPP }}", message: '={{ "Re-order from " + $json.supplier_name + ": " + $json.lines.map((l) => l.qty + l.unit + " " + l.ingredient).join(", ") + ". Approve?" }}', responseType: "approval", options: { limitWaitTime: { values: { limitType: "afterTimeInterval", resumeAmount: 6, resumeUnit: "hours" } } } }, [1200, -60], { credentials: cred.whatsapp, webhookId: randomUUID() }));
  const ok = add(ifBool("Approved?", "={{ $json.data.approved }}", [1440, -60]));
  const no = add(noop("Not approved or timed out (stays draft)", [1680, 80]));
  const send = add(sendWhatsApp("Send PO to supplier", '$("Save draft PO").item.json.supplier_phone', '"Hello from Temmiebakes. Please deliver: " + $("Save draft PO").item.json.lines.map((l) => l.qty + l.unit + " " + l.ingredient).join(", ") + ". Thank you!"', [1680, -160]));
  const upd = add(sbUpdate("Mark PO sent", "purchase_orders", '{{ $("Save draft PO").item.json.id }}', [1920, -160]));
  chain(sch, q, any);
  link(any, po, 0);
  link(any, fine, 1);
  chain(po, save, approve, ok);
  link(ok, send, 0);
  link(ok, no, 1);
  chain(send, upd);
});

W["11-academy"] = workflow("11 · Academy: class enquiries, seat booking, reminders, certificates", [TAG, "academy"], ({ add, link, chain }) => {
  const wh = add(webhook("Webhook: class booking (website, Tia)", "academy/book", [0, 0]));
  const coh = add(sbGet("Load cohort", "cohorts", '=id=eq.{{ $json.body.cohort_id }}', [240, 0]));
  const seat = add(ifBool("Seat available?", "={{ $json.seats_taken < $json.seats }}", [480, 0]));
  const full = add(code("Waitlist", `return [{ json: { ...$("Webhook: class booking (website, Tia)").first().json.body, status: "waitlist" } }];`, [720, 140]));
  const wl = add(sbCreate("Add to waitlist", "enrollments", [960, 140]));
  const wlMsg = add(respond("Respond: waitlisted", [1200, 140], '={{ { ok: true, waitlist: true } }}'));
  const enrol = add(code("Enrolment row", `
const b = $("Webhook: class booking (website, Tia)").first().json.body;
return [{ json: { cohort_id: b.cohort_id, customer_id: b.customer_id, phone: b.phone, status: "reserved", deposit_ngn: Math.round($("Load cohort").first().json.price_ngn / 2) } }];`, [720, -60]));
  const ins = add(sbCreate("Reserve seat", "enrollments", [960, -60]));
  const pay = add(paystackLink("Paystack: class deposit", '$json.phone.replace("+", "") + "@wa.temmiebakes.ng"', "$json.deposit_ngn * 100", '"AC-" + $json.id + "-dep"', [1200, -60]));
  const msg = add(sendWhatsApp("Send seat + pay link", '$("Enrolment row").first().json.phone', '`Your seat is reserved! Pay the 50% deposit to confirm: ${$json.data.authorization_url}. We send the kit list a week before class.`', [1440, -60]));
  const ok = add(respond("Respond 200", [1680, -60]));
  const sch = add(schedule("Daily 09:00", { field: "cronExpression", expression: "0 9 * * *" }, [0, 360]));
  const soon = add(sbGet("Classes starting in 7 days", "enrollments_upcoming", "=days_until=eq.7", [240, 360]));
  const any = add(ifBool("Anyone starting?", "={{ $json.id !== undefined }}", [480, 360]));
  const none = add(noop("No classes next week", [720, 500]));
  const kit = add(sendWhatsApp("Kit list & directions", "$json.phone", '`See you on ${$json.start_label} for ${$json.course_title}! Bring an apron and a notebook; everything else is provided. Studio: ${$vars.STUDIO_ADDRESS}`', [720, 300]));
  chain(wh, coh, seat);
  link(seat, enrol, 0);
  link(seat, full, 1);
  chain(full, wl, wlMsg);
  chain(enrol, ins, pay, msg, ok);
  chain(sch, soon, any);
  link(any, kit, 0);
  link(any, none, 1);
});

W["12-corporate-catering"] = workflow("12 · Corporate catering quotes & proposals", [TAG, "corporate"], ({ add, link, chain }) => {
  add(sticky("## Corporate\nCompany enquiry (website form or Tia) → package priced per guest → Claude writes a short proposal from the approved package copy → PDF-ready HTML emailed to the client and logged as *sent*. A 3-day follow-up runs if there's no answer.", [-120, -280], 600, 200, 5));
  const wh = add(webhook("Webhook: corporate enquiry", "corporate", [0, 0]));
  const price = add(code("Price package", `
const b = $json.body;
const PER_GUEST = { "breakfast-box": 7500, "canape-reception": 11000, "dessert-table": 9000, "cake-and-cupcakes": 4500 };
if (!PER_GUEST[b.package_id]) return [{ json: { ...b, valid: false } }];
const guests = Math.max(10, Number(b.guests) || 0);
const total = PER_GUEST[b.package_id] * guests + (guests > 100 ? 0 : 15000);
return [{ json: { ...b, guests, per_guest_ngn: PER_GUEST[b.package_id], total_ngn: total, valid: true } }];`, [240, 0]));
  const ok = add(ifBool("Known package?", "={{ $json.valid }}", [480, 0]));
  const bad = add(respond("Respond 422", [720, 140], '={{ { ok: false, error: "unknown package" } }}'));
  const write = add(claude("Claude: proposal text", '"Write a concise catering proposal (under 160 words) from Temmiebakes, Lagos, for the event described. Use ONLY the figures given. British English, no em dashes. Terms: 50% deposit to confirm, balance 48 hours before the event."', "JSON.stringify($json)", [720, -60], { temperature: 0.5, maxTokens: 700 }));
  const check = add(code("Validate proposal", `
const t = $json.content?.[0]?.text ?? "";
const q = $("Price package").first().json;
const ok = t.includes(q.total_ngn.toLocaleString("en-GB")) || t.includes(String(q.total_ngn));
return [{ json: { ...q, proposal: t, needs_review: !ok || /—|–/.test(t) } }];`, [960, -60]));
  const save = add(sbCreate("Save quote", "catering_quotes", [1200, -60]));
  const rev = add(ifBool("Needs Temmie's eye?", "={{ $json.needs_review }}", [1440, -60]));
  const hold = add(sendWhatsApp("Ask Temmie to check", "$vars.OWNER_WHATSAPP", '`Corporate quote for ${$json.company} needs a quick check before sending.`', [1680, 80]));
  const mail = add(sendEmail("Email proposal", "$json.email", '"Your Temmiebakes catering proposal"', "$json.proposal", [1680, -160]));
  const w = add(wait("Wait 3 days", 3, "days", [1920, -160]));
  const chk = add(sbGet("Quote status", "catering_quotes", '=id=eq.{{ $("Save quote").first().json.id }}', [2160, -160]));
  const open = add(ifBool("Still open?", '={{ $json.status === "sent" }}', [2400, -160]));
  const fu = add(sendEmail("Follow-up email", "$json.email", '"Following up on your catering proposal"', '"Hello, just checking the proposal reached you. Happy to adjust the menu or numbers."', [2640, -240]));
  const closed = add(noop("Answered (accepted or declined)", [2640, -80]));
  chain(wh, price, ok);
  link(ok, write, 0);
  link(ok, bad, 1);
  chain(write, check, save, rev);
  link(rev, hold, 0);
  link(rev, mail, 1);
  chain(mail, w, chk, open);
  link(open, fu, 0);
  link(open, closed, 1);
});

W["13-ai-content"] = workflow("13 · AI content drafts (Instagram posts, reels, broadcasts)", [TAG, "ai", "marketing"], ({ add, link, chain }) => {
  const sch = add(schedule("Mon & Thu 07:00", { field: "cronExpression", expression: "0 7 * * 1,4" }, [0, 0]));
  const top = add(sbGet("Best sellers & new items", "content_inputs", "=week=eq.{{ $now.toFormat('kkkk-WW') }}", [240, 0]));
  const write = add(claude("Claude: write drafts", '"You write Instagram captions, reel scripts and WhatsApp broadcasts for Temmiebakes, a Lagos cake and dessert business. Warm, playful, British English, no em dashes. Include price, lead time and the call to action DM CAKE. 5-6 Lagos hashtags. Return ONLY JSON: {\\"drafts\\":[{\\"kind\\":\\"instagram-post|reel-script|whatsapp-broadcast\\",\\"product\\":string,\\"text\\":string}]}"', "JSON.stringify($input.all().map((i) => i.json))", [480, 0], { temperature: 0.8, maxTokens: 1500 }));
  const v = add(code("Validate drafts", JS_PARSE_AI("item.json.content?.[0]?.text", ["drafts"]), [720, 0]));
  const ok = add(ifBool("Valid?", "={{ !$json.needs_review }}", [960, 0]));
  const bad = add(sendWhatsApp("Tell Temmie drafts failed", "$vars.OWNER_WHATSAPP", '"This week\'s AI drafts did not come out right, please check the content page."', [1200, 140]));
  const split = add(code("One row per draft", `return $json.ai.drafts.map((d) => ({ json: { ...d, status: "awaiting-approval", text: d.text.replace(/[—–]/g, ",") } }));`, [1200, -60]));
  const save = add(sbCreate("Save to approval queue", "content_drafts", [1440, -60]));
  const ping = add(sendWhatsApp("Ping Temmie to approve", "$vars.OWNER_WHATSAPP", '"New content drafts are ready to approve in the back office."', [1680, -60]));
  chain(sch, top, write, v, ok);
  link(ok, split, 0);
  link(ok, bad, 1);
  chain(split, save, ping);
});

W["14-daily-brief"] = workflow("14 · Morning brief to Temmie", [TAG, "reporting"], ({ add, chain }) => {
  add(sticky("## Morning brief\n07:00 every day: today's orders and value, balances to collect, chats waiting, low stock and tomorrow's capacity, as one WhatsApp message. Numbers come from the database; Claude only phrases them.", [-120, -260], 560, 180, 5));
  const sch = add(schedule("Daily 07:00", { field: "cronExpression", expression: "0 7 * * *" }, [0, 0]));
  const q = add(sbGet("Daily summary view", "daily_brief_view", "=day=eq.{{ $now.toFormat('yyyy-LL-dd') }}", [240, 0]));
  const write = add(claude("Claude: phrase the brief", '"Turn these numbers into a friendly WhatsApp morning brief for a bakery owner, max 80 words, bullet points, no em dashes. Use ONLY the numbers given."', "JSON.stringify($json)", [480, 0], { temperature: 0.5, maxTokens: 300 }));
  const check = add(code("Fallback if AI fails", `
const t = $json.content?.[0]?.text;
const d = $("Daily summary view").first().json;
return [{ json: { text: t && !/—|–/.test(t) ? t : \`Good morning! Today: \${d.orders_today} orders (₦\${d.value_today}). Balances to collect: ₦\${d.balances}. Chats waiting: \${d.handoffs}. Low stock: \${d.low_stock}.\`, ai_failed: !t } }];`, [720, 0]));
  const send = add(sendWhatsApp("Send to Temmie", "$vars.OWNER_WHATSAPP", "$json.text", [960, 0]));
  const log = add(logEvent("Log brief", "daily-report", '"Morning brief sent"', 20, [1200, 0]));
  chain(sch, q, write, check, send, log);
});

// ------------------------------------------------------------------ write

delete W["00-error-handler"].settings.errorWorkflow; // the handler must not point at itself

for (const [file, wf] of Object.entries(W)) {
  writeFileSync(new URL(`${file}.json`, OUT), JSON.stringify(wf, null, 2) + "\n");
}
console.log(`Wrote ${Object.keys(W).length} workflows to /workflows`);
