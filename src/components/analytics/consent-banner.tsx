"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ConsentState } from "@/lib/analytics/consent";
import { CONSENT_REOPEN_EVENT, useConsent } from "@/lib/analytics/use-consent";

/**
 * Cookie consent banner (UK GDPR + PECR).
 *
 * Design points that are compliance requirements, not styling choices:
 *  - "Reject all" is presented with the same prominence as "Accept all";
 *    a hidden or de-emphasised reject option is not valid consent.
 *  - Both optional categories default to OFF in the preferences panel —
 *    pre-ticked boxes do not constitute consent.
 *  - Consent can be withdrawn as easily as it was given, via the
 *    "Cookie preferences" link in the footer, which reopens this panel.
 *
 * Renders nothing until the cookie has been read, so someone who already
 * chose never sees a flash of the banner.
 */
export function ConsentBanner({ initialConsent }: { initialConsent: ConsentState | null }) {
  const { isLoaded, needsChoice, consent, save } = useConsent(initialConsent);
  const [showPreferences, setShowPreferences] = useState(false);
  const [reopened, setReopened] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // The footer link reopens this panel for someone who already decided.
  useEffect(() => {
    const handler = () => {
      setAnalytics(consent?.analytics ?? false);
      setMarketing(consent?.marketing ?? false);
      setShowPreferences(true);
      setReopened(true);
    };
    window.addEventListener(CONSENT_REOPEN_EVENT, handler);
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, handler);
  }, [consent]);

  if (!isLoaded) return null;
  if (!needsChoice && !reopened) return null;

  function choose(a: boolean, m: boolean) {
    save(a, m);
    setShowPreferences(false);
    setReopened(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur"
    >
      <div className="container flex flex-col gap-4 py-5">
        <div>
          <p className="font-heading text-lg">Your privacy</p>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            We use essential cookies to make this site work. With your permission we&apos;d also
            like to measure how the site is used, and show you relevant advertising. You can change
            your mind at any time via &ldquo;Cookie preferences&rdquo; in the footer. Read our{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              privacy policy
            </Link>
            .
          </p>
        </div>

        {showPreferences ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="flex items-start gap-3">
              <input type="checkbox" checked disabled className="mt-1 size-4" />
              <span className="text-sm">
                <span className="font-medium text-foreground">Strictly necessary</span>
                <span className="mt-0.5 block text-muted-foreground">
                  Your cart, sign-in session and security. Always on — the site cannot work without
                  these.
                </span>
              </span>
            </div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-1 size-4"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">Analytics</span>
                <span className="mt-0.5 block text-muted-foreground">
                  Lets us count visits and see which pages and products are useful, so we can
                  improve the site. Our own measurement only.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1 size-4"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">Marketing</span>
                <span className="mt-0.5 block text-muted-foreground">
                  Allows advertising tools from Google, Meta and TikTok to measure campaigns. These
                  set their own cookies.
                </span>
              </span>
            </label>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => choose(true, true)}>Accept all</Button>
          <Button variant="outline" onClick={() => choose(false, false)}>
            Reject all
          </Button>
          {showPreferences ? (
            <Button variant="secondary" onClick={() => choose(analytics, marketing)}>
              Save preferences
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setShowPreferences(true)}>
              Preferences
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
