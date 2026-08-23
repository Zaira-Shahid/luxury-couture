"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { logAudit } from "@/lib/security/audit";
import { pointsEarnedForPayment } from "@/lib/loyalty/config";
import { notify } from "@/lib/notifications/notify";
import { balanceDueTemplate, depositPaidTemplate } from "@/lib/notifications/templates";
import { getPaymentProvider } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import { createAdditionalPaymentSchema } from "@/lib/validations/payments";

export type ActionResult = { error: string } | { success: true };

export async function markPaymentPaidManually(paymentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("status, type, amount, currency, order_id")
    .eq("id", paymentId)
    .single();
  if (!payment) return { error: "Payment not found." };
  if (payment.status === "succeeded") return { error: "Already marked as paid." };

  const { error } = await supabase
    .from("payments")
    .update({ status: "succeeded", paid_at: new Date().toISOString(), provider: "manual" })
    .eq("id", paymentId);

  if (error) {
    logger.error("mark payment paid manually failed", error, { paymentId });
    return { error: "Could not update this payment. Please try again." };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("customer_id, order_number")
    .eq("id", payment.order_id)
    .single();
  if (order) {
    await notify(supabase, {
      profileId: order.customer_id,
      entityId: payment.order_id,
      ...depositPaidTemplate(order.order_number, payment.type, payment.amount, payment.currency),
    });

    await supabase.rpc("earn_loyalty_points", {
      p_customer_id: order.customer_id,
      p_points: pointsEarnedForPayment(payment.amount),
      p_reference: `payment:${paymentId}`,
    });
  }

  revalidatePath("/admin/payments");
  return { success: true };
}

export async function refundPayment(paymentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: payment } = await supabase.from("payments").select("*").eq("id", paymentId).single();
  if (!payment) return { error: "Payment not found." };
  if (payment.status !== "succeeded") return { error: "Only a succeeded payment can be refunded." };

  if (payment.provider === "stripe" && payment.provider_reference) {
    const result = await getPaymentProvider("stripe").refund({ providerReference: payment.provider_reference });
    if ("error" in result) return result;
  }
  // Manual payments have nothing external to reverse — just record the
  // refund status directly, matching ManualProvider.refund()'s guidance.

  const { error } = await supabase.from("payments").update({ status: "refunded" }).eq("id", paymentId);
  if (error) {
    logger.error("refund status update failed", error, { paymentId });
    return { error: "Refund may have processed, but the record could not be updated — please check manually." };
  }

  // MODULE 29: money moving is the canonical audit event.
  await logAudit({
    action: "payment.refunded",
    entityType: "payment",
    entityId: paymentId,
    before: { status: payment.status, amount: payment.amount },
    after: { status: "refunded" },
  });

  revalidatePath("/admin/payments");
  return { success: true };
}

export async function createAdditionalPayment(orderId: string, formData: FormData): Promise<ActionResult> {
  const parsed = createAdditionalPaymentSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, currency, customer_id, order_number")
    .eq("id", orderId)
    .single();
  if (!order) return { error: "Order not found." };

  const { error } = await supabase.from("payments").insert({
    order_id: orderId,
    type: parsed.data.type,
    amount: parsed.data.amount,
    currency: order.currency,
    status: "pending",
    provider: "manual",
  });

  if (error) {
    logger.error("additional payment creation failed", error, { orderId });
    return { error: "Could not create that payment. Please try again." };
  }

  await notify(supabase, {
    profileId: order.customer_id,
    entityId: orderId,
    ...balanceDueTemplate(order.order_number, parsed.data.amount, order.currency),
  });

  revalidatePath("/admin/payments");
  return { success: true };
}
