import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export type DashboardStats = {
  revenueAllTime: number;
  revenueThisMonth: number;
  ordersTotal: number;
  ordersPending: number;
  customersTotal: number;
  enquiriesPending: number;
  productionActive: number;
  paymentsPendingCount: number;
  paymentsPendingAmount: number;
  shippingInTransit: number;
  reviewsTotal: number;
  reviewsPendingModeration: number;
  ordersThisWeek: number;
  ordersLastWeek: number;
};

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/** Admin-only: every query here reads across all customers' data, permitted by the existing is_admin() RLS path on each table — no new policy needed. */
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60_000).toISOString();

  const [
    revenueAllTimeResult,
    revenueThisMonthResult,
    ordersTotalResult,
    ordersPendingResult,
    customersTotalResult,
    enquiriesPendingResult,
    productionActiveResult,
    paymentsPendingResult,
    shippingInTransitResult,
    reviewsTotalResult,
    reviewsPendingResult,
    ordersThisWeekResult,
    ordersLastWeekResult,
  ] = await Promise.all([
    supabase.from("payments").select("amount").eq("status", "succeeded"),
    supabase.from("payments").select("amount").eq("status", "succeeded").gte("paid_at", startOfMonth()),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
    supabase.from("enquiries").select("id", { count: "exact", head: true }).in("status", ["new", "in_review"]),
    supabase.from("production_orders").select("id", { count: "exact", head: true }).neq("current_status", "delivered"),
    supabase.from("payments").select("amount").eq("status", "pending"),
    supabase
      .from("shipping_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["label_created", "in_transit", "out_for_delivery"]),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("is_published", false),
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", twoWeeksAgo)
      .lt("created_at", weekAgo),
  ]);

  for (const [label, result] of Object.entries({
    revenueAllTimeResult,
    revenueThisMonthResult,
    ordersTotalResult,
    ordersPendingResult,
    customersTotalResult,
    enquiriesPendingResult,
    productionActiveResult,
    paymentsPendingResult,
    shippingInTransitResult,
    reviewsTotalResult,
    reviewsPendingResult,
    ordersThisWeekResult,
    ordersLastWeekResult,
  })) {
    if (result.error) logger.warn("dashboard stat query failed", { label, message: result.error.message });
  }

  const sum = (rows: { amount: number }[] | null) => (rows ?? []).reduce((total, r) => total + Number(r.amount), 0);

  return {
    revenueAllTime: sum(revenueAllTimeResult.data),
    revenueThisMonth: sum(revenueThisMonthResult.data),
    ordersTotal: ordersTotalResult.count ?? 0,
    ordersPending: ordersPendingResult.count ?? 0,
    customersTotal: customersTotalResult.count ?? 0,
    enquiriesPending: enquiriesPendingResult.count ?? 0,
    productionActive: productionActiveResult.count ?? 0,
    paymentsPendingCount: paymentsPendingResult.data?.length ?? 0,
    paymentsPendingAmount: sum(paymentsPendingResult.data),
    shippingInTransit: shippingInTransitResult.count ?? 0,
    reviewsTotal: reviewsTotalResult.count ?? 0,
    reviewsPendingModeration: reviewsPendingResult.count ?? 0,
    ordersThisWeek: ordersThisWeekResult.count ?? 0,
    ordersLastWeek: ordersLastWeekResult.count ?? 0,
  };
}
