import type { AssistantSettings, Automation, Category, Course, Ingredient, KBEntry, Product, Recipe, Staff, Supplier } from "../types";

const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type Row = [name: string, cat: Category, price: number, unit: string, img: string, lead: number, points: number, tags: string[], allergens: string[], desc: string];

const ROWS: Row[] = [
  // Celebration cakes (signature designs; every one can be customised in the cake builder)
  ["Sprinkle Party Cake", "celebration-cakes", 52000, '8" round, serves 20', "cake-sprinkle", 2, 2, ["bestseller"], ["gluten", "dairy", "egg"], "Four layers of funfetti sponge, vanilla buttercream and a shower of rainbow sprinkles. The birthday classic."],
  ["Chocolate Drip Celebration", "celebration-cakes", 58000, '8" round, serves 20', "cake-chocolate-drip", 2, 2, ["bestseller"], ["gluten", "dairy", "egg"], "Rich chocolate sponge, chocolate ganache filling, glossy drip and piped rosettes."],
  ["Strawberry Fraisier", "celebration-cakes", 62000, '8" round, serves 18', "cake-strawberry", 3, 2, ["new"], ["gluten", "dairy", "egg"], "Light vanilla genoise with fresh strawberries and crème mousseline, finished with a pink glaze."],
  ["Classic Black Forest", "celebration-cakes", 55000, '8" round, serves 20', "cake-black-forest", 2, 2, [], ["gluten", "dairy", "egg"], "Chocolate sponge soaked in cherry syrup, whipped cream and dark chocolate shavings."],
  ["Floral Semi-naked Cake", "celebration-cakes", 65000, '8" round, serves 20', "cake-floral", 3, 2, [], ["gluten", "dairy", "egg"], "Vanilla bean sponge, berry compote and a semi-naked finish dressed with edible flowers."],
  ["Pink Drip & Macaron Cake", "celebration-cakes", 72000, '8" tall, serves 24', "cake-drip-pink", 3, 3, ["new", "instagram-favourite"], ["gluten", "dairy", "egg", "nuts"], "Tall strawberry cake with a white chocolate drip, French macarons and gold sprinkles."],
  ["Ice Cream Cone Drip Cake", "celebration-cakes", 60000, '8" round, serves 20', "cake-icecream-drip", 3, 2, ["kids"], ["gluten", "dairy", "egg"], "Pink funfetti cake with a candy drip and upside-down ice cream cones. Kids love this one."],
  ["Gold Drip Luxe", "celebration-cakes", 85000, '8" tall, serves 24', "cake-gold-drip", 4, 3, ["premium"], ["gluten", "dairy", "egg"], "Red velvet with cream cheese, a hand-painted gold drip, gold leaf and chocolate shards."],
  ["Kids Character Cake", "celebration-cakes", 68000, '8" round, serves 20', "cake-kids-emoji", 4, 3, ["kids"], ["gluten", "dairy", "egg"], "Your child's favourite character or emoji in fondant, on any flavour you like."],
  ["Mirror Glaze Orange Entremet", "celebration-cakes", 70000, '7" entremet, serves 14', "cake-mirror-orange", 4, 3, ["premium"], ["gluten", "dairy", "egg"], "Orange and white chocolate mousse cake with a glossy mirror glaze."],
  ["Ombre Rosette Cake", "celebration-cakes", 58000, '8" round, serves 20', "cake-piping", 2, 2, [], ["gluten", "dairy", "egg"], "Vanilla or chocolate sponge piped with ombre buttercream rosettes in your colours."],
  ["Double Chocolate Ganache", "celebration-cakes", 56000, '8" round, serves 20', "cake-chocolate-ganache", 2, 2, ["bestseller"], ["gluten", "dairy", "egg"], "Dark chocolate sponge with whipped ganache and chocolate pearls."],
  ["Chocolate Cherry Layer Cake", "celebration-cakes", 60000, '8" round, serves 20', "cake-chocolate-layers", 2, 2, [], ["gluten", "dairy", "egg"], "Naked chocolate layers, vanilla cream and cherries. Rustic and indulgent."],
  ["Two-tier Berry Wedding Cake", "celebration-cakes", 280000, '10" + 8", serves 55', "cake-wedding-berry", 7, 6, ["premium", "wedding"], ["gluten", "dairy", "egg"], "Two tiers of vanilla and red velvet with fresh berries. Tastings available for weddings."],
  // Cupcakes
  ["Red Velvet Cupcakes", "cupcakes", 15000, "box of 6", "cupcake-red-velvet", 1, 0.5, ["bestseller"], ["gluten", "dairy", "egg"], "Moist red velvet with cream cheese frosting and red crumb."],
  ["Cookies & Cream Cupcakes", "cupcakes", 16000, "box of 6", "cupcake-oreo", 1, 0.5, [], ["gluten", "dairy", "egg"], "Chocolate cupcakes, Oreo buttercream and a whole cookie on top."],
  ["Funfetti Cupcakes", "cupcakes", 13500, "box of 6", "cupcake-sprinkle", 1, 0.5, ["kids"], ["gluten", "dairy", "egg"], "Vanilla sprinkle sponge with a cloud of buttercream and sprinkles."],
  ["Chocolate Fudge Cupcakes", "cupcakes", 14500, "box of 6", "cupcake-chocolate", 1, 0.5, [], ["gluten", "dairy", "egg"], "Deep chocolate cupcakes with whipped chocolate fudge frosting."],
  ["Strawberry Cupcakes", "cupcakes", 14500, "box of 6", "cupcake-strawberry", 1, 0.5, [], ["gluten", "dairy", "egg"], "Strawberry sponge, strawberry buttercream and a fresh berry."],
  ["Lemon Meringue Cupcakes", "cupcakes", 15500, "box of 6", "cupcake-lemon", 1, 0.5, ["new"], ["gluten", "dairy", "egg"], "Lemon sponge, lemon curd centre and toasted meringue."],
  ["Unicorn Swirl Cupcakes", "cupcakes", 28000, "box of 12", "cupcake-swirl", 2, 1, ["kids"], ["gluten", "dairy", "egg"], "Pastel swirl buttercream in your party colours. Perfect for school birthdays."],
  ["Mint Chocolate Cupcakes", "cupcakes", 14500, "box of 6", "cupcake-mint", 1, 0.5, [], ["gluten", "dairy", "egg"], "Chocolate cupcakes with fresh mint buttercream."],
  // Desserts
  ["Oreo Cake Parfait Cups", "desserts", 12000, "set of 4", "dessert-cake-parfait", 1, 0.5, ["bestseller"], ["gluten", "dairy", "egg"], "Layers of chocolate cake, Oreo crumb and vanilla cream in take-away cups."],
  ["Strawberry Cream Parfait", "desserts", 11000, "set of 4", "dessert-parfait-cups", 1, 0.5, [], ["dairy"], "Vanilla panna cotta, strawberry compote and fresh strawberries."],
  ["Classic Tiramisu Tray", "desserts", 24000, "tray, serves 8", "dessert-tiramisu", 1, 1, [], ["gluten", "dairy", "egg"], "Espresso-soaked sponge, mascarpone cream and cocoa."],
  ["Blueberry Cheesecake", "desserts", 38000, '8" whole', "dessert-cheesecake-blueberry", 2, 1, [], ["gluten", "dairy", "egg"], "Baked New York cheesecake topped with blueberry compote."],
  ["New York Cheesecake Slices", "desserts", 16000, "box of 4", "dessert-cheesecake", 1, 0.5, [], ["gluten", "dairy", "egg"], "Creamy baked cheesecake on a buttery biscuit base."],
  ["Lemon Tarts", "desserts", 12500, "box of 6", "dessert-lemon-tarts", 1, 0.5, [], ["gluten", "dairy", "egg"], "Crisp pastry shells with tangy lemon curd and berries."],
  ["Fruit Tartlets", "desserts", 21000, "box of 12", "dessert-tartlets", 2, 1, ["events"], ["gluten", "dairy", "egg"], "Vanilla custard tartlets with seasonal fruit. Popular on dessert tables."],
  ["French Macarons", "desserts", 18000, "box of 12", "dessert-macarons", 2, 0.5, ["gift"], ["nuts", "egg", "dairy"], "Assorted almond macarons: vanilla, raspberry, pistachio, salted caramel."],
  ["Fudgy Brownies", "desserts", 13500, "box of 9", "brownie-tray", 1, 0.5, ["bestseller"], ["gluten", "dairy", "egg"], "Crackly-topped, gooey-centred dark chocolate brownies."],
  ["Cheesecake Marble Brownies", "desserts", 12000, "box of 6", "brownie-marble", 1, 0.5, [], ["gluten", "dairy", "egg"], "Fudgy brownie swirled with vanilla cheesecake."],
  ["Raspberry Sponge Slices", "desserts", 12000, "box of 4", "slice-raspberry", 1, 0.5, [], ["gluten", "dairy", "egg"], "Vanilla sponge, raspberry jam and fresh cream."],
  ["Honey Cake Slices", "desserts", 14000, "box of 4", "slice-honey", 2, 0.5, ["new"], ["gluten", "dairy", "egg"], "Thin honey layers and sour cream frosting (medovik)."],
  // Pastries
  ["Cinnamon Rolls", "pastries", 12000, "box of 6", "pastry-cinnamon-rolls", 1, 0.5, ["bestseller"], ["gluten", "dairy", "egg"], "Soft rolls with brown sugar cinnamon and cream cheese glaze."],
  ["Glazed Doughnuts", "pastries", 9000, "box of 6", "pastry-doughnut-stack", 1, 0.5, [], ["gluten", "dairy", "egg"], "Fluffy yeast doughnuts, glazed and sprinkled."],
  ["Pink Sprinkle Doughnuts", "pastries", 9500, "box of 6", "pastry-doughnut-pink", 1, 0.5, ["kids"], ["gluten", "dairy", "egg"], "Strawberry-glazed doughnuts with sprinkles."],
  ["Butter Croissants", "pastries", 13000, "box of 6", "pastry-croissant", 1, 0.5, [], ["gluten", "dairy"], "Flaky all-butter croissants, baked fresh each morning."],
  ["Banana Bread Loaf", "pastries", 8500, "1 loaf", "pastry-loaf", 1, 0.5, ["bestseller"], ["gluten", "dairy", "egg"], "Moist banana bread with a crackly sugar top. Walnuts optional."],
  ["Brunch Bread Basket", "pastries", 22000, "basket for 6", "pastry-bread-basket", 1, 1, ["gift"], ["gluten", "dairy", "egg"], "Croissants, rolls, banana bread and mini muffins."],
  // Cookies & gifts
  ["Chocolate Chip Cookies", "cookies", 9500, "box of 12", "cookie-chocolate-chip", 1, 0.5, [], ["gluten", "dairy", "egg"], "Chewy brown-butter cookies with chocolate chunks."],
  ["Cookie Gift Basket", "cookies", 25000, "gift basket", "cookie-basket", 2, 1, ["gift"], ["gluten", "dairy", "egg"], "Assorted cookies in a woven basket with a handwritten card."],
  ["Funfetti Cookies", "cookies", 9500, "box of 12", "cookie-funfetti", 1, 0.5, ["kids"], ["gluten", "dairy", "egg"], "Soft vanilla cookies loaded with sprinkles."],
  ["Chocolate Bark Gift Box", "cookies", 11000, "gift box", "chocolate-bark", 2, 0.5, ["gift"], ["dairy", "nuts"], "Dark chocolate bark with nuts, dried fruit and sea salt."],
];

