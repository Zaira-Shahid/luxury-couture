import { type NextRequest, NextResponse } from "next/server";

import { getAnalyticsProvider } from "@/lib/analytics";
import {
  ANALYTICS_SESSION_COOKIE,
  hasAnalyticsConsent,
  parseConsentFromCookieHeader,
} from "@/lib/analytics/consent";
import {
  MAX_PROPERTIES_BYTES,
  isClientEventName,
  type AnalyticsProperties,
} from "@/lib/analytics/events";
import { createClient } from "@/lib/supabase/server";

/**
 * Ingest endpoint for the three high-frequency browser events
 * (page_view, product_view, checkout_started). The browser reaches it via
 * navigator.sendBeacon, so these never block navigation and survive page
 * unload — which a Server Action round trip would not.
 *
 * `analytics_events` is insert-by-anyone at the RLS level (that is what
 * lets an anonymous visitor be measured at all), so the validation in
 * this route IS the real gate on what gets written:
 *
 *  - the event name must be in the client allow-list — server-authored
 *    events like `purchase` can never be forged from a browser;
 *  - the properties payload is size-capped;
 *  - consent is re-checked here, server-side, rather than trusting that
 *    the client bothered to check before sending.
 *
 * Not rate-limited — noted as a known limitation for Module 29.
 */
export async function POST(request: NextRequest) {
  // Consent is read from the raw header: sendBeacon sends cookies, and
  // this runs outside the Server Component cookie API.
  const consent = parseConsentFromCookieHeader(request.headers.get("cookie"));
  if (!hasAnalyticsConsent(consent)) {
    // 204, not 403 — the browser is behaving correctly by respecting a
    // "no" it may not have re-read yet, and sendBeacon ignores the body.
    return new NextResponse(null, { status: 204 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, properties } = (body ?? {}) as {
    name?: unknown;
    properties?: unknown;
  };

  if (!isClientEventName(name)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  let safeProperties: AnalyticsProperties = {};
  if (properties && typeof properties === "object") {
    const serialized = JSON.stringify(properties);
    if (serialized.length > MAX_PROPERTIES_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    safeProperties = properties as AnalyticsProperties;
  }

  // Basic bot filter. Not a maintained bot list — a known limitation.
  const userAgent = request.headers.get("user-agent") ?? "";
  if (/bot|crawler|spider|crawling|headless|lighthouse/i.test(userAgent)) {
    return new NextResponse(null, { status: 204 });
  }

  const sessionId = request.cookies.get(ANALYTICS_SESSION_COOKIE)?.value ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await getAnalyticsProvider(supabase).track({
    name,
    properties: safeProperties,
    profileId: user?.id ?? null,
    sessionId,
  });

  return new NextResponse(null, { status: 204 });
}
