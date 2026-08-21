"use client";

import { useEffect, useRef } from "react";

import { trackClient } from "@/lib/analytics/track-client";
import type { AnalyticsProperties, ClientEventName } from "@/lib/analytics/events";
import { useConsent } from "@/lib/analytics/use-consent";

/**
 * Fires one browser event when a page mounts — used for `product_view`
 * (on the PDP) and `checkout_started` (on /checkout).
 *
 * Client-side on mount rather than server-side during render, for two
 * reasons: Next prefetches server-rendered pages on link hover, which
 * would log views nobody actually made; and a server render is repeated
 * on every revalidation.
 *
 * The ref guard keeps it to one send per mount even though the effect
 * re-runs when consent flips from false to true.
 */
export function EventTracker({
  event,
  properties,
}: {
  event: ClientEventName;
  properties?: AnalyticsProperties;
}) {
  const { analyticsAllowed } = useConsent();
  const sent = useRef(false);

  useEffect(() => {
    if (!analyticsAllowed || sent.current) return;
    sent.current = true;
    trackClient(event, properties);
  }, [analyticsAllowed, event, properties]);

  return null;
}