const COST_RATIO: Record<Category, number> = { "celebration-cakes": 0.36, cupcakes: 0.33, desserts: 0.34, pastries: 0.3, cookies: 0.28, corporate: 0.4 };
const RECIPE_FOR: Record<Category, string> = { "celebration-cakes": "r-cake", cupcakes: "r-cupcakes", desserts: "r-dessert", pastries: "r-pastry", cookies: "r-cookies", corporate: "r-dessert" };

export const PRODUCTS: Product[] = ROWS.map(([name, category, priceNGN, unit, img, leadDays, ovenPoints, tags, allergens, description], i) => ({
  id: `pr-${String(i + 1).padStart(2, "0")}`,
  slug: slug(name),
  name,
  category,
  description,
  priceNGN,
  unit,
  image: `/img/${img}.jpg`,
  leadDays,
  ovenPoints,
  tags,
  allergens,
  recipeId: RECIPE_FOR[category],
  costNGN: Math.round((priceNGN * COST_RATIO[category]) / 100) * 100,
  available: true,
}));

export const STAFF: Staff[] = [
  { id: "st-temmie", name: "Temmie", initials: "TM", role: "Founder & head baker", hue: 335, kind: "owner" },
  { id: "st-bisola", name: "Bisola Adeyemi", initials: "BA", role: "Kitchen lead", hue: 20, kind: "kitchen" },
  { id: "st-ope", name: "Ope Okafor", initials: "OO", role: "Cake decorator", hue: 280, kind: "kitchen" },
  { id: "st-kunle", name: "Kunle Bello", initials: "KB", role: "Baker", hue: 45, kind: "kitchen" },
  { id: "st-ify", name: "Ifeoma Eze", initials: "IE", role: "Orders & customer care", hue: 200, kind: "admin" },
  { id: "st-musa", name: "Musa Garba", initials: "MG", role: "Dispatch rider", hue: 150, kind: "rider" },
  { id: "st-emeka", name: "Emeka Nwosu", initials: "EN", role: "Dispatch rider", hue: 100, kind: "rider" },
];

