import type { SupabaseClient } from "@supabase/supabase-js";

import { ORDER_STATUSES } from "@/lib/validations/orders";

/**
 * Reporting aggregations — Module 41.
 *
 * WRITTEN HERE, NOT FOUND. `src/lib/analytics/` is entirely event
 * TRACKING — consent, event names, the client and server emitters — and
 * `src/lib/admin/get-analytics.ts` reports on `analytics_events` alone,
 * through three RPCs. Nothing anywhere aggregated the commercial figures
 * a "sales summary" means: `getDashboardStats()` computes a fixed set of
 * counts for one screen with no date range and no breakdown.
 *
 * AGGREGATES ONLY, which the Master Build Plan states for this module and
 * which is enforced here rather than in the tools: no function in this
 * file returns a row identifying a person. `customerSummary` counts and
 * never lists, and the order and sales figures are sums and counts with
 * no customer id, name or email anywhere in their return types. A tool
 * cannot leak what its service will not return.
 *
 * EVERY FUNCTION TAKES AN EXPLICIT CLIENT, so RLS decides what the caller
 * can see. That matters more here than anywhere else in the MCP work: an
 * aggregate is exactly the shape that looks harmless while summing rows
 * the caller was never allowed to read. A finance account and a marketing
 * account must get different answers, and they do — because Postgres
 * filters the rows, not this file.
 */

export type ReportRange = { from: string; to: string; days: number };

/** The ranges a caller may ask for. Clamped, like `resolveRange()`. */
export const REPORT_DAYS = [7, 30, 90, 365] as const;

export function reportRange(days: number): ReportRange {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString(), days };
}

/** The previous window of the same length, for a like-for-like comparison. */
function previousRange(range: ReportRange): ReportRange {
  const to = new Date(range.from);
  const from = new Date(to.getTime() - range.days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString(), days: range.days };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Percentage change, or null when there is nothing to compare against.
 *
 * Null rather than 0 or 100: a period with no previous revenue has no
 * meaningful percentage change, and reporting "+100%" for the first sale
 * ever would be a number an assistant would repeat as if it meant
 * something.
 */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round2(((current - previous) / previous) * 100);
}

export type SalesSummary = {
  range: { from: string; to: string; days: number };
  totalRevenue: number;
  paymentCount: number;
  averagePayment: number;
  previousPeriodRevenue: number;
  changePercent: number | null;
};

/**
 * Revenue over a window, from SUCCEEDED payments only.
 *
 * Succeeded, not all: a pending payment is money somebody intends to
 * send, and counting it as revenue would overstate every figure on this
 * report. `getDashboardStats()` makes the same choice, and the two must
 * not disagree about what revenue means.
 */
export async function salesSummary(
  range: ReportRange,
  client: SupabaseClient
): Promise<SalesSummary> {
  const previous = previousRange(range);

  const [{ data: current }, { data: prior }] = await Promise.all([
    client
      .from("payments")
      .select("amount")
      .eq("status", "succeeded")
      .gte("paid_at", range.from)
      .lte("paid_at", range.to),
    client
      .from("payments")
      .select("amount")
      .eq("status", "succeeded")
      .gte("paid_at", previous.from)
      .lte("paid_at", previous.to),
  ]);

  const sum = (rows: { amount: number | string }[] | null) =>
    (rows ?? []).reduce((total, row) => total + Number(row.amount), 0);

  const totalRevenue = round2(sum(current));
  const paymentCount = (current ?? []).length;
  const previousPeriodRevenue = round2(sum(prior));

  return {
    range: { from: range.from, to: range.to, days: range.days },
    totalRevenue,
    paymentCount,
    averagePayment: paymentCount === 0 ? 0 : round2(totalRevenue / paymentCount),
    previousPeriodRevenue,
    changePercent: percentChange(totalRevenue, previousPeriodRevenue),
  };
}

export type OrderSummary = {
  range: { from: string; to: string; days: number };
  orderCount: number;
  totalValue: number;
  averageValue: number;
  byStatus: Record<string, number>;
};

