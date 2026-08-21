"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { poundsToPoints } from "@/lib/loyalty/config";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true };

/**
 * Admin-triggered, not automatic on the referred customer's first order —
 * an explicit, approved scope call (avoids a new hook into placeOrder for
 * a low-frequency feature that benefits from a human sanity-check anyway,
 * e.g. against self-referral via a second account). The reward is
 * credited as loyalty points on the referrer's own account via
 * earn_loyalty_points (0041) — real, redeemable value, not just a number
 * on the referrals row.
 */
export async function completeReferral(referralId: string, formData: FormData): Promise<ActionResult> {
  const raw = formData.get("rewardAmount");
  const rewardAmount = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(rewardAmount) || rewardAmount < 0) return { error: "Enter a valid reward amount." };

  const supabase = await createClient();
  const { data: referral } = await supabase
    .from("referrals")
    .select("id, referrer_customer_id, status, referred_customer_id")
    .eq("id", referralId)
    .single();
  if (!referral) return { error: "Referral not found." };
  if (!referral.referred_customer_id) return { error: "This code hasn't been used by anyone yet." };
  if (referral.status === "completed") return { error: "This referral is already completed." };

  const { error } = await supabase
    .from("referrals")
    .update({ status: "completed", reward_amount: rewardAmount, completed_at: new Date().toISOString() })
    .eq("id", referralId);
  if (error) {
    logger.error("referral completion failed", error, { referralId });
    return { error: "Could not complete this referral. Please try again." };
  }

  if (rewardAmount > 0) {
    await supabase.rpc("earn_loyalty_points", {
      p_customer_id: referral.referrer_customer_id,
      p_points: poundsToPoints(rewardAmount),
      p_reference: `referral:${referralId}`,
    });
  }

  revalidatePath(`/admin/customers/${referral.referrer_customer_id}`);
  return { success: true };
}
