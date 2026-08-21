"use client";

import { openConsentPreferences } from "@/lib/analytics/use-consent";

/**
 * Footer entry point for changing or withdrawing consent after the fact.
 * PECR requires withdrawal to be as easy as giving consent, which means a
 * persistent, always-available control — not a one-time banner.
 */
export function ConsentPreferencesLink() {
  return (
    <button
      type="button"
      onClick={openConsentPreferences}
      className="text-left transition-colors hover:text-foreground"
    >
      Cookie preferences
    </button>
  );
}
