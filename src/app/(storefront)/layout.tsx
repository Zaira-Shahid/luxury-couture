import { cookies } from "next/headers";

import { ConsentBanner } from "@/components/analytics/consent-banner";
import { CONSENT_COOKIE, parseConsent } from "@/lib/analytics/consent";
import { getSiteSettings } from "@/lib/settings/get-site-settings";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { AnalyticsPixels } from "@/components/analytics/pixels";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PageTransition } from "@/components/motion/page-transition";
import { ChatWidget } from "@/lib/chat";

export default async function StorefrontLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Consent lives in a cookie precisely so the server can read it too.
  // Resolving it here means the banner ships in the initial HTML for a
  // new visitor (no post-hydration pop-in, no layout shift) and the first
  // client render matches the server exactly.
  const cookieStore = await cookies();
  const initialConsent = parseConsent(cookieStore.get(CONSENT_COOKIE)?.value);

  // Admin settings win; the env vars remain a fallback so an existing
  // deploy configured before Module 25 keeps working unchanged.
  const settings = await getSiteSettings();
  const pixelIds = {
    ga: settings.analytics.gaMeasurementId ?? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? null,
    meta: settings.analytics.metaPixelId ?? process.env.NEXT_PUBLIC_META_PIXEL_ID ?? null,
    tiktok: settings.analytics.tiktokPixelId ?? process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? null,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter />
      <ChatWidget />
      {/* Analytics is storefront-only by design: admin and account areas
          are staff/customer tooling, not a measurable customer journey,
          and excluding them keeps internal traffic out of the funnel. */}
      <PageViewTracker />
      <AnalyticsPixels initialConsent={initialConsent} ids={pixelIds} />
      <ConsentBanner initialConsent={initialConsent} />
    </div>
  );
}
