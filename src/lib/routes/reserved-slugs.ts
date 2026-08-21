/**
 * Every top-level path the app itself owns.
 *
 * CMS pages live at the root (`/about`), so this list has two jobs and
 * both must agree — which is why it lives in one dependency-free module
 * rather than being written twice:
 *
 *  1. `lib/validations/content.ts` rejects these as page slugs, so an
 *     admin can't create a page the router will never reach.
 *  2. `lib/supabase/middleware.ts` skips them when deciding whether an
 *     unknown root path should 404, so a real route is never 404'd by the
 *     CMS existence check.
 *
 * Deliberately free of imports: middleware runs on the Edge runtime, and
 * pulling in zod (or anything else) through this file would bloat it.
 */
export const RESERVED_ROOT_SLUGS = [
  // Storefront
  "products",
  "collections",
  "builder",
  "cart",
  "checkout",
  "contact",
  "consultations",
  "blog",
  "faq",
  "unsubscribe",
  // Auth
  "login",
  "register",
  "logout",
  "auth",
  "forgot-password",
  "reset-password",
  // Authenticated areas
  "account",
  "admin",
  // Infrastructure
  "api",
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
  "opengraph-image",
  "manifest.json",
  "_next",
] as const;

const RESERVED_SET = new Set<string>(RESERVED_ROOT_SLUGS);

export function isReservedRootSlug(slug: string): boolean {
  return RESERVED_SET.has(slug.toLowerCase());
}
