import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { logger } from "@/lib/logger";
import { pointsEarnedForPayment } from "@/lib/loyalty/config";
import { notify } from "@/lib/notifications/notify";
import { depositPaidTemplate } from "@/lib/notifications/templates";
import { getStripeClient } from "@/lib/payments/stripe-client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The actual source of truth for payment status — never the client-side
 * redirect back from Stripe Checkout, per "never trust client-submitted
 * status" (Master Build Plan §11). Every event is verified against
 * STRIPE_WEBHOOK_SECRET before anything in it is trusted, and logged to
 * payment_transactions (admin-only audit table) regardless of type.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  // Raw body is required for signature verification — reading it as JSON
  // first would consume the stream and break constructEvent.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    logger.warn("stripe webhook signature verification failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.metadata?.paymentId;

    if (paymentId) {
      const { data: payment } = await admin
        .from("payments")
        .update({
          status: "succeeded",
          paid_at: new Date().toISOString(),
          provider_reference: session.id,
        })
        .eq("id", paymentId)
        .eq("provider", "stripe")
        .select("order_id, type, amount, currency")
        .single();

      if (payment) {
        await updateOrderAfterPayment(admin, payment.order_id);

        const { data: order } = await admin
          .from("orders")
          .select("customer_id, order_number")
          .eq("id", payment.order_id)
          .single();
        if (order) {
          const { data: authUser } = await admin.auth.admin.getUserById(order.customer_id);
          await notify(admin, {
            profileId: order.customer_id,
            email: authUser?.user?.email,
            ...depositPaidTemplate(order.order_number, payment.type, payment.amount, payment.currency),
          });

          // Idempotent via reference — a retried webhook delivery for the
          // same payment is a no-op, not a double award (0041).
          await admin.rpc("earn_loyalty_points", {
            p_customer_id: order.customer_id,
            p_points: pointsEarnedForPayment(payment.amount),
            p_reference: `payment:${paymentId}`,
          });
        }
      } else {
        logger.warn("stripe webhook: payment row not found for checkout session", { paymentId });
      }

      await admin.from("payment_transactions").insert({
        payment_id: paymentId,
        provider_event_type: event.type,
        raw_payload: event as unknown as Record<string, unknown>,
      });
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId =
      typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;

    if (paymentIntentId) {
      // provider_reference on our side is the Checkout Session id, not the
      // PaymentIntent id — look the session up to bridge the two.
      const stripe = getStripeClient();
      const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
      const sessionId = sessions.data[0]?.id;

      if (sessionId) {
        await admin.from("payments").update({ status: "refunded" }).eq("provider_reference", sessionId);
      }
    }
  }

  return NextResponse.json({ received: true });
}

/**
 * Recomputes deposit_paid_amount/balance_due_amount from the full set of
 * succeeded payments for this order, rather than incrementing them —
 * incremental math isn't idempotent (a retried/duplicate webhook delivery
 * would double-count), recomputing from source data always gives the
 * same correct result no matter how many times it runs.
 */
async function updateOrderAfterPayment(admin: ReturnType<typeof createAdminClient>, orderId: string) {
  const { data: order } = await admin.from("orders").select("status, total_amount").eq("id", orderId).single();
  if (!order) return;

  const { data: succeededPayments } = await admin
    .from("payments")
    .select("type, amount")
    .eq("order_id", orderId)
    .eq("status", "succeeded");

  const payments = succeededPayments ?? [];
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const depositPaid = payments
    .filter((p) => p.type === "deposit")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const updates: Record<string, unknown> = {
    deposit_paid_amount: depositPaid,
    balance_due_amount: Math.max(0, Number(order.total_amount) - totalPaid),
  };
  if (order.status === "pending" && totalPaid > 0) updates.status = "confirmed";

  await admin.from("orders").update(updates).eq("id", orderId);
}
