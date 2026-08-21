"use server";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { applyCouponSchema } from "@/lib/validations/marketing";

export type ActionResult<T = undefined> = { error: string } | { success: true; data: T };

/**
 * Read-only preview for the checkout UI's "Apply" button — calls
 * validate_coupon (0041), the only way a customer session can check a
 * code at all, since coupons has no customer-read RLS policy. Never
 * consumes a use; placeOrder re-validates via redeem_coupon at actual
 * order creation, so this preview amount is never trusted as final.
 */
export async function previewCoupon(code: string, subtotal: number): Promise<ActionResult<{ discount: number }>> {
  const parsed = applyCouponSchema.safeParse({ code });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid code." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_coupon", {
    p_code: parsed.data.code.toUpperCase(),
    p_subtotal: subtotal,
  });

  if (error) {
    logger.warn("coupon preview failed", { message: error.message });
    return { error: error.message || "That coupon code isn't valid." };
  }

  return { success: true, data: { discount: Number(data) } };
}