export const COURSES: Course[] = [
  { id: "co-beginner", slug: "beginner-cake-baking", title: "Beginner Cake Baking", level: "Beginner", days: 3, priceNGN: 120000, image: "/img/class-kneading.jpg", mode: "in-person", outline: ["Sponges: vanilla, chocolate, red velvet", "Buttercream basics and crumb coat", "Smooth finish and simple piping", "Costing and pricing your first cakes"] },
  { id: "co-buttercream", slug: "buttercream-mastery", title: "Buttercream Mastery", level: "Intermediate", days: 2, priceNGN: 95000, image: "/img/cake-piping.jpg", mode: "in-person", outline: ["Swiss meringue and American buttercream", "Rosettes, ombre and textures", "Sharp edges and drips", "Colour mixing for Lagos heat"] },
  { id: "co-fondant", slug: "fondant-and-sugar-flowers", title: "Fondant & Sugar Flowers", level: "Advanced", days: 4, priceNGN: 180000, image: "/img/cake-wedding-berry.jpg", mode: "in-person", outline: ["Covering and stacking tiered cakes", "Sugar roses and peonies", "Figurines and character work", "Transporting tiered cakes safely"] },
  { id: "co-desserts", slug: "desserts-for-business", title: "Desserts & Parfaits for Business", level: "Business", days: 2, priceNGN: 85000, image: "/img/dessert-cake-parfait.jpg", mode: "in-person", outline: ["Cake parfaits, cheesecakes and brownies", "Packaging and shelf life", "Pricing for profit", "Selling on Instagram and WhatsApp"] },
  { id: "co-pastry", slug: "pastry-and-small-chops", title: "Pastry & Small Chops Masterclass", level: "Business", days: 3, priceNGN: 110000, image: "/img/pastry-croissant.jpg", mode: "in-person", outline: ["Puff puff, samosa, spring rolls", "Croissants and cinnamon rolls", "Doughnuts and meat pies", "Catering for events"] },
  { id: "co-kids", slug: "kids-baking-camp", title: "Kids Baking Camp", level: "Kids", days: 5, priceNGN: 75000, image: "/img/class-group.jpg", mode: "in-person", outline: ["Cookies and cupcakes", "Decorating with buttercream", "Kitchen safety", "Take-home treats every day"] },
  { id: "co-online", slug: "start-your-cake-business", title: "Start Your Cake Business (online)", level: "Business", days: 28, priceNGN: 45000, image: "/img/shop-display.jpg", mode: "online", outline: ["Recipes that travel well in Lagos heat", "Costing, deposits and pricing", "Photography for Instagram", "Handling orders without burnout"] },
];

