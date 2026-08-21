"use client";

import { touchAnalyticsSession } from "./use-consent";
import type { AnalyticsProperties, ClientEventName } from "./events";

const ENDPOINT = "/api/analytics";

/**
 * Sends a browser event to the ingest route.
 *
 * `sendBeacon` is the right primitive here: it hands the request to the
 * browser to deliver in the background, so a page_view fired during
 * navigation still arrives after the page is gone, and nothing blocks the
 * transition. It falls back to fetch with `keepalive` where sendBeacon is
 * unavailable.
 *
 * Consent is checked by the caller AND re-checked server-side in the
 * route — this function assumes nothing.
 */
export function trackClient(name: ClientEventName, properties: AnalyticsProperties = {}) {
  if (typeof window === "undefined") return;

  // Refresh the rolling session window on every tracked interaction, so
  // an active visit doesn't expire mid-session.
  touchAnalyticsSession();

  const payload = JSON.stringify({ name, properties });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      body: payload,
      headers: { "content-type": "application/json" },
      keepalive: true,
    });
  } catch {
    // Analytics is never worth surfacing an error to a customer.
  }
}
