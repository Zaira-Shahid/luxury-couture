import Link from "next/link";

import { siteConfig } from "@/lib/config/site";
import { getAuthUser } from "@/lib/auth/session";
import { getCurrentBanner } from "@/lib/admin/get-banners";
import { getCartItemCount } from "@/lib/cart/get-cart";
import { getSiteSettings } from "@/lib/settings/get-site-settings";
import { getUnreadNotificationCount } from "@/lib/notifications/get-notifications";

import { AnnouncementBar } from "./announcement-bar";

export async function SiteHeader() {
  const [user, settings, cartCount, banner, unreadCount] = await Promise.all([
    getAuthUser(),
    getSiteSettings(),
    getCartItemCount(),
    getCurrentBanner(),
    // Module 27: returns 0 for a signed-out visitor without querying, so
    // this costs nothing on the pages most people see.
    getUnreadNotificationCount(),
  ]);

  return (
    <>
      {banner ? <AnnouncementBar text={banner.text} linkUrl={banner.link_url} /> : null}
      <header className="border-b border-border bg-background">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center font-heading text-xl tracking-wide">
            {settings.branding.logoUrl ? (
              // Stays a plain <img> after Module 20's image pass: the logo
              // is intrinsically sized (h-8 w-auto) with an aspect ratio we
              // don't know ahead of time, so it fits neither next/image's
              // `fill` (needs a sized parent) nor explicit width/height.
              // StorefrontImage is for fixed-ratio content images instead.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.branding.logoUrl} alt={siteConfig.name} className="h-8 w-auto" />
            ) : (
              siteConfig.name
            )}
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <Link href="/collections" className="transition-colors hover:text-foreground">
              Collections
            </Link>
            <Link href="/builder" className="transition-colors hover:text-foreground">
              Design Your Own
            </Link>
            <Link href="/consultations" className="transition-colors hover:text-foreground">
              Book a Consultation
            </Link>
            <Link href="/contact" className="transition-colors hover:text-foreground">
              Contact
            </Link>
            <Link href="/cart" className="transition-colors hover:text-foreground">
              Cart{cartCount > 0 ? ` (${cartCount})` : ""}
            </Link>
            {user ? (
              <Link href="/account" className="transition-colors hover:text-foreground">
                My account
                {unreadCount > 0 ? (
                  <span
                    className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-medium text-background"
                    aria-label={`${unreadCount} unread notifications`}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            ) : (
              <>
                <Link href="/login" className="transition-colors hover:text-foreground">
                  Sign in
                </Link>
                <Link href="/register" className="transition-colors hover:text-foreground">
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
