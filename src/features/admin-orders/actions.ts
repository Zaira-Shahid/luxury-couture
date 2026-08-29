"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { notify } from "@/lib/notifications/notify";
import { orderMessageTemplate, productionStartedTemplate } from "@/lib/notifications/templates";
import { addOrderNoteRecord, updateOrderStatusRecord } from "@/lib/orders/write-orders";
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

  // allowCorrection: an admin looking at the order they just mis-clicked
  // is exactly who should be able to put it back, and this form has
  // always offered every status. Module 39 gives MCP the pipeline rules
  // without taking a capability away from the people who have it — see
  // src/lib/orders/transitions.ts for why the asymmetry is deliberate.
  const result = await updateOrderStatusRecord(
    {
      orderId,
      status: parsed.data.status,
      note: parsed.data.note ?? null,
      actorId: user.id,
      allowCorrection: true,
    },
    supabase
  );
  if (!result.ok) return { error: result.error };

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

  const result = await addOrderNoteRecord(
    { orderId, note: parsed.data.note, actorId: user.id },
    supabase
  );
  if (!result.ok) return { error: result.error };

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

  const { inAppSuccess } = await notify(supabase, {
    profileId: order.customer_id,
    entityId: orderId,
    ...orderMessageTemplate(parsed.data.title, parsed.data.body),
  });
  if (!inAppSuccess) {
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

  const { data: order } = await supabase.from("orders").select("customer_id, order_number").eq("id", orderId).single();
  if (order) {
    await notify(supabase, {
      profileId: order.customer_id,
      entityId: orderId,
      ...productionStartedTemplate(order.order_number),
    });
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/account/orders/${orderId}`);
  return { success: true };
}
