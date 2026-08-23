/**
 * Maps a notification `type` to the category it belongs to and the page
 * it should link to.
 *
 * NO IMPORTS on purpose — the established rule in this project (see
 * `lib/ai/guardrails.ts`, `lib/email/render.ts`, `lib/settings/registry.ts`,
 * `lib/auth/permissions.ts`). `scripts/test-notifications.mjs` imports
 * this `.ts` directly under Node's type stripping, where `@/...` aliases
 * do not resolve.
 *
 * This MIRRORS the check constraint and backfill in
 * `0056_notification_center.sql`. Where the two disagree the database
 * wins, exactly as with the permission mirror: the constraint is what can
 * actually reject a row.
 *
 * Why a table here rather than a `category` argument at each call site:
 * `notify()` has 18 call sites, all of which already pass a `type` from
 * `templates.ts`. Deriving the category from the type they already send
 * means none of them had to change, and a new template gets its category
 * by being added to one list instead of by remembering to thread an extra
 * argument through.
 */

export const NOTIFICATION_CATEGORIES = [
  "orders",
  "payments",
  "production",
  "shipping",
  "consultations",
  "reviews",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  orders: "Orders",
  payments: "Payments",
  production: "Production",
  shipping: "Shipping",
  consultations: "Consultations",
  reviews: "Reviews",
};

export const CATEGORY_DESCRIPTIONS: Record<NotificationCategory, string> = {
  orders: "Order confirmations, status changes and quotations.",
  payments: "Receipts and balance reminders.",
  production: "Progress on your piece as it is made.",
  shipping: "Dispatch and delivery updates.",
  consultations: "Appointment confirmations and reminders.",
  reviews: "Invitations to review a completed order.",
};

/**
 * Every type emitted by `templates.ts`, plus the two reminder types Pass 2
 * adds. A type absent from this map gets a null category, which means it
 * appears in the feed under "Other" and is never suppressed by a
 * preference — an unclassified notification is always delivered rather
 * than silently dropped.
 */
export const TYPE_CATEGORIES: Record<string, NotificationCategory> = {
  enquiry_received: "orders",
  quote_created: "orders",
  quote_approved: "orders",
  order_confirmed: "orders",
  order_status_changed: "orders",
  order_message: "orders",

  deposit_paid: "payments",
  balance_due: "payments",
  payment_reminder: "payments",

  production_started: "production",
  production_status_changed: "production",
  qc_complete: "production",

  shipped: "shipping",
  delivered: "shipping",
  shipping_status_changed: "shipping",

  consultation_reminder: "consultations",

  review_request: "reviews",
};

export function categoryForType(type: string): NotificationCategory | null {
  return TYPE_CATEGORIES[type] ?? null;
}

export function isNotificationCategory(value: string): value is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Where a notification should take you when clicked.
 *
 * Built from the category plus an optional entity id rather than from a
 * per-type switch, because the account area has one page per domain, not
 * one per event: every order notification lands on the order, every
 * shipping notification lands on the same order.
 *
 * `abandoned_cart` is absent deliberately — it is a marketing nudge that
 * belongs to the cart, not to the account feed, and Module 24 already
 * sends it with its own link.
 */
export function linkForNotification(
  category: NotificationCategory | null,
  entityId?: string | null
): string | null {
  switch (category) {
    case "orders":
    case "payments":
    case "production":
    case "shipping":
      return entityId ? `/account/orders/${entityId}` : "/account/orders";
    case "consultations":
      return "/account/consultations";
    case "reviews":
      return entityId ? `/account/orders/${entityId}` : "/account/reviews";
    default:
      return null;
  }
}
