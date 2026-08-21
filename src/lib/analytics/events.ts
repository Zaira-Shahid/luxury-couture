/**
 * The canonical event taxonomy — the single source of truth for Module 21.
 *
 * Producers (Server Actions, the /api/analytics route, the Stripe webhook)
 * and consumers (the admin funnel, the reporting RPCs) all import from
 * here, so an event name can never drift between the thing writing it and
 * the thing counting it. Adding an event means adding it here first.
 *
 * No React, no DB, no Node-only APIs: this file is imported from client
 * components, server code and the Edge runtime alike.
 */

export const ANALYTICS_EVENTS = [
  "page_view",
  "product_view",
  "builder_started",
  "builder_completed",
  "inspiration_uploaded",
  "enquiry_submitted",
  "consultation_booked",
  "add_to_cart",
  "checkout_started",
  "payment_started",
  "payment_completed",
  "purchase",
  "wishlist_action",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

const EVENT_SET = new Set<string>(ANALYTICS_EVENTS);

/** Allow-list check for anything arriving from a client request body. */
export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === "string" && EVENT_SET.has(value);
}

/**
 * Events the browser sends to /api/analytics. Everything else is emitted
 * server-side from the Server Action that already performs the operation,
 * where the data is trustworthy and no round trip is needed.
 */
export const CLIENT_EVENTS = ["page_view", "product_view", "checkout_started"] as const;
export type ClientEventName = (typeof CLIENT_EVENTS)[number];

const CLIENT_EVENT_SET = new Set<string>(CLIENT_EVENTS);

export function isClientEventName(value: unknown): value is ClientEventName {
  return typeof value === "string" && CLIENT_EVENT_SET.has(value);
}

/**
 * Transaction outcomes, recorded as business records even without consent
 * (with `session_id = null`) — they restate facts already stored in
 * `orders`/`payments`, involve no device storage, and dropping them would
 * leave the funnel's final step permanently empty. The funnel is computed
 * over session-linked events only, so an unconsented purchase counts
 * toward totals without ever distorting a conversion rate.
 */
export const TRANSACTION_EVENTS = ["purchase", "payment_completed"] as const;

export function isTransactionEvent(name: AnalyticsEventName): boolean {
  return (TRANSACTION_EVENTS as readonly string[]).includes(name);
}

/** Loosely-typed per-event properties. Kept optional — a missing property should never drop an event. */
export type AnalyticsProperties = {
  /** page_view, product_view, checkout_started */
  path?: string;
  /** product_view, add_to_cart, wishlist_action */
  productId?: string;
  productName?: string;
  /** builder_*, inspiration_uploaded */
  configurationId?: string;
  /** add_to_cart, checkout_started, payment_*, purchase */
  value?: number;
  currency?: string;
  /** purchase, payment_* */
  orderId?: string;
  paymentId?: string;
  /** wishlist_action */
  action?: "added" | "removed";
  /** enquiry_submitted, consultation_booked */
  enquiryType?: string;
  appointmentType?: string;
  [key: string]: unknown;
};

export type AnalyticsEvent = {
  name: AnalyticsEventName;
  properties?: AnalyticsProperties;
  /** Null for signed-out visitors. */
  profileId?: string | null;
  /** Null when there is no consented analytics session. */
  sessionId?: string | null;
};

/** Hard cap on serialized properties, enforced on the public ingest route. */
export const MAX_PROPERTIES_BYTES = 2048;

/**
 * The ordered funnel the admin screen reports. Each step is counted by
 * DISTINCT session, so one visitor viewing ten products is one "view".
 */
export const FUNNEL_STEPS = [
  { event: "product_view", label: "Product views" },
  { event: "add_to_cart", label: "Added to cart" },
  { event: "checkout_started", label: "Checkout started" },
  { event: "purchase", label: "Purchased" },
] as const satisfies ReadonlyArray<{ event: AnalyticsEventName; label: string }>;
