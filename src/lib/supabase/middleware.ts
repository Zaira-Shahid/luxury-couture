import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { isReservedRootSlug } from "@/lib/routes/reserved-slugs";

// Module 26: the coarse "may reach the admin shell at all" gate, now
// covering every admin role rather than the original three. It is only a
// gate on the shell -- which screens a role may actually use is decided
// by the per-route permission checks and RLS underneath. permissions.ts
// is import-free, so it is safe on the Edge runtime.
const STAFF_ROLES = new Set<string>(ADMIN_ROLES);
const CART_SESSION_COOKIE = "cart_session";
const CART_SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

/**
 * A genuine 404 response, built without depending on the app's compiled
 * (content-hashed) CSS bundle — middleware runs on the Edge runtime and
 * can't render the app's React not-found.tsx. Same copy, inline styles
 * standing in for the Tailwind classes used there.
 */
function notFoundResponse(): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Page not found</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; background: #faf9f6; color: #1a1a1a; display: flex; min-height: 100vh; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 1rem; margin: 0; padding: 1rem; }
  p.eyebrow { font-size: 0.75rem; letter-spacing: 0.3em; text-transform: uppercase; color: #6b6b6b; margin: 0; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: 2.25rem; margin: 0; }
  p.desc { max-width: 28rem; color: #6b6b6b; margin: 0; }
  a.btn { display: inline-block; margin-top: 0.5rem; padding: 0.5rem 1.25rem; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 0.5rem; font-size: 0.875rem; }
</style></head>
<body>
  <p class="eyebrow">404</p>
  <h1>Page not found</h1>
  <p class="desc">The page you're looking for doesn't exist or may have been moved.</p>
  <a class="btn" href="/">Return home</a>
</body></html>`;
  return new NextResponse(html, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth token if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAccountRoute = pathname.startsWith("/account");
  const isAdminRoute = pathname.startsWith("/admin");
  // Checkout's own page-level redirect() still works (defense in depth,
  // same as every other protected route), but on its own it produces a
  // 200 + client-side redirect rather than a clean 307 — PageTransition
  // (a client component wrapping every (storefront) page) forces the
  // response to start streaming before the page's async redirect() can
  // run. Gating it in middleware, like /account and /admin already are,
  // is what actually makes it a real HTTP redirect.
  const isCheckoutRoute = pathname.startsWith("/checkout") && !pathname.startsWith("/checkout/confirmed");

  if ((isAccountRoute || isAdminRoute || isCheckoutRoute) && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAdminRoute && user) {
    // Middleware runs on the Edge runtime with only the anon key — re-check
    // role server-side (RLS-protected read of the caller's own row), never
    // trust a client-supplied role.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !STAFF_ROLES.has(profile.role)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // notFound() thrown from within page/layout rendering produces a 200
  // with a client-side-handled redirect in this Next.js version, for any
  // route — confirmed by isolated testing (no client-component wrapper,
  // no PageTransition, force-dynamic, layout- and page-level notFound()
  // all still returned 200). There's no data-leak risk either way (RLS
  // already governs what's included), but these 3 public storefront
  // pages are the ones worth a genuine 404 for SEO/crawler correctness —
  // account/admin pages sit behind auth and aren't crawled. The existing
  // page-level notFound() calls stay as defense in depth for anything
  // that reaches the page without going through middleware (unlikely,
  // but matches the pattern used for auth elsewhere in this file).
  const productSlugMatch = pathname.match(/^\/products\/([^/]+)$/);
  if (productSlugMatch) {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("slug", productSlugMatch[1])
      .eq("status", "published")
      .maybeSingle();
    if (!data) return notFoundResponse();
  }

  const collectionSlugMatch = pathname.match(/^\/collections\/([^/]+)$/);
  if (collectionSlugMatch) {
    const { data } = await supabase
      .from("collections")
      .select("id")
      .eq("slug", collectionSlugMatch[1])
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return notFoundResponse();
  }

  // Module 20 added two more public, crawlable dynamic routes, so they
  // need the same treatment as products/collections above.
  const blogSlugMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (blogSlugMatch) {
    const { data } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", blogSlugMatch[1])
      .eq("status", "published")
      .maybeSingle();
    if (!data) return notFoundResponse();
  }

  // Root-level CMS pages ((storefront)/[slug]). This is the lowest-priority
  // route in the app, so an unmatched root path must 404 rather than
  // soft-404 — an unknown URL returning 200 is exactly what Google flags.
  // Real app routes are skipped via the shared reserved list, so this can
  // only ever 404 paths nothing else claims.
  const rootSlugMatch = pathname.match(/^\/([^/]+)$/);
  if (rootSlugMatch && !isReservedRootSlug(rootSlugMatch[1])) {
    const { data } = await supabase
      .from("pages")
      .select("id")
      .eq("slug", rootSlugMatch[1])
      .eq("status", "published")
      .maybeSingle();
    if (!data) return notFoundResponse();
  }

  const orderNumberMatch = pathname.match(/^\/checkout\/confirmed\/([^/]+)$/);
  if (orderNumberMatch) {
    // orders' RLS (owner-or-admin) applies here too — a non-owner and a
    // truly nonexistent order number produce the identical "not found"
    // outcome, which is the correct, non-enumerable behavior.
    const { data } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", orderNumberMatch[1])
      .maybeSingle();
    if (!data) return notFoundResponse();
  }

  // Ensures the cart-session cookie exists before any Server Component
  // ever reads it. Server Components can't call cookies().set() during
  // their own render (only Server Actions/Route Handlers can) — without
  // this, a first-time visitor's first request to a page that reads the
  // cart (e.g. the header, /cart, /checkout) would throw. Middleware is
  // the one place that can set a cookie ahead of that render.
  if (!request.cookies.get(CART_SESSION_COOKIE)) {
    supabaseResponse.cookies.set(CART_SESSION_COOKIE, crypto.randomUUID(), {
      maxAge: CART_SESSION_MAX_AGE,
      sameSite: "lax",
      path: "/",
    });
  }

  return supabaseResponse;
}
