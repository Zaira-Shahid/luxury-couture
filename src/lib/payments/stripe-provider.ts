import { getStripeClient } from "./stripe-client";
import type { CheckoutSessionParams, CheckoutSessionResult, PaymentProvider, RefundParams, RefundResult } from "./provider";

/**
 * Stripe Checkout (redirect-based) — deliberately not Stripe Elements/
 * Payment Element, so no @stripe/stripe-js is needed client-side at all.
 * Checkout also surfaces Apple Pay/Google Pay automatically when the
 * customer's browser/device supports them, satisfying that requirement
 * without building anything extra for it.
 */
export class StripeProvider implements PaymentProvider {
  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: { name: params.description },
            unit_amount: Math.round(params.amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      // The webhook handler is the source of truth for payment status —
      // this metadata is how it knows which `payments` row to update. The
      // redirect back to success_url is never trusted on its own.
      metadata: { paymentId: params.paymentId },
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { url: session.url, providerReference: session.id };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const stripe = getStripeClient();
    try {
      // providerReference is the Checkout Session id; Stripe refunds are
      // issued against the underlying PaymentIntent, so resolve that first.
      const session = await stripe.checkout.sessions.retrieve(params.providerReference);
      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (!paymentIntentId) return { error: "No payment found to refund for this session." };

      await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: params.amount ? Math.round(params.amount * 100) : undefined,
      });
      return { success: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Refund failed." };
    }
  }
}
