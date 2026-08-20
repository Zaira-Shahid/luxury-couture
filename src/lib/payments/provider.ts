export type CheckoutSessionParams = {
  paymentId: string;
  /** Major currency unit (e.g. GBP pounds) — matches payments.amount's numeric(10,2) shape. */
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
};

export type CheckoutSessionResult = { url: string; providerReference: string };

export type RefundParams = {
  providerReference: string;
  /** Major currency unit; omit for a full refund. */
  amount?: number;
};

export type RefundResult = { success: true } | { error: string };

/**
 * Free-first provider abstraction (Master Build Plan §3), same pattern as
 * lib/chat/ — one interface, swappable implementation. Only Stripe (real,
 * test mode) and manual (admin-confirmed, no external service) are
 * implemented; PayPal can implement this same interface later without
 * touching call sites.
 */
export interface PaymentProvider {
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>;
  refund(params: RefundParams): Promise<RefundResult>;
}
