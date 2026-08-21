import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

import type { AnalyticsEvent } from "./events";
import type { AnalyticsProvider } from "./provider";

/**
 * The default, free provider: writes to this project's own
 * `analytics_events` table (created in Module 1, 0012, and unused until
 * now). RLS on that table allows insert-by-anyone and select-by-admin, so
 * an anonymous visitor can log an event but only staff can ever read the
 * data back.
 *
 * Takes an already-instantiated client rather than creating its own, for
 * the same reason `notify()` does (lib/notifications/notify.ts): call
 * sites span the RLS-respecting server client in Server Actions, the
 * Route Handler client, and the service-role client inside the Stripe
 * webhook.
 */
export class SupabaseAnalyticsProvider implements AnalyticsProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly supabase: SupabaseClient<any>) {}

  async track(event: AnalyticsEvent): Promise<void> {
    const { error } = await this.supabase.from("analytics_events").insert({
      event_name: event.name,
      profile_id: event.profileId ?? null,
      session_id: event.sessionId ?? null,
      properties: event.properties ?? {},
    });

    // Warn, never throw. A failed analytics write must not break the
    // operation the visitor actually performed.
    if (error) {
      logger.warn("analytics event insert failed", { message: error.message, name: event.name });
    }
  }
}
