import { logger } from "@/lib/logger";

import type { AnalyticsEvent } from "./events";
import type { AnalyticsProvider } from "./provider";

/**
 * Logs instead of persisting. Selected when ANALYTICS_PROVIDER=mock —
 * useful for local work where you want to see events firing without
 * filling the table, and the fallback if a real provider is ever
 * misconfigured.
 */
export class MockAnalyticsProvider implements AnalyticsProvider {
  async track(event: AnalyticsEvent): Promise<void> {
    logger.info("analytics event (mock)", {
      name: event.name,
      sessionId: event.sessionId ?? null,
      profileId: event.profileId ?? null,
      properties: event.properties ?? {},
    });
  }
}
