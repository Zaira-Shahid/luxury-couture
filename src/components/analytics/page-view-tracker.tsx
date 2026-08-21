"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

import { trackClient } from "@/lib/analytics/track-client";
import { useConsent } from "@/lib/analytics/use-consent";

/**
 * Fires page_view on every client-side navigation, once analytics consent
 * exists.
 *
 * Deliberately a separate component rather than folding this into
 * PageTransition (which already watches usePathname): one concern per
 * component, and this one must be able to do nothing at all when consent
 * is absent.
 *
 * The ref guard stops a duplicate send when the effect re-runs for a
 * reason other than a real navigation — notably the moment consent is
 * granted, which changes `analyticsAllowed` while the path is unchanged.
 */
function PageViewTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { analyticsAllowed } = useConsent();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!analyticsAllowed) return;

    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    if (lastTracked.current === path) return;

    lastTracked.current = path;
    trackClient("page_view", { path });
  }, [pathname, searchParams, analyticsAllowed]);

  return null;
}

/**
 * useSearchParams() opts the whole subtree into client-side rendering
 * unless it sits under Suspense — without this boundary it would drag the
 * entire storefront layout with it. The tracker renders nothing, so the
 * fallback is null.
 */
export function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <PageViewTrackerInner />
    </Suspense>
  );
}
