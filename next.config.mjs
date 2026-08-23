// Supabase Storage is the only host we optimize images from. Derived from
// the env var rather than hardcoded so a different Supabase project (a
// staging branch, a fresh deploy) works without editing this file; the
// literal stays as the fallback for tooling that evaluates the config
// without .env loaded. Anything served from another host renders through
// StorefrontImage's plain-<img> fallback instead of throwing.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "cmskqksbumvastgoacmu.supabase.co";

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
};

export default nextConfig;
