// Domain model for the Temmiebakes demo (cakes, desserts, corporate catering, baking academy).
// Everything is simulated in the browser (Zustand + localStorage); see src/lib/store.ts.

export type Category = "celebration-cakes" | "cupcakes" | "desserts" | "pastries" | "cookies" | "corporate";

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: Category;
  description: string;
  priceNGN: number; // "from" price
  unit: string; // "8-inch cake", "box of 6", "per guest"
  image: string;
  leadDays: number; // minimum notice
  ovenPoints: number; // production capacity it consumes per unit
  tags: string[]; // bestseller, new, eggless-option, gift
  allergens: string[];
  recipeId?: string;
  costNGN: number; // ingredient + packaging cost per unit (for margin)
  available: boolean;
}

export type Shape = "round" | "square" | "heart";
export type Finish = "buttercream" | "whipped-cream" | "fondant" | "naked" | "drip";
export type Decoration = "simple" | "themed" | "premium";

export interface CakeConfig {
  shape: Shape;
  sizeInches: 6 | 8 | 10 | 12;
  tiers: 1 | 2 | 3;
  flavour: string;
  filling: string;
  finish: Finish;
  decoration: Decoration;
  colours: string;
  message: string;
  referencePhoto?: string;
}

export interface OrderItem {
  productId?: string;
  name: string;
  qty: number;
  unitPriceNGN: number;
  custom?: CakeConfig;
  notes?: string;
}

export type OrderStatus =
  | "enquiry"
  | "quoted"
  | "confirmed"
  | "baking"
  | "decorating"
  | "ready"
  | "out-for-delivery"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "unpaid" | "deposit" | "paid" | "refunded";
export type Channel = "instagram" | "whatsapp" | "web" | "walk-in" | "phone" | "corporate";
export type Occasion = "birthday" | "wedding" | "anniversary" | "baby-shower" | "graduation" | "corporate" | "just-because" | "valentine";

export interface Order {
  id: string;
  number: string; // TB-1042
  customerId: string;
  channel: Channel;
  items: OrderItem[];
  subtotalNGN: number;
  deliveryFeeNGN: number;
  discountNGN: number;
  totalNGN: number;
  depositNGN: number;
  paidNGN: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  occasion: Occasion;
  dueAt: string; // ISO, delivery or pickup time
  fulfilment: "delivery" | "pickup";
  zoneId?: string;
  address?: string;
  riderId?: string;
  ovenPoints: number;
  createdAt: string;
  updatedAt: string;
  history: { at: string; status: OrderStatus; by: string }[];
  assistedByAI: boolean;
  quoteSentAt?: string;
  reviewRequested?: boolean;
  rating?: number;
  review?: string;
  lateMins?: number;
}

export type Segment = "individual" | "corporate" | "student" | "reseller";

export interface CustomerOccasion {
  type: Occasion;
  label: string; // "Daughter Tolu's birthday"
  date: string; // MM-DD
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  instagram?: string;
  company?: string;
  zoneId: string;
  segment: Segment;
  source: Channel | "referral" | "class";
  createdAt: string;
  lastOrderAt?: string;
  tags: string[];
  occasions: CustomerOccasion[];
  consentWhatsApp: boolean;
  notes?: string;
  firstResponseMins?: number;
}

export interface Zone {
  id: string;
  name: string;
  feeNGN: number;
  etaMins: number;
}

export interface Staff {
  id: string;
  name: string;
  initials: string;
  role: string;
  hue: number;
  kind: "owner" | "kitchen" | "rider" | "admin";
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string; // kg, l, pcs, pack
  stock: number;
  reorderAt: number;
  costPerUnitNGN: number;
  supplierId: string;
  usage7d: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  items: string;
  leadDays: number;
}

export interface Recipe {
  id: string;
  name: string; // per 8-inch round or per unit
  yields: string;
  ingredients: { ingredientId: string; qty: number }[];
  labourMins: number;
}

export interface StockMove {
  id: string;
  at: string;
  ingredientId: string;
  qty: number; // negative = used
  reason: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  lines: { ingredientId: string; qty: number }[];
  totalNGN: number;
  status: "draft" | "sent" | "received";
  createdAt: string;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  level: "Beginner" | "Intermediate" | "Advanced" | "Kids" | "Business";
  days: number;
  priceNGN: number;
  image: string;
  outline: string[];
  mode: "in-person" | "online" | "hybrid";
}

export interface Cohort {
  id: string;
  courseId: string;
  startDate: string;
  seats: number;
  studentIds: string[];
}

