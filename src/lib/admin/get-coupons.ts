import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Coupon } from "@/types/database";

export async function getAdminCoupons(): Promise<Coupon[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load coupons", { message: error.message });
    return [];
  }
  return (data ?? []) as Coupon[];
}

export async function getAdminCoupon(id: string): Promise<Coupon | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("coupons").select("*").eq("id", id).maybeSingle();

  if (error) {
    logger.warn("failed to load coupon", { id, message: error.message });
    return null;
  }
  return (data ?? null) as Coupon | null;
}
