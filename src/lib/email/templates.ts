import { emailUrl } from "./index";
import {
  buildMarketingEmail,
  buildTransactionalEmail,
  getEmailBrand,
  type EmailBody,
} from "./layout";
import type { EmailMessage } from "./provider";

/**
 * The 12 template kinds the Master Build Plan lists for Module 24.
 *
 * Copy is intentionally close to `lib/notifications/templates.ts`
 * (Module 15), which remains the source for the in-app notification
 * feed. Keeping them aligned means a customer reading the in-app message
 * and the email sees the same thing; these add the greeting, the
 * call-to-action and the branded shell that only make sense in email.
 *
 * Prices and order references are REAL VALUES from the database. That is
 * correct and deliberate — see send.ts on why AI guardrails must not be
 * applied here.
 */

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function greeting(name: string | null): string {
  return name ? `Hello ${name},` : "Hello,";
}

async function transactional(
  to: string,
  templateKey: string,
  subject: string,
  body: EmailBody
): Promise<EmailMessage> {
  const brand = await getEmailBrand();
  const rendered = buildTransactionalEmail(brand, body);
  return { kind: "transactional", to, subject, templateKey, ...rendered };
}

async function marketing(
  to: string,
  templateKey: string,
  subject: string,
  body: EmailBody,
  unsubscribeUrl: string
): Promise<EmailMessage> {
  const brand = await getEmailBrand();
  const rendered = buildMarketingEmail(brand, body, unsubscribeUrl);
  return { kind: "marketing", to, subject, templateKey, unsubscribeUrl, ...rendered };
}

// ---- 1. Welcome ----------------------------------------------------------

export async function welcomeEmail(to: string, name: string | null): Promise<EmailMessage> {
  const brand = await getEmailBrand();
  return transactional(to, "welcome", `Welcome to ${brand.name}`, {
    heading: `Welcome to ${brand.name}`,
    paragraphs: [
      greeting(name),
      "Thank you for creating an account. You can now save designs, store your measurements, and follow your order from our atelier to your door.",
      "Whenever you're ready, start a design in our custom builder or book a consultation with our team.",
    ],
    cta: { label: "Start a design", url: emailUrl("/builder") },
  });
}

// ---- 2. Enquiry confirmation ---------------------------------------------

export async function enquiryConfirmationEmail(
  to: string,
  name: string | null
): Promise<EmailMessage> {
  return transactional(to, "enquiry_received", "We've received your enquiry", {
    heading: "We've received your enquiry",
    paragraphs: [
      greeting(name),
      "Thank you for reaching out. Our design team has your enquiry and will be in touch shortly.",
      "If you'd like to add anything in the meantime, simply reply to this email.",
    ],
  });
}

// ---- 3. Quotation --------------------------------------------------------

export async function quotationEmail(
  to: string,
  name: string | null,
  quotedPrice: number,
  currency: string
): Promise<EmailMessage> {
  return transactional(to, "quote_created", "Your quotation is ready", {
    heading: "Your quotation is ready",
    paragraphs: [
      greeting(name),
      `Our team has prepared your quotation: ${formatPrice(quotedPrice, currency)}.`,
      "Sign in to review the details and approve it whenever you're ready. Nothing is made and nothing is charged until you approve.",
    ],
    cta: { label: "Review your quotation", url: emailUrl("/account/quotations") },
  });
}

// ---- 4. Order confirmation -----------------------------------------------

export async function orderConfirmationEmail(
  to: string,
  name: string | null,
  orderNumber: string
): Promise<EmailMessage> {
  return transactional(to, "order_confirmed", `Order ${orderNumber} confirmed`, {
    heading: "Your order is confirmed",
    paragraphs: [
      greeting(name),
      `Order ${orderNumber} has been confirmed and is now with our team.`,
      "We'll keep you updated as your piece moves through production.",
    ],
    cta: { label: "View your order", url: emailUrl("/account/orders") },
  });
}

// ---- 5. Deposit confirmation ---------------------------------------------

export async function depositConfirmationEmail(
  to: string,
  name: string | null,
  orderNumber: string,
  amount: number,
  currency: string
): Promise<EmailMessage> {
  return transactional(to, "deposit_paid", `Payment received for order ${orderNumber}`, {
    heading: "Payment received",
    paragraphs: [
      greeting(name),
      `We've received your payment of ${formatPrice(amount, currency)} for order ${orderNumber}. Thank you.`,
      "Your receipt is available in your account.",
    ],
    cta: { label: "View your receipt", url: emailUrl("/account/payments") },
  });
}