export interface Enrollment {
  id: string;
  cohortId: string;
  customerId: string;
  paidNGN: number;
  status: "reserved" | "paid" | "attending" | "completed";
  certificate?: boolean;
  createdAt: string;
}

export type PackageId = "breakfast-box" | "canape-reception" | "dessert-table" | "cake-and-cupcakes";

export interface CateringQuote {
  id: string;
  number: string; // CQ-210
  customerId: string;
  company: string;
  event: string;
  guests: number;
  date: string;
  packageId: PackageId;
  extras: { name: string; priceNGN: number }[];
  perGuestNGN: number;
  totalNGN: number;
  status: "draft" | "sent" | "accepted" | "declined";
  recurring?: "monthly" | "quarterly";
  createdAt: string;
  sentAt?: string;
}

export interface ChatMessage {
  id: string;
  from: "user" | "ai" | "agent" | "system";
  text: string;
  at: string;
  productIds?: string[];
  quickReplies?: string[];
  card?: { kind: "quote" | "order" | "class" | "catering"; refId: string };
}

export interface Draft {
  cake?: Partial<CakeConfig>;
  productId?: string;
  qty?: number;
  occasion?: Occasion;
  date?: string; // ISO date
  zoneId?: string;
  fulfilment?: "delivery" | "pickup";
  name?: string;
  phone?: string;
  courseId?: string;
  guests?: number;
  packageId?: PackageId;
  awaiting?: "date" | "zone" | "contact" | "confirm" | "size" | "flavour" | "guests" | "course";
  quoteNGN?: number;
}

export type ConvChannel = "instagram" | "whatsapp" | "web";

export interface Conversation {
  id: string;
  channel: ConvChannel;
  customerId?: string;
  name: string;
  handle?: string;
  status: "ai" | "handoff" | "staff" | "closed";
  handoffReason?: string;
  draft: Draft;
  messages: ChatMessage[];
  startedAt: string;
  lastAt: string;
  orderId?: string;
  unread: number;
  review?: "approved" | "flagged";
}

export type OutboundChannel = "whatsapp" | "instagram" | "sms" | "email";
export type OutboundStatus = "scheduled" | "sent" | "delivered" | "read" | "replied" | "failed";

export interface Outbound {
  id: string;
  channel: OutboundChannel;
  customerId: string;
  automationId?: string;
  body: string;
  scheduledFor: string;
  sentAt?: string;
  status: OutboundStatus;
  orderId?: string;
}

export type AutomationId =
  | "order-intake"
  | "ai-assistant"
  | "quote-follow-up"
  | "payment-reminders"
  | "order-updates"
  | "occasion-reminders"
  | "review-request"
  | "reorder-nudge"
  | "capacity-guard"
  | "stock-reorder"
  | "academy"
  | "corporate"
  | "content"
  | "daily-report";

export interface Automation {
  id: AutomationId;
  name: string;
  trigger: string;
  action: string;
  channel: OutboundChannel | "internal";
  active: boolean;
  template: string;
  file: string; // n8n export
}

export interface AutoEvent {
  id: string;
  at: string;
  automation: AutomationId;
  title: string;
  detail?: string;
  kind: "trigger" | "action" | "ai" | "handoff" | "alert";
  customerId?: string;
  orderId?: string;
  minutesSaved: number;
  revenueNGN?: number;
}

export interface ContentDraft {
  id: string;
  kind: "instagram-post" | "reel-script" | "story" | "whatsapp-broadcast" | "menu-copy";
  productId?: string;
  title: string;
  body: string;
  status: "draft" | "approved" | "scheduled" | "published";
  createdAt: string;
  scheduledFor?: string;
}

export interface KBEntry {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
  approved: boolean;
}

export interface AssistantSettings {
  name: string;
  tone: "warm" | "playful" | "concise";
  discloseAI: boolean;
  depositPct: number;
  rules: { id: string; text: string; enabled: boolean }[];
  handoff: { id: string; label: string; keywords: string[]; enabled: boolean }[];
}

export interface DemoData {
  seededAt: string;
  goLiveAt: string;
  staff: Staff[];
  zones: Zone[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  conversations: Conversation[];
  outbound: Outbound[];
  automations: Automation[];
  events: AutoEvent[];
  ingredients: Ingredient[];
  suppliers: Supplier[];
  recipes: Recipe[];
  stockMoves: StockMove[];
  purchaseOrders: PurchaseOrder[];
  courses: Course[];
  cohorts: Cohort[];
  enrollments: Enrollment[];
  quotes: CateringQuote[];
  content: ContentDraft[];
  kb: KBEntry[];
  assistant: AssistantSettings;
  dailyCapacity: number; // oven points per day
}

export type Role = "owner" | "kitchen";