export const SUPPLIERS: Supplier[] = [
  { id: "su-ikeja", name: "Ikeja Baking Supplies", phone: "+234 803 441 2087", items: "Flour, sugar, cocoa, fondant, colours", leadDays: 1 },
  { id: "su-dairy", name: "Lagos Dairy Hub", phone: "+234 809 112 6630", items: "Butter, whipping cream, cream cheese", leadDays: 1 },
  { id: "su-fresh", name: "Fresh Farm Eggs & Produce", phone: "+234 816 228 4410", items: "Eggs, strawberries, fruit", leadDays: 1 },
  { id: "su-box", name: "Boxit Packaging, Ogba", phone: "+234 812 770 9015", items: "Cake boards, cake boxes, cupcake boxes", leadDays: 2 },
];

type IRow = [id: string, name: string, unit: string, stock: number, reorderAt: number, cost: number, supplier: string, usage7d: number];
const IROWS: IRow[] = [
  ["in-flour", "Plain flour", "kg", 42, 25, 1600, "su-ikeja", 38],
  ["in-sugar", "Granulated sugar", "kg", 30, 20, 1900, "su-ikeja", 26],
  ["in-icing", "Icing sugar", "kg", 9, 15, 2800, "su-ikeja", 21],
  ["in-butter", "Unsalted butter", "kg", 14, 12, 9500, "su-dairy", 19],
  ["in-eggs", "Eggs", "crate (30)", 6, 5, 6200, "su-fresh", 9],
  ["in-cream", "Whipping cream", "litre", 8, 10, 7800, "su-dairy", 12],
  ["in-cheese", "Cream cheese", "kg", 3, 4, 14000, "su-dairy", 5],
  ["in-cocoa", "Cocoa powder", "kg", 5, 3, 9000, "su-ikeja", 3],
  ["in-choc", "Dark chocolate", "kg", 6, 4, 12500, "su-ikeja", 5],
  ["in-vanilla", "Vanilla extract", "litre", 1.2, 1, 35000, "su-ikeja", 0.4],
  ["in-fondant", "Fondant", "kg", 7, 5, 6500, "su-ikeja", 4],
  ["in-colour", "Gel food colours", "bottle", 4, 3, 3000, "su-ikeja", 2],
  ["in-oreo", "Oreo biscuits", "pack", 18, 12, 1200, "su-ikeja", 14],
  ["in-straw", "Fresh strawberries", "kg", 2, 3, 6000, "su-fresh", 4],
  ["in-boards", "Cake boards", "piece", 40, 30, 600, "su-box", 26],
  ["in-boxes", "Cake boxes", "piece", 55, 40, 900, "su-box", 31],
  ["in-cupbox", "Cupcake boxes (6)", "piece", 30, 25, 500, "su-box", 22],
  ["in-gold", "Edible gold leaf", "sheet", 12, 10, 1500, "su-ikeja", 6],
];