// ---- 6. Production update ------------------------------------------------

export async function productionUpdateEmail(
  to: string,
  name: string | null,
  orderNumber: string,
  statusLabel: string
): Promise<EmailMessage> {
  return transactional(to, "production_status_changed", `Update on order ${orderNumber}`, {
    heading: "Your piece has moved on",
    paragraphs: [
      greeting(name),
      `Order ${orderNumber} has reached a new stage: ${statusLabel}.`,
      "You can follow every stage of production from your account.",
    ],
    cta: { label: "Track your order", url: emailUrl("/account/orders") },
  });
}

// ---- 7. Shipping update --------------------------------------------------

export async function shippingUpdateEmail(
  to: string,
  name: string | null,
  orderNumber: string,
  statusLabel: string,
  courier: string | null,
  trackingNumber: string | null
): Promise<EmailMessage> {
  const details = [courier ? `Courier: ${courier}` : null, trackingNumber ? `Tracking: ${trackingNumber}` : null]
    .filter(Boolean)
    .join(" · ");

  return transactional(to, "shipping_status_changed", `Shipping update for order ${orderNumber}`, {
    heading: "Your order is on its way",
    paragraphs: [
      greeting(name),
      `Order ${orderNumber} is now: ${statusLabel}.`,
      ...(details ? [details] : []),
    ],
    cta: { label: "Track your order", url: emailUrl("/account/orders") },
  });
}

// ---- 8. Balance reminder -------------------------------------------------

export async function balanceReminderEmail(
  to: string,
  name: string | null,
  orderNumber: string,
  amount: number,
  currency: string
): Promise<EmailMessage> {
  return transactional(to, "balance_due", `Balance due for order ${orderNumber}`, {
    heading: "Your balance is due",
    paragraphs: [
      greeting(name),
      `A payment of ${formatPrice(amount, currency)} is now due for order ${orderNumber}.`,
      "You can settle it securely from your account.",
    ],
    cta: { label: "Pay your balance", url: emailUrl("/account/payments") },
  });
}

// ---- 9. Delivery ---------------------------------------------------------

export async function deliveryEmail(
  to: string,
  name: string | null,
  orderNumber: string
): Promise<EmailMessage> {
  return transactional(to, "delivered", `Order ${orderNumber} delivered`, {
    heading: "Your order has arrived",
    paragraphs: [
      greeting(name),
      `Order ${orderNumber} has been delivered. We hope you love it.`,
      "If anything isn't quite right, reply to this email and our team will put it right.",
    ],
  });
}

// ---- 10. Review request --------------------------------------------------

export async function reviewRequestEmail(
  to: string,
  name: string | null,
  orderNumber: string
): Promise<EmailMessage> {
  return transactional(to, "review_request", "How was your experience?", {
    heading: "How was your experience?",
    paragraphs: [
      greeting(name),
      `We'd love to hear your thoughts on order ${orderNumber}.`,
      "A few words from you helps other customers, and helps us keep improving.",
    ],
    cta: { label: "Leave a review", url: emailUrl("/account/reviews/new") },
  });
}

// ---- 11. Abandoned cart (MARKETING) --------------------------------------

/**
 * Marketing, not transactional: it is a promotional nudge, not a record
 * of something the customer did. It therefore requires an unsubscribe
 * URL, and the type system enforces that.
 */
export async function abandonedCartEmail(
  to: string,
  name: string | null,
  unsubscribeUrl: string
): Promise<EmailMessage> {
  return marketing(
    to,
    "abandoned_cart",
    "You left something behind",
    {
      heading: "Your cart is still waiting",
      paragraphs: [
        greeting(name),
        "You left something in your cart. It's still saved, so you can pick up exactly where you left off.",
      ],
      cta: { label: "Return to your cart", url: emailUrl("/cart") },
    },
    unsubscribeUrl
  );
}

// ---- 12. Promotional campaign (MARKETING) --------------------------------

export async function campaignEmail(
  to: string,
  subject: string,
  bodyText: string,
  unsubscribeUrl: string
): Promise<EmailMessage> {
  // Admin-authored body, split into paragraphs on blank lines — the same
  // treatment RichText gives CMS copy. Escaped by the layout.
  const paragraphs = bodyText
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return marketing(
    to,
    "campaign",
    subject,
    {
      heading: subject,
      paragraphs: paragraphs.length > 0 ? paragraphs : [bodyText],
    },
    unsubscribeUrl
  );
}
