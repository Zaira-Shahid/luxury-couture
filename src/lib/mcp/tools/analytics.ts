import { z } from "zod";

import { getEventSummary, buildFunnel, resolveRange } from "@/lib/admin/get-analytics";
import {
  REPORT_DAYS,
  customerSummary,
  orderSummary,
  pendingOrderSummary,
  reportRange,
  salesSummary,
} from "@/lib/analytics/reporting";

import type { AnyToolDefinition } from "../registry";
import { readerOptions } from "./shared";

/**
 * Analytics and reporting tools — Module 41. Five tools, all reads.
 *
 * ONLY ONE OF THEM TAKES `analytics.read`, which is the finding this
 * module turned on. The plan specifies `analytics_sales_summary`,
 * `analytics_order_summary`, `analytics_customer_summary` and
 * `orders_pending_summary`, and the names suggest a single analytics
 * permission covers them. It does not. Migration 0054 gates
 * `analytics.read` on `analytics_events` and nothing else; `orders` needs
 * `orders.read`, `payments` needs `payments.read`, and `profiles` needs
 * `customers.read`.
 *
 * The `marketing` role holds `analytics.read` and holds none of those
 * three. A sales tool declaring `analytics.read` would have been listed
 * for a marketing account and refused by Postgres on every call — the
 * same defect Module 40 found and recorded as MCP-017, which is why each
 * tool below declares the key its TABLE requires.
 *
 * AGGREGATES ONLY. The plan's rule for this module is that no tool
 * returns a customer list as an analytics result, and it is enforced in
 * `lib/analytics/reporting.ts` rather than here: those functions return
 * sums and counts, and the customer figures come from head-only counts
 * that fetch no profile row at all. A tool cannot leak what its service
 * will not return.
 *
 * RLS DOES THE FILTERING, not these handlers. An aggregate is exactly the
 * shape that looks harmless while summing rows the caller may not read,
 * so every service is handed `ctx.supabase` and a finance account and an
 * admin get genuinely different totals.
 */

const daysInput = z
  .number()
  .int()
  .refine((n) => (REPORT_DAYS as readonly number[]).includes(n), {
    message: `Use one of: ${REPORT_DAYS.join(", ")}.`,
  })
  .optional()
  .describe(`How many days back to report over. One of ${REPORT_DAYS.join(", ")}. Defaults to 30.`);

function rangeFrom(days: number | undefined) {
  return reportRange(days ?? 30);
}

const analyticsSalesSummary: AnyToolDefinition = {
  name: "analytics_sales_summary",
  title: "Summarise revenue over a period",
  description:
    "Total revenue, payment count and average payment over a period, with the previous period of " +
    "the same length for comparison. Counts SUCCEEDED payments only — pending money is not " +
    "revenue. Returns totals only: it names no customer and lists no order.",
  kind: "read",
  risk: "low",
  // payments.read, not analytics.read — see the file header.
  permission: "payments.read",
  inputSchema: z.object({ days: daysInput }).strict(),
  handler: async (input, ctx) => {
    const data = await salesSummary(rangeFrom(input.days), ctx.supabase);
    return { action: `Summarised revenue over ${data.range.days} days`, data };
  },
};

const analyticsOrderSummary: AnyToolDefinition = {
  name: "analytics_order_summary",
  title: "Summarise orders over a period",
  description:
    "How many orders were placed over a period, their total and average value, and a count for " +
    "every status including the statuses with none. Returns counts only: it names no customer and " +
    "lists no individual order — use orders_list for those.",
  kind: "read",
  risk: "low",
  permission: "orders.read",
  inputSchema: z.object({ days: daysInput }).strict(),
  handler: async (input, ctx) => {
    const data = await orderSummary(rangeFrom(input.days), ctx.supabase);
    return { action: `Summarised orders over ${data.range.days} days`, data };
  },
};

const ordersPendingSummary: AnyToolDefinition = {
  name: "orders_pending_summary",
  title: "Summarise what is currently outstanding",
  description:
    "What is open right now: how many orders are not yet delivered or cancelled, what they are " +
    "worth, a count per status, and when the oldest one was placed. Takes no date range — this is " +
    "a question about the present. Returns counts only; it names no customer.",
  kind: "read",
  risk: "low",
  permission: "orders.read",
  inputSchema: z.object({}).strict(),
  handler: async (_input, ctx) => {
    const data = await pendingOrderSummary(ctx.supabase);
    return { action: "Summarised outstanding orders", data };
  },
};

const analyticsCustomerSummary: AnyToolDefinition = {
  name: "analytics_customer_summary",
  title: "Summarise customer numbers over a period",
  description:
    "How many customers exist in total and how many registered during a period, with the previous " +
    "period for comparison. COUNTS ONLY — this tool cannot return a customer, a name, an email or " +
    "a list, by any argument. Use customers_search to find a specific person.",
  kind: "read",
  risk: "low",
  permission: "customers.read",
  inputSchema: z.object({ days: daysInput }).strict(),
  handler: async (input, ctx) => {
    const data = await customerSummary(rangeFrom(input.days), ctx.supabase);
    return { action: `Summarised customers over ${data.range.days} days`, data };
  },
};

const analyticsEventsSummary: AnyToolDefinition = {
  name: "analytics_events_summary",
  title: "Summarise site activity and the conversion funnel",
  description:
    "Website activity over a period: how often each tracked event fired, how many distinct " +
    "sessions fired it, and the conversion funnel from those session counts. This is visitor " +
    "behaviour, not money — use analytics_sales_summary for revenue. Returns totals per event; it " +
    "identifies no visitor and no session.",
  kind: "read",
  risk: "low",
  // The one tool in this module for which analytics.read is the right
  // key, because analytics_events is the only table it gates.
  permission: "analytics.read",
  inputSchema: z
    .object({
      days: z
        .number()
        .int()
        .refine((n) => [7, 30, 90].includes(n), { message: "Use one of: 7, 30, 90." })
        .optional()
        .describe("How many days back. One of 7, 30, 90. Defaults to 30."),
    })
    .strict(),
  handler: async (input, ctx) => {
    const range = resolveRange(input.days === undefined ? undefined : String(input.days));
    const summary = await getEventSummary(range, readerOptions(ctx));

    return {
      action: `Summarised site activity over ${range.days} days`,
      data: {
        range: { from: range.from.toISOString(), to: range.to.toISOString(), days: range.days },
        // Session counts are carried through as the readers produce them.
        // The funnel is built from DISTINCT sessions rather than raw
        // events, so one visitor viewing ten products counts once — see
        // buildFunnel(); reporting raw events would make a 100%
        // conversion look like 10%.
        events: summary.map((row) => ({
          event: row.event_name,
          total: Number(row.total_events),
          uniqueSessions: Number(row.unique_sessions),
        })),
        funnel: buildFunnel(summary),
      },
    };
  },
};

export const analyticsTools: AnyToolDefinition[] = [
  analyticsSalesSummary,
  analyticsOrderSummary,
  ordersPendingSummary,
  analyticsCustomerSummary,
  analyticsEventsSummary,
];