export const INGREDIENTS: Ingredient[] = IROWS.map(([id, name, unit, stock, reorderAt, costPerUnitNGN, supplierId, usage7d]) => ({ id, name, unit, stock, reorderAt, costPerUnitNGN, supplierId, usage7d }));

export const RECIPES: Recipe[] = [
  { id: "r-cake", name: "Celebration cake (per oven point)", yields: "≈ one 8-inch tier", labourMins: 150, ingredients: [{ ingredientId: "in-flour", qty: 0.5 }, { ingredientId: "in-sugar", qty: 0.4 }, { ingredientId: "in-icing", qty: 0.5 }, { ingredientId: "in-butter", qty: 0.45 }, { ingredientId: "in-eggs", qty: 0.25 }, { ingredientId: "in-cream", qty: 0.3 }, { ingredientId: "in-boards", qty: 1 }, { ingredientId: "in-boxes", qty: 1 }] },
  { id: "r-cupcakes", name: "Cupcakes (box of 6)", yields: "6 cupcakes", labourMins: 40, ingredients: [{ ingredientId: "in-flour", qty: 0.18 }, { ingredientId: "in-sugar", qty: 0.15 }, { ingredientId: "in-icing", qty: 0.2 }, { ingredientId: "in-butter", qty: 0.15 }, { ingredientId: "in-eggs", qty: 0.1 }, { ingredientId: "in-cupbox", qty: 1 }] },
  { id: "r-dessert", name: "Dessert batch", yields: "one box or tray", labourMins: 45, ingredients: [{ ingredientId: "in-cream", qty: 0.3 }, { ingredientId: "in-cheese", qty: 0.2 }, { ingredientId: "in-sugar", qty: 0.1 }, { ingredientId: "in-oreo", qty: 1 }, { ingredientId: "in-boxes", qty: 1 }] },
  { id: "r-pastry", name: "Pastry batch", yields: "one box", labourMins: 50, ingredients: [{ ingredientId: "in-flour", qty: 0.35 }, { ingredientId: "in-butter", qty: 0.2 }, { ingredientId: "in-sugar", qty: 0.08 }, { ingredientId: "in-eggs", qty: 0.05 }, { ingredientId: "in-boxes", qty: 1 }] },
  { id: "r-cookies", name: "Cookie batch", yields: "12 cookies", labourMins: 35, ingredients: [{ ingredientId: "in-flour", qty: 0.3 }, { ingredientId: "in-butter", qty: 0.2 }, { ingredientId: "in-sugar", qty: 0.2 }, { ingredientId: "in-choc", qty: 0.15 }, { ingredientId: "in-boxes", qty: 1 }] },
];

