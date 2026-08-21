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
