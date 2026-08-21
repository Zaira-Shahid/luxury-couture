"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true };

function randomCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

/**
 * referrals' INSERT policy already allows the referrer to create their
 * own row directly (0010, referrer_customer_id = auth.uid()) — no RPC
 * needed here, unlike redemption (which the referred person, not the
 * referrer, would need to trigger, and RLS gives them no path to that
 * row at all).
 */
export async function generateReferralCode(): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "You must be signed in." };

  const supabase = await createClient();

  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase.from("referrals").insert({
      referrer_customer_id: user.id,
      code: randomCode(),
      status: "pending",
    });
    if (!error) {
      revalidatePath("/account/referrals");
      return { success: true };
    }
    if (error.code !== "23505") {
      logger.error("referral code generation failed", error, { userId: user.id });
      return { error: "Could not generate a referral code. Please try again." };
    }
    // 23505 (duplicate code) — retry with a fresh random code.
  }

  return { error: "Could not generate a referral code. Please try again." };
}