export const KNOWLEDGE: KBEntry[] = [
  { id: "kb-delivery", question: "Do you deliver, and how much?", keywords: ["deliver", "delivery", "dispatch", "send to", "una dey deliver", "how much to"], answer: "Yes, we deliver across Lagos from our Ikeja studio. Ikeja and GRA from ₦2,500, Surulere ₦6,000, Ikoyi and VI ₦8,000, Lekki ₦9,500 and Ajah ₦12,000. Pickup from Ikeja is free.", approved: true },
  { id: "kb-notice", question: "How much notice do you need?", keywords: ["notice", "how long", "how soon", "lead time", "same day", "today", "tomorrow", "urgent"], answer: "Ready-made treats (cupcakes, parfaits, brownies, pastries) need 24 hours. Celebration cakes need 2-3 days, premium or tiered designs 5-7 days, and wedding cakes 2-4 weeks. For same-day, message us before 10am and we'll check what's in the kitchen.", approved: true },
  { id: "kb-deposit", question: "How do payment and deposits work?", keywords: ["deposit", "pay", "payment", "transfer", "account", "card", "balance", "half"], answer: "A 50% deposit confirms your order and books your slot in the kitchen; the balance is due before dispatch. You can pay by bank transfer or card through Paystack, and you'll get a receipt automatically.", approved: true },
  { id: "kb-eggless", question: "Do you do eggless, dairy-free or nut-free?", keywords: ["eggless", "egg free", "vegan", "dairy free", "lactose", "nut", "allergy", "allergic", "gluten"], answer: "Eggless versions of most sponges are available for ₦5,000 extra. We bake in a kitchen that handles nuts, dairy, eggs and gluten, so we can't guarantee allergen-free. Tell us about any allergy and we'll advise.", approved: true },
  { id: "kb-copy", question: "Can you recreate a cake from a picture?", keywords: ["picture", "photo", "replicate", "recreate", "copy", "inspo", "inspiration", "like this"], answer: "Yes, send the picture and we'll recreate the style in your colours. Very detailed designs (figurines, sugar flowers) are quoted by our decorator, and we'll reply with a price within the hour during working hours.", approved: true },
  { id: "kb-cancel", question: "What is your cancellation policy?", keywords: ["cancel", "refund", "change date", "reschedule", "postpone"], answer: "You can reschedule free of charge up to 72 hours before. Deposits are refundable up to 72 hours before your date; after that, ingredients are already bought, so the deposit can be moved to a new date instead.", approved: true },
  { id: "kb-storage", question: "How should I store my cake?", keywords: ["store", "fridge", "keep", "last", "shelf life", "heat", "melt"], answer: "Keep buttercream cakes in the fridge and bring them out 30 minutes before serving. Whipped cream cakes must stay chilled. Lagos heat melts icing fast, so avoid leaving cakes in a hot car.", approved: true },
  { id: "kb-classes", question: "Do you run baking classes?", keywords: ["class", "classes", "train", "training", "learn", "course", "academy", "student"], answer: "Yes. We've trained over 200 students. Courses run from beginner cake baking to fondant and sugar flowers, plus a kids' camp and an online business course. Ingredients, aprons and a certificate are included.", approved: true },
  { id: "kb-corporate", question: "Do you cater corporate events?", keywords: ["corporate", "office", "company", "breakfast", "canape", "canapé", "event", "staff", "invoice"], answer: "Yes: corporate breakfast boxes from ₦7,500 per guest, canapé receptions from ₦11,000, dessert tables and office celebration cakes. We invoice companies and can set up monthly orders.", approved: true },
  { id: "kb-smallchops", question: "Do you do small chops?", keywords: ["small chops", "smallchops", "puff puff", "samosa", "spring roll", "chops"], answer: "Our small chops are made by our sister brand @1005foodhub, and we can add them to any cake or event order so you get one delivery and one invoice.", approved: true },
  { id: "kb-location", question: "Where are you located?", keywords: ["where", "location", "address", "pickup", "pick up", "studio", "shop"], answer: "Our studio is in Ikeja, Lagos. Pickups are by appointment from 10am to 6pm, Monday to Saturday. We'll send the exact pin with your order confirmation.", approved: true },
];

