"use server";

import { redirect } from "next/navigation";

import { logger } from "@/lib/logger";
import { siteConfig } from "@/lib/config/site";
import { getPaymentProvider, isStripeConfigured } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string };

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  balance: "Balance",
  full: "Payment",
  refund: "Refund",
};

export async function initiatePayment(paymentId: string): Promise<ActionResult | void> {
  if (!isStripeConfigured()) {
    return { error: "Online payment isn't available right now — please contact us to pay." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // RLS (owner-or-admin) already scopes this to the caller's own payment;
  // the .order() join re-confirms ownership explicitly too.
  const { data: payment } = await supabase
    .from("payments")
    .select("*, orders!inner(id, order_number, customer_id, currency)")
    .eq("id", paymentId)
    .eq("orders.customer_id", user.id)
    .single();

  if (!payment) return { error: "Payment not found." };
  if (payment.status === "succeeded") return { error: "This payment has already been made." };

  const order = payment.orders as unknown as {
    id: string;
    order_number: string;
    customer_id: string;
    currency: string;
  };

  const provider = getPaymentProvider("stripe");
  let session;
  try {
    session = await provider.createCheckoutSession({
      paymentId: payment.id,
      amount: payment.amount,
      currency: order.currency,
      description: `${TYPE_LABELS[payment.type] ?? "Payment"} — Order ${order.order_number}`,
      successUrl: `${siteConfig.url}/checkout/confirmed/${order.order_number}?payment=success`,
      cancelUrl: `${siteConfig.url}/checkout/confirmed/${order.order_number}?payment=cancelled`,
      customerEmail: user.email,
    });
  } catch (error) {
    logger.error("stripe checkout session creation failed", error, { paymentId });
    return { error: "Could not start checkout. Please try again." };
  }

  // Records which session this pending payment is now tied to, so the
  // webhook (the actual source of truth) can find it — the redirect
  // itself never marks anything as paid.
  await supabase
    .from("payments")
    .update({ provider: "stripe", provider_reference: session.providerReference })
    .eq("id", payment.id);

  redirect(session.url);
}
