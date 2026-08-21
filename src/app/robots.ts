import type { MetadataRoute } from "next";

import { getSiteSettings } from "@/lib/settings/get-site-settings";
import { absoluteUrl } from "@/lib/seo/urls";

/**
 * Public /robots.txt.
 *
 * Until the owner flips `seo.indexingEnabled` on in Admin → SEO, this
 * disallows everything — a pre-launch or staging deploy should never be
 * crawled. `buildMetadata` applies the matching `noindex` meta tag, since
 * robots.txt alone does not remove already-known URLs from an index.
 *
 * Once enabled, only the private surfaces are blocked. These are already
 * server-side authorized (RLS + route guards); disallowing them is about
 * keeping useless URLs out of the index, never about security.
 */
const PRIVATE_PATHS = [
  "/admin",
  "/account",
  "/checkout",
  "/cart",
  "/api",
  "/unsubscribe",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettings();

  if (!settings.seo.indexingEnabled) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
