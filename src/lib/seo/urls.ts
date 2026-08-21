import { siteConfig } from "@/lib/config/site";

/**
 * Turns an app path into a fully-qualified URL against the configured site
 * origin. Canonical tags, OG tags, JSON-LD and the sitemap all require
 * absolute URLs, so they all funnel through here — `NEXT_PUBLIC_SITE_URL`
 * is the single place the deployed origin is configured.
 */
export function absoluteUrl(path = "/"): string {
  const base = siteConfig.url.replace(/\/+$/, "");
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Passes through URLs that are already absolute (Supabase Storage public
 * URLs, admin-pasted CDN links) and absolutizes app-relative ones.
 */
export function absoluteAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return absoluteUrl(url);
}