export const ASSISTANT: AssistantSettings = {
  name: "Tia",
  tone: "warm",
  discloseAI: true,
  depositPct: 50,
  rules: [
    { id: "r1", text: "Say you're Temmiebakes' AI assistant in the first reply", enabled: true },
    { id: "r2", text: "Only quote from the price list and cake builder; never promise a discount", enabled: true },
    { id: "r3", text: "Check kitchen capacity before confirming a date", enabled: true },
    { id: "r4", text: "Always mention allergens when asked about ingredients", enabled: true },
    { id: "r5", text: "Collect a 50% deposit before booking a slot", enabled: true },
  ],
  handoff: [
    { id: "h1", label: "Complaint or refund", keywords: ["complain", "complaint", "refund", "disappointed", "not happy", "spoilt", "melted", "late"], enabled: true },
    { id: "h2", label: "Discount or price negotiation", keywords: ["discount", "reduce", "last price", "too expensive", "cheaper", "abeg reduce"], enabled: true },
    { id: "h3", label: "Wants to speak to Temmie", keywords: ["speak to temmie", "talk to temmie", "human", "real person", "call me", "owner"], enabled: true },
    { id: "h4", label: "Wedding cake consultation", keywords: ["wedding cake", "wedding", "tasting"], enabled: true },
    { id: "h5", label: "Very large order (over ₦500k)", keywords: [], enabled: true },
  ],
};

