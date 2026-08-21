import type { AnalyticsEvent } from "./events";

/**
 * Free-first provider abstraction (Master Build Plan §3), same shape as
 * lib/social/ and lib/shipping/: interface here, implementations
 * alongside, factory in index.ts.
 *
 * The default implementation writes to this project's own
 * `analytics_events` table — first-party, free, and the source the admin
 * funnel reports from. Third-party destinations (GA4, Meta, TikTok) are
 * deliberately NOT providers here: they run in the browser against the
 * visitor's own device and are gated on marketing consent, which is a
 * different consent category and a different execution context. See
 * components/analytics/pixels.tsx.
 *
 * `track` never throws. Analytics failing must never break the operation
 * the visitor actually asked for — adding to cart matters, recording that
 * they did does not.
 */
export interface AnalyticsProvider {
  track(event: AnalyticsEvent): Promise<void>;
}
