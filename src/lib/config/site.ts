/**
 * Resolves the origin this deployment is actually served from.
 *
 * WHY THIS IS NOT JUST `process.env.NEXT_PUBLIC_SITE_URL`.
 *
 * That variable was never set on the Vercel deployment, and the old
 * `?? "http://localhost:3000"` fallback meant the live site quietly
 * described itself as localhost. The damage was not cosmetic:
 *
 *   - `<link rel="canonical">`, `og:url` and the Organization/WebSite
 *     JSON-LD all pointed at http://localhost:3000
 *   - the sitemap and every absolute URL in an email were wrong
 *   - password-reset and email-confirmation links were generated against
 *     localhost, so account recovery did not work for real users
 *
 * Falling back to `VERCEL_URL` fixes all of that automatically, because
 * Vercel always sets it. An explicit `NEXT_PUBLIC_SITE_URL` still wins —
 * it is the only way to get a custom domain right, since `VERCEL_URL` is
 * the per-deployment *.vercel.app hostname rather than the domain a
 * customer typed.
 *
 * `VERCEL_URL` is server-only (no NEXT_PUBLIC_ prefix), which is fine:
 * every importer of siteConfig is a Server Component, a Server Action or
 * a route handler. If that ever stops being true, the client would read
 * `undefined` here and fall through to localhost, so keep it that way.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

export const siteConfig = {
  name: "Luxury Lehenga Couture",
  description:
    "Custom-tailored luxury lehengas, designed and hand-crafted for your special occasion.",
  url: resolveSiteUrl(),
} as const;