export const AUTOMATIONS: Automation[] = [
  { id: "order-intake", name: "Order intake from DMs, WhatsApp & website", trigger: "New enquiry on any channel", action: "Log customer + order, check capacity, send quote", channel: "internal", active: true, template: "", file: "01-order-intake.json" },
  { id: "ai-assistant", name: "Tia, the 24/7 order assistant", trigger: "Message on Instagram, WhatsApp or website", action: "Answer, quote, take deposit, hand off when needed", channel: "whatsapp", active: true, template: "", file: "02-ai-order-assistant.json" },
  { id: "quote-follow-up", name: "Quote follow-up", trigger: "Quote unpaid after 6 hours", action: "Friendly nudge with the payment link, then a last call at 24h", channel: "whatsapp", active: true, template: "Hi {{firstName}}, just checking you saw your quote for the {{item}} ({{total}}). Your {{date}} slot is held until tonight. Pay the deposit here: {{payLink}}", file: "03-quote-follow-up.json" },
  { id: "payment-reminders", name: "Deposit & balance reminders", trigger: "Balance due 48h before delivery", action: "Send balance link; release slot if deposit unpaid", channel: "whatsapp", active: true, template: "Hi {{firstName}}, your {{item}} is scheduled for {{date}}. The balance of {{balance}} is due before dispatch: {{payLink}}", file: "04-payment-reminders.json" },
  { id: "order-updates", name: "Order status updates", trigger: "Order moves to baking, ready or out for delivery", action: "WhatsApp update with photo and rider ETA", channel: "whatsapp", active: true, template: "Your {{item}} is {{status}}! {{eta}}", file: "05-order-updates.json" },
  { id: "occasion-reminders", name: "Birthday & anniversary reminders", trigger: "Saved occasion is 14 days away", action: "Personal offer to re-order, with last year's cake photo", channel: "whatsapp", active: true, template: "Hi {{firstName}}! {{occasion}} is on {{date}}. Shall we bake something special again? Order this week and get free delivery.", file: "06-occasion-reminders.json" },
  { id: "review-request", name: "Review & photo request", trigger: "Delivered + 1 day", action: "Ask for a rating and a party photo to repost", channel: "whatsapp", active: true, template: "Hi {{firstName}}, we hope the {{item}} was a hit! Could you rate it 1-5 and share a photo for our page?", file: "07-review-request.json" },
  { id: "reorder-nudge", name: "Re-order nudge", trigger: "No order in 45 days (treats customers)", action: "New flavours of the week + one-tap re-order", channel: "instagram", active: true, template: "Hi {{firstName}}, your favourite {{item}} is back this week, plus new honey cake slices. Reply YES to re-order.", file: "08-reorder-nudge.json" },
  { id: "capacity-guard", name: "Kitchen capacity guard", trigger: "Day reaches 85% of oven capacity", action: "Assistant offers next free date; alert Temmie", channel: "internal", active: true, template: "", file: "09-capacity-guard.json" },
  { id: "stock-reorder", name: "Ingredient re-order", trigger: "Stock below re-order level", action: "Draft purchase order and WhatsApp the supplier", channel: "internal", active: true, template: "", file: "10-stock-reorder.json" },
  { id: "academy", name: "Academy enrolment & reminders", trigger: "Class enquiry or booking", action: "Seat hold, payment link, class reminders, certificate", channel: "whatsapp", active: true, template: "Hi {{firstName}}, your seat for {{course}} on {{date}} is confirmed. Bring an apron and an appetite!", file: "11-academy.json" },
  { id: "corporate", name: "Corporate catering quotes", trigger: "Corporate enquiry", action: "Package quote PDF, follow-up, monthly re-order", channel: "email", active: true, template: "", file: "12-corporate-catering.json" },
  { id: "content", name: "AI Instagram content", trigger: "New product photo or weekly schedule", action: "Captions, hashtags and broadcast drafts for approval", channel: "internal", active: true, template: "", file: "13-ai-content.json" },
  { id: "daily-report", name: "Daily kitchen brief & weekly report", trigger: "Every day 6:30am", action: "Today's bakes, deliveries, unpaid balances to WhatsApp", channel: "whatsapp", active: true, template: "", file: "14-daily-brief.json" },
];
