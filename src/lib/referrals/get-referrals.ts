import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Referral } from "@/types/database";

/** The signed-in customer's own referral codes, as referrer. */
export async function getMyReferrals(): Promise<Referral[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("referrals")
    .select("*")
    .eq("referrer_customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load referrals", { message: error.message });
    return [];
  }
  return (data ?? []) as Referral[];
}
