"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true };

/**
 * points can be positive or negative — routed through adjust_loyalty_points
 * (0042), a dedicated RPC that labels the resulting ledger row 'adjust'
 * rather than reusing earn/redeem (which would mislabel an admin
 * correction as if the customer had actually earned or redeemed points).
 * points_balance's own check (>= 0) is the real guard against a downward
 * adjustment exceeding the current balance — no extra check needed here.
 */
export async function adjustLoyaltyPoints(customerId: string, formData: FormData): Promise<ActionResult> {
  const raw = formData.get("points");
  const points = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(points) || points === 0) return { error: "Enter a non-zero number of points." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_loyalty_points", {
    p_customer_id: customerId,
    p_points: points,
    p_reference: `admin-adjustment:${crypto.randomUUID()}`,
  });

  if (error) {
    logger.error("loyalty points adjustment failed", error, { customerId, points });
    return { error: error.message || "Could not adjust points." };
  }

  revalidatePath(`/admin/customers/${customerId}`);
  return { success: true };
}
