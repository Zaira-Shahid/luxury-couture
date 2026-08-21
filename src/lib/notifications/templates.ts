export type NotificationTemplate = { type: string; title: string; body: string };

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

// "account created" is handled entirely at the DB layer (0037's
// handle_new_user() trigger) — no TS template for it, since a trigger
// can never reach this file.

export function enquiryReceivedTemplate(): NotificationTemplate {
  return {
    type: "enquiry_received",
    title: "We've received your enquiry",
    body: "Thank you for reaching out — our design team will be in touch shortly.",
  };
}

export function quoteCreatedTemplate(quotedPrice: number, currency: string): NotificationTemplate {
  return {
    type: "quote_created",
    title: "Your quote is ready",
    body: `You've received a quote for ${formatPrice(quotedPrice, currency)}. Sign in to review and approve it.`,
  };
}

export function quoteApprovedTemplate(orderNumber: string): NotificationTemplate {
  return {
    type: "quote_approved",
    title: "Quote approved",
    body: `Thanks for approving your quote — order ${orderNumber} has been created.`,
  };
}

export function orderConfirmedTemplate(orderNumber: string): NotificationTemplate {
  return {
    type: "order_confirmed",
    title: "Order confirmed",
    body: `Great news — order ${orderNumber} has been confirmed.`,
  };
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "pending",
  confirmed: "confirmed",
  in_production: "in production",
  ready_to_ship: "ready to ship",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
};

export function orderStatusChangedTemplate(orderNumber: string, status: string): NotificationTemplate {
  return {
    type: "order_status_changed",
    title: "Your order status has been updated",
    body: `Order ${orderNumber} status is now: ${ORDER_STATUS_LABELS[status] ?? status}.`,
  };
}

export function orderMessageTemplate(title: string, body: string): NotificationTemplate {
  return { type: "order_message", title, body };
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: "deposit",
  balance: "balance",
  full: "payment",
  refund: "refund",
};

export function depositPaidTemplate(orderNumber: string, type: string, amount: number, currency: string): NotificationTemplate {
  return {
    type: "deposit_paid",
    title: "Payment received",
    body: `We've received your ${PAYMENT_TYPE_LABELS[type] ?? type} of ${formatPrice(amount, currency)} for order ${orderNumber}.`,
  };
}

export function balanceDueTemplate(orderNumber: string, amount: number, currency: string): NotificationTemplate {
  return {
    type: "balance_due",
    title: "Payment due",
    body: `A payment of ${formatPrice(amount, currency)} is now due for order ${orderNumber}.`,
  };
}

export function productionStartedTemplate(orderNumber: string): NotificationTemplate {
  return {
    type: "production_started",
    title: "Production has started",
    body: `Production has started on order ${orderNumber}.`,
  };
}

const PRODUCTION_STATUS_LABELS: Record<string, string> = {
  order_confirmed: "order confirmed",
  measurements_verified: "measurements verified",
  design_approved: "design approved",
  materials_prepared: "materials prepared",
  cutting: "cutting",
  embroidery: "embroidery",
  stitching: "stitching",
  finishing: "finishing",
  quality_check: "quality check",
  ready_for_dispatch: "ready for dispatch",
  shipped: "shipped",
  delivered: "delivered",
};

export function productionStatusChangedTemplate(orderNumber: string, status: string): NotificationTemplate {
  return {
    type: "production_status_changed",
    title: "Your order's production status has been updated",
    body: `Production status for order ${orderNumber} is now: ${PRODUCTION_STATUS_LABELS[status] ?? status}.`,
  };
}

export function qcCompleteTemplate(orderNumber: string): NotificationTemplate {
  return {
    type: "qc_complete",
    title: "Quality check complete",
    body: `Order ${orderNumber} has passed quality check.`,
  };
}

const SHIPPING_STATUS_LABELS: Record<string, string> = {
  pending: "pending",
  label_created: "label created",
  in_transit: "in transit",
  out_for_delivery: "out for delivery",
  delivered: "delivered",
  exception: "exception",
};

export function shippingStatusChangedTemplate(orderNumber: string, status: string): NotificationTemplate {
  return {
    type: "shipping_status_changed",
    title: "Your order's shipping status has been updated",
    body: `Shipping status for order ${orderNumber} is now: ${SHIPPING_STATUS_LABELS[status] ?? status}.`,
  };
}

export function shippedTemplate(orderNumber: string, courier: string | null, trackingNumber: string | null): NotificationTemplate {
  const details = [courier ? `via ${courier}` : null, trackingNumber ? `tracking: ${trackingNumber}` : null]
    .filter(Boolean)
    .join(", ");
  return {
    type: "shipped",
    title: "Your order has shipped",
    body: `Order ${orderNumber} has shipped${details ? ` (${details})` : ""}.`,
  };
}

export function deliveredTemplate(orderNumber: string): NotificationTemplate {
  return {
    type: "delivered",
    title: "Your order has been delivered",
    body: `Order ${orderNumber} has been delivered. We hope you love it!`,
  };
}

export function reviewRequestTemplate(orderNumber: string): NotificationTemplate {
  return {
    type: "review_request",
    title: "How was your experience?",
    body: `We'd love to hear your thoughts on order ${orderNumber} — leave us a review whenever you're ready.`,
  };
}
