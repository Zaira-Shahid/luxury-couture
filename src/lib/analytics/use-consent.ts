"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ANALYTICS_SESSION_COOKIE,
  ANALYTICS_SESSION_MAX_AGE,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  makeConsent,
  parseConsent,
  serializeConsent,
  type ConsentState,
} from "./consent";

/**
 * Custom DOM event so every consent-aware component (banner, footer link,
 * pixels, page-view tracker) reacts to a change in the same tick. Cookies
 * fire no change notification of their own, and these components are
 * siblings rather than a provider tree.
 */
const CONSENT_CHANGED = "consent:changed";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const part of document.cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

function writeCookie(name: string, value: string, maxAge: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/** Starts or refreshes the rolling analytics session. Only ever called with consent. */
export function touchAnalyticsSession() {
  const existing = readCookie(ANALYTICS_SESSION_COOKIE);
  const id = existing || crypto.randomUUID();
  writeCookie(ANALYTICS_SESSION_COOKIE, id, ANALYTICS_SESSION_MAX_AGE);
  return id;
}

/**
 * @param initial Consent as read on the SERVER from the same cookie. Pass
 *   it wherever the component renders markup, so the first client render
 *   matches the server HTML exactly (no hydration mismatch) and the
 *   banner is present in the initial response instead of popping in after
 *   hydration. Components that render nothing can omit it and let the
 *   effect below resolve consent a tick later.
 */
export function useConsent(initial?: ConsentState | null) {
  // undefined means "not resolved yet", which is distinct from null ("no
  // choice made") — that difference is what stops the banner flashing for
  // someone who already decided.
  const [consent, setConsent] = useState<ConsentState | null | undefined>(initial);

  useEffect(() => {
    const read = () => setConsent(parseConsent(readCookie(CONSENT_COOKIE)));
    read();
    window.addEventListener(CONSENT_CHANGED, read);
    return () => window.removeEventListener(CONSENT_CHANGED, read);
  }, []);

  const save = useCallback((analytics: boolean, marketing: boolean) => {
    const next = makeConsent(analytics, marketing);
    writeCookie(CONSENT_COOKIE, serializeConsent(next), CONSENT_MAX_AGE);

    if (analytics) {
      touchAnalyticsSession();
    } else {
      // Withdrawing consent must actually remove the identifier, not just
      // stop reading it — otherwise the cookie sits on the device with no
      // lawful basis.
      deleteCookie(ANALYTICS_SESSION_COOKIE);
    }

    window.dispatchEvent(new Event(CONSENT_CHANGED));
  }, []);

  return {
    consent,
    /** true once the cookie has been read, whatever it said. */
    isLoaded: consent !== undefined,
    /** No valid stored choice — show the banner. */
    needsChoice: consent === null,
    analyticsAllowed: consent?.analytics === true,
    marketingAllowed: consent?.marketing === true,
    save,
  };
}

/** Lets the footer link reopen the preferences panel from anywhere. */
export const CONSENT_REOPEN_EVENT = "consent:reopen";

export function openConsentPreferences() {
  window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT));
}
