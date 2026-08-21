import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { FUNNEL_STEPS, type AnalyticsEventName } from "@/lib/analytics/events";

/**
 * Admin analytics reads. Every query goes through the RLS-respecting
 * server client, and `analytics_events` is select-by-admin only, so a
 * non-admin reaching these gets empty results even before the (admin)
 * layout's role guard.
 *
 * Aggregation happens in Postgres (0046's three functions) rather than by
 * pulling raw rows into Node — the raw table grows by one row per page
 * view, so anything else stops working within weeks.
 */

export type EventSummaryRow = {
  event_name: string;
  total_events: number;
  unique_sessions: number;
};

export type TimeseriesRow = { day: string; event_name: string; total: number };

export type TopProductRow = {
  product_id: string;
  product_name: string;
  product_slug: string;
  views: number;
};

export type FunnelStep = {
  event: AnalyticsEventName;
  label: string;
  sessions: number;
  /** % of the previous step that reached this one; null for the first step. */
  conversionFromPrevious: number | null;
  /** % of the very first step that reached this one. */
  conversionFromStart: number;
};

export type RecentEvent = {
  id: string;
  event_name: string;
  occurred_at: string;
  session_id: string | null;
  profile_id: string | null;
  properties: Record<string, unknown> | null;
};

export type AnalyticsRange = { from: Date; to: Date; days: number };

/** Clamps an arbitrary `?days=` param to the offered options. */
export function resolveRange(daysParam: string | undefined): AnalyticsRange {
  const days = [7, 30, 90].includes(Number(daysParam)) ? Number(daysParam) : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to, days };
}

export async function getEventSummary(range: AnalyticsRange): Promise<EventSummaryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_analytics_summary", {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
  });
  if (error) {
    logger.warn("analytics summary failed", { message: error.message });
    return [];
  }
  return (data ?? []) as EventSummaryRow[];
}

export async function getTimeseries(range: AnalyticsRange): Promise<TimeseriesRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_analytics_timeseries", {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
  });
  if (error) {
    logger.warn("analytics timeseries failed", { message: error.message });
    return [];
  }
  return (data ?? []) as TimeseriesRow[];
}

export async function getTopViewedProducts(range: AnalyticsRange): Promise<TopProductRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_top_viewed_products", {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
    p_limit: 10,
  });
  if (error) {
    logger.warn("analytics top products failed", { message: error.message });
    return [];
  }
  return (data ?? []) as TopProductRow[];
}

export async function getRecentEvents(limit = 25): Promise<RecentEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analytics_events")
    .select("id, event_name, occurred_at, session_id, profile_id, properties")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) {
    logger.warn("recent analytics events failed", { message: error.message });
    return [];
  }
  return (data ?? []) as RecentEvent[];
}

/**
 * Builds the funnel from the summary's DISTINCT-session counts.
 *
 * Sessions, not raw events: one visitor viewing ten products must count
 * once, or "add to cart" would look like a 10% conversion when it was
 * actually 100%. Purchases recorded without consent carry session_id
 * null, which `count(distinct session_id)` ignores — so they can never
 * push a step above the one before it.
 */
export function buildFunnel(summary: EventSummaryRow[]): FunnelStep[] {
  const byName = new Map(summary.map((row) => [row.event_name, row]));

  const raw = FUNNEL_STEPS.map((step) => ({
    event: step.event,
    label: step.label,
    sessions: Number(byName.get(step.event)?.unique_sessions ?? 0),
  }));

  const start = raw[0]?.sessions ?? 0;

  return raw.map((step, index) => {
    const previous = index === 0 ? null : raw[index - 1].sessions;
    return {
      ...step,
      conversionFromPrevious:
        previous === null ? null : previous === 0 ? 0 : (step.sessions / previous) * 100,
      conversionFromStart: start === 0 ? 0 : (step.sessions / start) * 100,
    };
  });
}
