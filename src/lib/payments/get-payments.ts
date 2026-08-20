import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Payment } from "@/types/database";

export type PaymentWithOrder = Payment & { orders: { order_number: string } | null };

/** The signed-in customer's own payment history. */
export async function getMyPayments(): Promise<PaymentWithOrder[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("payments")
    .select("*, orders!inner(order_number, customer_id)")
    .eq("orders.customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load payments", { message: error.message });
    return [];
  }
  return (data ?? []) as unknown as PaymentWithOrder[];
}

/** Admin-only: every payment across all orders. */
export async function getAdminPayments(): Promise<PaymentWithOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*, orders(order_number)")
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load admin payments", { message: error.message });
    return [];
  }
  return (data ?? []) as unknown as PaymentWithOrder[];
}
