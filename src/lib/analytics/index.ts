import type { SupabaseClient } from "@supabase/supabase-js";

import { MockAnalyticsProvider } from "./mock-provider";
import type { AnalyticsProvider } from "./provider";
import { SupabaseAnalyticsProvider } from "./supabase-provider";

export type { AnalyticsProvider } from "./provider";
export type { AnalyticsEvent, AnalyticsEventName, AnalyticsProperties } from "./events";

/**
 * Env-selected provider, mirroring lib/payments/index.ts. Defaults to the
 * free first-party Supabase provider; set ANALYTICS_PROVIDER=mock to log
 * events instead of persisting them.
 */
export function getAnalyticsProvider(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): AnalyticsProvider {
  switch (process.env.ANALYTICS_PROVIDER) {
    case "mock":
      return new MockAnalyticsProvider();
    case "supabase":
    default:
      return new SupabaseAnalyticsProvider(supabase);
  }
}
