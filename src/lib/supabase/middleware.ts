import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const STAFF_ROLES = new Set(["admin", "staff", "production"]);
const CART_SESSION_COOKIE = "cart_session";
const CART_SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

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
