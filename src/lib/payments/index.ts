import { ManualProvider } from "./manual-provider";
import type { PaymentProvider } from "./provider";
import { StripeProvider } from "./stripe-provider";

export type { PaymentProvider, CheckoutSessionParams, CheckoutSessionResult, RefundParams, RefundResult } from "./provider";

export function getPaymentProvider(name: "stripe" | "manual"): PaymentProvider {
  switch (name) {
    case "stripe":
      return new StripeProvider();
    case "manual":
      return new ManualProvider();
  }
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
