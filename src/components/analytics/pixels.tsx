"use client";

import Script from "next/script";

import type { ConsentState } from "@/lib/analytics/consent";
import { useConsent } from "@/lib/analytics/use-consent";

/**
 * Third-party advertising pixels — GA4, Meta and TikTok.
 *
 * Two independent conditions must both hold before any of these load:
 *  1. the visitor granted MARKETING consent (not analytics — these are
 *     third parties setting their own cookies on their own domains); and
 *  2. the corresponding env ID is configured.
 *
 * Every ID is unset by default, so on a normal checkout of this project
 * nothing third-party loads at all. That is the Master Build Plan's
 * "Prepare:" wording plus §3's free-first rule: the integration is real
 * and ready, but nothing paid or external is wired up during development.
 *
 * `afterInteractive` keeps these off the critical rendering path.
 *
 * NOT verified against real GA/Meta/TikTok accounts — no credentials
 * exist, the same deferral Modules 11 and 14 made for PayPal and courier
 * APIs. The snippets follow each vendor's documented install.
 */
export function AnalyticsPixels({
  initialConsent,
  ids,
}: {
  initialConsent: ConsentState | null;
  /**
   * Module 25: resolved server-side from admin settings, with the
   * NEXT_PUBLIC_* env vars as a fallback. They have to arrive as props —
   * NEXT_PUBLIC_* values are inlined at BUILD time, so a client component
   * reading process.env directly could never pick up a value an admin
   * changed at runtime.
   */
  ids: { ga: string | null; meta: string | null; tiktok: string | null };
}) {
  const { marketingAllowed } = useConsent(initialConsent);

  const gaId = ids.ga;
  const metaId = ids.meta;
  const tiktokId = ids.tiktok;

  if (!marketingAllowed) return null;

  return (
    <>
      {gaId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');
            `}
          </Script>
        </>
      ) : null}

      {metaId ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaId}');
            fbq('track', 'PageView');
          `}
        </Script>
      ) : null}

      {tiktokId ? (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
              ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
              ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
              for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
              ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
              ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
              ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
              var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;
              var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
              ttq.load('${tiktokId}');
              ttq.page();
            }(window, document, 'ttq');
          `}
        </Script>
      ) : null}
    </>
  );
}
