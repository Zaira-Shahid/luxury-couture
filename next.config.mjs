// Supabase Storage is the only host we optimize images from. Derived from
// the env var rather than hardcoded so a different Supabase project (a
// staging branch, a fresh deploy) works without editing this file; the
// literal stays as the fallback for tooling that evaluates the config
// without .env loaded. Anything served from another host renders through
// StorefrontImage's plain-<img> fallback instead of throwing.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "cmskqksbumvastgoacmu.supabase.co";


/*
 * MODULE 29 — security headers.
 *
 * The audit found the app was serving NONE of these. Added in the order
 * the audit ranked them, with the one that can break the site handled
 * differently from the ones that cannot.
 *
 * CSP IS REPORT-ONLY FOR NOW, DELIBERATELY. An enforced policy that is
 * even slightly wrong white-screens the storefront, and this app loads
 * three third-party analytics pixels (GA, Meta, TikTok) plus Next's own
 * inline bootstrap scripts. Report-Only sends violation reports without
 * blocking anything, so the policy can be proven against real traffic
 * before it is allowed to break something. Switching the header name to
 * `Content-Security-Policy` is the whole of the change when that is done.
 *
 * 'unsafe-inline' and 'unsafe-eval' in script-src are the uncomfortable
 * part and are called out rather than buried: Next injects inline
 * bootstrap scripts, and removing the allowance requires per-request
 * nonces threaded through the document. That is a real piece of work and
 * belongs to whoever enforces this, not to the report-only rollout. As
 * written the policy still blocks the things that matter most — foreign
 * script hosts, framing, form hijacking, and base-tag injection.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Analytics pixels are loaded from these hosts by the Module 21 code.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com",
  "style-src 'self' 'unsafe-inline'",
  // Supabase Storage for catalogue imagery; data: for inlined SVG.
  `img-src 'self' data: blob: https://${supabaseHostname} https://www.google-analytics.com https://www.facebook.com`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHostname} wss://${supabaseHostname} https://www.google-analytics.com https://analytics.tiktok.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  // Redundant with frame-ancestors above, kept for older browsers that
  // understand this but not CSP.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // strict-origin-when-cross-origin: full URL to our own origin, bare
  // origin to third parties, nothing at all on a downgrade to http.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No feature here needs camera, microphone or geolocation.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // MODULE 28: AVIF first, WebP as the fallback. Next only serves these
    // to browsers that send a matching Accept header, so there is no
    // compatibility cost — and for the photographic imagery this shop is
    // built from, AVIF is typically a large saving over JPEG at the same
    // perceptual quality.
    formats: ["image/avif", "image/webp"],
    // A year. These are content-addressed Supabase Storage URLs — a
    // changed image gets a new URL rather than new bytes at the old one,
    // so a long TTL cannot serve a stale picture.
    minimumCacheTTL: 31_536_000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  async headers() {
    return [
      {
        // Everything, including API routes and static assets.
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
