"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { advanceProductionStatusSchema, updateProductionDetailsSchema } from "@/lib/validations/production";

export type ActionResult = { error: string } | { success: true };

/**
 * production_orders/production_status_history are admin- or
 * production-role-write-only by RLS (0034) — this relies entirely on
 * that, same pattern as updateOrderStatus (Module 12).
 */
export async function advanceProductionStatus(productionOrderId: string, formData: FormData): Promise<ActionResult> {
  const parsed = advanceProductionStatusSchema.safeParse({
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return { error: "You must be signed in." };

  const { data: production } = await supabase
    .from("production_orders")
    .select("order_id")
    .eq("id", productionOrderId)
    .single();
  if (!production) return { error: "Production order not found." };

  const { error: updateErr } = await supabase
    .from("production_orders")
    .update({ current_status: parsed.data.status })
    .eq("id", productionOrderId);
  if (updateErr) {
    logger.error("production status update failed", updateErr, { productionOrderId });
    return { error: "Could not update production status. Please try again." };
  }

  await supabase.from("production_status_history").insert({
    production_order_id: productionOrderId,
    status: parsed.data.status,
    note: parsed.data.note ?? null,
    changed_by: user.id,
  });

  const { data: order } = await supabase.from("orders").select("customer_id").eq("id", production.order_id).single();
  if (order) {
    await supabase.from("notifications").insert({
      profile_id: order.customer_id,
      type: "production_status_changed",
      title: "Your order's production status has been updated",
      body: `Production status is now: ${parsed.data.status.replace(/_/g, " ")}.`,
      channel: "in_app",
    });
  }

  revalidatePath(`/admin/production/${productionOrderId}`);
  revalidatePath(`/account/orders/${production.order_id}`);
  return { success: true };
}

export async function updateProductionDetails(productionOrderId: string, formData: FormData): Promise<ActionResult> {
  const parsed = updateProductionDetailsSchema.safeParse({
    assignedTeam: formData.get("assignedTeam") || undefined,
    estimatedCompletionDate: formData.get("estimatedCompletionDate") || undefined,
  });
  if (!parsed.success) return { error: "Invalid input." };

  const supabase = await createClient();
  const { data: production } = await supabase
    .from("production_orders")
    .select("order_id")
    .eq("id", productionOrderId)
    .single();
  if (!production) return { error: "Production order not found." };

  const { error } = await supabase
    .from("production_orders")
    .update({
      assigned_team: parsed.data.assignedTeam || null,
      estimated_completion_date: parsed.data.estimatedCompletionDate || null,
    })
    .eq("id", productionOrderId);
  if (error) {
    logger.error("production details update failed", error, { productionOrderId });
    return { error: "Could not update these details. Please try again." };
  }

  revalidatePath(`/admin/production/${productionOrderId}`);
  revalidatePath(`/account/orders/${production.order_id}`);
  return { success: true };
}
