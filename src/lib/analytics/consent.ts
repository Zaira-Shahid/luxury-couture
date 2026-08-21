/**
 * Consent model (UK GDPR + PECR).
 *
 * Three categories, granular, opt-in. "Necessary" isn't stored because it
 * is never optional — it covers the cart session, auth and CSRF cookies
 * the site cannot function without, which PECR exempts as
 * strictly necessary.
 *
 * The preference itself lives in a first-party cookie rather than
 * localStorage for one concrete reason: Server Actions must be able to
 * read it before recording an event, and localStorage does not exist on
 * the server. The cookie is deliberately NOT httpOnly (client code reads
 * it too) and needs no consent of its own — recording a legal preference
 * is itself strictly necessary.
 *
 * This module is imported from client components, Server Actions, Route
 * Handlers and the Edge runtime, so it must stay free of React, Node and
 * database imports.
 */

export const CONSENT_COOKIE = "consent";
export const CONSENT_VERSION = 1;

/** A year: long enough not to nag, short enough that consent is periodically re-confirmed. */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

/** Rolling analytics session. 30 minutes of inactivity ends it — the GA4 convention. */
export const ANALYTICS_SESSION_COOKIE = "analytics_session";
export const ANALYTICS_SESSION_MAX_AGE = 60 * 30;

export type ConsentState = {
  v: number;
  /** First-party event collection (this project's own analytics_events). */
  analytics: boolean;
  /** Third-party advertising pixels (GA4 / Meta / TikTok). */
  marketing: boolean;
  /** When the choice was made — evidence of consent, as the ICO expects. */
  ts: string;
};

/** No stored choice yet: everything optional is off until the visitor decides. */
export const DEFAULT_CONSENT: ConsentState = {
  v: CONSENT_VERSION,
  analytics: false,
  marketing: false,
  ts: "",
};

export function makeConsent(analytics: boolean, marketing: boolean): ConsentState {
  return { v: CONSENT_VERSION, analytics, marketing, ts: new Date().toISOString() };
}

export function serializeConsent(state: ConsentState): string {
  return encodeURIComponent(JSON.stringify(state));
}

/**
 * Parses the cookie value, returning null when there is no valid stored
 * choice — which is what tells the UI to show the banner. A malformed or
 * outdated-version cookie is treated as "no choice made" rather than
 * being trusted or silently upgraded: if the categories change, consent
 * must genuinely be re-collected.
 */
export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>;
    if (parsed?.v !== CONSENT_VERSION) return null;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean") return null;
    return {
      v: CONSENT_VERSION,
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      ts: typeof parsed.ts === "string" ? parsed.ts : "",
    };
  } catch {
    return null;
  }
}

/** Reads the consent cookie from a raw Cookie header (Route Handlers, middleware). */
export function parseConsentFromCookieHeader(header: string | null): ConsentState | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CONSENT_COOKIE) return parseConsent(rest.join("="));
  }
  return null;
}

export function hasAnalyticsConsent(state: ConsentState | null): boolean {
  return state?.analytics === true;
}

export function hasMarketingConsent(state: ConsentState | null): boolean {
  return state?.marketing === true;
}
