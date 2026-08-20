import type { CheckoutSessionParams, CheckoutSessionResult, PaymentProvider, RefundParams, RefundResult } from "./provider";

/**
 * Manual payments (bank transfer, cash) are confirmed by an admin action
 * (markPaymentPaidManually), not paid through an online checkout — there's
 * nothing to redirect the customer to. This class exists for interface
 * symmetry/architecture completeness, not because it's ever actually
 * invoked from the "Pay Now" flow.
 */
export class ManualProvider implements PaymentProvider {
  async createCheckoutSession(_params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    throw new Error("Manual payments are confirmed by an admin, not paid online.");
  }

  async refund(_params: RefundParams): Promise<RefundResult> {
    return { error: "Manual payments are refunded by updating their status directly, not through a provider." };
  }
}