/**
 * Orders placed in a window, counted and valued by status.
 *
 * `byStatus` lists EVERY status including the zeroes. A breakdown that
 * omitted empty statuses would let an assistant report "no cancelled
 * orders" when the truth is that the key was absent, and those two
 * readings are not the same claim.
 */
export async function orderSummary(
  range: ReportRange,
  client: SupabaseClient
): Promise<OrderSummary> {
  const { data } = await client
    .from("orders")
    .select("status, total_amount")
    .gte("created_at", range.from)
    .lte("created_at", range.to);

  const rows = data ?? [];
  const totalValue = round2(rows.reduce((total, row) => total + Number(row.total_amount), 0));

  const byStatus: Record<string, number> = {};
  for (const status of ORDER_STATUSES) byStatus[status] = 0;
  for (const row of rows) {
    byStatus[row.status as string] = (byStatus[row.status as string] ?? 0) + 1;
  }

  return {
    range: { from: range.from, to: range.to, days: range.days },
    orderCount: rows.length,
    totalValue,
    averageValue: rows.length === 0 ? 0 : round2(totalValue / rows.length),
    byStatus,
  };
}

export type PendingSummary = {
  openOrderCount: number;
  openOrderValue: number;
  byStatus: Record<string, number>;
  oldestOpenOrderPlacedAt: string | null;
};

/**
 * What is outstanding RIGHT NOW — no date range, because "what still
 * needs doing" is a question about the present, and a windowed version
 * would silently drop an order that has been stuck for four months.
 *
 * That stuck order is the reason `oldestOpenOrderPlacedAt` is here: a
 * count answers "how much is open" and hides "one of them has been open
 * since April".
 */
export async function pendingOrderSummary(client: SupabaseClient): Promise<PendingSummary> {
  const { data } = await client
    .from("orders")
    .select("status, total_amount, created_at")
    .not("status", "in", "(delivered,cancelled)")
    .order("created_at", { ascending: true });

  const rows = data ?? [];

  const byStatus: Record<string, number> = {};
  for (const status of ORDER_STATUSES) {
    if (status === "delivered" || status === "cancelled") continue;
    byStatus[status] = 0;
  }
  for (const row of rows) {
    byStatus[row.status as string] = (byStatus[row.status as string] ?? 0) + 1;
  }

  return {
    openOrderCount: rows.length,
    openOrderValue: round2(rows.reduce((total, row) => total + Number(row.total_amount), 0)),
    byStatus,
    oldestOpenOrderPlacedAt: (rows[0]?.created_at as string) ?? null,
  };
}

export type CustomerSummary = {
  range: { from: string; to: string; days: number };
  totalCustomers: number;
  newCustomers: number;
  previousPeriodNewCustomers: number;
  changePercent: number | null;
};

/**
 * Customer COUNTS. Never a customer.
 *
 * The Master Build Plan's rule for this module is "aggregates only — no
 * tool returns a customer list as an analytics result", and this is the
 * function that rule was written about. It uses head-only counts, so no
 * profile row is fetched at all: there is nothing in memory to leak, and
 * no future edit can accidentally widen a `select("id")` into a
 * `select("*")`.
 */
export async function customerSummary(
  range: ReportRange,
  client: SupabaseClient
): Promise<CustomerSummary> {
  const previous = previousRange(range);

  const [total, added, addedBefore] = await Promise.all([
    client.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
    client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer")
      .gte("created_at", range.from)
      .lte("created_at", range.to),
    client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer")
      .gte("created_at", previous.from)
      .lte("created_at", previous.to),
  ]);

  const newCustomers = added.count ?? 0;
  const previousPeriodNewCustomers = addedBefore.count ?? 0;

  return {
    range: { from: range.from, to: range.to, days: range.days },
    totalCustomers: total.count ?? 0,
    newCustomers,
    previousPeriodNewCustomers,
    changePercent: percentChange(newCustomers, previousPeriodNewCustomers),
  };
}
