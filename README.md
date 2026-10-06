# Koretbakes · interactive demo

A clickable demo of an ordering, kitchen and automation platform for Koretbakes, a cake and dessert business in Ikeja, Lagos. It covers:

- a storefront with a live-priced cake builder and deposit checkout
- "Tia", a 24/7 order assistant on Instagram, WhatsApp and the website
- a back office for orders, the kitchen, deliveries, customers, corporate catering, the academy and stock
- an owner dashboard that shows what the automation is worth

Everything runs in the browser on seeded sample data. There are no API keys, no backend and no external integrations. Every AI feature is a scripted simulation that responds to what you type. The production versions of the automations are exported as n8n workflows in [`/workflows`](workflows/README.md).

## What's in it

| Area | Where |
|---|---|
| Storefront: home, menu with categories and search, product pages, basket | `/`, `/menu` |
| Cake builder: size, tiers, shape, flavour, filling, finish, decoration and message, priced live, with an earliest-date check against kitchen capacity | `/cake-builder` |
| Checkout with a 50% deposit or full payment (simulated Paystack), then live order tracking, balance payment and a review | `/checkout`, `/track` |
| Corporate catering packages with an instant quote, and baking classes with seat booking | `/corporate`, `/classes` |
| Tia, the AI assistant: website chat, WhatsApp and Instagram DM mocks. Tia prices cakes, checks dates, takes orders, books class seats, drafts corporate quotes, tracks orders, understands Pidgin and hands over to Temmie | Chat buttons on every page |
| DMs and chats: every conversation in one inbox, with "Simulate a new DM", take over, hand back, and the details Tia captured | `/admin/inbox` |
| Tia settings: tone, rules, handoff triggers, knowledge base and a test sandbox | `/admin/assistant` |
| Orders board and list, order detail with payments and production ticket, kitchen calendar with oven capacity and bake sheet, deliveries by rider and zone | `/admin/orders`, `/admin/kitchen`, `/admin/deliveries` |
| Customers with saved birthdays and anniversaries, reminders and campaigns, reviews, AI content studio | `/admin/customers`, `/admin/campaigns`, `/admin/reviews`, `/admin/content` |
| Corporate quotes and proposals, academy cohorts, stock and recipe costing with re-order POs, menu and pricing | `/admin/corporate`, `/admin/academy`, `/admin/stock`, `/admin/menu` |
| Owner dashboard and the 14 automations with a live activity timeline | `/admin`, `/admin/automations` |

## A five-minute walkthrough for the pitch

1. **Storefront** (`/`): start with the hero and best sellers. Open **Order a cake** and build a 2-tier cake. The price, servings, deposit and earliest date update as you click. Pick a busy date to show the kitchen-full warning.
2. **Tia**: tap **Ask Tia** and type *"How much is an 8 inch red velvet cake for Saturday? Deliver to Yaba"*. Tia quotes the cake, the delivery fee and the deposit. Then try one of these:
   - *"abeg how much be cupcakes for 12"* (Pidgin)
   - *"do you run baking classes?"*
   - *"I want a discount"*, which hands the chat over to Temmie.
3. **Checkout**: add the cake to the basket, check out and pay the deposit in the Paystack window. You land on the tracking page for the new order.
4. **Back office** (*Back office* in the top bar): open **DMs & chats**.
   - The chat from step 2 is there with the details Tia captured.
   - Click **Simulate a new DM** to watch Tia answer an Instagram or WhatsApp message live.
   - Open the complaint marked **Needs you** and reply as Temmie.
5. **Orders**: find the new order and press **Next step** to move it through baking, decorating, ready and out for delivery. Each step sends the customer a WhatsApp update, visible on the order page. Open **Kitchen calendar** for oven capacity and the bake sheet.
6. **Dashboard** (`/admin`): show these numbers:
   - first reply to DMs, under a minute now against more than 3 hours before
   - enquiry conversion, about half before automation and around three quarters now
   - on-time delivery, around 70% before and about 94% now
   - hours saved a week
   - revenue influenced by automation
7. **Automations**: switch workflows on and off, and press **Send due reminders** to send birthday reminders. Each run appears in the live activity log. Every card names the n8n workflow file that runs it in production.

**Reset demo** (top bar or sidebar) restores the original sample data at any time.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Zustand, Motion and Phosphor icons. State is kept in the browser's localStorage.

## Regenerating the n8n workflows

```bash
node scripts/build-workflows.mjs
```
