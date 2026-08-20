"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import {
  addOrderNoteSchema,
  sendCustomerMessageSchema,
  sendToProductionSchema,
  updateOrderStatusSchema,
} from "@/lib/validations/orders";

export type ActionResult = { error: string } | { success: true };

/**
 * orders/order_status_history/notifications are all admin-write-only by
 * RLS — this relies entirely on that (the regular RLS-respecting client),
 * same as markPaymentPaidManually, rather than re-checking admin status
 * here. /admin is already gated by middleware + layout before this action
 * can be invoked from the UI.
 */
export async function updateOrderStatus(orderId: string, formData: FormData): Promise<ActionResult> {
  const parsed = updateOrderStatusSchema.safeParse({
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return { error: "You must be signed in." };

  const { data: order } = await supabase.from("orders").select("customer_id").eq("id", orderId).single();
  if (!order) return { error: "Order not found." };

  const { error: updateErr } = await supabase
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", orderId);
  if (updateErr) {
    logger.error("order status update failed", updateErr, { orderId });
    return { error: "Could not update this order. Please try again." };
  }

  await supabase.from("order_status_history").insert({
    order_id: orderId,
    status: parsed.data.status,
    note: parsed.data.note ?? null,
    changed_by: user.id,
  });

  await supabase.from("notifications").insert({
    profile_id: order.customer_id,
    type: "order_status_changed",
    title: "Your order status has been updated",
    body: `Order status is now: ${parsed.data.status.replace(/_/g, " ")}.`,
    channel: "in_app",
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/account/orders/${orderId}`);
  return { success: true };
}

export async function addOrderNote(orderId: string, formData: FormData): Promise<ActionResult> {
  const parsed = addOrderNoteSchema.safeParse({ note: formData.get("note") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("order_notes").insert({
    order_id: orderId,
    note: parsed.data.note,
    created_by: user.id,
  });
  if (error) {
    logger.error("order note creation failed", error, { orderId });
    return { error: "Could not save this note. Please try again." };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

export async function sendCustomerMessage(orderId: string, formData: FormData): Promise<ActionResult> {
  const parsed = sendCustomerMessageSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("customer_id").eq("id", orderId).single();
  if (!order) return { error: "Order not found." };

  const { error } = await supabase.from("notifications").insert({
    profile_id: order.customer_id,
    type: "order_message",
    title: parsed.data.title,
    body: parsed.data.body,
    channel: "in_app",
  });
  if (error) {
    logger.error("customer message send failed", error, { orderId });
    return { error: "Could not send this message. Please try again." };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

/**
 * The "production handoff" bullet, and only that — creating the initial
 * production_orders row. Advancing it through the 12-stage pipeline is
 * Module 13's job, not this one's.
 */
export async function sendToProduction(orderId: string, formData: FormData): Promise<ActionResult> {
  const parsed = sendToProductionSchema.safeParse({
    estimatedCompletionDate: formData.get("estimatedCompletionDate") || undefined,
  });
  if (!parsed.success) return { error: "Invalid input." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("production_orders")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing) return { error: "This order has already been sent to production." };

  const { error } = await supabase.from("production_orders").insert({
    order_id: orderId,
    estimated_completion_date: parsed.data.estimatedCompletionDate || null,
  });
  if (error) {
    logger.error("send to production failed", error, { orderId });
    return { error: "Could not send this order to production. Please try again." };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/account/orders/${orderId}`);
  return { success: true };
}
